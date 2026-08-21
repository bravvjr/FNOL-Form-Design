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
const EMPTY_INSURED = { name: "", idNumber: "" };

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

const ACCIDENT_LOCATIONS = [
  "Nairobi",
  "Mombasa",
  "Kisumu",
  "Nakuru",
  "Eldoret",
  "Thika",
  "Nyeri",
  "Meru",
  "Kakamega",
  "Machakos",
  "Other",
];

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

/** Placeholder until the panel-garage directory is wired to the API. */
const PANEL_GARAGE_NAME = "Test garage";

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
  { label: "Incident", desc: "Date and claim type" },
  { label: "Circumstances", desc: "Other parties and impact" },
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
          <p className={`text-xs font-semibold leading-tight flex items-center gap-1.5
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
    <div className="flex-1 min-w-0 rounded-xl border border-blue-100 bg-blue-50/40 p-5 flex flex-col gap-4">
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

/** One combined file: the upload itself plus what the user says is inside it. */
function CombinedDocRow({ doc, index, onFile, onToggleTag, onRemove, showErrors }: {
  doc: CombinedDoc;
  index: number;
  onFile: (id: string, file: File | null) => void;
  onToggleTag: (id: string, tag: DocTag) => void;
  onRemove: (id: string) => void;
  showErrors: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const untagged = showErrors && doc.file !== null && doc.tags.length === 0;

  return (
    <div className="rounded-lg border border-blue-100 bg-white p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-blue-900">Combined Document {index + 1}</p>
        <button type="button" onClick={() => onRemove(doc.id)}
          aria-label={`Remove combined document ${index + 1}`}
          className="w-7 h-7 rounded-md flex items-center justify-center text-blue-300 hover:text-red-500 hover:bg-red-50 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => onFile(doc.id, e.target.files?.[0] ?? null)} />

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
            onToggle={(t) => onToggleTag(doc.id, t)}
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

function YesNoSelect({ label, hint, value, onChange }: {
  label: string; hint: string; value: boolean | null; onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <Label required>{label}</Label>
      <div className="relative">
        <Select value={value === null ? "" : value ? "yes" : "no"}
          onChange={(e) => onChange(e.target.value === "yes")} required>
          <option value="">Select...</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </Select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      <p className="text-xs text-blue-400 mt-1.5 leading-relaxed">{hint}</p>
    </div>
  );
}

function StepperHeader({ step, total }: { step: number; total: number }) {
  return (
    <div className="shrink-0 px-7 py-4 bg-white border-b border-blue-100">
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200
                  ${done ? "bg-blue-600 text-white" : active ? "bg-blue-600 text-white ring-4 ring-blue-100" : "bg-blue-100 text-blue-400"}`}>
                  {done ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i + 1}
                </div>
                <div className="hidden sm:block">
                  <p className={`text-xs font-bold leading-tight ${active ? "text-blue-700" : done ? "text-blue-500" : "text-blue-300"}`}>{s.label}</p>
                  <p className={`text-xs leading-tight ${active ? "text-blue-400" : "text-blue-200"}`}>{s.desc}</p>
                </div>
              </div>
              {i < total - 1 && (
                <div className="flex-1 mx-3 h-px bg-blue-100 relative overflow-hidden">
                  <div className={`absolute inset-y-0 left-0 bg-blue-400 transition-all duration-500 ${done ? "w-full" : "w-0"}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FNOLDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [partyType, setPartyType] = useState<"intermediary" | "insured">("intermediary");
  const [claimType, setClaimType] = useState<ClaimType>("");
  const [claimSubType, setClaimSubType] = useState("");
  const [accidentLocation, setAccidentLocation] = useState("");
  const [otherVehiclesInvolved, setOtherVehiclesInvolved] = useState<boolean | null>(null);
  const [tppd, setTppd] = useState<boolean | null>(null);
  const [injuriesFatalities, setInjuriesFatalities] = useState<boolean | null>(null);
  const [vehicleLocation, setVehicleLocation] = useState<VehicleLocation>("");
  const [locationCounty, setLocationCounty] = useState("");
  const [otherLocation, setOtherLocation] = useState("");
  const [movement, setMovement] = useState("");
  const [towingAgent, setTowingAgent] = useState("");
  const [towingAgentOther, setTowingAgentOther] = useState("");
  const [combinedDocs, setCombinedDocs] = useState<CombinedDoc[]>([]);
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
    setInsured({ name: r.client.name ?? "", idNumber: r.client.idNumber ?? "" });
    setSelectedRecord(r);
    setPartyType("intermediary");
  };

  const handleVehicleClear = () => {
    setVehicle(EMPTY_VEHICLE);
    setIntermediary(EMPTY_INTERMEDIARY);
    setInsured(EMPTY_INSURED);
    setSelectedRecord(null);
  };

  const handleDocChange = (key: DocKey, file: File | null) => setDocs((p) => ({ ...p, [key]: file }));
  const handleClaimTypeChange = (type: ClaimType) => { setClaimType(type); setClaimSubType(""); };

  // Changing the location invalidates every answer that hung off the old one.
  const handleVehicleLocationChange = (loc: string) => {
    setVehicleLocation(loc as VehicleLocation);
    setLocationCounty("");
    setOtherLocation("");
  };

  const handleMovementChange = (m: string) => {
    setMovement(m);
    if (m !== "Towed") { setTowingAgent(""); setTowingAgentOther(""); }
  };

  const handleTowingAgentChange = (a: string) => {
    setTowingAgent(a);
    if (a !== "Other") setTowingAgentOther("");
  };

  const addCombinedDoc = () =>
    setCombinedDocs((p) => [...p, { id: `cd-${Date.now()}-${p.length}`, file: null, tags: [] }]);

  const setCombinedFile = (id: string, file: File | null) =>
    setCombinedDocs((p) => p.map((c) => (c.id === id ? { ...c, file } : c)));

  const toggleCombinedTag = (id: string, tag: DocTag) =>
    setCombinedDocs((p) => p.map((c) => c.id === id
      ? { ...c, tags: c.tags.includes(tag) ? c.tags.filter((t) => t !== tag) : [...c.tags, tag] }
      : c));

  const removeCombinedDoc = (id: string) => setCombinedDocs((p) => p.filter((c) => c.id !== id));

  const countyNeeded = vehicleLocation === "Panel Garage" || vehicleLocation === "Non-Panel Garage";

  /** Every unmet rule on the final step, phrased as cause + fix. */
  const validationErrors: string[] = [];
  if (!vehicleLocation) validationErrors.push("Choose where the vehicle is now.");
  if (countyNeeded && !locationCounty) validationErrors.push("Select the county the garage is in.");
  if (vehicleLocation === "Other" && !otherLocation) validationErrors.push("Choose whether the vehicle is at an office or a home.");
  if (vehicleLocation && !movement) validationErrors.push("Tell us whether the vehicle was driven or towed.");
  if (movement === "Towed" && !towingAgent) validationErrors.push("Select the towing agent.");
  if (movement === "Towed" && towingAgent === "Other" && !towingAgentOther.trim()) validationErrors.push("Enter the towing provider's name.");
  REQUIRED_TAGS.forEach((tag) => {
    if (!isTagSatisfied(tag, docs, combinedDocs)) validationErrors.push(`Upload the ${tag}, or tick it on a combined file.`);
  });
  if (combinedDocs.some((c) => c.file && c.tags.length === 0)) validationErrors.push("Tick what each combined file contains.");

  const handleSubmit = () => {
    if (validationErrors.length > 0) { setShowErrors(true); return; }
    setShowErrors(false);
    setSubmitted(true);
  };

  const handleReset = () => {
    setStep(0); setClaimType(""); setClaimSubType(""); setAccidentLocation("");
    setOtherVehiclesInvolved(null); setTppd(null); setInjuriesFatalities(null);
    setVehicleLocation(""); setLocationCounty(""); setOtherLocation("");
    setMovement(""); setTowingAgent(""); setTowingAgentOther("");
    setCombinedDocs([]); setShowErrors(false); setSubmitted(false);
    setDocs({ kyc: null, policeAbstract: null, drivingLicence: null, claimForm: null });
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
        <div className="shrink-0 bg-blue-700 px-7 py-4 flex items-center justify-between">
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
        <StepperHeader step={step} total={STEPS.length} />

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
            <div className="p-7">

              {/* Step 1: Vehicle + Party */}
              {step === 0 && (
                <div className="flex gap-5" style={{ animation: "slideIn 0.2s ease" }}>
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

                  <SectionCard title="Party Details" subtitle="Intermediary or insured contact">
                    <div className="flex gap-1.5 p-1 bg-blue-100 rounded-lg w-fit">
                      {(["intermediary", "insured"] as const).map((t) => (
                        <button key={t} type="button" onClick={() => setPartyType(t)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150
                            ${partyType === t ? "bg-blue-600 text-white shadow-sm" : "text-blue-500 hover:text-blue-700"}`}>
                          {t === "intermediary" ? "Intermediary" : "Direct Insured"}
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
                      ) : (
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
                      )}
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* Step 2: Date of Loss + Nature of Claim */}
              {step === 1 && (
                <div className="flex gap-5 items-start" style={{ animation: "slideIn 0.2s ease" }}>
                  <SectionCard title="Loss Details" subtitle="When and where the incident occurred">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label required>Date of Loss</Label>
                        <Input type="date" required max={new Date().toISOString().split("T")[0]} />
                      </div>
                      <div>
                        <Label required>Accident Location</Label>
                        <div className="relative">
                          <Select value={accidentLocation} onChange={(e) => setAccidentLocation(e.target.value)} required>
                            <option value="">Select location...</option>
                            {ACCIDENT_LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                          </Select>
                          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
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
              )}

              {/* Step 3: Incident Circumstances */}
              {step === 2 && (
                <div style={{ animation: "slideIn 0.2s ease" }}>
                  <SectionCard title="Incident Circumstances" subtitle="Other parties and impact">
                    <div className="grid grid-cols-1 gap-3">
                      <YesNoSelect
                        label="Other Vehicles Involved"
                        hint="Were any other vehicles involved in the accident?"
                        value={otherVehiclesInvolved}
                        onChange={setOtherVehiclesInvolved}
                      />
                      <YesNoSelect
                        label="Third Party Property Damage (TPPD)"
                        hint="Was a third party injured, or was third-party property damaged, as a result of the accident?"
                        value={tppd}
                        onChange={setTppd}
                      />
                      <YesNoSelect
                        label="Injuries / Fatalities"
                        hint="Were there any injuries or fatalities to the driver or passengers of the insured vehicle?"
                        value={injuriesFatalities}
                        onChange={setInjuriesFatalities}
                      />
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* Step 4: Vehicle location + Documents */}
              {step === 3 && (
                <div className="flex gap-5" style={{ animation: "slideIn 0.2s ease" }}>
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
                          <Label locked>Garage Name</Label>
                          <Input locked value={PANEL_GARAGE_NAME} readOnly />
                        </div>
                        <div>
                          <Label required>County Located</Label>
                          <CountyPicker value={locationCounty} onChange={setLocationCounty}
                            invalid={showErrors && !locationCounty} />
                        </div>
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
                        const covered = isRequired && tag !== undefined && isTagSatisfied(tag, docs, combinedDocs);
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

                      {combinedDocs.map((doc, i) => (
                        <CombinedDocRow
                          key={doc.id}
                          doc={doc}
                          index={i}
                          onFile={setCombinedFile}
                          onToggleTag={toggleCombinedTag}
                          onRemove={removeCombinedDoc}
                          showErrors={showErrors}
                        />
                      ))}

                      <button type="button" onClick={addCombinedDoc}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 text-xs font-semibold transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add combined document
                      </button>
                    </div>
                  </SectionCard>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        {!submitted && (
          <>
            {showErrors && validationErrors.length > 0 && (
              <div role="alert" aria-live="polite"
                className="shrink-0 border-t border-red-200 bg-red-50 px-7 py-3"
                style={{ animation: "slideIn 0.18s ease" }}>
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-red-600">
                      {validationErrors.length} thing{validationErrors.length > 1 ? "s" : ""} left before you can submit
                    </p>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {validationErrors.map((err) => (
                        <li key={err} className="text-xs text-red-500 leading-relaxed">· {err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          <div className="shrink-0 border-t border-blue-100 bg-white px-7 py-4 flex items-center justify-between">
            <div>
              {step > 0 && (
                <button type="button" onClick={() => setStep((s) => s - 1)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-blue-300"><span className="text-blue-400">*</span> Required</p>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={() => setStep((s) => s + 1)}
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
          </>
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
