import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "success" | "warning";
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  trend,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "stat-card overflow-hidden",
        variant === "primary" && "stat-card-primary",
        variant === "success" && "stat-card-success"
      )}
    >
      <div className="flex items-start justify-between mb-3 lg:mb-4">
        <div
          className={cn(
            "w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center flex-shrink-0",
            variant === "default" && "bg-primary/10",
            variant === "primary" && "bg-primary-foreground/20",
            variant === "success" && "bg-success-foreground/20",
            variant === "warning" && "bg-warning/10"
          )}
        >
          <Icon
            className={cn(
              "w-5 h-5 lg:w-6 lg:h-6",
              variant === "default" && "text-primary",
              variant === "primary" && "text-primary-foreground",
              variant === "success" && "text-success-foreground",
              variant === "warning" && "text-warning"
            )}
          />
        </div>
        {trend && (
          <div
            className={cn(
              "px-2 py-0.5 lg:px-2.5 lg:py-1 rounded-full text-xs font-medium flex-shrink-0",
              trend.isPositive
                ? "bg-success/15 text-success"
                : "bg-destructive/15 text-destructive"
            )}
          >
            {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <div className="min-w-0">
        <h3
          className={cn(
            "text-xs lg:text-sm font-medium mb-1 truncate",
            variant === "default" && "text-muted-foreground",
            (variant === "primary" || variant === "success") && "text-current opacity-80"
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "text-lg lg:text-2xl xl:text-3xl font-semibold tracking-tight font-sans truncate",
            variant === "default" && "text-foreground"
          )}
        >
          {value}
        </p>
        {subtitle && (
          <p
            className={cn(
              "text-xs lg:text-sm mt-1 truncate",
              variant === "default" && "text-muted-foreground",
              (variant === "primary" || variant === "success") && "opacity-70"
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
