import * as React from "react";

import { cn } from "@/lib/utils";

function capitalizeParagraphs(value: string): string {
  if (!value) return value;
  return value
    .split("\n")
    .map((line) => {
      if (!line) return line;
      return line.charAt(0).toUpperCase() + line.slice(1);
    })
    .join("\n");
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, onChange, value, defaultValue, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.value = capitalizeParagraphs(e.target.value);
    onChange?.(e);
  };

  const transformedValue = typeof value === "string" ? capitalizeParagraphs(value) : value;
  const transformedDefault = typeof defaultValue === "string" ? capitalizeParagraphs(defaultValue) : defaultValue;

  return (
    <textarea
      className={cn(
        "premium-input min-h-[80px] w-full resize-none",
        className,
      )}
      ref={ref}
      onChange={handleChange}
      value={transformedValue}
      defaultValue={transformedDefault}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
