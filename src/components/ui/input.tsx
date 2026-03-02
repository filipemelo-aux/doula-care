import * as React from "react";

import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/masks";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onChange, value, defaultValue, ...props }, ref) => {
    // Check if lowercase class is present or if type forces lowercase
    const shouldBeLowercase = className?.includes("lowercase") || type === "email";
    // Never transform password, number, or email fields (including password fields toggled to "text" via autoComplete hint)
    const isPasswordField = type === "password" || props.autoComplete?.includes("password");
    const isExemptType = type === "number" || type === "email" || isPasswordField;
    const shouldTransform = !isExemptType && !shouldBeLowercase;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (type === "password") {
        onChange?.(e);
        return;
      }
      
      if (shouldTransform) {
        e.target.value = toTitleCase(e.target.value);
      } else if (shouldBeLowercase) {
        e.target.value = e.target.value.toLowerCase();
      }
      onChange?.(e);
    };

    // Transform controlled value and defaultValue
    const transformedValue = shouldTransform && typeof value === "string" ? toTitleCase(value) : (shouldBeLowercase && typeof value === "string" ? value.toLowerCase() : value);
    const transformedDefault = shouldTransform && typeof defaultValue === "string" ? toTitleCase(defaultValue) : (shouldBeLowercase && typeof defaultValue === "string" ? defaultValue.toLowerCase() : defaultValue);

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          shouldBeLowercase && "lowercase",
          className,
        )}
        ref={ref}
        onChange={handleChange}
        value={transformedValue}
        defaultValue={transformedDefault}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
