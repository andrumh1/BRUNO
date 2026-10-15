/* Selector de cuentas recordadas en la pantalla de acceso (≈ media pantalla). Solo muestra identidad pública; nunca contraseñas. */
import React from "react";
import { X, UserPlus, ChevronRight, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initials, maskEmail } from "@/lib/rememberedAccounts";

export default function AccountPicker({ accounts, onPick, onRemove, onOther, biometricReady }) {
  return (
    <div className="space-y-3" data-testid="account-picker">
      <p className="text-sm font-semibold">Elige tu cuenta</p>
      <p className="text-xs text-muted-foreground -mt-2">Cuentas usadas en este dispositivo. Te pediremos la contraseña{biometricReady ? " o tu biometría" : ""} para entrar.</p>
      <ul className="max-h-[48vh] overflow-y-auto overscroll-contain divide-y divide-border/60 rounded-2xl border border-border/60" data-testid="account-picker-list">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 p-3" data-testid={`account-item-${a.id}`}>
            <button type="button" onClick={() => onPick(a)} className="flex flex-1 min-w-0 items-center gap-3 text-left rounded-xl transition-transform active:scale-[0.98]" data-testid={`account-pick-${a.id}`}>
              {a.avatar_url ? <img src={a.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" /> : <span className="w-11 h-11 rounded-full bg-primary/15 text-primary font-bold grid place-items-center shrink-0">{initials(a.name)}</span>}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold truncate">{a.name || "Cuenta BRUNO"}</span>
                <span className="block text-[11px] text-muted-foreground truncate">{a.username ? `@${a.username}` : maskEmail(a.email)}</span>
              </span>
              {biometricReady && a.hasToken ? <Fingerprint className="w-4 h-4 text-primary shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </button>
            <button type="button" onClick={() => onRemove(a)} className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0" aria-label={`Quitar ${a.name}`} data-testid={`account-remove-${a.id}`}><X className="w-4 h-4" /></button>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="w-full rounded-full" onClick={onOther} data-testid="account-picker-other"><UserPlus className="w-4 h-4 mr-2" /> Usar otra cuenta</Button>
    </div>
  );
}
