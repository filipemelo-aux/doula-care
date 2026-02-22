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
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
