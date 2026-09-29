import React from "react";
import { Button } from "@/components/ui/button";
import BrunoLogo from "@/components/bruno/BrunoLogo";

/**
 * BrunoEmpty — estado vacío corporativo con el oso.
 *  <BrunoEmpty title="Sin notificaciones" description="…" action={<Button/>} />
 *  onDark: true cuando se muestra sobre superficies oscuras (Reels, Lives)
 */
export default function BrunoEmpty({ title, description, action, actionText, onAction, compact = false, className = "", testId = "bruno-empty" }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8 px-4" : "py-14 px-6"} ${className}`} data-testid={testId}>
      <div className={`relative grid place-items-center rounded-[28px] bg-card border border-border/60 shadow-sm ${compact ? "w-16 h-16 mb-3" : "w-24 h-24 mb-5"}`}>
        <span className="absolute inset-0 rounded-[28px] bg-primary/10 blur-xl" />
        <BrunoLogo variant="icon" tone="orange" className={`relative ${compact ? "w-9" : "w-14"} bubble-float`} />
      </div>
      {title && <h3 className={`font-bold tracking-tight text-foreground ${compact ? "text-sm" : "text-lg"}`}>{title}</h3>}
      {description && <p className={`text-muted-foreground mt-1 max-w-xs ${compact ? "text-xs" : "text-sm"}`}>{description}</p>}
      {action}
      {!action && actionText && onAction && (
        <Button onClick={onAction} className="mt-5 rounded-full px-5 shadow-lg shadow-primary/25" data-testid={`${testId}-action`}>{actionText}</Button>
      )}
    </div>
  );
}
