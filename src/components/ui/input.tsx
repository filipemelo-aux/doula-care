import * as React from "react";

import { cn } from "@/lib/utils";
import { toTitleCase, maskCPF, maskPhone, maskCEP, maskCurrency } from "@/lib/masks";

export type InputMask = "name" | "cpf" | "phone" | "cep" | "currency" | "uppercase";

export interface InputProps extends React.ComponentProps<"input"> {
  mask?: InputMask;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onChange, value, defaultValue, mask, ...props }, ref) => {
    const shouldBeLowercase = className?.includes("lowercase") || type === "email";
    const isPasswordField = type === "password" || props.autoComplete?.includes("password");

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
