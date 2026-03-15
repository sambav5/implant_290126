import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[2px] font-sans text-[12px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-forest text-champagne hover:bg-[#142A22]",
        destructive: "bg-charcoal text-champagne hover:opacity-90",
        outline: "border border-forest bg-transparent text-forest hover:bg-forest hover:text-champagne",
        secondary: "border border-forest bg-transparent text-forest hover:bg-forest hover:text-champagne",
        ghost: "text-charcoal hover:bg-divider",
        link: "text-forest underline-offset-4 hover:underline",
      },
      size: {
        default: "px-8 py-[18px]",
        sm: "px-6 py-3",
        lg: "px-10 py-5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
})
Button.displayName = "Button"

export { Button, buttonVariants }
