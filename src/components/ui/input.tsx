import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onChange, ...props }, ref) => {
    // Check if lowercase class is present
    const shouldBeLowercase = className?.includes("lowercase");
    // Never transform password, number, or email fields
    const isExemptType = type === "number" || type === "email" || type === "password";
    const shouldTransform = !isExemptType && !shouldBeLowercase;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Never transform password fields, regardless of other conditions
      if (type === "password") {
        onChange?.(e);
        return;
      }
      
      // Transform text to uppercase for text inputs (unless lowercase class is present)
      if (shouldTransform) {
        e.target.value = e.target.value.toUpperCase();
      } else if (shouldBeLowercase) {
        e.target.value = e.target.value.toLowerCase();
      }
      onChange?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          shouldTransform && "uppercase",
          shouldBeLowercase && "lowercase",
          className,
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
