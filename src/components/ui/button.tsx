import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "motion-safe-lift inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium tracking-[-0.01em] shadow-[var(--shadow-xs)] transition-[transform,background-color,color,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default:
          "border-primary/15 bg-primary text-primary-foreground hover:-translate-y-px hover:bg-primary/95 hover:shadow-[var(--shadow-soft)]",
        destructive:
          "border-destructive/20 bg-destructive text-destructive-foreground hover:-translate-y-px hover:bg-destructive/92 hover:shadow-[var(--shadow-soft)] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border-border/75 bg-[var(--surface-elevated)] text-foreground hover:-translate-y-px hover:border-primary/15 hover:bg-accent/70 hover:text-foreground hover:shadow-[var(--shadow-soft)]",
        secondary:
          "border-border/70 bg-secondary text-secondary-foreground hover:-translate-y-px hover:bg-secondary/88 hover:shadow-[var(--shadow-soft)]",
        tonal:
          "border-primary/10 bg-accent text-accent-foreground hover:-translate-y-px hover:bg-accent/82 hover:shadow-[var(--shadow-soft)]",
        ghost:
          "border-transparent bg-transparent text-muted-foreground shadow-none hover:-translate-y-px hover:bg-muted/72 hover:text-foreground",
        link: "border-transparent bg-transparent text-primary shadow-none underline-offset-4 hover:text-primary/90 hover:underline",
      },
      size: {
        default: "h-10 px-3.5 py-2.5 has-[>svg]:px-3",
        xs: "h-7 gap-1 rounded-md px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-md px-5 text-[15px] has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-11 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
