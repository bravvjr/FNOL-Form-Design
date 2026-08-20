import { useMemo, useState } from "react";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";

import { Badge } from "@/components/reui/badge";
import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  CLAIM_STAGES,
  DEMO_CLAIM,
  INITIAL_CURRENT_INDEX,
  type ClaimActivity,
  type ClaimDocument,
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

function activityStatus(kind: StageKind, index: number, total: number) {
  if (kind === "upcoming" || total === 0) return "pending";
  if (kind === "completed") return "completed";
  if (index === total - 1) return "active";
  return "completed";
}

function activityDuration(status: string, item: ClaimActivity) {
  if (status === "completed") return item.at.includes(",") ? item.at.split(",")[1].trim() : "Done";
  if (status === "active") return "Live";
  return "Pending";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckIcon className="size-3.5" />;
  if (status === "active") return <Spinner className="size-3.5" />;
  return <CircleIcon className="size-3.5" />;
}

function StatusBadge({ status, duration }: { status: string; duration: string }) {
  const variant =
    status === "completed" ? "success-light" : status === "active" ? "info-light" : "warning-light";

  return (
    <Badge variant={variant} size="sm">
      {duration}
    </Badge>
  );
}

function stageKind(index: number, currentIndex: number): StageKind {
  if (index < currentIndex) return "completed";
  if (index === currentIndex) return "current";
  return "upcoming";
}

function KindBadge({ kind }: { kind: StageKind }) {
  const styles: Record<StageKind, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    current: "bg-blue-50 text-blue-700 border-blue-200",
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

function FileIcon({ kind }: { kind: ClaimDocument["kind"] }) {
  if (kind === "image") {
    return (
      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5A1.5 1.5 0 0021.75 18V6A1.5 1.5 0 0020.25 4.5H3.75A1.5 1.5 0 002.25 6v12A1.5 1.5 0 003.75 19.5z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
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
                  "cursor-pointer rounded-md px-1.5 py-1",
                  selected && kind !== "current" && "bg-muted",
                  kind === "current" && "bg-blue-50 ring-1 ring-blue-200",
                )}
                onClick={() => onSelect(i)}
              >
                <TimelineHeader>
                  <TimelineSeparator />
                  <TimelineDate className={kind === "current" ? "text-blue-500" : undefined}>
                    {stageDate(stage, kind)}
                  </TimelineDate>
                  <TimelineTitle
                    className={cn(
                      "text-[13px] font-semibold leading-snug",
                      kind === "upcoming" && "text-muted-foreground",
                      kind === "current" && "text-blue-800",
                      selected && kind !== "current" && "text-blue-800",
                    )}
                  >
                    {stage.name}
                  </TimelineTitle>
                  <TimelineIndicator
                    className={cn(
                      "flex items-center justify-center",
                      kind === "current" &&
                        "size-4 border-none bg-primary text-primary-foreground ring-2 ring-primary/20",
                      kind === "completed" && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {(kind === "current" || kind === "completed") && (
                      <CheckIcon className="size-2.5" strokeWidth={3} />
                    )}
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
  onPrimary,
  onSecondary,
  toast,
}: {
  stage: ClaimStage;
  kind: StageKind;
  index: number;
  onPrimary: () => void;
  onSecondary: () => void;
  toast: string | null;
}) {
  return (
    <main className="flex-1 min-w-0 flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-100 text-[11px] font-semibold text-blue-700">
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">
              {index + 1}
            </span>
            {DEMO_CLAIM.nature}
          </span>
          <KindBadge kind={kind} />
        </div>

        <div className="flex items-start gap-2 mb-1">
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
            {stage.name}
          </h1>
          <span title={stage.caption} className="mt-1.5 text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </span>
        </div>
        <p className="text-sm text-slate-500 mb-6">{stage.caption}</p>

        <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
            {stage.owner.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{stage.owner}</p>
            <p className="text-xs text-slate-400">{stage.ownerRole}</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed mb-6">{stage.narrative}</p>

        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Stage details</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-8">
          {stage.fields.map((field) => (
            <div key={field.label} className="border-b border-slate-100 pb-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{field.label}</p>
              <p className={`text-sm mt-0.5 ${field.emphasize ? "text-blue-700 font-bold" : "text-slate-800 font-medium"}`}>
                {field.value}
              </p>
            </div>
          ))}
        </div>

        {kind === "upcoming" && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100 mb-4">
            <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-amber-800 leading-relaxed">
              This stage is locked until earlier steps are complete. Fields above show the data we expect to capture here.
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 px-8 py-4 bg-white">
        {toast && (
          <p className="text-xs text-emerald-600 font-medium mb-3" style={{ animation: "slideIn 0.18s ease" }}>
            {toast}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          {kind === "current" && stage.secondaryAction && (
            <button
              type="button"
              onClick={onSecondary}
              className="px-4 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              {stage.secondaryAction}
            </button>
          )}
          {kind === "current" && stage.primaryAction ? (
            <button
              type="button"
              onClick={onPrimary}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md shadow-blue-200"
            >
              {stage.primaryAction}
            </button>
          ) : kind === "completed" ? (
            <p className="text-xs text-slate-400">This stage is complete. Select another step to review it.</p>
          ) : (
            <button
              type="button"
              disabled
              className="px-5 py-2.5 bg-slate-100 text-slate-400 text-sm font-semibold rounded-lg cursor-not-allowed"
            >
              Waiting on previous stage
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function DocsColumn({ stage, kind }: { stage: ClaimStage; kind: StageKind }) {
  return (
    <aside className="w-[360px] shrink-0 border-l border-slate-200 bg-slate-50/60 flex flex-col min-h-0">
      <div className="px-5 py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            <h2 className="text-sm font-bold text-slate-800">Documents</h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">{stage.documents.length}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Files attached to this stage</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {stage.documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-50 mx-auto mb-3 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-slate-500">No documents yet</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              {kind === "upcoming"
                ? "Uploads will appear here once this stage starts."
                : "Nothing has been attached to this stage."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {stage.documents.map((doc) => (
              <li key={doc.name} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <FileIcon kind={doc.kind} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{doc.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {doc.size} · {doc.uploadedAt}
                    </p>
                    <p className="text-[11px] text-slate-400">{doc.uploadedBy}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-0.5">Activity</h3>
          {stage.activities.length === 0 ? (
            <p className="text-[11px] text-slate-400 px-0.5">No activity logged on this stage yet.</p>
          ) : (
            <Timeline
              value={kind === "upcoming" ? 0 : stage.activities.length}
              className="w-full"
            >
              {stage.activities.map((item, i) => {
                const status = activityStatus(kind, i, stage.activities.length);
                return (
                  <TimelineItem key={`${item.at}-${i}`} step={i + 1} className="ms-10 pb-10 last:pb-0">
                    <TimelineHeader>
                      <TimelineSeparator className="group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=vertical]/timeline:translate-y-7" />
                      <div className="flex items-center gap-2 min-w-0">
                        <TimelineTitle className="text-sm font-semibold truncate">
                          {item.role}
                        </TimelineTitle>
                        <StatusBadge status={status} duration={activityDuration(status, item)} />
                      </div>
                      <TimelineIndicator
                        className={cn(
                          "bg-muted text-muted-foreground group-data-completed/timeline-item:bg-primary group-data-completed/timeline-item:text-primary-foreground flex size-6 items-center justify-center border-none group-data-[orientation=vertical]/timeline:-left-7",
                          status === "active" && "ring-primary/20 ring-2 bg-primary text-primary-foreground",
                        )}
                      >
                        <StatusIcon status={status} />
                      </TimelineIndicator>
                    </TimelineHeader>
                    <TimelineContent className="mt-2">
                      <Frame stacked dense spacing="sm">
                        <Collapsible defaultOpen className="group/collapsible">
                          <CollapsibleTrigger className="flex w-full">
                            <FrameHeader className="flex grow flex-row items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="size-5">
                                  <AvatarFallback>{initials(item.actor)}</AvatarFallback>
                                </Avatar>
                                <span className="text-muted-foreground text-xs font-medium truncate">
                                  {item.actor}
                                </span>
                              </div>
                              <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-open/collapsible:rotate-90" />
                            </FrameHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <FramePanel>
                              <p className="text-muted-foreground text-sm leading-relaxed">
                                {item.note}
                              </p>
                            </FramePanel>
                          </CollapsibleContent>
                        </Collapsible>
                      </Frame>
                    </TimelineContent>
                  </TimelineItem>
                );
              })}
            </Timeline>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function ClaimTracking({ onBack }: { onBack: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(INITIAL_CURRENT_INDEX);
  const [selectedIndex, setSelectedIndex] = useState(INITIAL_CURRENT_INDEX);
  const [toast, setToast] = useState<string | null>(null);

  const stage = CLAIM_STAGES[selectedIndex];
  const kind = stageKind(selectedIndex, currentIndex);
  const currentName = CLAIM_STAGES[currentIndex].name;

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  const handlePrimary = () => {
    if (selectedIndex !== currentIndex) return;
    if (currentIndex < CLAIM_STAGES.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      setSelectedIndex(next);
      flash(`${CLAIM_STAGES[currentIndex].name} marked complete.`);
    } else {
      flash("Claim is already on the final stage.");
    }
  };

  const handleSecondary = () => {
    flash(`Update requested from ${stage.owner}.`);
  };

  const contextBits = useMemo(
    () => [
      DEMO_CLAIM.number,
      `${DEMO_CLAIM.vehicle} · ${DEMO_CLAIM.registration}`,
      DEMO_CLAIM.insured,
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
        <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
          Current · {currentName}
        </span>
      </div>

      <div className="flex-1 flex min-h-0">
        <ProgressColumn currentIndex={currentIndex} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
        <DetailColumn
          stage={stage}
          kind={kind}
          index={selectedIndex}
          onPrimary={handlePrimary}
          onSecondary={handleSecondary}
          toast={toast}
        />
        <DocsColumn stage={stage} kind={kind} />
      </div>
    </div>
  );
}
