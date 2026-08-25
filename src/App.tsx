import { useState, useRef, useEffect } from "react";
import ClaimTracking from "./ClaimTracking";
import vehicleLookup from "./vehicleLookup.json";

/**
 * `insurance_data.vehicle`, normalised at build time: the raw jsonb carries
 * several aliases per fact (registration/reg_no, cc/engine_capacity, ...), so
 * vehicleLookup.json collapses each set to one canonical key. Keys stay optional
 * because the raw blob is schema-less and empty values are omitted.
 */
type Vehicle = {
  registrationNumber: string;
  make: string;
  model: string;
  yearOfManufacture: number;
  bodyType?: string;
  motorClass?: string;
  vehicleClass?: string;
  engineCc?: string;
  engineNumber?: string;
  chassisNumber?: string;
  seatingCapacity?: string;
  tonnage?: string;
  sumInsured?: number;
};

/** `insurance_data.client`, trimmed to what the FNOL form consumes. */
type Client = {
  name?: string;
  idNumber?: string;
  gender?: string;
  email?: string;
  phone?: string;
};

/** Resolved from `user` via `draftquote.draft_quote_user_id`. */
type Intermediary = {
  name: string;
  code?: string;
  email?: string;
  phone?: string;
};

type VehicleRecord = {
  quoteRef: string;
  sourceOrigin: "on-portal" | "off-portal";
  vehicle: Vehicle;
  client: Client;
  intermediary: Intermediary;
};

const LOOKUP = vehicleLookup as unknown as {
  autosuggest: {
    placeholder: string;
    helperText: string;
    emptyText: string;
    minChars: number;
    maxSuggestions: number;
  };
  records: VehicleRecord[];
};

/** Normalise for matching: "kdq 089-k" and "KDQ089K" are the same plate. */
const normPlate = (v: string | undefined) => (v ?? "").toUpperCase().replace(/[\s-]/g, "");

function searchVehicles(query: string): VehicleRecord[] {
  const needle = normPlate(query);
  if (needle.length < LOOKUP.autosuggest.minChars) return [];
  return LOOKUP.records
    .filter(
      (r) =>
        normPlate(r.vehicle.registrationNumber).includes(needle) ||
        normPlate(r.vehicle.make).includes(needle) ||
        normPlate(r.vehicle.model).includes(needle) ||
        normPlate(r.client.name ?? "").includes(needle),
    )
    .slice(0, LOOKUP.autosuggest.maxSuggestions);
}

const EMPTY_VEHICLE = { registrationNumber: "", make: "", model: "", yearOfManufacture: "" };
const EMPTY_INTERMEDIARY = { name: "", code: "", phone: "", email: "" };
const EMPTY_INSURED = { name: "", idNumber: "", dateOfBirth: "", dlNumber: "", licenseAcquiredDate: "" };
const EMPTY_DRIVER = { name: "", idNumber: "", dateOfBirth: "", dlNumber: "", licenseAcquiredDate: "" };
const EMPTY_COMBINED_DOC: CombinedDoc = { id: "combined", file: null, tags: [] };

type PartyTab = "intermediary" | "insured" | "driver";
type DriverRelation = "self" | "other" | "";

function driverFromInsured(insured: typeof EMPTY_INSURED) {
  return {
    name: insured.name,
    idNumber: insured.idNumber,
    dateOfBirth: insured.dateOfBirth,
    dlNumber: insured.dlNumber,
    licenseAcquiredDate: insured.licenseAcquiredDate,
  };
}

const KES = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
const titleCase = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

function recordDetailRows(r: VehicleRecord): { label: string; value: string }[] {
  const { vehicle: v, client: c } = r;
  const pairs: [string, string | number | undefined][] = [
    ["Engine CC", v.engineCc],
    ["Engine No.", v.engineNumber],
    ["Chassis No.", v.chassisNumber],
    ["Class", v.motorClass && titleCase(v.motorClass)],
    ["Sum Insured", v.sumInsured != null ? KES.format(v.sumInsured) : undefined],
    ["Insured Phone", c.phone],
    ["Insured Email", c.email],
  ];
  return pairs
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([label, value]) => ({ label, value: String(value) }));
}

type ClaimType = "Normal" | "Partial Theft" | "Total Loss" | "Windscreen" | "";

/**
 * Accident locations come from OpenStreetMap via Photon, which needs no API key
 * (unlike Google Places) and is built for search-as-you-type. Results are biased
 * to Kenya's bounding box and filtered to KE, and each carries its coordinates.
 *
 * The komoot instance is a free public service on fair-use terms - fine for this
 * volume, but a production rollout should self-host Photon or move to a paid
 * OSM provider. Nothing else changes: only PHOTON_ENDPOINT would.
 */
const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";
const KENYA_BBOX = "33.9,-4.7,41.9,5.5";

type Place = {
  id: string;
  /** What the user picked, e.g. "Westlands". */
  name: string;
  /** Where it sits, e.g. "Nairobi, Kenya". */
  context: string;
  lat: number;
  lon: number;
  county: string;
};

type PhotonFeature = {
  properties: Record<string, string | undefined> & { osm_id?: number | string };
  geometry: { coordinates: [number, number] };
};

function toPlace(f: PhotonFeature): Place | null {
  const p = f.properties ?? {};
  const [lon, lat] = f.geometry?.coordinates ?? [];
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  const name = p.name || p.street || p.city || p.state;
  if (!name) return null;
  // In Photon's Kenyan data `state` is the county (Nairobi, Mombasa) and `county`
  // is the sub-county (Nairobi City, Mvita), so `state` wins. A result that IS a
  // county boundary carries neither and names itself.
  const county = p.state || (p.type === "state" ? p.name : "") || p.county || p.city || "";
  const context = [p.district, p.city, p.state, p.country]
    .filter((v, i, arr) => v && v !== name && arr.indexOf(v) === i)
    .join(", ");
  return {
    id: `${p.osm_type ?? ""}${p.osm_id ?? ""}-${lat},${lon}`,
    name,
    context,
    lat,
    lon,
    county,
  };
}

async function searchPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const url = `${PHOTON_ENDPOINT}?q=${encodeURIComponent(query)}&limit=8&bbox=${KENYA_BBOX}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Location search failed (${res.status})`);
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  return (data.features ?? [])
    .filter((f) => (f.properties?.countrycode ?? "KE") === "KE")
    .map(toPlace)
    .filter((p): p is Place => p !== null)
    .filter((p) => {
      // Photon repeats the same spot at different zoom levels; keep the first.
      const key = `${p.name}|${p.context}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

type VehicleLocation =
  | ""
  | "SanlamAllianz Assessment Centre"
  | "Panel Garage"
  | "Non-Panel Garage"
  | "Other";

const VEHICLE_LOCATIONS: Exclude<VehicleLocation, "">[] = [
  "SanlamAllianz Assessment Centre",
  "Panel Garage",
  "Non-Panel Garage",
  "Other",
];

/** Short hint under each option so the user picks correctly the first time. */
const VEHICLE_LOCATION_HINTS: Record<Exclude<VehicleLocation, "">, string> = {
  "SanlamAllianz Assessment Centre": "Vehicle is at our own assessment centre",
  "Panel Garage": "One of our approved repair partners",
  "Non-Panel Garage": "Any other garage - tell us which county",
  Other: "Still at your office or home",
};

/**
 * Approved panel garages and the counties they have branches in. A single-branch
 * garage fixes the county outright; a multi-branch one still needs the user to
 * say which branch holds the vehicle. Stands in for the garage directory API.
 */
const PANEL_GARAGES: Record<string, string[]> = {
  "Flip Test garage": ["Nairobi", "Kisumu", "Nakuru"],
  Titanic: ["Mombasa"],
  "Stantech Motors Garage": ["Nairobi"],
  "Dubai Ndogo": ["Nairobi", "Eldoret"],
};

const PANEL_GARAGE_NAMES = Object.keys(PANEL_GARAGES);

const OTHER_LOCATIONS = ["Office", "Home"];

const TOWING_AGENTS = ["Murray Towing Service", "Other"];

const KENYA_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu",
  "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa",
  "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi",
  "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
];



const CLAIM_SUBTYPES: Record<Exclude<ClaimType, "">, string[]> = {
  Normal: ["Collision with Another Vehicle", "Collision with Stationary Object", "Rollover", "Single-Vehicle Accident"],
  "Partial Theft": ["Wheels / Rims", "Battery", "Side Mirrors", "Radio / Infotainment", "Number Plates"],
  "Total Loss": ["Beyond Economic Repair (BER)", "Full Theft (Unrecovered)", "Fire Damage"],
  Windscreen: ["Windscreen Only", "Windscreen + Other Glass Panels"],
};

type DocKey = "kyc" | "policeAbstract" | "drivingLicence" | "claimForm";
const DOC_LABELS: Record<DocKey, string> = {
  kyc: "KYC Document",
  policeAbstract: "Police Abstract",
  drivingLicence: "Driving Licence",
  claimForm: "Claim Form",
};

/**
 * What a single uploaded file can be tagged as containing. One scanned PDF often
 * holds several of these, so the tags are a multi-select rather than one type.
 */
const DOC_TAGS = ["Copy of Log Book", "Police Abstract", "Claim Form", "Driving Licence"] as const;
type DocTag = (typeof DOC_TAGS)[number];

type CombinedDoc = { id: string; file: File | null; tags: DocTag[] };

/** Cannot submit without these two, however they arrive. */
const REQUIRED_TAGS: DocTag[] = ["Police Abstract", "Driving Licence"];

/** Maps a required tag to the single-purpose slot that also satisfies it. */
const TAG_TO_DOC_KEY: Partial<Record<DocTag, DocKey>> = {
  "Police Abstract": "policeAbstract",
  "Driving Licence": "drivingLicence",
  "Claim Form": "claimForm",
};

/** Reverse of the above, so an upload slot knows which requirement it answers. */
const DOC_KEY_TO_TAG: Partial<Record<DocKey, DocTag>> = {
  policeAbstract: "Police Abstract",
  drivingLicence: "Driving Licence",
  claimForm: "Claim Form",
};

/** A requirement is met by its own upload slot or by any combined file tagged with it. */
function isTagSatisfied(tag: DocTag, docs: Record<DocKey, File | null>, combined: CombinedDoc[]) {
  const key = TAG_TO_DOC_KEY[tag];
  if (key && docs[key]) return true;
  return combined.some((c) => c.file && c.tags.includes(tag));
}

const STEPS = [
  { label: "Vehicle & Party", desc: "Car details and contact" },
  { label: "Incident", desc: "Date, claim type and circumstances" },
  { label: "Location & Docs", desc: "Where it is and uploads" },
];

function FileDropZone({ label, docKey, file, onChange, required, invalid }: {
  label: string;
  docKey: DocKey;
  file: File | null;
  onChange: (key: DocKey, file: File | null) => void;
  required?: boolean;
  invalid?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onChange(docKey, f);
  };

  return (
    <div
      className={`relative rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer group
        ${dragging
          ? "border-blue-400 bg-blue-50"
          : file
            ? "border-green-400 bg-green-50"
            : invalid
              ? "border-red-300 bg-red-50/50 hover:border-red-400"
              : "border-blue-200 hover:border-blue-400 bg-blue-50/40 hover:bg-blue-50"}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => onChange(docKey, e.target.files?.[0] ?? null)} />
      <div className="px-3 py-3 flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors
          ${file ? "bg-green-100" : "bg-blue-100 group-hover:bg-blue-200"}`}>
          {file ? (
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold leading-tight flex items-center flex-wrap gap-1.5
            ${file ? "text-green-700" : invalid ? "text-red-600" : "text-blue-900"}`}>
            <span>
              {label}
              {required && <span className={invalid ? "text-red-500 ml-0.5" : "text-blue-400 ml-0.5"}>*</span>}
            </span>
            {required && !file && (
              <span className={`normal-case tracking-normal text-[10px] font-semibold uppercase rounded px-1.5 py-0.5
                ${invalid ? "text-red-600 bg-red-100" : "text-blue-500 bg-blue-100"}`}>
                Required
              </span>
            )}
          </p>
          <p className={`text-xs truncate mt-0.5 ${invalid && !file ? "text-red-400" : "text-blue-400"}`}>
            {file ? file.name : "Click or drag to upload"}
          </p>
        </div>
        {file && (
          <button className="shrink-0 text-blue-300 hover:text-red-400 transition-colors p-1"
            onClick={(e) => { e.stopPropagation(); onChange(docKey, null); }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-blue-100 bg-blue-50/40 p-4 sm:p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-blue-900">{title}</h3>
        <p className="text-xs text-blue-400 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Label({ children, required, locked }: { children: React.ReactNode; required?: boolean; locked?: boolean }) {
  return (
    <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${locked ? "text-slate-400" : "text-blue-700"}`}>
      {children}{required && <span className={locked ? "text-slate-300 ml-0.5" : "text-blue-400 ml-0.5"}>*</span>}
    </label>
  );
}

function Input({ locked, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { locked?: boolean }) {
  return (
    <input {...props}
      readOnly={locked || props.readOnly}
      aria-readonly={locked || undefined}
      tabIndex={locked ? -1 : props.tabIndex}
      className={`w-full border rounded-lg px-3 py-2.5 text-sm transition-all duration-150
        ${locked
          ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed select-none"
          : "bg-white border-blue-200 text-blue-900 placeholder-blue-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}
        ${className ?? ""}`} />
  );
}

function RegistrationAutosuggest({ value, locked, onChange, onSelect, onClear }: {
  value: string;
  locked: boolean;
  onChange: (v: string) => void;
  onSelect: (record: VehicleRecord) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = locked ? [] : searchVehicles(value);
  const showList = open && !locked && value.trim().length >= LOOKUP.autosuggest.minChars;

  useEffect(() => setHighlight(0), [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const choose = (record: VehicleRecord) => { onSelect(record); setOpen(false); };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); choose(results[highlight]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          locked={locked}
          placeholder={LOOKUP.autosuggest.placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          aria-controls="reg-listbox"
          aria-activedescendant={showList && results.length > 0 ? `reg-option-${highlight}` : undefined}
          className={locked ? "pr-9" : "pl-9 pr-3"}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          required
        />
        {!locked && (
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.4a7.25 7.25 0 11-14.5 0 7.25 7.25 0 0114.5 0z" />
          </svg>
        )}
        {locked && (
          <button type="button" onClick={onClear} title="Clear and search again"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <p className={`text-xs mt-1.5 ${locked ? "text-slate-400" : "text-blue-400"}`}>
        {locked ? "Vehicle matched. Clear to search another registration." : LOOKUP.autosuggest.helperText}
      </p>

      {showList && (
        <ul id="reg-listbox" role="listbox" aria-label="Matching vehicles"
          className="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-xl border border-blue-200 bg-white shadow-xl shadow-blue-900/15">
          {results.length === 0 ? (
            <li className="px-3 py-4 text-xs text-blue-300 text-center">{LOOKUP.autosuggest.emptyText}</li>
          ) : (
            <>
              {results.map((r, i) => (
                <li key={r.quoteRef} id={`reg-option-${i}`} role="option" aria-selected={i === highlight}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => { e.preventDefault(); choose(r); }}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-blue-50 last:border-b-0 transition-colors
                    ${i === highlight ? "bg-blue-50" : "bg-white"}`}>
                  <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-colors
                    ${i === highlight ? "bg-blue-600" : "bg-blue-100"}`}>
                    <svg className={`w-4 h-4 ${i === highlight ? "text-white" : "text-blue-500"}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-bold text-blue-900 font-mono tracking-tight">{r.vehicle.registrationNumber}</span>
                      <span className="text-xs font-semibold text-blue-400 shrink-0 tabular-nums">{r.vehicle.yearOfManufacture}</span>
                    </div>
                    <p className="text-xs text-blue-600 truncate mt-0.5">{r.vehicle.make} {r.vehicle.model}</p>
                    <p className="text-xs text-blue-300 truncate">{r.client.name ?? "—"} · {r.intermediary.name}</p>
                  </div>
                </li>
              ))}
              <li className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-blue-300 bg-blue-50/60 border-t border-blue-100">
                {results.length} of {LOOKUP.records.length} vehicles on record
              </li>
            </>
          )}
        </ul>
      )}
    </div>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select {...props}
      className={`w-full bg-white border border-blue-200 rounded-lg px-3 py-2.5 text-sm text-blue-900
        focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-150 appearance-none ${props.className ?? ""}`}>
      {props.children}
    </select>
  );
}
/** Select plus its chevron - the pairing was duplicated at every call site. */
function SelectField({ value, onChange, placeholder, options, required, invalid, id }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: readonly string[];
  required?: boolean;
  invalid?: boolean;
  id?: string;
}) {
  return (
    <div className="relative">
      <Select id={id} value={value} required={required} aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={invalid ? "border-red-300 focus:border-red-500 focus:ring-red-100" : ""}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </Select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <svg className={`w-3.5 h-3.5 ${invalid ? "text-red-400" : "text-blue-400"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Children revealed by a parent choice sit inside this rail so it stays obvious
 * they belong to the field above rather than reading as new top-level questions.
 */
function RevealGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative pl-3 flex flex-col gap-3" style={{ animation: "slideIn 0.18s ease" }}>
      <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-blue-200" aria-hidden="true" />
      {children}
    </div>
  );
}

/** 47 counties is too many for a plain select, so this filters as you type. */
function CountyPicker({ value, onChange, invalid }: {
  value: string; onChange: (v: string) => void; invalid?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const needle = query.trim().toLowerCase();
  const results = needle ? KENYA_COUNTIES.filter((c) => c.toLowerCase().includes(needle)) : KENYA_COUNTIES;

  useEffect(() => setHighlight(0), [query]);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const choose = (c: string) => { onChange(c); setQuery(""); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); choose(results[highlight]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          value={open ? query : value}
          placeholder={value || "Search county..."}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          className={`w-full bg-white border rounded-lg pl-9 pr-3 py-2.5 text-sm transition-all duration-150
            focus:outline-none focus:ring-2
            ${invalid
              ? "border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-100"
              : "border-blue-200 text-blue-900 placeholder-blue-300 focus:border-blue-500 focus:ring-blue-100"}`}
        />
        <svg className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${invalid ? "text-red-300" : "text-blue-300"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.4a7.25 7.25 0 11-14.5 0 7.25 7.25 0 0114.5 0z" />
        </svg>
      </div>

      {open && (
        <ul role="listbox" aria-label="Counties"
          className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-lg border border-blue-200 bg-white shadow-lg shadow-blue-900/10">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-xs text-blue-300 text-center">No county matches "{query}"</li>
          ) : (
            results.map((c, i) => (
              <li key={c} role="option" aria-selected={c === value}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(c); }}
                className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between
                  ${i === highlight ? "bg-blue-50 text-blue-900" : "text-blue-700"}`}>
                {c}
                {c === value && (
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Accident location search over OpenStreetMap. Captures coordinates alongside the
 * name, and falls back to whatever the user typed if the lookup is unreachable -
 * a network problem should never block reporting a claim.
 */
function AccidentLocationPicker({ value, place, onChange, onSelect, invalid }: {
  value: string;
  place: Place | null;
  onChange: (v: string) => void;
  onSelect: (p: Place | null) => void;
  invalid?: boolean;
}) {
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (place || q.length < 3) { setResults([]); setLoading(false); setFailed(false); return; }

    const controller = new AbortController();
    setLoading(true);
    // Photon is a shared public instance; debounce so typing is not a flood.
    const timer = setTimeout(() => {
      searchPlaces(q, controller.signal)
        .then((r) => { setResults(r); setFailed(false); setHighlight(0); })
        .catch((err) => { if (err.name !== "AbortError") { setResults([]); setFailed(true); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 350);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, place]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const choose = (p: Place) => {
    onSelect(p);
    onChange(p.context ? `${p.name}, ${p.context}` : p.name);
    setOpen(false);
  };

  const clear = () => { onSelect(null); onChange(""); setResults([]); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); choose(results[highlight]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const showList = open && !place && value.trim().length >= 3;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          value={value}
          placeholder="Search a place, road or landmark..."
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(e) => { if (place) onSelect(null); onChange(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          className={`w-full bg-white border rounded-lg pl-9 py-2.5 text-sm transition-all duration-150
            focus:outline-none focus:ring-2 ${place ? "pr-9" : "pr-3"}
            ${invalid
              ? "border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-100"
              : "border-blue-200 text-blue-900 placeholder-blue-300 focus:border-blue-500 focus:ring-blue-100"}`}
        />
        <svg className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${invalid ? "text-red-300" : "text-blue-300"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
        {place && (
          <button type="button" onClick={clear} aria-label="Clear location"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {place ? (
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {place.county && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-100 rounded px-1.5 py-0.5">
              {place.county}
            </span>
          )}
          <span className="text-xs font-mono text-blue-400 tabular-nums">
            {place.lat.toFixed(5)}, {place.lon.toFixed(5)}
          </span>
        </div>
      ) : failed ? (
        <p className="text-xs text-amber-600 mt-1.5">
          Location search is unreachable. Your typed description is kept, but without coordinates.
        </p>
      ) : (
        <p className={`text-xs mt-1.5 ${invalid ? "text-red-500" : "text-blue-400"}`}>
          Type 3+ characters. Picking a result captures its coordinates.
        </p>
      )}

      {showList && (
        <ul role="listbox" aria-label="Matching places"
          className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-blue-200 bg-white shadow-lg shadow-blue-900/10">
          {loading ? (
            <li className="px-3 py-3 text-xs text-blue-300 text-center">Searching OpenStreetMap...</li>
          ) : failed ? (
            <li className="px-3 py-3 text-xs text-amber-600 text-center">Search unavailable - type the location instead.</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-3 text-xs text-blue-300 text-center">No place matches "{value.trim()}"</li>
          ) : (
            <>
              {results.map((p, i) => (
                <li key={p.id} role="option" aria-selected={i === highlight}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => { e.preventDefault(); choose(p); }}
                  className={`px-3 py-2 cursor-pointer border-b border-blue-50 last:border-b-0 ${i === highlight ? "bg-blue-50" : "bg-white"}`}>
                  <p className="text-sm font-semibold text-blue-900 truncate">{p.name}</p>
                  {p.context && <p className="text-xs text-blue-400 truncate mt-0.5">{p.context}</p>}
                </li>
              ))}
              <li className="px-3 py-1.5 text-[10px] text-blue-300 bg-blue-50/60 border-t border-blue-100 text-center">
                Results © OpenStreetMap contributors
              </li>
            </>
          )}
        </ul>
      )}
    </div>
  );
}

/** Two-option choice. Pills rather than a select: both options stay visible. */
function ChoicePills({ value, onChange, options, name }: {
  value: string; onChange: (v: string) => void; options: readonly string[]; name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const active = value === o;
        return (
          <button key={o} type="button" role="radio" aria-checked={active} onClick={() => onChange(o)}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-semibold transition-all duration-150
              ${active
                ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm shadow-blue-100"
                : "border-blue-200 bg-white text-blue-500 hover:border-blue-300 hover:bg-blue-50/60"}`}>
            <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0
              ${active ? "border-blue-600" : "border-blue-300"}`}>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
            </span>
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** A Yes/No question as the same radio-pill control used for Driven/Towed and Office/Home. */
/** A quick yes/no tap: plain radio dot + text, label and choice on one row - no button box. */
function YesNoField({ label, hint, value, onChange }: {
  label: string; hint: string; value: boolean | null; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <Label required>{label}</Label>
        <p className="text-xs text-blue-400 leading-relaxed">{hint}</p>
      </div>
      <div role="radiogroup" aria-label={label} className="flex items-center gap-4 shrink-0">
        {(["Yes", "No"] as const).map((opt) => {
          const active = value === (opt === "Yes");
          return (
            <button key={opt} type="button" role="radio" aria-checked={active}
              onClick={() => onChange(opt === "Yes")}
              className={`flex items-center gap-1.5 px-1 py-2 text-sm font-semibold transition-colors
                ${active ? "text-blue-700" : "text-blue-400 hover:text-blue-600"}`}>
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                ${active ? "border-blue-600" : "border-blue-300"}`}>
                {active && <span className="w-2 h-2 rounded-full bg-blue-600" />}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "Contains" control: one file can hold several documents, so tags multi-select. */
function TagMultiSelect({ selected, onToggle, invalid }: {
  selected: DocTag[]; onToggle: (t: DocTag) => void; invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const summary = selected.length === 0
    ? "Select what this file contains"
    : selected.length <= 2 ? selected.join(", ") : `${selected.length} documents selected`;

  return (
    <div ref={wrapRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox" aria-expanded={open} aria-invalid={invalid || undefined}
        className={`w-full flex items-center justify-between gap-2 bg-white border rounded-lg px-3 py-2.5 text-sm text-left transition-all duration-150
          focus:outline-none focus:ring-2
          ${invalid
            ? "border-red-300 focus:border-red-500 focus:ring-red-100"
            : "border-blue-200 focus:border-blue-500 focus:ring-blue-100"}`}>
        <span className={`truncate ${selected.length ? "text-blue-900" : invalid ? "text-red-400" : "text-blue-300"}`}>
          {summary}
        </span>
        <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""} ${invalid ? "text-red-400" : "text-blue-400"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul role="listbox" aria-multiselectable="true" aria-label="Document contents"
          className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-blue-200 bg-white shadow-lg shadow-blue-900/10 overflow-hidden">
          {DOC_TAGS.map((tag) => {
            const checked = selected.includes(tag);
            return (
              <li key={tag} role="option" aria-selected={checked}
                onMouseDown={(e) => { e.preventDefault(); onToggle(tag); }}
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-blue-50 border-b border-blue-50 last:border-b-0">
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                  ${checked ? "bg-blue-600 border-blue-600" : "bg-white border-blue-300"}`}>
                  {checked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className="text-sm text-blue-900 uppercase tracking-wide text-xs font-semibold">{tag}</span>
                {REQUIRED_TAGS.includes(tag) && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-blue-400">Required</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The one combined file: the upload itself plus what the user says is inside it. */
function CombinedDocRow({ doc, onFile, onToggleTag, onClear, showErrors }: {
  doc: CombinedDoc;
  onFile: (file: File | null) => void;
  onToggleTag: (tag: DocTag) => void;
  onClear: () => void;
  showErrors: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const untagged = showErrors && doc.file !== null && doc.tags.length === 0;

  return (
    <div className="rounded-lg border border-blue-100 bg-white p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-blue-900">Combined Document</p>
        {doc.file && (
          <button type="button" onClick={onClear} aria-label="Clear combined document"
            className="w-7 h-7 rounded-md flex items-center justify-center text-blue-300 hover:text-red-500 hover:bg-red-50 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)} />

      {doc.file ? (
        <div className="flex items-center gap-2.5 rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2">
          <div className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-blue-900 truncate">{doc.file.name}</p>
            <p className="text-xs text-blue-400">{(doc.file.size / 1048576).toFixed(1)} MB · Uploaded</p>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-white transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
            Replace
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2.5 rounded-lg border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/40 hover:bg-blue-50 px-3 py-3 transition-all duration-200 group">
          <div className="w-8 h-8 rounded-md bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center shrink-0 transition-colors">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-blue-900">Upload combined file</p>
            <p className="text-xs text-blue-400 mt-0.5">One PDF or scan holding several documents</p>
          </div>
        </button>
      )}

      {doc.file && (
        <div style={{ animation: "slideIn 0.18s ease" }}>
          <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${untagged ? "text-red-500" : "text-blue-700"}`}>
            Contains<span className={untagged ? "text-red-400 ml-0.5" : "text-blue-400 ml-0.5"}>*</span>
          </label>
          <TagMultiSelect
            selected={doc.tags}
            invalid={untagged}
            onToggle={onToggleTag}
          />
          {untagged && (
            <p role="alert" className="text-xs text-red-500 mt-1.5">
              Tick what this file contains so we can match it against the required documents.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RecordDetail({ record }: { record: VehicleRecord }) {
  const [expanded, setExpanded] = useState(false);
  const rows = recordDetailRows(record);
  const visible = expanded ? rows : rows.slice(0, 4);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-100 border-b border-slate-200">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Policy record</p>
          <p className="text-xs font-mono text-slate-600 truncate">{record.quoteRef}</p>
        </div>
        <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border
          ${record.sourceOrigin === "off-portal"
            ? "text-amber-700 bg-amber-50 border-amber-200"
            : "text-blue-600 bg-blue-50 border-blue-200"}`}>
          {record.sourceOrigin}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-2.5">
        {visible.map(({ label, value }) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="text-xs text-slate-600 truncate" title={value}>{value}</dd>
          </div>
        ))}
      </dl>

      {rows.length > 4 && (
        <button type="button" onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide
            text-slate-400 hover:text-blue-600 hover:bg-white border-t border-slate-200 transition-colors">
          {expanded ? "Show less" : `Show ${rows.length - 4} more`}
          <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}

function StepperHeader({ step, total, furthest, onSelect }: {
  step: number;
  total: number;
  /** Highest step reached so far - anything past it has not been filled yet. */
  furthest: number;
  onSelect: (step: number) => void;
}) {
  return (
    <div className="shrink-0 px-4 sm:px-7 py-4 bg-white border-b border-blue-100">
      <nav aria-label="Form steps" className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          // Jumping ahead of what has been filled would skip required answers.
          const reachable = i <= furthest;
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => reachable && onSelect(i)}
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.label}${reachable ? "" : " (not yet available)"}`}
                title={reachable ? `Go to ${s.label}` : "Finish the current step first"}
                className={`flex items-center gap-2.5 shrink-0 rounded-lg -m-1 p-1 text-left transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1
                  ${reachable ? "cursor-pointer hover:bg-blue-50" : "cursor-not-allowed"}`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200
                  ${done ? "bg-blue-600 text-white" : active ? "bg-blue-600 text-white ring-4 ring-blue-100" : "bg-blue-100 text-blue-400"}`}>
                  {done ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i + 1}
                </span>
                <span className="hidden sm:block">
                  <span className={`block text-xs font-bold leading-tight ${active ? "text-blue-700" : done ? "text-blue-500" : "text-blue-300"}`}>{s.label}</span>
                  <span className={`block text-xs leading-tight ${active ? "text-blue-400" : "text-blue-200"}`}>{s.desc}</span>
                </span>
              </button>
              {i < total - 1 && (
                <div className="flex-1 mx-3 h-px bg-blue-100 relative overflow-hidden">
                  <div className={`absolute inset-y-0 left-0 bg-blue-400 transition-all duration-500 ${done ? "w-full" : "w-0"}`} />
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

function FNOLDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);

  const goToStep = (next: number) => {
    const clamped = Math.max(0, Math.min(next, STEPS.length - 1));
    setStep(clamped);
    setFurthestStep((f) => Math.max(f, clamped));
  };
  const [partyType, setPartyType] = useState<PartyTab>("intermediary");
  const [driverRelation, setDriverRelation] = useState<DriverRelation>("");
  const [driver, setDriver] = useState(EMPTY_DRIVER);
  const [claimType, setClaimType] = useState<ClaimType>("");
  const [claimSubType, setClaimSubType] = useState("");
  const [accidentLocation, setAccidentLocation] = useState("");
  const [accidentPlace, setAccidentPlace] = useState<Place | null>(null);
  const [otherVehiclesInvolved, setOtherVehiclesInvolved] = useState<boolean | null>(null);
  const [tppd, setTppd] = useState<boolean | null>(null);
  const [injuriesFatalities, setInjuriesFatalities] = useState<boolean | null>(null);
  const [vehicleLocation, setVehicleLocation] = useState<VehicleLocation>("");
  const [panelGarage, setPanelGarage] = useState("");
  const [locationCounty, setLocationCounty] = useState("");
  const [otherLocation, setOtherLocation] = useState("");
  const [movement, setMovement] = useState("");
  const [towingAgent, setTowingAgent] = useState("");
  const [towingAgentOther, setTowingAgentOther] = useState("");
  const [combinedDoc, setCombinedDoc] = useState<CombinedDoc>(EMPTY_COMBINED_DOC);
  const [showErrors, setShowErrors] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [vehicle, setVehicle] = useState(EMPTY_VEHICLE);
  const [intermediary, setIntermediary] = useState(EMPTY_INTERMEDIARY);
  const [insured, setInsured] = useState(EMPTY_INSURED);
  const [selectedRecord, setSelectedRecord] = useState<VehicleRecord | null>(null);
  const autofilled = selectedRecord !== null;
  const [docs, setDocs] = useState<Record<DocKey, File | null>>({
    kyc: null, policeAbstract: null, drivingLicence: null, claimForm: null,
  });

  const handleVehicleSelect = (r: VehicleRecord) => {
    setVehicle({
      registrationNumber: r.vehicle.registrationNumber,
      make: r.vehicle.make,
      model: r.vehicle.model,
      yearOfManufacture: String(r.vehicle.yearOfManufacture),
    });
    setIntermediary({
      name: r.intermediary.name,
      code: r.intermediary.code ?? "",
      phone: r.intermediary.phone ?? "",
      email: r.intermediary.email ?? "",
    });
    setInsured({ name: r.client.name ?? "", idNumber: r.client.idNumber ?? "", dateOfBirth: "", dlNumber: "", licenseAcquiredDate: "" });
    setSelectedRecord(r);
    setPartyType("intermediary");
    if (driverRelation === "self") setDriver(driverFromInsured({ name: r.client.name ?? "", idNumber: r.client.idNumber ?? "", dateOfBirth: "", dlNumber: "", licenseAcquiredDate: "" }));
  };

  const handleVehicleClear = () => {
    setVehicle(EMPTY_VEHICLE);
    setIntermediary(EMPTY_INTERMEDIARY);
    setInsured(EMPTY_INSURED);
    setSelectedRecord(null);
    if (driverRelation === "self") setDriver(EMPTY_DRIVER);
  };

  const handleDriverRelationChange = (relation: Exclude<DriverRelation, "">) => {
    setDriverRelation(relation);
    if (relation === "self") {
      setDriver(driverFromInsured(insured));
    } else {
      setDriver(EMPTY_DRIVER);
    }
  };

  useEffect(() => {
    if (driverRelation === "self") {
      setDriver(driverFromInsured(insured));
    }
  }, [insured, driverRelation]);

  const handleDocChange = (key: DocKey, file: File | null) => setDocs((p) => ({ ...p, [key]: file }));
  const handleClaimTypeChange = (type: ClaimType) => { setClaimType(type); setClaimSubType(""); };

  // Changing the location invalidates every answer that hung off the old one.
  const handleVehicleLocationChange = (loc: string) => {
    setVehicleLocation(loc as VehicleLocation);
    setPanelGarage("");
    setLocationCounty("");
    setOtherLocation("");
  };

  /** One branch means the county is already known, so fill it rather than ask. */
  const handlePanelGarageChange = (name: string) => {
    setPanelGarage(name);
    const branches = PANEL_GARAGES[name] ?? [];
    setLocationCounty(branches.length === 1 ? branches[0] : "");
  };

  const handleMovementChange = (m: string) => {
    setMovement(m);
    if (m !== "Towed") { setTowingAgent(""); setTowingAgentOther(""); }
  };

  const handleTowingAgentChange = (a: string) => {
    setTowingAgent(a);
    if (a !== "Other") setTowingAgentOther("");
  };

  const setCombinedFile = (file: File | null) => setCombinedDoc((p) => ({ ...p, file }));

  const toggleCombinedTag = (tag: DocTag) =>
    setCombinedDoc((p) => ({
      ...p,
      tags: p.tags.includes(tag) ? p.tags.filter((t) => t !== tag) : [...p.tags, tag],
    }));

  const clearCombinedDoc = () => setCombinedDoc(EMPTY_COMBINED_DOC);

  const panelBranches = panelGarage ? PANEL_GARAGES[panelGarage] ?? [] : [];
  const countyAutoFilled = vehicleLocation === "Panel Garage" && panelBranches.length === 1;
  const countyNeeded = vehicleLocation === "Panel Garage" || vehicleLocation === "Non-Panel Garage";

  /** Every unmet rule on the final step, phrased as cause + fix. */
  const validationErrors: string[] = [];
  if (!vehicleLocation) validationErrors.push("Choose where the vehicle is now.");
  if (vehicleLocation === "Panel Garage" && !panelGarage) validationErrors.push("Choose which panel garage has the vehicle.");
  if (countyNeeded && !locationCounty) {
    validationErrors.push(
      panelBranches.length > 1
        ? `Choose which ${panelGarage} branch has the vehicle.`
        : "Select the county the garage is in.",
    );
  }
  if (vehicleLocation === "Other" && !otherLocation) validationErrors.push("Choose whether the vehicle is at an office or a home.");
  if (vehicleLocation && !movement) validationErrors.push("Tell us whether the vehicle was driven or towed.");
  if (movement === "Towed" && !towingAgent) validationErrors.push("Select the towing agent.");
  if (movement === "Towed" && towingAgent === "Other" && !towingAgentOther.trim()) validationErrors.push("Enter the towing provider's name.");
  REQUIRED_TAGS.forEach((tag) => {
    if (!isTagSatisfied(tag, docs, [combinedDoc])) validationErrors.push(`Upload the ${tag}, or tick it on a combined file.`);
  });
  if (combinedDoc.file && combinedDoc.tags.length === 0) validationErrors.push("Tick what the combined file contains.");
  if (!driverRelation) validationErrors.push("On Party Details, choose whether the driver was the insured or someone else.");
  if (driverRelation === "self" && !insured.name.trim()) validationErrors.push("Enter the insured name on Direct Insured before selecting Self as driver.");
  if (driverRelation === "self" && !insured.idNumber.trim()) validationErrors.push("Enter the insured ID on Direct Insured before selecting Self as driver.");
  if (driverRelation === "other" && !driver.name.trim()) validationErrors.push("Enter the driver's name.");
  if (driverRelation === "other" && !driver.idNumber.trim()) validationErrors.push("Enter the driver's ID number.");
  if (driverRelation === "other" && !driver.dateOfBirth) validationErrors.push("Enter the driver's date of birth.");
  if (driverRelation === "other" && !driver.dlNumber.trim()) validationErrors.push("Enter the driver's driving licence number.");
  if (driverRelation === "other" && !driver.licenseAcquiredDate) validationErrors.push("Enter when the driving licence was acquired.");

  const handleSubmit = () => {
    if (validationErrors.length > 0) { setShowErrors(true); return; }
    setShowErrors(false);
    setSubmitted(true);
  };

  const handleReset = () => {
    setStep(0); setFurthestStep(0); setClaimType(""); setClaimSubType("");
    setAccidentLocation(""); setAccidentPlace(null);
    setOtherVehiclesInvolved(null); setTppd(null); setInjuriesFatalities(null);
    setVehicleLocation(""); setPanelGarage(""); setLocationCounty(""); setOtherLocation("");
    setMovement(""); setTowingAgent(""); setTowingAgentOther("");
    setCombinedDoc(EMPTY_COMBINED_DOC); setShowErrors(false); setSubmitted(false);
    setDocs({ kyc: null, policeAbstract: null, drivingLicence: null, claimForm: null });
    setDriverRelation(""); setDriver(EMPTY_DRIVER);
  };

  const handleClose = () => { handleReset(); onClose(); };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,40,90,0.55)", backdropFilter: "blur(4px)", animation: "backdropIn 0.18s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="relative w-full flex flex-col rounded-2xl overflow-hidden bg-white"
        style={{
          maxWidth: "900px",
          maxHeight: "88vh",
          boxShadow: "0 28px 72px rgba(30,64,175,0.22), 0 4px 20px rgba(30,64,175,0.12)",
          animation: "fadeIn 0.22s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Dialog header */}
        <div className="shrink-0 bg-blue-700 px-4 sm:px-7 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <p className="text-blue-200 text-xs leading-none">Motor Claims</p>
              <p className="text-white text-base font-bold leading-tight mt-0.5" style={{ fontFamily: "'DM Serif Display', serif" }}>
                First Notice of Loss
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-blue-300 text-xs hidden sm:block">
              Step {step + 1} of {STEPS.length}
            </span>
            <button onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Blue accent strip */}
        <div className="shrink-0 h-0.5 bg-gradient-to-r from-blue-400 via-blue-300 to-blue-500" />

        {/* Stepper */}
        <StepperHeader step={step} total={STEPS.length} furthest={furthestStep} onSelect={goToStep} />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mb-5">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-blue-900 mb-2" style={{ fontFamily: "'DM Serif Display', serif" }}>Claim Submitted</h2>
              <p className="text-blue-400 text-sm leading-relaxed mb-2 max-w-sm">
                Your FNOL has been received. A reference number will be sent to you within 30 minutes.
              </p>
              <p className="text-blue-300 text-xs mb-8">
                Reference: <span className="text-blue-600 font-mono font-semibold">FNOL-{Date.now().toString(36).toUpperCase()}</span>
              </p>
              <div className="flex gap-3">
                <button onClick={handleReset}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                  Submit Another
                </button>
                <button onClick={handleClose}
                  className="px-5 py-2.5 border border-blue-200 text-blue-600 hover:bg-blue-50 text-sm font-semibold rounded-lg transition-colors">
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-7">

              {/* Step 1: Vehicle + Party */}
              {step === 0 && (
                <div className="flex flex-col md:flex-row gap-5" style={{ animation: "slideIn 0.2s ease" }}>
                  <SectionCard title="Vehicle Details" subtitle="Registration and car identification">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Label required locked={autofilled}>Registration Number</Label>
                        <RegistrationAutosuggest
                          value={vehicle.registrationNumber}
                          locked={autofilled}
                          onChange={(v) => setVehicle((p) => ({ ...p, registrationNumber: v }))}
                          onSelect={handleVehicleSelect}
                          onClear={handleVehicleClear}
                        />
                      </div>
                      <div>
                        <Label required locked={autofilled}>Make</Label>
                        <Input placeholder="Toyota" required locked={autofilled} value={vehicle.make}
                          onChange={(e) => setVehicle((p) => ({ ...p, make: e.target.value }))} />
                      </div>
                      <div>
                        <Label required locked={autofilled}>Model</Label>
                        <Input placeholder="Fielder" required locked={autofilled} value={vehicle.model}
                          onChange={(e) => setVehicle((p) => ({ ...p, model: e.target.value }))} />
                      </div>
                      <div className="col-span-2">
                        <Label required locked={autofilled}>Year of Manufacture</Label>
                        <Input placeholder="2019" type={autofilled ? "text" : "number"} min={1980} max={new Date().getFullYear()}
                          required locked={autofilled} value={vehicle.yearOfManufacture}
                          onChange={(e) => setVehicle((p) => ({ ...p, yearOfManufacture: e.target.value }))} />
                      </div>
                    </div>

                    {selectedRecord && <RecordDetail record={selectedRecord} />}
                  </SectionCard>

                  <SectionCard title="Party Details" subtitle="Intermediary, insured, and driver at time of accident">
                    <div className="flex gap-1 p-1 bg-blue-100 rounded-lg">
                      {([
                        { id: "intermediary" as const, label: "Intermediary" },
                        { id: "insured" as const, label: "Direct Insured" },
                        { id: "driver" as const, label: "Driver" },
                      ]).map((tab) => (
                        <button key={tab.id} type="button" onClick={() => setPartyType(tab.id)}
                          className={`flex-1 px-2 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-all duration-150
                            ${partyType === tab.id ? "bg-blue-600 text-white shadow-sm" : "text-blue-500 hover:text-blue-700"}`}>
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {partyType === "intermediary" ? (
                        <>
                          <div>
                            <Label required locked={autofilled}>Intermediary Name</Label>
                            <Input placeholder="Jane Mwangi" required locked={autofilled} value={intermediary.name}
                              onChange={(e) => setIntermediary((p) => ({ ...p, name: e.target.value }))} />
                          </div>
                          <div>
                            <Label required locked={autofilled}>Intermediary Code</Label>
                            <Input placeholder="AG-2024-00142" required locked={autofilled} value={intermediary.code}
                              onChange={(e) => setIntermediary((p) => ({ ...p, code: e.target.value }))} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="min-w-0">
                              <Label locked={autofilled}>Phone</Label>
                              <Input placeholder="0712 345 678" type="tel" locked={autofilled} value={intermediary.phone}
                                onChange={(e) => setIntermediary((p) => ({ ...p, phone: e.target.value }))} />
                            </div>
                            <div className="min-w-0">
                              <Label locked={autofilled}>Email</Label>
                              <Input placeholder="agent@broker.co.ke" type="email" locked={autofilled} value={intermediary.email}
                                onChange={(e) => setIntermediary((p) => ({ ...p, email: e.target.value }))} />
                            </div>
                          </div>
                        </>
                      ) : partyType === "insured" ? (
                        <>
                          <div>
                            <Label required locked={autofilled}>Insured Name</Label>
                            <Input placeholder="John Kamau Njoroge" required locked={autofilled} value={insured.name}
                              onChange={(e) => setInsured((p) => ({ ...p, name: e.target.value }))} />
                          </div>
                          <div>
                            <Label required locked={autofilled}>ID Number</Label>
                            <Input placeholder="12345678" required locked={autofilled} value={insured.idNumber}
                              onChange={(e) => setInsured((p) => ({ ...p, idNumber: e.target.value }))} />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <Label required>Driver at time of accident</Label>
                            <ChoicePills
                              value={driverRelation === "self" ? "Self" : driverRelation === "other" ? "Other" : ""}
                              onChange={(v) => handleDriverRelationChange(v === "Self" ? "self" : "other")}
                              options={["Self", "Other"]}
                              name="Driver at time of accident"
                            />
                            <p className="text-xs text-blue-400 mt-1.5 leading-relaxed">
                              {driverRelation === "self"
                                ? "The insured was driving — no need to re-enter details."
                                : driverRelation === "other"
                                  ? "Someone else was driving. Enter their details below."
                                  : "Choose Self if the insured was driving, or Other if someone else was at the wheel."}
                            </p>
                          </div>
                          {driverRelation === "self" && (
                            <div className="rounded-lg border border-blue-100 bg-white px-3 py-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-400 mb-2">Using insured details</p>
                              <dl className="grid grid-cols-1 gap-2">
                                <div>
                                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">Name</dt>
                                  <dd className="text-sm font-medium text-slate-700">{insured.name.trim() || "— fill on Direct Insured tab"}</dd>
                                </div>
                                <div>
                                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">ID Number</dt>
                                  <dd className="text-sm font-medium text-slate-700">{insured.idNumber.trim() || "— fill on Direct Insured tab"}</dd>
                                </div>
                              </dl>
                            </div>
                          )}
                          {driverRelation === "other" && (
                            <RevealGroup>
                              <div>
                                <Label required>Name</Label>
                                <Input
                                  placeholder="Full name"
                                  required
                                  value={driver.name}
                                  onChange={(e) => setDriver((p) => ({ ...p, name: e.target.value }))}
                                />
                              </div>
                              <div>
                                <Label required>ID Number</Label>
                                <Input
                                  placeholder="National ID"
                                  required
                                  value={driver.idNumber}
                                  onChange={(e) => setDriver((p) => ({ ...p, idNumber: e.target.value }))}
                                />
                                <p className="text-xs text-blue-400 mt-1">May be verified against IPRS when integrated.</p>
                              </div>
                              <div>
                                <Label required>Date of Birth</Label>
                                <Input
                                  type="date"
                                  required
                                  value={driver.dateOfBirth}
                                  onChange={(e) => setDriver((p) => ({ ...p, dateOfBirth: e.target.value }))}
                                  onClick={(e) => e.currentTarget.showPicker?.()}
                                />
                                <p className="text-xs text-blue-400 mt-1">Used to confirm young driver excess.</p>
                              </div>
                              <div>
                                <Label required>Driving Licence Number</Label>
                                <Input
                                  placeholder="DL number"
                                  required
                                  value={driver.dlNumber}
                                  onChange={(e) => setDriver((p) => ({ ...p, dlNumber: e.target.value }))}
                                />
                                <p className="text-xs text-blue-400 mt-1">May be verified against NTSA when integrated.</p>
                              </div>
                              <div>
                                <Label required>Date licence was acquired</Label>
                                <Input
                                  type="date"
                                  required
                                  value={driver.licenseAcquiredDate}
                                  onChange={(e) => setDriver((p) => ({ ...p, licenseAcquiredDate: e.target.value }))}
                                  onClick={(e) => e.currentTarget.showPicker?.()}
                                />
                                <p className="text-xs text-blue-400 mt-1">Used to confirm novice driver excess.</p>
                              </div>
                            </RevealGroup>
                          )}
                        </>
                      )}
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* Step 2: Date of Loss, Nature of Claim + Circumstances */}
              {step === 1 && (
                <div className="flex flex-col gap-5" style={{ animation: "slideIn 0.2s ease" }}>
                  <div className="flex flex-col md:flex-row gap-5 md:items-start">
                    <SectionCard title="Loss Details" subtitle="When and where the incident occurred">
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <Label required>Date of Loss</Label>
                          <Input
                            type="date"
                            required
                            max={new Date().toISOString().split("T")[0]}
                            onClick={(e) => e.currentTarget.showPicker?.()}
                          />
                        </div>
                        <div>
                          <Label required>Accident Location</Label>
                          <AccidentLocationPicker
                            value={accidentLocation}
                            place={accidentPlace}
                            onChange={setAccidentLocation}
                            onSelect={setAccidentPlace}
                          />
                        </div>
                      </div>
                    </SectionCard>

                    <SectionCard title="Nature of Claim" subtitle="Select the incident category">
                      <div>
                        <Label required>Claim Type</Label>
                        <div className="relative">
                          <Select value={claimType} onChange={(e) => handleClaimTypeChange(e.target.value as ClaimType)} required>
                            <option value="">Select claim type...</option>
                            {(Object.keys(CLAIM_SUBTYPES) as Exclude<ClaimType, "">[]).map((t) => <option key={t} value={t}>{t}</option>)}
                          </Select>
                          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {claimType && (
                        <div style={{ animation: "slideIn 0.18s ease" }}>
                          <Label required>Specify</Label>
                          <div className="relative">
                            <Select value={claimSubType} onChange={(e) => setClaimSubType(e.target.value)} required>
                              <option value="">Select detail...</option>
                              {CLAIM_SUBTYPES[claimType].map((s) => <option key={s} value={s}>{s}</option>)}
                            </Select>
                            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      )}
                    </SectionCard>
                  </div>

                  <SectionCard title="Incident Circumstances" subtitle="Other parties and impact">
                    <div className="grid grid-cols-1 gap-3">
                      <YesNoField
                        label="Other Vehicles Involved"
                        hint="Were any other vehicles involved in the accident?"
                        value={otherVehiclesInvolved}
                        onChange={setOtherVehiclesInvolved}
                      />
                      <YesNoField
                        label="Third Party Property Damage (TPPD)"
                        hint="Was a third party injured, or was third-party property damaged, as a result of the accident?"
                        value={tppd}
                        onChange={setTppd}
                      />
                      <YesNoField
                        label="Injuries / Fatalities"
                        hint="Were there any injuries or fatalities to the driver or passengers of the insured vehicle?"
                        value={injuriesFatalities}
                        onChange={setInjuriesFatalities}
                      />
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* Step 3: Vehicle location + Documents */}
              {step === 2 && (
                <div className="flex flex-col md:flex-row gap-5" style={{ animation: "slideIn 0.2s ease" }}>
                  <SectionCard title="Vehicle Location" subtitle="Where the vehicle is and how it got there">
                    <div>
                      <Label required>Vehicle Location</Label>
                      <SelectField
                        value={vehicleLocation}
                        onChange={handleVehicleLocationChange}
                        placeholder="Select location..."
                        options={VEHICLE_LOCATIONS}
                        required
                        invalid={showErrors && !vehicleLocation}
                      />
                      {vehicleLocation ? (
                        <p className="text-xs text-blue-400 mt-1.5">
                          {VEHICLE_LOCATION_HINTS[vehicleLocation as Exclude<VehicleLocation, "">]}
                        </p>
                      ) : (
                        <p className="text-xs text-blue-400 mt-1.5">We only ask what your answer needs.</p>
                      )}
                    </div>

                    {vehicleLocation === "Panel Garage" && (
                      <RevealGroup>
                        <div>
                          <Label required>Garage Name</Label>
                          <SelectField
                            value={panelGarage}
                            onChange={handlePanelGarageChange}
                            placeholder="Select panel garage..."
                            options={PANEL_GARAGE_NAMES}
                            required
                            invalid={showErrors && !panelGarage}
                          />
                        </div>

                        {panelGarage && countyAutoFilled && (
                          <div style={{ animation: "slideIn 0.18s ease" }}>
                            <Label locked>County Located</Label>
                            <Input locked value={locationCounty} readOnly />
                            <p className="text-xs text-slate-400 mt-1.5">
                              {panelGarage} only operates in {locationCounty}.
                            </p>
                          </div>
                        )}

                        {panelGarage && !countyAutoFilled && (
                          <div style={{ animation: "slideIn 0.18s ease" }}>
                            <Label required>County Located</Label>
                            <SelectField
                              value={locationCounty}
                              onChange={setLocationCounty}
                              placeholder="Select county..."
                              options={panelBranches}
                              required
                              invalid={showErrors && !locationCounty}
                            />
                            <p className={`text-xs mt-1.5 ${showErrors && !locationCounty ? "text-red-500" : "text-blue-400"}`}>
                              {panelGarage} has {panelBranches.length} branches. Which one has the vehicle?
                            </p>
                          </div>
                        )}
                      </RevealGroup>
                    )}

                    {vehicleLocation === "Non-Panel Garage" && (
                      <RevealGroup>
                        <div>
                          <Label required>County Located</Label>
                          <CountyPicker value={locationCounty} onChange={setLocationCounty}
                            invalid={showErrors && !locationCounty} />
                          <p className="text-xs text-blue-400 mt-1.5">
                            Which county is the garage in? Start typing to filter.
                          </p>
                        </div>
                      </RevealGroup>
                    )}

                    {vehicleLocation === "Other" && (
                      <RevealGroup>
                        <div>
                          <Label required>Where exactly</Label>
                          <ChoicePills value={otherLocation} onChange={setOtherLocation}
                            options={OTHER_LOCATIONS} name="Other location" />
                        </div>
                      </RevealGroup>
                    )}

                    {vehicleLocation && (
                      <div style={{ animation: "slideIn 0.18s ease" }}>
                        <Label required>How did it get there</Label>
                        <ChoicePills value={movement} onChange={handleMovementChange}
                          options={["Driven", "Towed"]} name="Movement" />
                      </div>
                    )}

                    {movement === "Towed" && (
                      <RevealGroup>
                        <div>
                          <Label required>Towing Agent</Label>
                          <SelectField
                            value={towingAgent}
                            onChange={handleTowingAgentChange}
                            placeholder="Select towing agent..."
                            options={TOWING_AGENTS}
                            required
                            invalid={showErrors && !towingAgent}
                          />
                        </div>
                        {towingAgent === "Other" && (
                          <div style={{ animation: "slideIn 0.18s ease" }}>
                            <Label required>Provider Name</Label>
                            <Input
                              placeholder="Who towed the vehicle?"
                              value={towingAgentOther}
                              onChange={(e) => setTowingAgentOther(e.target.value)}
                              className={showErrors && !towingAgentOther.trim()
                                ? "border-red-300 focus:border-red-500 focus:ring-red-100" : ""}
                              required
                            />
                          </div>
                        )}
                      </RevealGroup>
                    )}
                  </SectionCard>

                  <SectionCard title="Supporting Documents" subtitle="PDF, JPG or PNG · max 10MB each">
                    <div className="grid grid-cols-1 gap-2.5">
                      {(Object.keys(DOC_LABELS) as DocKey[]).map((key) => {
                        const tag = DOC_KEY_TO_TAG[key];
                        const isRequired = tag !== undefined && REQUIRED_TAGS.includes(tag);
                        // A combined file tagged with this document already covers it.
                        const covered = isRequired && tag !== undefined && isTagSatisfied(tag, docs, [combinedDoc]);
                        return (
                          <FileDropZone
                            key={key}
                            label={DOC_LABELS[key]}
                            docKey={key}
                            file={docs[key]}
                            onChange={handleDocChange}
                            required={isRequired && !covered}
                            invalid={showErrors && isRequired && !covered}
                          />
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-blue-100" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                          Or one file for several
                        </span>
                        <div className="h-px flex-1 bg-blue-100" />
                      </div>

                      <CombinedDocRow
                        doc={combinedDoc}
                        onFile={setCombinedFile}
                        onToggleTag={toggleCombinedTag}
                        onClear={clearCombinedDoc}
                        showErrors={showErrors}
                      />
                    </div>
                  </SectionCard>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        {!submitted && (
          <div className="shrink-0 border-t border-blue-100 bg-white px-4 sm:px-7 py-4 flex items-center justify-between">
            <div>
              {step > 0 && (
                <button type="button" onClick={() => goToStep(step - 1)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <p className="hidden sm:block text-xs text-blue-300"><span className="text-blue-400">*</span> Required</p>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={() => goToStep(step + 1)}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0">
                  Continue
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button type="button" onClick={handleSubmit}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0">
                  Submit FNOL
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<"home" | "tracking">("home");

  if (page === "tracking") {
    return <ClaimTracking onBack={() => setPage("home")} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 40%, #3b82f6 100%)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-blue-400/10" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-blue-900/30" />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full bg-white/5" />
      </div>
      <div className="relative text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <h1 className="text-white text-3xl font-bold mb-2" style={{ fontFamily: "'DM Serif Display', serif" }}>Motor Claims Portal</h1>
        <p className="text-blue-200 text-sm mb-8 max-w-xs mx-auto">Report a vehicle incident quickly and securely. Our team responds within 30 minutes.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={() => setOpen(true)}
            className="px-7 py-3 bg-white hover:bg-blue-50 text-blue-700 font-bold text-sm rounded-xl transition-all shadow-xl shadow-blue-900/30 hover:-translate-y-0.5 active:translate-y-0">
            File a Claim (FNOL)
          </button>
          <button onClick={() => setPage("tracking")}
            className="px-7 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl transition-all border border-white/25 hover:-translate-y-0.5 active:translate-y-0">
            Track a Claim
          </button>
        </div>
        <p className="text-blue-300/60 text-xs mt-4">Available 24 hours · 7 days a week</p>
      </div>
      <FNOLDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
