"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./utils";

const variants = {
  primary:
    "border-transparent bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "border-border bg-surface text-foreground hover:bg-surface-2 active:bg-surface-3",
  outline:
    "border-border bg-background text-foreground hover:bg-surface-2 active:bg-surface-3",
  ghost:
    "border-transparent bg-transparent text-foreground hover:bg-surface-2 active:bg-surface-3",
  danger:
    "border-transparent bg-danger text-white hover:brightness-95 active:brightness-90",
  subtleDanger:
    "border-danger/20 bg-danger/10 text-danger hover:bg-danger/15 active:bg-danger/20",
  success:
    "border-transparent bg-success text-white hover:brightness-95 active:brightness-90",
};

const sizes = {
  sm: "h-8 gap-1.5 rounded-md px-2.5 text-xs",
  md: "h-10 gap-2 rounded-lg px-3.5 text-sm",
  lg: "h-11 gap-2 rounded-lg px-4 text-sm",
  icon: "size-10 rounded-lg p-0",
  iconSm: "size-8 rounded-md p-0",
};

export const Button = forwardRef(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    loading = false,
    loadingText,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    disabled,
    children,
    type = "button",
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center border font-semibold transition focus-visible:ring-2 focus-visible:ring-primary/25 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
      ) : LeftIcon ? (
        <LeftIcon className="size-4" strokeWidth={1.9} aria-hidden="true" />
      ) : null}

      {size !== "icon" && size !== "iconSm" ? loadingText && loading ? loadingText : children : children}

      {!loading && RightIcon ? (
        <RightIcon className="size-4" strokeWidth={1.9} aria-hidden="true" />
      ) : null}
    </button>
  );
});
