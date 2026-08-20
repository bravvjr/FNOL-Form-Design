import type { ImgHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

function Avatar({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  if (!props.src) return null;
  return (
    <img
      alt={alt}
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage };
