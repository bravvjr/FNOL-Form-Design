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
type DeliveryMode = "Garage Collection" | "Home Delivery" | "Courier" | "";

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

const GARAGE_LOCATIONS = [
  "Nairobi - Westlands",
  "Nairobi - Industrial Area",
  "Mombasa - Mvita",
  "Kisumu - Milimani",
  "Nakuru - Town",
  "Eldoret - Town",
  "Thika - Blue Post",
];

const DELIVERY_MODES: Record<string, DeliveryMode[]> = {
  "Nairobi - Westlands": ["Garage Collection", "Home Delivery", "Courier"],
  "Nairobi - Industrial Area": ["Garage Collection", "Home Delivery", "Courier"],
  "Mombasa - Mvita": ["Garage Collection", "Home Delivery"],
  "Kisumu - Milimani": ["Garage Collection", "Courier"],
  "Nakuru - Town": ["Garage Collection", "Home Delivery"],
  "Eldoret - Town": ["Garage Collection"],
  "Thika - Blue Post": ["Garage Collection", "Courier"],
};

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

const STEPS = [
  { label: "Vehicle & Party", desc: "Car details and contact" },
  { label: "Incident", desc: "Date and claim type" },
  { label: "Circumstances", desc: "Other parties and impact" },
  { label: "Garage & Docs", desc: "Location and uploads" },
];

function FileDropZone({ label, docKey, file, onChange }: {
  label: string; docKey: DocKey; file: File | null; onChange: (key: DocKey, file: File | null) => void;
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
        ${dragging ? "border-blue-400 bg-blue-50" : file ? "border-green-400 bg-green-50" : "border-blue-200 hover:border-blue-400 bg-blue-50/40 hover:bg-blue-50"}`}
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
          <p className={`text-xs font-semibold leading-tight ${file ? "text-green-700" : "text-blue-900"}`}>{label}</p>
          <p className="text-xs text-blue-400 truncate mt-0.5">{file ? file.name : "Click or drag to upload"}</p>
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
function ClaimTypeCard({ type, selected, onSelect, icon, description }: {
  type: string; selected: boolean; onSelect: () => void; icon: React.ReactNode; description: string;
}) {
  return (
    <button type="button" onClick={onSelect}
      className={`relative w-full text-left rounded-lg border p-3 transition-all duration-150
        ${selected ? "border-blue-500 bg-blue-50 shadow-sm shadow-blue-100" : "border-blue-100 bg-white hover:border-blue-300 hover:bg-blue-50/60"}`}>
      <div className="flex items-start gap-2.5">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${selected ? "bg-blue-100" : "bg-blue-50"}`}>
          {icon}
        </div>
        <div>
          <p className={`text-xs font-bold ${selected ? "text-blue-700" : "text-blue-900"}`}>{type}</p>
          <p className="text-xs text-blue-400 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      {selected && (
        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
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
  const [garageLocation, setGarageLocation] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("");
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
  const availableDelivery = garageLocation ? DELIVERY_MODES[garageLocation] ?? [] : [];
  const handleGarageChange = (loc: string) => { setGarageLocation(loc); setDeliveryMode(""); };

  const handleReset = () => {
    setStep(0); setClaimType(""); setClaimSubType(""); setAccidentLocation("");
    setOtherVehiclesInvolved(null); setTppd(null); setInjuriesFatalities(null);
    setGarageLocation(""); setDeliveryMode(""); setSubmitted(false);
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

              {/* Step 4: Garage + Documents */}
              {step === 3 && (
                <div className="flex gap-5" style={{ animation: "slideIn 0.2s ease" }}>
                  <SectionCard title="Garage & Delivery" subtitle="Approved garage and return preference">
                    <div>
                      <Label required>Garage Location</Label>
                      <div className="relative">
                        <Select value={garageLocation} onChange={(e) => handleGarageChange(e.target.value)} required>
                          <option value="">Select garage...</option>
                          {GARAGE_LOCATIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                        </Select>
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {garageLocation && (
                      <div style={{ animation: "slideIn 0.18s ease" }}>
                        <Label required>Mode of Delivery</Label>
                        <div className="relative">
                          <Select value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)} required>
                            <option value="">Select delivery...</option>
                            {availableDelivery.map((d) => <option key={d} value={d}>{d}</option>)}
                          </Select>
                          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-xs text-blue-400 mt-1.5">{availableDelivery.length} mode{availableDelivery.length !== 1 ? "s" : ""} at this location</p>
                      </div>
                    )}

                    <div className="mt-auto pt-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <p className="text-xs text-blue-400 leading-relaxed">
                        Delivery options vary by garage. Home delivery and courier services are available in select locations.
                      </p>
                    </div>
                  </SectionCard>

                  <SectionCard title="Supporting Documents" subtitle="PDF, JPG or PNG · max 10MB each">
                    <div className="grid grid-cols-1 gap-2.5">
                      {(Object.keys(DOC_LABELS) as DocKey[]).map((key) => (
                        <FileDropZone key={key} label={DOC_LABELS[key]} docKey={key} file={docs[key]} onChange={handleDocChange} />
                      ))}
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                      <p className="text-xs text-blue-400 leading-relaxed">
                        A police abstract is required for theft and accident claims. Missing documents may delay processing.
                      </p>
                    </div>
                  </SectionCard>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        {!submitted && (
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
                <button type="button" onClick={() => setSubmitted(true)}
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
