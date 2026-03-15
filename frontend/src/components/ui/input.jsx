import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-12 w-full rounded-[2px] border border-divider bg-champagne px-4 py-2 text-base text-charcoal placeholder:text-warmgray transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forest disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
