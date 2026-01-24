import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface Column<T> {
  key: string;
  label: string;
  className?: string;
  mobileLabel?: string;
  hideOnMobile?: boolean;
  priority?: "high" | "medium" | "low";
  render?: (item: T) => React.ReactNode;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  renderMobileCard?: (item: T, columns: Column<T>[]) => React.ReactNode;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  renderMobileCard,
  onRowClick,
  emptyMessage = "Nenhum dado encontrado",
  className,
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const getValue = (item: T, key: string) => {
    return (item as Record<string, unknown>)[key];
  };

  return (
    <>
      {/* Mobile Cards - visible on small screens */}
      <div className={cn("block lg:hidden space-y-3", className)}>
        {data.map((item) => {
          if (renderMobileCard) {
            return (
              <div key={keyExtractor(item)}>
                {renderMobileCard(item, columns)}
              </div>
            );
          }

          // Default mobile card layout
          const visibleColumns = columns.filter((col) => !col.hideOnMobile);
          const highPriorityColumns = visibleColumns.filter(
            (col) => col.priority === "high" || !col.priority
          );
          const otherColumns = visibleColumns.filter(
            (col) => col.priority === "medium" || col.priority === "low"
          );

          return (
            <Card
              key={keyExtractor(item)}
              className={cn(
                "p-3 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors",
                onRowClick && "cursor-pointer"
              )}
              onClick={() => onRowClick?.(item)}
            >
              {/* High priority items at top */}
              <div className="space-y-1">
                {highPriorityColumns.slice(0, 2).map((col) => (
                  <div key={col.key} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {col.mobileLabel || col.label}
                    </span>
                    <span className="text-sm font-medium text-right">
                      {col.render ? col.render(item) : String(getValue(item, col.key) ?? "—")}
                    </span>
                  </div>
                ))}
              </div>

              {/* Other fields in a grid */}
              {(highPriorityColumns.slice(2).length > 0 || otherColumns.length > 0) && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                  {[...highPriorityColumns.slice(2), ...otherColumns].map((col) => (
                    <div key={col.key} className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {col.mobileLabel || col.label}
                      </span>
                      <div className="text-xs font-medium">
                        {col.render ? col.render(item) : String(getValue(item, col.key) ?? "—")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Desktop Table - hidden on small screens */}
      <div className={cn("hidden lg:block overflow-x-auto", className)}>
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b transition-colors">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "h-10 px-3 text-left align-middle font-medium text-muted-foreground text-xs",
                    col.className
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={cn(
                  "border-b transition-colors hover:bg-muted/50",
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("p-3 align-middle text-sm", col.className)}
                  >
                    {col.render ? col.render(item) : String(getValue(item, col.key) ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
