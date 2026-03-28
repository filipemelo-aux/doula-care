import * as React from "react";
import { cn } from "@/lib/utils";
import { toTitleCase, maskCPF, maskPhone, maskCEP, maskCurrency } from "@/lib/masks";

export type InputMask = "name" | "cpf" | "phone" | "cep" | "currency" | "uppercase";

export interface InputProps extends React.ComponentProps<"input"> {
  mask?: InputMask;
  icon?: React.ReactNode;
  floatingLabel?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onChange, value, defaultValue, mask, icon, floatingLabel, placeholder, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const shouldBeLowercase = className?.includes("lowercase") || type === "email";
    const isPasswordField = type === "password" || props.autoComplete?.includes("password");

    const hasValue = value !== undefined && value !== null && value !== "";

    const applyMask = (raw: string): string => {
      if (mask === "name") return toTitleCase(raw);
      if (mask === "cpf") return maskCPF(raw);
      if (mask === "phone") return maskPhone(raw);
      if (mask === "cep") return maskCEP(raw);
      if (mask === "currency") return maskCurrency(raw);
      if (mask === "uppercase") return raw.toUpperCase();
      return raw;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isPasswordField) {
        onChange?.(e);
        return;
      }
      if (mask) {
        e.target.value = applyMask(e.target.value);
      } else if (shouldBeLowercase) {
        e.target.value = e.target.value.toLowerCase();
      }
      onChange?.(e);
    };

    const transformValue = (v: typeof value): typeof value => {
      if (typeof v !== "string") return v;
      if (isPasswordField) return v;
      if (mask) return applyMask(v);
      if (shouldBeLowercase) return v.toLowerCase();
      return v;
    };

    const transformedValue = transformValue(value);
    const transformedDefault = transformValue(defaultValue);

    // If floatingLabel is provided, render the floating label variant
    if (floatingLabel) {
      const isLifted = isFocused || hasValue;
      return (
        <div className="relative w-full group">
          {icon && (
            <span className={cn(
              "absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200 text-muted-foreground/50",
              isFocused && "text-primary/70"
            )}>
              {icon}
            </span>
          )}
          <input
            type={type}
            className={cn(
              "premium-input peer w-full",
              icon ? "pl-10" : "pl-4",
              "pt-5 pb-1.5",
              shouldBeLowercase && "lowercase",
              className,
            )}
            ref={ref}
            onChange={handleChange}
            value={transformedValue}
            defaultValue={transformedDefault}
            placeholder=""
            onFocus={(e) => { setIsFocused(true); props.onFocus?.(e); }}
            onBlur={(e) => { setIsFocused(false); props.onBlur?.(e); }}
            {...props}
          />
          <span className={cn(
            "absolute pointer-events-none transition-all duration-200 ease-out",
            icon ? "left-10" : "left-4",
            isLifted
              ? "top-1.5 text-[10px] font-medium text-primary/70"
              : "top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50"
          )}>
            {floatingLabel}
          </span>
        </div>
      );
    }

    // Standard input (with optional icon)
    return (
      <div className={cn("relative w-full", icon && "group")}>
        {icon && (
          <span className={cn(
            "absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200 text-muted-foreground/50",
            "group-focus-within:text-primary/70"
          )}>
            {icon}
          </span>
        )}
        <input
          type={type}
          className={cn(
            "premium-input w-full",
            icon ? "pl-10" : "pl-4",
            shouldBeLowercase && "lowercase",
            className,
          )}
          ref={ref}
          onChange={handleChange}
          value={transformedValue}
          defaultValue={transformedDefault}
          placeholder={placeholder}
          {...props}
        />
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
