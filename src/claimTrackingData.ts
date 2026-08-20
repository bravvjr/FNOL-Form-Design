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

export type ClaimPerson = {
  name: string;
  role: string;
};

export type ClaimFlag = {
  label: string;
  tone: "ok" | "warn" | "info";
};

export type ClaimPart = {
  name: string;
  category: "Part" | "Service";
  qty: number;
  action: "Repair" | "Replace";
  amount: string;
  status: string;
};

export type ClaimOffer = {
  provider: string;
  offeredAs: string;
  amount: string;
  status: string;
  quoted: string;
};

export type ClaimCheckoff = {
  name: string;
  repair: string;
  receipt: string;
  delivery: string;
};

export type ClaimPhoto = {
  label: string;
  association: string;
  src: string;
};

export type ClaimAlert = {
  title: string;
  detail: string;
  tone: "ok" | "warn" | "info";
};

export type ClaimSla = {
  label: string;
  due: string;
  status: "met" | "due" | "upcoming";
};

export type ClaimComment = {
  at: string;
  author: string;
  role: string;
  body: string;
  field?: string;
};

export type ClaimStage = {
  id: number;
  code: string;
  name: string;
  caption: string;
  summary: string;
  owner: string;
  ownerRole: string;
  narrative: string;
  parentStage?: string;
  people: ClaimPerson[];
  flags: ClaimFlag[];
  fields: ClaimField[];
  costs: ClaimField[];
  parts: ClaimPart[];
  offers: ClaimOffer[];
  checkoffs: ClaimCheckoff[];
  photos: ClaimPhoto[];
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
  analyst: "Mary Njeri",
  lossDate: "11 Aug 2026",
  nature: "Normal claim · Own damage",
  claimType: "NORMAL_CLAIM",
  garage: "Westlands AutoWorks",
  location: "Garage (Westlands AutoWorks)",
  repairOption: "Repair Authority",
  excess: "KES 15,000 due",
  sumInsured: "KES 1,450,000",
  chassis: "NZE161-8093312",
  odometer: "86,412 km",
  color: "Silver",
};

export const CLAIM_ALERTS: ClaimAlert[] = [
  { title: "Excess unpaid", detail: "KES 15,000 is due from the insured before release.", tone: "warn" },
  { title: "Reinspection required", detail: "Config requires an assessor reinspection after workshop completion.", tone: "info" },
  { title: "No investigation", detail: "No investigator appointment is pending on this claim.", tone: "ok" },
  { title: "Not under repudiation", detail: "The file is proceeding on the repair-authority path.", tone: "ok" },
];

export const CLAIM_SLAS: ClaimSla[] = [
  { label: "Draft report", due: "15 Aug 2026", status: "met" },
  { label: "Quote submission", due: "16 Aug 2026", status: "met" },
  { label: "Repair due date", due: "27 Aug 2026", status: "due" },
  { label: "Reinspection", due: "Not scheduled", status: "upcoming" },
];

export const CLAIM_COMMENTS: ClaimComment[] = [
  { at: "13 Aug, 12:20", author: "Peter Otieno", role: "Assessor", field: "Bonnet", body: "Crease is repairable. No structural crush on the slam panel." },
  { at: "16 Aug, 10:22", author: "Mary Njeri", role: "Claim analyst", field: "Excess", body: "Remind insured that excess is collected at the garage on release." },
  { at: "20 Aug, 08:44", author: "Samuel Kiptoo", role: "Workshop", field: "Paint", body: "Three panels in booth. Expecting cure complete 22 Aug if weather holds." },
];

const PARTS: ClaimPart[] = [
  { name: "Front bumper skin", category: "Part", qty: 1, action: "Replace", amount: "KES 38,500", status: "Fitted" },
  { name: "LH headlamp assembly", category: "Part", qty: 1, action: "Replace", amount: "KES 52,200", status: "Fitted" },
  { name: "Bonnet", category: "Part", qty: 1, action: "Repair", amount: "KES 18,000", status: "In paint" },
  { name: "Strip, fit and alignment", category: "Service", qty: 1, action: "Repair", amount: "KES 42,000", status: "In progress" },
  { name: "Paint — 3 panels", category: "Service", qty: 3, action: "Repair", amount: "KES 18,900", status: "In progress" },
];

const COST_FINAL: ClaimField[] = [
  { label: "Parts excl. VAT", value: "KES 108,700" },
  { label: "Services excl. VAT", value: "KES 60,900" },
  { label: "Gross excl. VAT", value: "KES 169,600" },
  { label: "Excess deducted", value: "KES 15,000" },
  { label: "Net excl. VAT", value: "KES 154,600" },
  { label: "VAT 16%", value: "KES 24,736" },
  { label: "Net incl. VAT", value: "KES 179,336", emphasize: true },
];

export const CLAIM_STAGES: ClaimStage[] = [
  {
    id: 1,
    code: "INITIATION",
    name: "Initiation",
    caption: "Booking captured and claim file opened",
    summary: "FNOL-M8K2P4 · Normal claim",
    owner: "Jane Mwangi",
    ownerRole: "Intermediary",
    narrative:
      "The claim was booked from the intermediary portal. Policy cover is active, the own-damage asset was created, and required claim documents were requested. Processing stage is ClaimProcessingStage.INITIATION.",
    people: [
      { name: "Jane Mwangi", role: "Intermediary" },
      { name: "Mary Njeri", role: "Claim analyst" },
      { name: "John Kamau Njoroge", role: "Insured" },
    ],
    flags: [
      { label: "Claim form submitted", tone: "ok" },
      { label: "Insured consent captured", tone: "ok" },
      { label: "Excess not yet paid", tone: "warn" },
      { label: "Not late reporting", tone: "info" },
    ],
    fields: [
      { label: "Claim number", value: "CLM-2026-08421" },
      { label: "Initiation source", value: "Internal · intermediary" },
      { label: "Claim type", value: "NORMAL_CLAIM" },
      { label: "Date of loss", value: "11 Aug 2026" },
      { label: "Reported", value: "12 Aug 2026, 09:14" },
      { label: "Vehicle location", value: "Garage (Westlands AutoWorks)" },
      { label: "Nature of damage", value: "Mild or major damage" },
      { label: "Recommendation", value: "Assessor-based review" },
    ],
    costs: [],
    parts: [],
    offers: [],
    checkoffs: [],
    photos: [
      { label: "Front impact", association: "DRAFT", src: "https://images.pexels.com/photos/38339706/pexels-photo-38339706.jpeg" },
      { label: "LH headlamp", association: "DRAFT", src: "https://images.pexels.com/photos/37160459/pexels-photo-37160459.jpeg" },
    ],
    documents: [
      { name: "FNOL Form.pdf", kind: "pdf", size: "420 KB", uploadedAt: "12 Aug 2026", uploadedBy: "Jane Mwangi" },
      { name: "KYC Document.pdf", kind: "pdf", size: "1.1 MB", uploadedAt: "12 Aug 2026", uploadedBy: "Jane Mwangi" },
      { name: "Police Abstract.pdf", kind: "pdf", size: "880 KB", uploadedAt: "12 Aug 2026", uploadedBy: "Jane Mwangi" },
      { name: "Driving Licence.jpg", kind: "image", size: "640 KB", uploadedAt: "12 Aug 2026", uploadedBy: "Jane Mwangi" },
    ],
    activities: [
      { at: "12 Aug, 09:14", actor: "Jane Mwangi", role: "Intermediary", note: "Submitted booking with supporting documents." },
      { at: "12 Aug, 09:22", actor: "System", role: "Intake", note: "Policy MOT-884219 validated. Cover confirmed active." },
      { at: "12 Aug, 09:28", actor: "Mary Njeri", role: "Claim analyst", note: "Claim file opened. Own-damage asset created." },
    ],
  },
  {
    id: 2,
    code: "DRAFT_ASSESSMENT",
    name: "Draft Assessment",
    caption: "Assessor appointed and inspection started",
    summary: "In progress · P. Otieno",
    owner: "Peter Otieno",
    ownerRole: "Motor assessor",
    narrative:
      "An assessment was created on booking. Peter Otieno accepted the assignment and inspected at the nominated garage. Draft report due date is tracked on the assessment. Endorsement is still allowed at this stage.",
    people: [
      { name: "Peter Otieno", role: "Assessor" },
      { name: "Grace Wanjiku", role: "Reviewer" },
      { name: "Daniel Omondi", role: "Account handler" },
    ],
    flags: [
      { label: "Assessment in progress", tone: "info" },
      { label: "Not yet endorsed", tone: "warn" },
      { label: "External assessment: no", tone: "info" },
    ],
    fields: [
      { label: "Assessment status", value: "in_progress" },
      { label: "Assigned", value: "12 Aug 2026, 14:20" },
      { label: "Inspection", value: "13 Aug 2026, 10:00" },
      { label: "Draft report due", value: "15 Aug 2026" },
      { label: "Report status", value: "Pending" },
      { label: "Work assignment", value: "Manual" },
      { label: "VAT on parts/services", value: "16% · inclusive default" },
      { label: "Damage summary", value: "Bumper, LH headlamp, bonnet crease" },
    ],
    costs: [{ label: "Preliminary estimate", value: "KES 186,400", emphasize: true }],
    parts: PARTS.map((part) => ({ ...part, status: "Draft" })),
    offers: [],
    checkoffs: [],
    photos: [
      { label: "Front bumper", association: "DRAFT", src: "https://images.pexels.com/photos/11627936/pexels-photo-11627936.jpeg" },
      { label: "LH headlamp", association: "DRAFT", src: "https://images.pexels.com/photos/37160459/pexels-photo-37160459.jpeg" },
      { label: "Bonnet crease", association: "DRAFT", src: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=400&h=240&q=80" },
      { label: "Odometer", association: "DRAFT", src: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=400&h=240&q=80" },
    ],
    documents: [
      { name: "Scene & damage photos.zip", kind: "image", size: "8.4 MB", uploadedAt: "13 Aug 2026", uploadedBy: "Peter Otieno" },
      { name: "Draft worksheet.pdf", kind: "pdf", size: "310 KB", uploadedAt: "13 Aug 2026", uploadedBy: "Peter Otieno" },
    ],
    activities: [
      { at: "12 Aug, 14:20", actor: "Mary Njeri", role: "Claim analyst", note: "Assigned Peter Otieno as motor assessor." },
      { at: "12 Aug, 15:02", actor: "Peter Otieno", role: "Assessor", note: "Accepted assessment assignment." },
      { at: "13 Aug, 10:00", actor: "Peter Otieno", role: "Assessor", note: "Completed physical inspection at garage." },
    ],
    primaryAction: "Endorse assessment",
    secondaryAction: "Request internal review",
  },
  {
    id: 10,
    code: "PENDING_INTERNAL_ASSESSOR_REVIEW",
    name: "Pending Internal Assessor Review",
    caption: "QA / senior assessor reviews the draft",
    summary: "Cleared · G. Wanjiku",
    owner: "Grace Wanjiku",
    ownerRole: "Senior assessor",
    parentStage: "Draft Assessment",
    narrative:
      "This is a display sub-status, not a core ClaimProcessingStage. The draft was sent for internal QA. No total-loss path; estimate is within sum insured. Change requests can be raised against the draft report.",
    people: [
      { name: "Grace Wanjiku", role: "QA reviewer" },
      { name: "Peter Otieno", role: "Assessor" },
    ],
    flags: [
      { label: "QA cleared", tone: "ok" },
      { label: "No total-loss indicators", tone: "ok" },
    ],
    fields: [
      { label: "Reviewer", value: "Grace Wanjiku" },
      { label: "Submitted for review", value: "13 Aug 2026, 16:45" },
      { label: "Decision", value: "Proceed to draft report" },
      { label: "Change request", value: "None" },
      { label: "Sum insured check", value: "KES 1,450,000 · within limit" },
      { label: "Pre-accident value", value: "KES 980,000" },
    ],
    costs: [],
    parts: [],
    offers: [],
    checkoffs: [],
    photos: [],
    documents: [
      { name: "Internal review checklist.pdf", kind: "pdf", size: "180 KB", uploadedAt: "13 Aug 2026", uploadedBy: "Grace Wanjiku" },
    ],
    activities: [
      { at: "13 Aug, 16:45", actor: "Peter Otieno", role: "Assessor", note: "Submitted draft findings for internal review." },
      { at: "13 Aug, 20:40", actor: "Grace Wanjiku", role: "Senior assessor", note: "Cleared. No total-loss path required." },
    ],
  },
  {
    id: 11,
    code: "ASSESSMENT_DRAFT_REPORT",
    name: "Assessment Draft Report",
    caption: "Formal draft of parts, labour and paint",
    summary: "Assessor draft · KES 189,400",
    owner: "Peter Otieno",
    ownerRole: "Motor assessor",
    parentStage: "Draft Assessment",
    narrative:
      "Draft report type is ASSESSOR. Vehicle particulars, pre-accident value, estimated repair days and painting quote type are stored on draft general_data. The garage was invited to return a matching estimate.",
    people: [{ name: "Peter Otieno", role: "Assessor" }],
    flags: [
      { label: "Draft submitted", tone: "ok" },
      { label: "Preferred option: Repair Authority", tone: "info" },
    ],
    fields: [
      { label: "Report type", value: "ASSESSOR" },
      { label: "Report status", value: "External draft submitted" },
      { label: "Issued", value: "14 Aug 2026" },
      { label: "Odometer", value: "86,412 km" },
      { label: "Chassis", value: "NZE161-8093312" },
      { label: "Estimated repair days", value: "7" },
      { label: "Painting quote type", value: "Price per panel" },
      { label: "Painting panels", value: "3" },
    ],
    costs: [
      { label: "Labour", value: "KES 42,000" },
      { label: "Parts", value: "KES 128,500" },
      { label: "Paint", value: "KES 18,900" },
      { label: "Draft total", value: "KES 189,400", emphasize: true },
      { label: "Policy excess", value: "KES 15,000" },
    ],
    parts: PARTS.map((part) => ({ ...part, status: "Draft submitted" })),
    offers: [],
    checkoffs: [],
    photos: [],
    documents: [
      { name: "Assessment Draft Report.pdf", kind: "pdf", size: "1.4 MB", uploadedAt: "14 Aug 2026", uploadedBy: "Peter Otieno" },
      { name: "Parts schedule.xlsx", kind: "pdf", size: "96 KB", uploadedAt: "14 Aug 2026", uploadedBy: "Peter Otieno" },
    ],
    activities: [
      { at: "14 Aug, 11:05", actor: "Peter Otieno", role: "Assessor", note: "Issued assessor draft report." },
      { at: "14 Aug, 11:12", actor: "System", role: "Workflow", note: "Draft report forwarded to Westlands AutoWorks." },
    ],
    primaryAction: "Complete report",
    secondaryAction: "Request external review",
  },
  {
    id: 12,
    code: "GARAGE_QUOTATION_SUBMITTED",
    name: "Garage Quotation Submitted",
    caption: "Nominated garage returns an estimate",
    summary: "Adopted · parts and prices",
    owner: "Westlands AutoWorks",
    ownerRole: "Nominated garage",
    parentStage: "Draft Assessment",
    narrative:
      "Garage estimates can be initiated by insurance or the garage. This estimate was adopted with scope PARTS_AND_PRICES. Variance versus the assessor draft is mainly on the bumper skin. Quote TAT is seven working days once authority is issued.",
    people: [
      { name: "Westlands AutoWorks", role: "Garage" },
      { name: "Peter Otieno", role: "Assessor" },
    ],
    flags: [
      { label: "Estimate adopted", tone: "ok" },
      { label: "Scope: parts and prices", tone: "info" },
    ],
    fields: [
      { label: "Estimate initiator", value: "Garage" },
      { label: "Task status", value: "Submitted" },
      { label: "Submitted", value: "15 Aug 2026, 13:30" },
      { label: "Adoption scope", value: "PARTS_AND_PRICES" },
      { label: "Quoted TAT", value: "7 working days" },
      { label: "Variance vs assessor", value: "+ KES 4,800" },
    ],
    costs: [{ label: "Quoted amount", value: "KES 194,200", emphasize: true }],
    parts: [],
    offers: [],
    checkoffs: [],
    photos: [],
    documents: [
      { name: "Garage estimate.pdf", kind: "pdf", size: "540 KB", uploadedAt: "15 Aug 2026", uploadedBy: "Westlands AutoWorks" },
      { name: "OEM parts list.pdf", kind: "pdf", size: "220 KB", uploadedAt: "15 Aug 2026", uploadedBy: "Westlands AutoWorks" },
    ],
    activities: [
      { at: "15 Aug, 13:30", actor: "Westlands AutoWorks", role: "Garage", note: "Uploaded garage estimate." },
      { at: "15 Aug, 14:02", actor: "Peter Otieno", role: "Assessor", note: "Adopted estimate: parts and prices." },
    ],
    primaryAction: "Adopt garage estimate",
    secondaryAction: "Decline garage assessment",
  },
  {
    id: 3,
    code: "OFFERS",
    name: "Offers",
    caption: "RFQ sent to garages and part suppliers",
    summary: "1 endorsed · bidding closed",
    owner: "Mary Njeri",
    ownerRole: "Claim analyst",
    narrative:
      "An offer group (PRIMARY / garage) was sent. Bidding ran 15–16 Aug. Westlands AutoWorks quoted as garage; AutoParts Kenya quoted as part supplier. The insured was also shown cash-in-lieu as an alternative. They accepted Repair Authority.",
    people: [
      { name: "Mary Njeri", role: "Claim analyst" },
      { name: "John Kamau Njoroge", role: "Insured" },
    ],
    flags: [
      { label: "Bidding closed", tone: "ok" },
      { label: "Offer endorsed", tone: "ok" },
      { label: "Repair Authority chosen", tone: "info" },
    ],
    fields: [
      { label: "Offer group", value: "Primary garage offers" },
      { label: "Phase / scope", value: "PRIMARY / PRIMARY" },
      { label: "Bidding window", value: "15 Aug 17:00 – 16 Aug 12:00" },
      { label: "Insured choice", value: "Repair Authority", emphasize: true },
      { label: "Cash in lieu alternative", value: "KES 165,000" },
      { label: "Excess reminder", value: "KES 15,000 at release" },
    ],
    costs: [],
    parts: [],
    offers: [
      { provider: "Westlands AutoWorks", offeredAs: "Garage", amount: "KES 191,600", status: "Endorsed", quoted: "100%" },
      { provider: "Industrial Area Motors", offeredAs: "Garage", amount: "KES 198,400", status: "Rejected", quoted: "100%" },
      { provider: "AutoParts Kenya", offeredAs: "Part supplier", amount: "KES 90,700", status: "Quoted", quoted: "84%" },
    ],
    checkoffs: [],
    photos: [],
    documents: [
      { name: "Request for quotation.pdf", kind: "pdf", size: "210 KB", uploadedAt: "15 Aug 2026", uploadedBy: "Claims Desk" },
      { name: "Quotation summary.pdf", kind: "pdf", size: "340 KB", uploadedAt: "16 Aug 2026", uploadedBy: "System" },
      { name: "Offer acceptance.pdf", kind: "pdf", size: "190 KB", uploadedAt: "16 Aug 2026", uploadedBy: "John Kamau Njoroge" },
    ],
    activities: [
      { at: "15 Aug, 17:40", actor: "Mary Njeri", role: "Claim analyst", note: "Sent offer group to two garages and one supplier." },
      { at: "16 Aug, 09:10", actor: "Westlands AutoWorks", role: "Garage", note: "Submitted quotation. Marked endorsed." },
      { at: "16 Aug, 10:18", actor: "John Kamau Njoroge", role: "Insured", note: "Accepted Repair Authority over cash in lieu." },
    ],
    primaryAction: "Close quote submission",
    secondaryAction: "Extend bidding",
  },
  {
    id: 4,
    code: "ASSESSMENT_FINAL_REPORT",
    name: "Assessment Final Report",
    caption: "Agreed figures locked for authority",
    summary: "Internal assessor · KES 179,336 incl.",
    owner: "Peter Otieno",
    ownerRole: "Motor assessor",
    narrative:
      "Final report type is INTERNAL_ASSESSOR. Costing uses parts/services excl. VAT, excess, then 16% VAT. Configs deduct excess, apply contribution to garage, and keep supplier details unmasked on the RA path.",
    people: [
      { name: "Peter Otieno", role: "Assessor" },
      { name: "Grace Wanjiku", role: "Reviewer" },
    ],
    flags: [
      { label: "Final report completed", tone: "ok" },
      { label: "Repair option: Repair Authority", tone: "info" },
    ],
    fields: [
      { label: "Report type", value: "INTERNAL_ASSESSOR" },
      { label: "Report status", value: "Internal final completed" },
      { label: "Issued", value: "17 Aug 2026" },
      { label: "Pre-accident value", value: "KES 980,000" },
      { label: "Sum insured", value: "KES 1,450,000" },
      { label: "Estimated repair days", value: "7" },
      { label: "Handling fee", value: "Not applied" },
      { label: "Contribution payable to", value: "Garage" },
    ],
    costs: COST_FINAL,
    parts: PARTS.map((part) => ({ ...part, status: "Final" })),
    offers: [],
    checkoffs: [],
    photos: [],
    documents: [
      { name: "Assessment Final Report.pdf", kind: "pdf", size: "1.6 MB", uploadedAt: "17 Aug 2026", uploadedBy: "Peter Otieno" },
    ],
    activities: [
      { at: "17 Aug, 09:50", actor: "Peter Otieno", role: "Assessor", note: "Agreed KES 169,600 excl. VAT with garage." },
      { at: "17 Aug, 10:05", actor: "Grace Wanjiku", role: "Senior assessor", note: "Countersigned internal final report." },
    ],
    primaryAction: "Complete report",
    secondaryAction: "Stage repair",
  },
  {
    id: 5,
    code: "REPAIR_AUTHORITY_ISSUING",
    name: "Repair Authority Issuing",
    caption: "Approval matrix then RA letters",
    summary: "Approved · RA issued",
    owner: "Claims authorisations",
    ownerRole: "Operations",
    narrative:
      "Repair authority goes through the approval matrix before letters are generated. Both garage RA and insured RA letters were issued. CIL was not authorised. The garage acknowledged and booked the vehicle in.",
    people: [
      { name: "Faith Achieng", role: "Approver" },
      { name: "Mary Njeri", role: "Initiating analyst" },
    ],
    flags: [
      { label: "Approval finalized", tone: "ok" },
      { label: "CIL not authorised", tone: "info" },
    ],
    fields: [
      { label: "Approval type", value: "REPAIR_AUTHORITY" },
      { label: "Approval status", value: "FINALIZED" },
      { label: "Issued", value: "18 Aug 2026" },
      { label: "Authorised amount", value: "KES 179,336 incl. VAT", emphasize: true },
      { label: "Valid until", value: "18 Sep 2026" },
      { label: "Garage RA letter", value: "Generated" },
      { label: "Insured RA letter", value: "Generated" },
      { label: "Booking date", value: "19 Aug 2026" },
    ],
    costs: COST_FINAL,
    parts: [],
    offers: [],
    checkoffs: [],
    photos: [],
    documents: [
      { name: "Repair Authority letter.pdf", kind: "pdf", size: "340 KB", uploadedAt: "18 Aug 2026", uploadedBy: "Claims Authorisations" },
      { name: "Insured RA letter.pdf", kind: "pdf", size: "290 KB", uploadedAt: "18 Aug 2026", uploadedBy: "Claims Authorisations" },
    ],
    activities: [
      { at: "18 Aug, 09:15", actor: "Mary Njeri", role: "Claim analyst", note: "Initiated repair authority approval." },
      { at: "18 Aug, 10:40", actor: "Faith Achieng", role: "Approver", note: "Approved within matrix limit. Status FINALIZED." },
      { at: "18 Aug, 12:04", actor: "Westlands AutoWorks", role: "Garage", note: "Acknowledged RA. Slot booked for 19 Aug." },
    ],
    primaryAction: "Issue repair authority",
    secondaryAction: "Request changes",
  },
  {
    id: 6,
    code: "REPAIRS",
    name: "Repairs",
    caption: "Vehicle is in the workshop",
    summary: "INPROGRESS · paint stage",
    owner: "Samuel Kiptoo",
    ownerRole: "Workshop lead",
    narrative:
      "Repair status is INPROGRESS. Parts are checked off individually (repair completed, receipt, delivery). OEM bumper and headlamp are fitted. Bonnet and paint remain open. A supplementary can still be raised from this stage if hidden damage appears.",
    people: [
      { name: "Samuel Kiptoo", role: "Workshop lead" },
      { name: "Westlands AutoWorks", role: "Repairer" },
    ],
    flags: [
      { label: "Repair in progress", tone: "info" },
      { label: "Not halted", tone: "ok" },
      { label: "Reinspection will be required", tone: "warn" },
    ],
    fields: [
      { label: "Repair status", value: "INPROGRESS" },
      { label: "Issue type", value: "FINAL" },
      { label: "Started", value: "19 Aug 2026" },
      { label: "Repair due date", value: "27 Aug 2026", emphasize: true },
      { label: "Work status", value: "1 · in progress" },
      { label: "Last garage update", value: "20 Aug 2026, 08:40" },
      { label: "Require repair images", value: "Yes" },
      { label: "Supplementary", value: "None open" },
    ],
    costs: [{ label: "Authorised incl. VAT", value: "KES 179,336", emphasize: true }],
    parts: PARTS,
    offers: [],
    checkoffs: [
      { name: "Front bumper skin", repair: "Completed", receipt: "Received & acknowledged", delivery: "Delivered" },
      { name: "LH headlamp assembly", repair: "Completed", receipt: "Received", delivery: "Delivered" },
      { name: "Bonnet", repair: "Not completed", receipt: "N/A", delivery: "N/A" },
      { name: "Strip, fit and alignment", repair: "In progress", receipt: "N/A", delivery: "N/A" },
      { name: "Paint — 3 panels", repair: "In progress", receipt: "N/A", delivery: "N/A" },
    ],
    photos: [
      { label: "Parts fitted", association: "REPAIR_CONFIRMATION", src: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=400&h=240&q=80" },
      { label: "Paint booth", association: "REPAIR_CONFIRMATION", src: "https://images.pexels.com/photos/4756887/pexels-photo-4756887.jpeg" },
      { label: "Headlamp receipt", association: "PART_RECEIPT", src: "https://images.pexels.com/photos/3807226/pexels-photo-3807226.jpeg" },
    ],
    documents: [
      { name: "Work order WO-4412.pdf", kind: "pdf", size: "210 KB", uploadedAt: "19 Aug 2026", uploadedBy: "Westlands AutoWorks" },
      { name: "Progress photo — parts fitted.jpg", kind: "image", size: "1.8 MB", uploadedAt: "20 Aug 2026", uploadedBy: "Samuel Kiptoo" },
      { name: "Progress photo — paint booth.jpg", kind: "image", size: "2.1 MB", uploadedAt: "20 Aug 2026", uploadedBy: "Samuel Kiptoo" },
    ],
    activities: [
      { at: "19 Aug, 08:15", actor: "Samuel Kiptoo", role: "Workshop", note: "Vehicle booked in. Strip-down started." },
      { at: "19 Aug, 16:40", actor: "Samuel Kiptoo", role: "Workshop", note: "Bumper and headlamp receipt acknowledged." },
      { at: "20 Aug, 08:40", actor: "Samuel Kiptoo", role: "Workshop", note: "Parts fitted. Moved to paint booth." },
    ],
    primaryAction: "Mark repair complete",
    secondaryAction: "Request garage update",
  },
  {
    id: 13,
    code: "REPAIR_COMPLETED",
    name: "Repair Completed",
    caption: "Garage confirms works are finished",
    summary: "Awaiting completion notice",
    owner: "Westlands AutoWorks",
    ownerRole: "Approved garage",
    parentStage: "Repairs",
    narrative:
      "Display sub-status of Repairs. Completing the job sets date_completed, stores completion notes on general_data, and can move the claim to Reinspection if an assessor is assigned. Invoice, quality checklist and completion photos land here.",
    people: [{ name: "Westlands AutoWorks", role: "Garage" }],
    flags: [{ label: "Waiting on garage sign-off", tone: "warn" }],
    fields: [
      { label: "Repair status", value: "INPROGRESS → COMPLETED" },
      { label: "Completion date", value: "Pending" },
      { label: "Completion notes", value: "Not submitted" },
      { label: "Invoice vs authority", value: "—" },
      { label: "Ready for inspect", value: "No" },
    ],
    costs: [],
    parts: [],
    offers: [],
    checkoffs: [],
    photos: [],
    documents: [],
    activities: [],
    primaryAction: "Confirm completion",
    secondaryAction: "Open supplementary",
  },
  {
    id: 7,
    code: "REINSPECTION",
    name: "Reinspection",
    caption: "Post-repair quality check",
    summary: "Not scheduled",
    owner: "Peter Otieno",
    ownerRole: "Motor assessor",
    narrative:
      "Reinspection source can be garage, external assessor or internal assessor. Parts are checked off as ok / not_ok with comments. A fail raises a change request; a pass unlocks release documents.",
    people: [{ name: "Peter Otieno", role: "Assessor" }],
    flags: [{ label: "Not scheduled", tone: "warn" }],
    fields: [
      { label: "Source", value: "Internal assessor (expected)" },
      { label: "Work report status", value: "PENDING" },
      { label: "Reinspection due", value: "—" },
      { label: "Result", value: "—" },
      { label: "Change request", value: "—" },
    ],
    costs: [],
    parts: [],
    offers: [],
    checkoffs: PARTS.map((part) => ({
      name: part.name,
      repair: "Pending inspect",
      receipt: "—",
      delivery: "—",
    })),
    photos: [],
    documents: [],
    activities: [],
    primaryAction: "Assign reinspection",
    secondaryAction: "Allow garage reinspection",
  },
  {
    id: 8,
    code: "RELEASE",
    name: "Release",
    caption: "Handover, DV and feedback",
    summary: "Not started",
    owner: "Westlands AutoWorks",
    ownerRole: "Approved garage",
    narrative:
      "Release status moves REINSPECTION → PENDING → RELEASE_COMPLETED. Settlement documents are a discharge voucher, feedback form and release letter. Excess is collected before the vehicle leaves. Delivery mode follows the FNOL preference.",
    people: [
      { name: "John Kamau Njoroge", role: "Insured" },
      { name: "Westlands AutoWorks", role: "Garage" },
    ],
    flags: [
      { label: "Excess still due", tone: "warn" },
      { label: "DV not generated", tone: "info" },
    ],
    fields: [
      { label: "Release status", value: "—" },
      { label: "Delivery mode", value: "Garage collection" },
      { label: "Excess collected", value: "KES 15,000 due" },
      { label: "Discharge voucher", value: "Not generated" },
      { label: "Feedback form", value: "Not generated" },
      { label: "Release letter", value: "Not generated" },
    ],
    costs: [],
    parts: [],
    offers: [],
    checkoffs: [],
    photos: [],
    documents: [],
    activities: [],
    primaryAction: "Generate discharge voucher",
    secondaryAction: "Record release",
  },
  {
    id: 9,
    code: "CLOSED",
    name: "Closed",
    caption: "File settled and archived",
    summary: "Not started",
    owner: "Claims desk",
    ownerRole: "Operations",
    narrative:
      "Closing sets processing_stage to CLOSED after release is complete. Garage settlement, signed DV and feedback are archived. A 90-day reopen window remains for snags.",
    people: [{ name: "Mary Njeri", role: "Claim analyst" }],
    flags: [{ label: "File still open", tone: "info" }],
    fields: [
      { label: "Closed on", value: "—" },
      { label: "Settlement amount", value: "KES 179,336 (expected)" },
      { label: "Payment status", value: "—" },
      { label: "Archive reference", value: "—" },
      { label: "Reopen window", value: "90 days after close" },
    ],
    costs: COST_FINAL,
    parts: [],
    offers: [],
    checkoffs: [],
    photos: [],
    documents: [],
    activities: [],
    primaryAction: "Close claim",
  },
];

export const INITIAL_CURRENT_INDEX = CLAIM_STAGES.findIndex((s) => s.id === 6);
