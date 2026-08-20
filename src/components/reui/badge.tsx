import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center w-fit border border-transparent font-medium whitespace-nowrap outline-none transition-shadow",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline: "border-border bg-transparent",
        secondary: "bg-secondary text-secondary-foreground",
        "success-light": "border-emerald-200 bg-emerald-50 text-emerald-800",
        "info-light": "border-violet-200 bg-violet-50 text-violet-800",
        "warning-light": "border-amber-200 bg-amber-50 text-amber-800",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[0.625rem] leading-none h-4.5 min-w-4.5 gap-1 rounded-sm",
        default: "px-1.5 py-0.5 text-xs h-5 min-w-5 gap-1 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Badge({
  className,
  variant,
  size,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
