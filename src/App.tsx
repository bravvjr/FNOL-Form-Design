import { useState, useRef } from "react";
import ClaimTracking from "./ClaimTracking";

type ClaimType = "Normal" | "Partial Theft" | "Total Loss" | "Windscreen" | "";
type DeliveryMode = "Garage Collection" | "Home Delivery" | "Courier" | "";

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

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
      {children}{required && <span className="text-blue-400 ml-0.5">*</span>}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full bg-white border border-blue-200 rounded-lg px-3 py-2.5 text-sm text-blue-900 placeholder-blue-300
        focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-150 ${props.className ?? ""}`} />
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
  const [garageLocation, setGarageLocation] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("");
  const [submitted, setSubmitted] = useState(false);
  const [docs, setDocs] = useState<Record<DocKey, File | null>>({
    kyc: null, policeAbstract: null, drivingLicence: null, claimForm: null,
  });

  const handleDocChange = (key: DocKey, file: File | null) => setDocs((p) => ({ ...p, [key]: file }));
  const availableDelivery = garageLocation ? DELIVERY_MODES[garageLocation] ?? [] : [];
  const handleGarageChange = (loc: string) => { setGarageLocation(loc); setDeliveryMode(""); };

  const handleReset = () => {
    setStep(0); setClaimType(""); setGarageLocation(""); setDeliveryMode(""); setSubmitted(false);
    setDocs({ kyc: null, policeAbstract: null, drivingLicence: null, claimForm: null });
  };

  const handleClose = () => { handleReset(); onClose(); };

  if (!open) return null;

  const claimIcon = (type: ClaimType, icon: React.ReactNode) => (
    <span className={claimType === type ? "text-blue-600" : "text-blue-400"}>{icon}</span>
  );

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
                        <Label required>Registration Number</Label>
                        <Input placeholder="KAA 000A" required />
                      </div>
                      <div>
                        <Label required>Make</Label>
                        <Input placeholder="Toyota" required />
                      </div>
                      <div>
                        <Label required>Model</Label>
                        <Input placeholder="Fielder" required />
                      </div>
                      <div className="col-span-2">
                        <Label required>Year of Manufacture</Label>
                        <Input placeholder="2019" type="number" min={1980} max={new Date().getFullYear()} required />
                      </div>
                    </div>
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
                            <Label required>Intermediary Name</Label>
                            <Input placeholder="Jane Mwangi" required />
                          </div>
                          <div>
                            <Label required>Agent Code</Label>
                            <Input placeholder="AG-2024-00142" required />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <Label required>Insured Name</Label>
                            <Input placeholder="John Kamau Njoroge" required />
                          </div>
                          <div>
                            <Label required>ID Number</Label>
                            <Input placeholder="12345678" required />
                          </div>
                        </>
                      )}
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* Step 2: Date of Loss + Nature of Claim */}
              {step === 1 && (
                <div className="flex gap-5" style={{ animation: "slideIn 0.2s ease" }}>
                  <SectionCard title="Loss Details" subtitle="When the incident occurred">
                    <div>
                      <Label required>Date of Loss</Label>
                      <Input type="date" required max={new Date().toISOString().split("T")[0]} />
                    </div>
                    <div className="mt-2 p-3 rounded-lg bg-blue-600/5 border border-blue-100">
                      <p className="text-xs text-blue-400 leading-relaxed">
                        Enter the exact date the incident occurred. For incidents spanning multiple days, enter the date first noticed.
                      </p>
                    </div>
                  </SectionCard>

                  <SectionCard title="Nature of Claim" subtitle="Select the incident category">
                    <div className="grid grid-cols-1 gap-2">
                      {([
                        { type: "Normal", desc: "Minor accident or partial collision damage", path: "M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" },
                        { type: "Partial Theft", desc: "Accessories or parts stolen, vehicle intact", path: "M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" },
                        { type: "Total Loss", desc: "Beyond economic repair or fully stolen", path: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" },
                        { type: "Windscreen", desc: "Glass panel or windscreen damage only", path: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" },
                      ] as { type: ClaimType; desc: string; path: string }[]).map(({ type, desc, path }) => (
                        <ClaimTypeCard key={type} type={type} selected={claimType === type} onSelect={() => setClaimType(type)} description={desc}
                          icon={claimIcon(type, (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d={path} />
                            </svg>
                          ))} />
                      ))}
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* Step 3: Garage + Documents */}
              {step === 2 && (
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
