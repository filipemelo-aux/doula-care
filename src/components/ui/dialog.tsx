import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[99] bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
      onPointerDownOutside={(e) => {
        // Prevent dialog from closing when interacting with Select dropdown, date pickers, or other portaled elements
        const target = e.target as HTMLElement;
        const dialogContent = (e.currentTarget as HTMLElement);
        const hasActiveDateInput = dialogContent?.querySelector('input[type="datetime-local"]:focus, input[type="date"]:focus, input[type="time"]:focus');
        if (
          hasActiveDateInput ||
          target?.closest('[data-radix-select-content]') ||
          target?.closest('[role="listbox"]') ||
          target?.closest('[data-radix-popper-content-wrapper]') ||
          target?.closest('.rdp') ||
          target?.tagName === 'INPUT'
        ) {
          e.preventDefault();
        }
      }}
      onInteractOutside={(e) => {
        const target = e.target as HTMLElement;
        const dialogContent = (e.currentTarget as HTMLElement);
        const hasActiveDateInput = dialogContent?.querySelector('input[type="datetime-local"]:focus, input[type="date"]:focus, input[type="time"]:focus');
        if (
          hasActiveDateInput ||
          target?.closest('[data-radix-select-content]') ||
          target?.closest('[role="listbox"]') ||
          target?.closest('[data-radix-popper-content-wrapper]') ||
          target?.closest('.rdp') ||
          target?.tagName === 'INPUT'
        ) {
          e.preventDefault();
        }
      }}
      className={cn(
        "fixed left-[50%] top-[50%] z-[100] grid w-[94%] max-w-lg translate-x-[-50%] translate-y-[-50%] border-0 bg-background shadow-[0_8px_24px_rgba(0,0,0,0.06)] rounded-[18px] duration-200 overflow-visible max-h-[85vh] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        className,
      )}
      {...props}
    >
      <div className="overflow-y-auto overscroll-contain px-4 pt-5 pb-6 gap-3 grid" style={{ WebkitOverflowScrolling: 'touch', maxHeight: '85vh' }}>
        {children}
      </div>
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 p-1.5 rounded-full bg-background/70 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
