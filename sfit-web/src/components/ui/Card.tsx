import type { HTMLAttributes, CSSProperties } from "react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  accent?: "gold" | "default";
}

export function Card({
  padded = true,
  accent = "default",
  className = "",
  style,
  children,
  ...props
}: CardProps) {
  const base: CSSProperties = {
    background: accent === "gold" ? "#FDF8EC" : "#ffffff",
    border: accent === "gold" ? "1.5px solid #E8D090" : "1.5px solid #e4e4e7",
    borderRadius: 16,
    padding: padded ? "1.5rem" : 0,
    ...style,
  };
  return (
    <div className={className} style={base} {...props}>
      {children}
    </div>
  );
}

/* ── Shadcn Card primitives (para nuevos componentes) ── */

function ShadCard({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10",
        className
      )}
      {...props}
    />
  );
}

function ShadCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("grid auto-rows-min items-start gap-1 px-4", className)}
      {...props}
    />
  );
}

function ShadCardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-heading text-base leading-snug font-medium", className)}
      {...props}
    />
  );
}

function ShadCardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function ShadCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-4", className)} {...props} />;
}

function ShadCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center rounded-b-xl border-t bg-muted/50 p-4", className)}
      {...props}
    />
  );
}

export { ShadCard, ShadCardHeader, ShadCardTitle, ShadCardDescription, ShadCardContent, ShadCardFooter };
