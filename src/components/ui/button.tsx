import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose/40 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-rose to-rose-dark text-white shadow-[0_4px_16px_rgba(200,130,150,0.25)] hover:shadow-[0_6px_20px_rgba(200,130,150,0.35)] hover:brightness-105",
        secondary:
          "border border-rose/10 bg-white/60 text-muted hover:bg-rose/5 hover:text-foreground",
        ghost: "text-muted hover:bg-white/50 hover:text-foreground",
        success: "bg-emerald-100/70 text-emerald-700",
      },
      size: {
        sm: "h-8 px-3 text-xs gap-1.5",
        md: "h-9 px-4 text-sm gap-2",
        lg: "h-11 px-6 text-sm gap-2",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
