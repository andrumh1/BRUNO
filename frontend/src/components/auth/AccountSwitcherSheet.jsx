/* Multi-cuenta (app nativa): lista de cuentas usadas en este dispositivo, cambio con un toque sin cerrar sesión,
 * añadir otra cuenta y quitar una cuenta (con confirmación). Cada cuenta guarda su propio refresh token en el Keystore. */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, Trash2, UserPlus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { listAccounts, storedAccountToken, initials, maskEmail } from "@/lib/rememberedAccounts";
import { brunoToast } from "@/components/bruno/BrunoToast";

export default function AccountSwitcherSheet({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { user, switchAccount, removeAccount } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [busy, setBusy] = useState(null);
  const [toRemove, setToRemove] = useState(null);
  const [error, setError] = useState("");

  const reload = async () => {
    const list = await listAccounts();
    const withTok = await Promise.all(list.map(async (a) => ({ ...a, hasToken: !!(await storedAccountToken(a.id)) })));
    setAccounts(withTok);
  };
  useEffect(() => { if (open) { setError(""); reload(); } }, [open]);

  const pick = async (a) => {
    if (a.id === user?.id) { onOpenChange(false); return; }
    setBusy(a.id); setError("");
    try {
      if (!a.hasToken) throw Object.assign(new Error("no-token"), { code: "no-token" });
      await switchAccount(a);
      onOpenChange(false);
      brunoToast.success(`Ahora estás como ${a.name || a.email}`);
      navigate("/my-profile", { replace: true });
    } catch (e) {
      if (e.code === "expired" || e.code === "no-token") {
        onOpenChange(false);
        brunoToast.error(`La sesión de ${a.name || a.email} caducó. Inicia sesión de nuevo en esa cuenta.`);
        navigate(`/login?add=1&email=${encodeURIComponent(a.email || "")}`);
      } else {
        setError("No se pudo cambiar de cuenta. Revisa tu internet e inténtalo de nuevo.");
      }
    } finally { setBusy(null); }
  };

  const confirmRemove = async () => {
    const a = toRemove; setToRemove(null);
    if (!a) return;
    setBusy(a.id);
    try {
      const wasCurrent = a.id === user?.id;
      await removeAccount(a);
      await reload();
      brunoToast.success(`Cuenta ${a.name || a.email} quitada de este dispositivo`);
      if (wasCurrent) { onOpenChange(false); navigate("/login", { replace: true }); }
    } finally { setBusy(null); }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto" data-testid="account-switcher">
          <SheetHeader className="text-left">
            <SheetTitle>Cuentas</SheetTitle>
            <SheetDescription>Cambia de cuenta con un toque. La sesión anterior queda guardada en este dispositivo.</SheetDescription>
          </SheetHeader>
          <ul className="mt-4 divide-y divide-border/60 rounded-2xl border border-border/60" data-testid="account-switcher-list">
            {accounts.map((a) => {
              const current = a.id === user?.id;
              return (
                <li key={a.id} className="flex items-center gap-3 p-3" data-testid={`switcher-item-${a.id}`}>
                  <button type="button" onClick={() => pick(a)} disabled={!!busy} className="flex flex-1 min-w-0 items-center gap-3 text-left rounded-xl transition-transform active:scale-[0.98] disabled:opacity-60" data-testid={`switcher-pick-${a.id}`}>
                    {a.avatar_url ? <img src={a.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" /> : <span className="w-11 h-11 rounded-full bg-primary/15 text-primary font-bold grid place-items-center shrink-0">{initials(a.name)}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{a.name || "Cuenta BRUNO"}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">{a.username ? `@${a.username}` : maskEmail(a.email)}{!current && !a.hasToken ? " · requiere contraseña" : ""}</span>
                    </span>
                    {busy === a.id ? <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" /> : current ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary shrink-0" data-testid="switcher-current-badge"><Check className="w-3.5 h-3.5" /> Actual</span> : null}
                  </button>
                  <button type="button" onClick={() => setToRemove(a)} disabled={!!busy} className="w-9 h-9 rounded-full grid place-items-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0" aria-label={`Quitar ${a.name}`} data-testid={`switcher-remove-${a.id}`}><Trash2 className="w-4 h-4" /></button>
                </li>
              );
            })}
          </ul>
          {error ? <p className="mt-3 text-xs text-destructive" role="alert" data-testid="switcher-error">{error}</p> : null}
          <Button variant="outline" className="w-full rounded-full mt-4" onClick={() => { onOpenChange(false); navigate("/login?add=1"); }} data-testid="switcher-add-account">
            <UserPlus className="w-4 h-4 mr-2" /> Añadir cuenta
          </Button>
        </SheetContent>
      </Sheet>

      <Dialog open={!!toRemove} onOpenChange={(o) => { if (!o) setToRemove(null); }}>
        <DialogContent className="max-w-sm rounded-2xl" data-testid="switcher-remove-dialog">
          <DialogHeader>
            <DialogTitle>¿Quitar esta cuenta?</DialogTitle>
            <DialogDescription>
              Se quitará <strong>{toRemove?.name || toRemove?.email}</strong> de este dispositivo y se cerrará su sesión aquí. Las demás cuentas no cambian.
              {toRemove?.id === user?.id ? " Es la cuenta actual: volverás a la pantalla de acceso." : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" className="rounded-full flex-1" onClick={() => setToRemove(null)} data-testid="switcher-remove-cancel">Cancelar</Button>
            <Button variant="destructive" className="rounded-full flex-1" onClick={confirmRemove} data-testid="switcher-remove-confirm">Quitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
