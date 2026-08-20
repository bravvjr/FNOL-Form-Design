export type StageKind = "completed" | "current" | "upcoming";

export type ClaimField = {
  label: string;
  value: string;
  emphasize?: boolean;
};

export type ClaimDocument = {
  name: string;
  kind: "pdf" | "image";
  size: string;
  uploadedAt: string;
  uploadedBy: string;
};

export type ClaimActivity = {
  at: string;
  actor: string;
  role: string;
  note: string;
};

export type ClaimStage = {
  id: number;
  name: string;
  caption: string;
  summary: string;
  owner: string;
  ownerRole: string;
  narrative: string;
  fields: ClaimField[];
  documents: ClaimDocument[];
  activities: ClaimActivity[];
  primaryAction?: string;
  secondaryAction?: string;
};

export const DEMO_CLAIM = {
  number: "CLM-2026-08421",
  policy: "MOT-884219",
  vehicle: "2019 Toyota Fielder",
  registration: "KDG 482K",
  insured: "John Kamau Njoroge",
  intermediary: "Jane Mwangi",
  lossDate: "11 Aug 2026",
  nature: "Collision · Own damage",
  garage: "Westlands AutoWorks",
};

/** Logical motor-claim lifecycle. IDs match the source status catalogue. */
export const CLAIM_STAGES: ClaimStage[] = [
  {
    id: 1,
    name: "Initiation",
    caption: "FNOL captured and claim file opened",
    summary: "FNOL-M8K2P4 · Collision",
    owner: "Jane Mwangi",
    ownerRole: "Intermediary",
    narrative:
      "First notice of loss was lodged through the intermediary portal. Policy cover was confirmed, the vehicle identified, and supporting documents attached to open the claim file.",
    fields: [
      { label: "FNOL reference", value: "FNOL-M8K2P4" },
      { label: "Reported", value: "12 Aug 2026, 09:14" },
      { label: "Channel", value: "Intermediary portal" },
      { label: "Date of loss", value: "11 Aug 2026" },
      { label: "Location", value: "Waiyaki Way, Westlands" },
      { label: "Nature of claim", value: "Normal · Front-end collision" },
    ],
    documents: [
      { name: "FNOL Form.pdf", kind: "pdf", size: "420 KB", uploadedAt: "12 Aug 2026", uploadedBy: "Jane Mwangi" },
      { name: "KYC Document.pdf", kind: "pdf", size: "1.1 MB", uploadedAt: "12 Aug 2026", uploadedBy: "Jane Mwangi" },
      { name: "Police Abstract.pdf", kind: "pdf", size: "880 KB", uploadedAt: "12 Aug 2026", uploadedBy: "Jane Mwangi" },
      { name: "Driving Licence.jpg", kind: "image", size: "640 KB", uploadedAt: "12 Aug 2026", uploadedBy: "Jane Mwangi" },
    ],
    activities: [
      { at: "12 Aug, 09:14", actor: "Jane Mwangi", role: "Intermediary", note: "Submitted FNOL with four supporting documents." },
      { at: "12 Aug, 09:22", actor: "System", role: "Intake", note: "Policy MOT-884219 validated. Cover confirmed active." },
      { at: "12 Aug, 09:28", actor: "Claims Desk", role: "Operations", note: "Claim file CLM-2026-08421 opened and assigned." },
    ],
  },
  {
    id: 2,
    name: "Draft Assessment",
    caption: "Initial inspection and preliminary estimate",
    summary: "KES 186,400 · P. Otieno",
    owner: "Peter Otieno",
    ownerRole: "Motor Assessor",
    narrative:
      "The appointed assessor inspected the vehicle at Westlands AutoWorks. Damage is limited to the front bumper, left headlamp, and a crease on the bonnet. No structural or airbag deployment noted.",
    fields: [
      { label: "Assessor", value: "Peter Otieno" },
      { label: "Assigned", value: "12 Aug 2026, 14:20" },
      { label: "Inspection", value: "13 Aug 2026, 10:00" },
      { label: "Site", value: "Westlands AutoWorks" },
      { label: "Preliminary estimate", value: "KES 186,400", emphasize: true },
      { label: "Damage summary", value: "Bumper, LH headlamp, bonnet crease" },
    ],
    documents: [
      { name: "Scene & damage photos.zip", kind: "image", size: "8.4 MB", uploadedAt: "13 Aug 2026", uploadedBy: "Peter Otieno" },
      { name: "Draft worksheet.pdf", kind: "pdf", size: "310 KB", uploadedAt: "13 Aug 2026", uploadedBy: "Peter Otieno" },
    ],
    activities: [
      { at: "12 Aug, 14:20", actor: "Claims Desk", role: "Operations", note: "Appointed Peter Otieno as motor assessor." },
      { at: "13 Aug, 10:00", actor: "Peter Otieno", role: "Assessor", note: "Completed physical inspection at garage." },
      { at: "13 Aug, 12:15", actor: "Peter Otieno", role: "Assessor", note: "Logged preliminary estimate of KES 186,400." },
    ],
  },
  {
    id: 10,
    name: "Pending Internal Assessor Review",
    caption: "Senior assessor reviews the draft findings",
    summary: "Cleared · G. Wanjiku",
    owner: "Grace Wanjiku",
    ownerRole: "Senior Assessor",
    narrative:
      "Internal review confirmed the estimate sits within policy limits, with no total-loss indicators. The file was cleared to proceed to a formal draft report.",
    fields: [
      { label: "Reviewer", value: "Grace Wanjiku" },
      { label: "Submitted for review", value: "13 Aug 2026, 16:45" },
      { label: "Decision", value: "Proceed to draft report" },
      { label: "SLA", value: "Cleared in 4 hours" },
      { label: "Total-loss check", value: "Not indicated" },
      { label: "Policy limit check", value: "Within sum insured" },
    ],
    documents: [
      { name: "Internal review checklist.pdf", kind: "pdf", size: "180 KB", uploadedAt: "13 Aug 2026", uploadedBy: "Grace Wanjiku" },
    ],
    activities: [
      { at: "13 Aug, 16:45", actor: "Peter Otieno", role: "Assessor", note: "Submitted draft findings for internal review." },
      { at: "13 Aug, 20:40", actor: "Grace Wanjiku", role: "Senior Assessor", note: "Cleared. No total-loss path required." },
    ],
  },
  {
    id: 11,
    name: "Assessment Draft Report",
    caption: "Formal draft of labour, parts and paint",
    summary: "ADR-2026-3318 · KES 189,400",
    owner: "Peter Otieno",
    ownerRole: "Motor Assessor",
    narrative:
      "The draft report itemises labour, parts and paint. An excess of KES 15,000 applies. The report was shared with the garage to invite a matching quotation.",
    fields: [
      { label: "Report number", value: "ADR-2026-3318" },
      { label: "Issued", value: "14 Aug 2026" },
      { label: "Labour", value: "KES 42,000" },
      { label: "Parts", value: "KES 128,500" },
      { label: "Paint", value: "KES 18,900" },
      { label: "Draft total", value: "KES 189,400", emphasize: true },
      { label: "Policy excess", value: "KES 15,000" },
    ],
    documents: [
      { name: "Assessment Draft Report.pdf", kind: "pdf", size: "1.4 MB", uploadedAt: "14 Aug 2026", uploadedBy: "Peter Otieno" },
      { name: "Parts schedule.xlsx", kind: "pdf", size: "96 KB", uploadedAt: "14 Aug 2026", uploadedBy: "Peter Otieno" },
    ],
    activities: [
      { at: "14 Aug, 11:05", actor: "Peter Otieno", role: "Assessor", note: "Issued draft report ADR-2026-3318." },
      { at: "14 Aug, 11:12", actor: "System", role: "Workflow", note: "Draft report sent to Westlands AutoWorks." },
    ],
  },
  {
    id: 12,
    name: "Garage Quotation Submitted",
    caption: "Approved garage returns a repair quote",
    summary: "Q-WA-8841 · KES 194,200",
    owner: "Westlands AutoWorks",
    ownerRole: "Approved garage",
    narrative:
      "The garage quoted KES 194,200 against the assessor draft of KES 189,400. Variance is mainly on the bumper skin. Quoted turnaround is seven working days once authority is issued.",
    fields: [
      { label: "Garage", value: "Westlands AutoWorks" },
      { label: "Quote number", value: "Q-WA-8841" },
      { label: "Submitted", value: "15 Aug 2026, 13:30" },
      { label: "Quoted amount", value: "KES 194,200", emphasize: true },
      { label: "Variance vs assessor", value: "+ KES 4,800" },
      { label: "Quoted TAT", value: "7 working days" },
    ],
    documents: [
      { name: "Garage quotation Q-WA-8841.pdf", kind: "pdf", size: "540 KB", uploadedAt: "15 Aug 2026", uploadedBy: "Westlands AutoWorks" },
      { name: "OEM parts list.pdf", kind: "pdf", size: "220 KB", uploadedAt: "15 Aug 2026", uploadedBy: "Westlands AutoWorks" },
    ],
    activities: [
      { at: "15 Aug, 13:30", actor: "Westlands AutoWorks", role: "Garage", note: "Uploaded quotation Q-WA-8841." },
      { at: "15 Aug, 14:02", actor: "Peter Otieno", role: "Assessor", note: "Flagged KES 4,800 variance for negotiation." },
    ],
  },
  {
    id: 3,
    name: "Offers",
    caption: "Repair authority vs cash-in-lieu options",
    summary: "Repair accepted · 16 Aug",
    owner: "John Kamau Njoroge",
    ownerRole: "Insured",
    narrative:
      "The insured was offered repair at the approved garage or cash in lieu of KES 165,000. They accepted the repair route. Excess remains payable at the garage before release.",
    fields: [
      { label: "Offer A", value: "Repair at approved garage" },
      { label: "Offer B", value: "Cash in lieu · KES 165,000" },
      { label: "Insured choice", value: "Repair", emphasize: true },
      { label: "Accepted", value: "16 Aug 2026, 10:18" },
      { label: "Excess reminder", value: "KES 15,000 at release" },
      { label: "Channel", value: "SMS + email confirmation" },
    ],
    documents: [
      { name: "Offer letter.pdf", kind: "pdf", size: "260 KB", uploadedAt: "15 Aug 2026", uploadedBy: "Claims Desk" },
      { name: "Signed acceptance.pdf", kind: "pdf", size: "190 KB", uploadedAt: "16 Aug 2026", uploadedBy: "John Kamau Njoroge" },
    ],
    activities: [
      { at: "15 Aug, 17:40", actor: "Claims Desk", role: "Operations", note: "Issued repair vs cash-in-lieu offers." },
      { at: "16 Aug, 10:18", actor: "John Kamau Njoroge", role: "Insured", note: "Accepted repair at Westlands AutoWorks." },
    ],
  },
  {
    id: 4,
    name: "Assessment Final Report",
    caption: "Agreed figures locked for authority",
    summary: "AFR-2026-3318 · KES 191,600",
    owner: "Peter Otieno",
    ownerRole: "Motor Assessor",
    narrative:
      "After reconciling the garage quote, the final agreed repair figure is KES 191,600. This amount is the basis for the repair authority.",
    fields: [
      { label: "Report number", value: "AFR-2026-3318" },
      { label: "Issued", value: "17 Aug 2026" },
      { label: "Agreed labour", value: "KES 42,000" },
      { label: "Agreed parts", value: "KES 130,700" },
      { label: "Agreed paint", value: "KES 18,900" },
      { label: "Final amount", value: "KES 191,600", emphasize: true },
    ],
    documents: [
      { name: "Assessment Final Report.pdf", kind: "pdf", size: "1.6 MB", uploadedAt: "17 Aug 2026", uploadedBy: "Peter Otieno" },
    ],
    activities: [
      { at: "17 Aug, 09:50", actor: "Peter Otieno", role: "Assessor", note: "Agreed KES 191,600 with garage." },
      { at: "17 Aug, 10:05", actor: "Grace Wanjiku", role: "Senior Assessor", note: "Countersigned final report." },
    ],
  },
  {
    id: 5,
    name: "Repair Authority Issuing",
    caption: "Written go-ahead issued to the garage",
    summary: "RA-2026-5521 · KES 191,600",
    owner: "Claims Authorisations",
    ownerRole: "Operations",
    narrative:
      "Repair authority RA-2026-5521 was issued to Westlands AutoWorks for KES 191,600, valid for 30 days. The garage confirmed receipt and booked the vehicle in.",
    fields: [
      { label: "Authority number", value: "RA-2026-5521" },
      { label: "Issued", value: "18 Aug 2026" },
      { label: "Authorised amount", value: "KES 191,600", emphasize: true },
      { label: "Valid until", value: "18 Sep 2026" },
      { label: "Garage notified", value: "Yes · email + portal" },
      { label: "Booking date", value: "19 Aug 2026" },
    ],
    documents: [
      { name: "Repair Authority RA-2026-5521.pdf", kind: "pdf", size: "340 KB", uploadedAt: "18 Aug 2026", uploadedBy: "Claims Authorisations" },
    ],
    activities: [
      { at: "18 Aug, 11:20", actor: "Claims Authorisations", role: "Operations", note: "Issued RA-2026-5521." },
      { at: "18 Aug, 12:04", actor: "Westlands AutoWorks", role: "Garage", note: "Acknowledged authority. Slot booked for 19 Aug." },
    ],
  },
  {
    id: 6,
    name: "Repairs",
    caption: "Vehicle is currently in the workshop",
    summary: "Paint in progress · 60%",
    owner: "Samuel Kiptoo",
    ownerRole: "Workshop lead",
    narrative:
      "Repairs started on 19 August. OEM parts have been fitted. The vehicle is in paint. Expected completion is 27 August, subject to paint curing and quality check.",
    fields: [
      { label: "Started", value: "19 Aug 2026" },
      { label: "Expected completion", value: "27 Aug 2026" },
      { label: "Workshop progress", value: "60% · Paint stage", emphasize: true },
      { label: "Technician", value: "Samuel Kiptoo" },
      { label: "Last garage update", value: "20 Aug 2026, 08:40" },
      { label: "Blockers", value: "None reported" },
    ],
    documents: [
      { name: "Work order WO-4412.pdf", kind: "pdf", size: "210 KB", uploadedAt: "19 Aug 2026", uploadedBy: "Westlands AutoWorks" },
      { name: "Progress photo — parts fitted.jpg", kind: "image", size: "1.8 MB", uploadedAt: "20 Aug 2026", uploadedBy: "Samuel Kiptoo" },
      { name: "Progress photo — paint booth.jpg", kind: "image", size: "2.1 MB", uploadedAt: "20 Aug 2026", uploadedBy: "Samuel Kiptoo" },
    ],
    activities: [
      { at: "19 Aug, 08:15", actor: "Samuel Kiptoo", role: "Workshop", note: "Vehicle booked in. Strip-down started." },
      { at: "20 Aug, 08:40", actor: "Samuel Kiptoo", role: "Workshop", note: "Parts fitted. Moved to paint booth." },
    ],
    primaryAction: "Mark repair complete",
    secondaryAction: "Request garage update",
  },
  {
    id: 13,
    name: "Repair Completed",
    caption: "Garage confirms works are finished",
    summary: "Awaiting completion notice",
    owner: "Westlands AutoWorks",
    ownerRole: "Approved garage",
    narrative:
      "Once the garage marks the job complete, the invoice, quality checklist and completion photos will appear here. Reinspection is then scheduled with the assessor.",
    fields: [
      { label: "Completion date", value: "Pending" },
      { label: "Final invoice", value: "Pending" },
      { label: "Quality checklist", value: "Not submitted" },
      { label: "Invoice vs authority", value: "—" },
      { label: "Garage sign-off", value: "—" },
      { label: "Ready for inspect", value: "No" },
    ],
    documents: [],
    activities: [],
    primaryAction: "Confirm completion",
    secondaryAction: "Chase garage",
  },
  {
    id: 7,
    name: "Reinspection",
    caption: "Post-repair quality check by the assessor",
    summary: "Not scheduled",
    owner: "Peter Otieno",
    ownerRole: "Motor Assessor",
    narrative:
      "The assessor will reinspect the repaired vehicle against the final report. Pass or snag notes, and any photos, will be stored on this step before the vehicle can be released.",
    fields: [
      { label: "Scheduled", value: "Not yet" },
      { label: "Assessor", value: "Peter Otieno" },
      { label: "Result", value: "—" },
      { label: "Snags", value: "—" },
      { label: "Reinspect photos", value: "—" },
      { label: "Sign-off", value: "—" },
    ],
    documents: [],
    activities: [],
    primaryAction: "Schedule reinspection",
  },
  {
    id: 8,
    name: "Release",
    caption: "Handover of the repaired vehicle",
    summary: "Not started",
    owner: "Westlands AutoWorks",
    ownerRole: "Approved garage",
    narrative:
      "On a clean reinspection, the insured collects the vehicle. Excess is collected, a satisfaction note is signed, and the chosen delivery mode is recorded.",
    fields: [
      { label: "Release date", value: "—" },
      { label: "Delivery mode", value: "Garage collection (expected)" },
      { label: "Excess collected", value: "KES 15,000 due" },
      { label: "Satisfaction note", value: "—" },
      { label: "Collected by", value: "—" },
      { label: "Odometer at release", value: "—" },
    ],
    documents: [],
    activities: [],
    primaryAction: "Record release",
  },
  {
    id: 9,
    name: "Closed",
    caption: "File settled and archived",
    summary: "Not started",
    owner: "Claims Desk",
    ownerRole: "Operations",
    narrative:
      "After release and garage settlement, the claim is closed. A closure letter is issued to the insured and intermediary, and the file is archived.",
    fields: [
      { label: "Closed on", value: "—" },
      { label: "Settlement amount", value: "KES 191,600 (expected)" },
      { label: "Payment status", value: "—" },
      { label: "Closure letter", value: "—" },
      { label: "Archive reference", value: "—" },
      { label: "Reopen window", value: "90 days after close" },
    ],
    documents: [],
    activities: [],
    primaryAction: "Close claim",
  },
];

export const INITIAL_CURRENT_INDEX = CLAIM_STAGES.findIndex((s) => s.id === 6);
