import { createContext, useCallback, useContext, useState, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type TimelineContextValue = {
  activeStep: number;
  setActiveStep: (step: number) => void;
};

const TimelineContext = createContext<TimelineContextValue | undefined>(undefined);

const useTimeline = () => {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error("useTimeline must be used within a Timeline");
  }
  return context;
};

interface TimelineProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  orientation?: "horizontal" | "vertical";
}

function Timeline({
  defaultValue = 1,
  value,
  onValueChange,
  orientation = "vertical",
  className,
  ...props
}: TimelineProps) {
  const [activeStep, setInternalStep] = useState(defaultValue);

  const setActiveStep = useCallback(
    (step: number) => {
      if (value === undefined) {
        setInternalStep(step);
      }
      onValueChange?.(step);
    },
    [value, onValueChange],
  );

  const currentStep = value ?? activeStep;

  return (
    <TimelineContext.Provider value={{ activeStep: currentStep, setActiveStep }}>
      <div
        data-slot="timeline"
        data-orientation={orientation}
        className={cn(
          "group/timeline flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col",
          className,
        )}
        {...props}
      />
    </TimelineContext.Provider>
  );
}

function TimelineContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="timeline-content"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function TimelineDate({ className, ...props }: HTMLAttributes<HTMLTimeElement>) {
  return (
    <time
      data-slot="timeline-date"
      className={cn(
        "mb-1 block font-medium text-muted-foreground text-xs group-data-[orientation=vertical]/timeline:max-sm:h-4",
        className,
      )}
      {...props}
    />
  );
}

function TimelineHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="timeline-header" className={cn(className)} {...props} />;
}

function TimelineIndicator({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      data-slot="timeline-indicator"
      className={cn(
        "group-data-[orientation=horizontal]/timeline:-top-6 group-data-[orientation=horizontal]/timeline:-translate-y-1/2 group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:-translate-x-1/2 absolute size-4 rounded-full border-2 border-primary/20 group-data-[orientation=vertical]/timeline:top-0 group-data-[orientation=horizontal]/timeline:left-0 group-data-completed/timeline-item:border-primary",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface TimelineItemProps extends HTMLAttributes<HTMLDivElement> {
  step: number;
}

function TimelineItem({ step, className, ...props }: TimelineItemProps) {
  const { activeStep } = useTimeline();

  return (
    <div
      data-slot="timeline-item"
      data-completed={step <= activeStep ? "true" : undefined}
      className={cn(
        "group/timeline-item relative flex flex-1 flex-col gap-0.5 group-data-[orientation=vertical]/timeline:ms-8 group-data-[orientation=horizontal]/timeline:mt-8 group-data-[orientation=horizontal]/timeline:not-last:pe-8 group-data-[orientation=vertical]/timeline:not-last:pb-6 has-[+[data-completed]]:**:data-[slot=timeline-separator]:bg-primary",
        className,
      )}
      {...props}
    />
  );
}

function TimelineSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      data-slot="timeline-separator"
      className={cn(
        "group-data-[orientation=horizontal]/timeline:-top-6 group-data-[orientation=horizontal]/timeline:-translate-y-1/2 group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:-translate-x-1/2 absolute self-start bg-primary/10 group-last/timeline-item:hidden group-data-[orientation=horizontal]/timeline:h-0.5 group-data-[orientation=vertical]/timeline:h-[calc(100%-1rem-0.25rem)] group-data-[orientation=horizontal]/timeline:w-[calc(100%-1rem-0.25rem)] group-data-[orientation=vertical]/timeline:w-0.5 group-data-[orientation=horizontal]/timeline:translate-x-4.5 group-data-[orientation=vertical]/timeline:translate-y-4.5",
        className,
      )}
      {...props}
    />
  );
}

function TimelineTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 data-slot="timeline-title" className={cn("font-medium text-sm", className)} {...props} />
  );
}

export {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
};
