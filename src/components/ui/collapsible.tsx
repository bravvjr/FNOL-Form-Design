import { createContext, useContext, useState, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type CollapsibleContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

function Collapsible({
  defaultOpen = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <CollapsibleContext.Provider value={{ open, setOpen }}>
      <div
        data-slot="collapsible"
        data-open={open ? "" : undefined}
        className={cn("group/collapsible", className)}
        {...props}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

function CollapsibleTrigger({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) throw new Error("CollapsibleTrigger must be used within Collapsible");

  return (
    <div
      role="button"
      tabIndex={0}
      data-slot="collapsible-trigger"
      className={cn("cursor-pointer", className)}
      aria-expanded={ctx.open}
      onClick={() => ctx.setOpen(!ctx.open)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          ctx.setOpen(!ctx.open);
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
}

function CollapsibleContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) throw new Error("CollapsibleContent must be used within Collapsible");
  if (!ctx.open) return null;

  return (
    <div data-slot="collapsible-content" className={className} {...props}>
      {children}
    </div>
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
