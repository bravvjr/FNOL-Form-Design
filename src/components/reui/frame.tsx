import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const frameVariants = cva(
  "relative flex flex-col bg-muted/50 rounded-xl [--frame-panel-bg:var(--color-card)] [--frame-panel-border-color:var(--color-border)] [--frame-border-color:var(--color-border)] [--frame-radius:0.75rem] [--frame-panel-radius:0.75rem]",
  {
    variants: {
      variant: {
        default: "border border-[var(--frame-border-color)] bg-clip-padding",
        ghost: "",
      },
      spacing: {
        sm: "[--frame-panel-px:0.75rem] [--frame-panel-py:0.75rem] [--frame-panel-header-px:0.75rem] [--frame-panel-header-py:0.4rem]",
        default:
          "[--frame-panel-px:1rem] [--frame-panel-py:1rem] [--frame-panel-header-px:1rem] [--frame-panel-header-py:0.5rem]",
      },
      stacked: {
        true: "gap-0",
        false: "gap-2 p-2",
      },
      dense: {
        true: "p-0 gap-0 overflow-hidden",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      spacing: "default",
      stacked: false,
      dense: false,
    },
  },
);

function Frame({
  className,
  variant,
  spacing,
  stacked,
  dense,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof frameVariants>) {
  return (
    <div
      data-slot="frame"
      data-spacing={spacing}
      className={cn(frameVariants({ variant, spacing, stacked, dense }), className)}
      {...props}
    />
  );
}

function FramePanel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="frame-panel"
      className={cn(
        "relative bg-(--frame-panel-bg) px-(--frame-panel-px) py-(--frame-panel-py) border-t border-(--frame-panel-border-color)",
        className,
      )}
      {...props}
    />
  );
}

function FrameHeader({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      data-slot="frame-panel-header"
      className={cn(
        "flex flex-col bg-(--frame-panel-bg) px-(--frame-panel-header-px) py-(--frame-panel-header-py)",
        className,
      )}
      {...props}
    />
  );
}

export { Frame, FrameHeader, FramePanel, frameVariants };
