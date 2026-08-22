import { useMemo, useState } from "react";
import { CheckIcon, ChevronRightIcon, MailIcon, SmartphoneIcon } from "lucide-react";

import {
  Timeline,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline";
import { cn } from "@/lib/utils";
import {
  CLAIM_ALERTS,
  CLAIM_SLAS,
  CLAIM_STAGES,
  DEMO_CLAIM,
  INITIAL_CURRENT_INDEX,
  notificationsForStage,
  type ClaimAlert,
  type ClaimFlag,
  type ClaimNotification,
  type ClaimSla,
  type ClaimStage,
  type StageKind,
} from "./claimTrackingData";

const ZIGZAG_ITEM_CLASS = cn(
  "w-[calc(50%-1.5rem)] odd:ms-auto even:me-auto even:text-right even:group-data-[orientation=vertical]/timeline:ms-0 even:group-data-[orientation=vertical]/timeline:me-8",
  "even:group-data-[orientation=vertical]/timeline:**:data-[slot=timeline-indicator]:-right-6 even:group-data-[orientation=vertical]/timeline:**:data-[slot=timeline-indicator]:left-auto",
  "even:group-data-[orientation=vertical]/timeline:**:data-[slot=timeline-indicator]:translate-x-1/2 even:group-data-[orientation=vertical]/timeline:**:data-[slot=timeline-separator]:-right-6",
  "even:group-data-[orientation=vertical]/timeline:**:data-[slot=timeline-separator]:left-auto even:group-data-[orientation=vertical]/timeline:**:data-[slot=timeline-separator]:translate-x-1/2",
);

function stageDate(stage: ClaimStage, kind: StageKind) {
  if (kind === "upcoming") return "Pending";
  const stamp = stage.activities[0]?.at;
  if (!stamp) return stage.summary;
  return stamp.split(",")[0];
}

function stageKind(index: number, currentIndex: number): StageKind {
  if (index < currentIndex) return "completed";
  if (index === currentIndex) return "current";
  return "upcoming";
}

function KindBadge({ kind }: { kind: StageKind }) {
  const styles: Record<StageKind, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    current: "bg-emerald-50 text-emerald-800 border-emerald-300",
    upcoming: "bg-slate-50 text-slate-500 border-slate-200",
  };
  const labels: Record<StageKind, string> = {
    completed: "Completed",
    current: "In progress",
    upcoming: "Not started",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${styles[kind]}`}>
      {labels[kind]}
    </span>
  );
}

function flagClass(tone: ClaimFlag["tone"]) {
  if (tone === "ok") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (tone === "warn") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-blue-50 text-blue-700 border-blue-100";
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">{children}</h3>
  );
}

function NotificationStatusBadge({ status }: { status: ClaimNotification["status"] }) {
  const styles = {
    sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-800 border-amber-200",
    scheduled: "bg-slate-50 text-slate-500 border-slate-200",
  };
  const labels = {
    sent: "Delivered",
    pending: "Sending soon",
    scheduled: "Planned",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  "repairs.booking_completed": "Claim received",
  "repairs.assessor_appointed": "Assessor appointed",
  "repairs.draft_submitted": "Draft assessment submitted",
  "repairs.offers_sent": "Quotes requested from garages",
  "repairs.bidding_closed": "Quote bidding closed",
  "repairs.analysis_completed": "Quotation review complete",
  "repairs.repair_estimate": "Garage estimate received",
  "repairs.repair_authority_issued": "Repair authority issued",
  "repairs.repair_completed": "Repairs completed",
  "repairs.reinspection_assigned": "Reinspection scheduled",
  "repairs.reinspection_completed": "Reinspection complete",
  "repairs.request_insured_feedback": "Feedback requested",
  "repairs.release_letter_generated": "Release letter sent",
  "repairs.asset_collected": "Vehicle collected",
  "repairs.discharge_voucher_generated": "Discharge voucher sent",
};

function notificationTitle(notification: ClaimNotification) {
  if (notification.triggerEvent && NOTIFICATION_TYPE_LABELS[notification.triggerEvent]) {
    return NOTIFICATION_TYPE_LABELS[notification.triggerEvent];
  }
  return notification.subject;
}

function sentAtLabel(notification: ClaimNotification) {
  if (notification.sentAt) return notification.sentAt;
  if (notification.status === "scheduled") return "When this stage starts";
  if (notification.status === "pending") return "Shortly";
  return "Not yet sent";
}

function ChannelBadge({ channel }: { channel: ClaimNotification["channel"] }) {
  const isEmail = channel === "email";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-white text-slate-600 border-slate-200">
      {isEmail ? <MailIcon className="size-3" /> : <SmartphoneIcon className="size-3" />}
      {isEmail ? "Email" : "App"}
    </span>
  );
}

function NotificationCard({ notification }: { notification: ClaimNotification }) {
  const isEmail = notification.channel === "email";
  return (
    <article className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ChannelBadge channel={notification.channel} />
          <NotificationStatusBadge status={notification.status} />
        </div>
        <p className="text-sm font-semibold text-slate-900">{notificationTitle(notification)}</p>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        {isEmail && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Email subject</p>
            <p className="text-sm text-slate-800 mt-0.5 leading-snug">{notification.subject}</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Sent to</p>
            <p className="text-xs text-slate-700 mt-0.5">{notification.recipients}</p>
          </div>
          {notification.cc && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Copy sent to</p>
              <p className="text-xs text-slate-700 mt-0.5">{notification.cc}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
              {isEmail ? "Sent on" : "Sent"}
            </p>
            <p className="text-xs text-slate-700 mt-0.5">{sentAtLabel(notification)}</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">
            {isEmail ? "Message" : "Text"}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
            {notification.message}
          </p>
        </div>
      </div>
    </article>
  );
}

function ClaimSnapshot() {
  const rows = [
    { label: "Insured", value: DEMO_CLAIM.insured },
    { label: "Intermediary", value: DEMO_CLAIM.intermediary },
    { label: "Policy", value: DEMO_CLAIM.policy },
    { label: "Location", value: DEMO_CLAIM.location },
    { label: "Loss date", value: DEMO_CLAIM.lossDate },
    { label: "Chassis", value: DEMO_CLAIM.chassis },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 h-full">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Claim snapshot</p>
          <p className="text-sm font-semibold text-slate-800 mt-0.5">
            {DEMO_CLAIM.vehicle} · {DEMO_CLAIM.registration}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
          {DEMO_CLAIM.repairOption}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map((row) => (
          <div key={row.label}>
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{row.label}</p>
            <p className="text-xs text-slate-700 font-medium truncate">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsPanel({ alerts }: { alerts: ClaimAlert[] }) {
  return (
    <div>
      <SectionTitle>Claim alerts</SectionTitle>
      <div className="flex flex-col gap-2">
        {alerts.map((alert) => (
          <div key={alert.title} className={`rounded-lg border px-3 py-2 ${flagClass(alert.tone)}`}>
            <p className="text-xs font-semibold">{alert.title}</p>
            <p className="text-[11px] mt-0.5 opacity-80 leading-relaxed">{alert.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlaRow({ items }: { items: ClaimSla[] }) {
  const styles = {
    met: "bg-emerald-50 text-emerald-700 border-emerald-200",
    due: "bg-amber-50 text-amber-800 border-amber-200",
    upcoming: "bg-slate-50 text-slate-500 border-slate-200",
  };
  const labels = { met: "Met", due: "Due", upcoming: "Upcoming" };
  return (
    <div>
      <SectionTitle>SLA / TAT</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-800">{item.label}</p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${styles[item.status]}`}>
                {labels[item.status]}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{item.due}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressColumn({
  currentIndex,
  selectedIndex,
  onSelect,
}: {
  currentIndex: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const doneCount = currentIndex;
  const pct = Math.round((doneCount / CLAIM_STAGES.length) * 100);

  return (
    <aside className="w-[400px] shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-0">
      <div className="px-5 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-slate-800">Progress</h2>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
          <span>{doneCount} of {CLAIM_STAGES.length} stages complete</span>
          <span className="font-semibold text-blue-600">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6">
        <Timeline value={currentIndex + 1} className="w-full">
          {CLAIM_STAGES.map((stage, i) => {
            const kind = stageKind(i, currentIndex);
            const selected = i === selectedIndex;
            return (
              <TimelineItem
                key={stage.id}
                step={i + 1}
                className={cn(
                  ZIGZAG_ITEM_CLASS,
                  "cursor-pointer rounded-md px-1.5 py-1 transition-colors",
                  selected && kind !== "current" && "bg-muted",
                  kind === "current" && "bg-emerald-50 ring-2 ring-emerald-300/80",
                )}
                onClick={() => onSelect(i)}
              >
                <TimelineHeader>
                  <TimelineSeparator />
                  <TimelineDate className={kind === "current" ? "text-emerald-600 font-semibold" : undefined}>
                    {stageDate(stage, kind)}
                  </TimelineDate>
                  <TimelineTitle
                    className={cn(
                      "text-[13px] font-semibold leading-snug",
                      kind === "upcoming" && "text-muted-foreground",
                      kind === "current" && "text-emerald-900",
                      selected && kind !== "current" && "text-blue-800",
                    )}
                  >
                    {stage.name}
                  </TimelineTitle>
                  <TimelineIndicator
                    className={cn(
                      "flex items-center justify-center",
                      kind === "current" &&
                        "size-5 border-none bg-emerald-600 text-white ring-[3px] ring-emerald-200 shadow-sm shadow-emerald-200/80",
                      kind === "completed" && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {kind === "current" && <span className="size-2 rounded-full bg-white" aria-hidden="true" />}
                    {kind === "completed" && <CheckIcon className="size-2.5" strokeWidth={3} />}
                  </TimelineIndicator>
                </TimelineHeader>
              </TimelineItem>
            );
          })}
        </Timeline>
      </div>
    </aside>
  );
}

function DetailColumn({
  stage,
  kind,
  index,
}: {
  stage: ClaimStage;
  kind: StageKind;
  index: number;
}) {
  const notifications = notificationsForStage(stage.id, kind);

  return (
    <main className="flex-1 min-w-0 flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span
            className={cn(
              "inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold",
              kind === "current" ? "bg-emerald-600 ring-2 ring-emerald-200" : "bg-blue-600",
            )}
          >
            {index + 1}
          </span>
          <KindBadge kind={kind} />
          {stage.parentStage && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-slate-50 text-slate-500 border-slate-200">
              Sub-status of {stage.parentStage}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: "'DM Serif Display', serif" }}>
          {stage.name}
        </h1>
        <p className="text-sm text-slate-500 mb-4">{stage.caption}</p>

        {stage.flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {stage.flags.map((flag) => (
              <span key={flag.label} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${flagClass(flag.tone)}`}>
                {flag.label}
              </span>
            ))}
          </div>
        )}

        <SectionTitle>Updates sent at this stage</SectionTitle>

        {notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
            <MailIcon className="size-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">No updates for this stage yet</p>
            <p className="text-xs text-slate-400 mt-1">
              {kind === "upcoming"
                ? "Emails will go out once this stage begins."
                : "Nothing has been sent for this step."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {notifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))}
          </div>
        )}

        {kind === "upcoming" && notifications.length > 0 && (
          <p className="text-xs text-slate-400 mt-4 leading-relaxed">
            These updates are planned and will be sent automatically once earlier steps are complete.
          </p>
        )}
      </div>
    </main>
  );
}

export default function ClaimTracking({ onBack }: { onBack: () => void }) {
  const [currentIndex] = useState(INITIAL_CURRENT_INDEX);
  const [selectedIndex, setSelectedIndex] = useState(INITIAL_CURRENT_INDEX);
  const [showSnapshot, setShowSnapshot] = useState(false);

  const stage = CLAIM_STAGES[selectedIndex];
  const kind = stageKind(selectedIndex, currentIndex);
  const currentName = CLAIM_STAGES[currentIndex].name;

  const contextBits = useMemo(
    () => [
      DEMO_CLAIM.number,
      `${DEMO_CLAIM.vehicle} · ${DEMO_CLAIM.registration}`,
      DEMO_CLAIM.repairOption,
      DEMO_CLAIM.excess,
      `Analyst · ${DEMO_CLAIM.analyst}`,
    ],
    [],
  );

  return (
    <div className="h-screen flex flex-col bg-white text-slate-800">
      <header className="shrink-0 h-12 px-4 border-b border-slate-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 19.5L12 4.5l9 15H3z" />
            </svg>
          </div>
          <p className="text-xs font-bold tracking-[0.18em] text-slate-700">CLAIM STATUS</p>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            Claim updates
          </span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
          aria-label="Close claim tracking"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div className="shrink-0 px-5 py-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center gap-4 overflow-x-auto">
        {contextBits.map((bit, i) => (
          <span key={bit} className="flex items-center gap-4 shrink-0">
            {i > 0 && <span className="w-px h-3 bg-slate-300" />}
            <span className="text-xs text-slate-600 font-medium">{bit}</span>
          </span>
        ))}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowSnapshot((open) => !open)}
            aria-expanded={showSnapshot}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors",
              showSnapshot
                ? "text-blue-700 bg-blue-50 border-blue-200"
                : "text-slate-600 bg-white border-slate-200 hover:bg-white/80",
            )}
          >
            Snapshot
            <ChevronRightIcon className={cn("size-3.5 transition-transform duration-200", showSnapshot && "rotate-90")} />
          </button>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            Current · {currentName}
          </span>
        </div>
      </div>

      {showSnapshot && (
        <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ animation: "slideIn 0.18s ease" }}>
          <ClaimSnapshot />
          <AlertsPanel alerts={CLAIM_ALERTS} />
          <SlaRow items={CLAIM_SLAS} />
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <ProgressColumn currentIndex={currentIndex} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
        <DetailColumn stage={stage} kind={kind} index={selectedIndex} />
      </div>
    </div>
  );
}
