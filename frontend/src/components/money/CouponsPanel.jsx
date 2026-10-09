import React, { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, Plus, Ticket, Trash2, Power, Share2, Camera } from "lucide-react";
import { publishCouponStory } from "@/lib/couponStory";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { fmtMoney, detailMsg } from "@/hooks/useBrunoCheckout";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SCOPE = { all: "Todo", live_ticket: "Entradas a lives", gift: "Regalos", marketplace: "Marketplace" };
const EMPTY = { code: "", mode: "pct", pct: "10", amount: "", currency: "usd", applies_to: "all", max_uses: "", expires_at: "" };

export const couponLink = (c) => `${window.location.origin}/cupon/${c.id}`;
export const couponValue = (c) => (c.pct ? `${c.pct} %` : fmtMoney(c.amount, c.currency));
export const shareCoupon = async (c) => {
  const url = couponLink(c);
  const text = `Usa mi cupón ${c.code} (−${couponValue(c)}) en BRUNO`;
  try {
    if (navigator.share) { await navigator.share({ title: `Cupón ${c.code}`, text, url }); return; }
  } catch (e) { if (e?.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(`${text} → ${url}`); brunoToast.success("Enlace del cupón copiado", { description: url }); }
  catch { brunoToast.info?.(url); }
};

const CouponRow = ({ c, onToggle, onDelete, onStory, storyBusy }) => {
  const dead = c.expired || c.exhausted;
  const value = couponValue(c);
  return (
    <div className={`rounded-2xl border border-border/60 p-3 text-sm flex items-center gap-3 ${!c.active || dead ? "opacity-60" : ""}`} data-testid={`coupon-${c.code}`}>
      <div className="min-w-0 flex-1">
        <p className="font-mono font-bold tracking-wider">{c.code} <span className="font-sans font-semibold text-primary ml-1">−{value}</span></p>
        <p className="text-[11px] text-muted-foreground">{SCOPE[c.applies_to] || c.applies_to} · usos {c.uses_count}{c.max_uses ? `/${c.max_uses}` : ""}{c.expires_at ? ` · caduca ${new Date(c.expires_at).toLocaleDateString("es")}` : ""}</p>
        <p className="text-[11px] font-semibold" data-testid={`coupon-status-${c.code}`}>{c.expired ? "Caducado" : c.exhausted ? "Agotado" : c.active ? "Activo" : "Desactivado"}</p>
      </div>
      {c.active && !dead && <button onClick={() => shareCoupon(c)} className="w-9 h-9 rounded-full bg-primary/10 text-primary grid place-items-center" aria-label="Compartir cupón" data-testid={`coupon-share-${c.code}`}><Share2 className="w-4 h-4" /></button>}
      {c.active && !dead && <button onClick={() => onStory(c)} disabled={storyBusy} className="w-9 h-9 rounded-full bg-primary/10 text-primary grid place-items-center" aria-label="Publicar en historia" data-testid={`coupon-story-${c.code}`}>{storyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}</button>}
      <button onClick={() => onToggle(c)} className="w-9 h-9 rounded-full bg-foreground/[0.05] grid place-items-center" aria-label={c.active ? "Desactivar" : "Activar"} data-testid={`coupon-toggle-${c.code}`}><Power className={`w-4 h-4 ${c.active ? "text-emerald-600" : "text-muted-foreground"}`} /></button>
      <button onClick={() => onDelete(c)} className="w-9 h-9 rounded-full bg-destructive/10 text-destructive grid place-items-center" aria-label="Eliminar" data-testid={`coupon-delete-${c.code}`}><Trash2 className="w-4 h-4" /></button>
    </div>
  );
};

export const CouponsPanel = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const { user } = useAuth();
  const [storyBusy, setStoryBusy] = useState("");
  const [list, setList] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const load = () => axios.get(`${API}/money/coupons`, { headers }).then((r) => setList(r.data)).catch(() => setList([]));
  useEffect(() => { if (token) load(); /* eslint-disable-next-line */ }, [token]);

  const create = async () => {
    setBusy(true);
    const body = { code: form.code, applies_to: form.applies_to, max_uses: form.max_uses ? Number(form.max_uses) : null, expires_at: form.expires_at || null, currency: form.currency };
    if (form.mode === "pct") body.pct = Number(form.pct); else body.amount = Number(form.amount);
    try { await axios.post(`${API}/money/coupons`, body, { headers }); brunoToast.success("Cupón creado"); setForm(EMPTY); setOpen(false); load(); }
    catch (e) { brunoToast.error(detailMsg(e) || "No se pudo crear el cupón"); }
    finally { setBusy(false); }
  };
  const toggle = async (c) => { try { await axios.patch(`${API}/money/coupons/${c.id}`, {}, { headers }); load(); } catch (e) { brunoToast.error(detailMsg(e) || "Error"); } };
  const remove = async (c) => { try { await axios.delete(`${API}/money/coupons/${c.id}`, { headers }); brunoToast.success("Cupón eliminado"); load(); } catch (e) { brunoToast.error(detailMsg(e) || "Error"); } };

  return (
    <section className="rounded-3xl border border-border/60 p-4 space-y-3" data-testid="coupons-panel">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary grid place-items-center"><Ticket className="w-4 h-4" /></div>
        <div className="flex-1"><h2 className="text-sm font-bold">Cupones de descuento</h2><p className="text-[11px] text-muted-foreground">Compártelos por enlace o en una historia: al abrirlo, el cupón se aplica solo cuando te paguen. El descuento sale de tu parte; la comisión BRUNO se calcula sobre el importe ya rebajado.</p></div>
        <Button size="sm" className="rounded-full" onClick={() => setOpen((o) => !o)} data-testid="coupon-new-btn"><Plus className="w-4 h-4 mr-1" /> Nuevo</Button>
      </div>
      {open && (
        <div className="rounded-2xl bg-muted/40 p-3 grid grid-cols-2 gap-2 text-sm" data-testid="coupon-form">
          <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="CÓDIGO (ej. VERANO20)" maxLength={24} className="col-span-2 h-10 rounded-xl border bg-background px-3 uppercase tracking-wider" data-testid="coupon-form-code" />
          <select value={form.mode} onChange={set("mode")} className="h-10 rounded-xl border bg-background px-3" data-testid="coupon-form-mode"><option value="pct">Porcentaje</option><option value="amount">Importe fijo</option></select>
          {form.mode === "pct"
            ? <input type="number" min="1" max="100" value={form.pct} onChange={set("pct")} placeholder="%" className="h-10 rounded-xl border bg-background px-3" data-testid="coupon-form-pct" />
            : <div className="flex gap-1"><input type="number" min="0.5" step="0.5" value={form.amount} onChange={set("amount")} placeholder="Importe" className="h-10 flex-1 min-w-0 rounded-xl border bg-background px-3" data-testid="coupon-form-amount" /><select value={form.currency} onChange={set("currency")} className="h-10 rounded-xl border bg-background px-2" data-testid="coupon-form-currency">{["usd", "eur", "mxn", "cop", "brl", "gbp", "cad"].map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></div>}
          <select value={form.applies_to} onChange={set("applies_to")} className="h-10 rounded-xl border bg-background px-3" data-testid="coupon-form-scope">{Object.entries(SCOPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input type="number" min="1" value={form.max_uses} onChange={set("max_uses")} placeholder="Límite de usos (opcional)" className="h-10 rounded-xl border bg-background px-3" data-testid="coupon-form-max-uses" />
          <label className="col-span-2 text-[11px] text-muted-foreground">Caducidad (opcional)<input type="date" value={form.expires_at} onChange={set("expires_at")} className="mt-1 w-full h-10 rounded-xl border bg-background px-3 text-sm text-foreground" data-testid="coupon-form-expires" /></label>
          <Button variant="outline" className="rounded-full" onClick={() => { setOpen(false); setForm(EMPTY); }} data-testid="coupon-form-cancel">Cancelar</Button>
          <Button className="rounded-full" onClick={create} disabled={busy || form.code.trim().length < 3 || (form.mode === "pct" ? !form.pct : !form.amount)} data-testid="coupon-form-submit">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear cupón"}</Button>
        </div>
      )}
      {list === null ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : list.length === 0 ? <p className="text-xs text-muted-foreground" data-testid="coupons-empty">Aún no tienes cupones.</p> : <div className="space-y-2" data-testid="coupons-list">{list.map((c) => <CouponRow key={c.id} c={c} onToggle={toggle} onDelete={remove} storyBusy={storyBusy === c.id} onStory={async (cp) => {
            setStoryBusy(cp.id);
            try { await publishCouponStory({ code: cp.code, value: couponValue(cp), url: couponLink(cp) }, token, user?.name); brunoToast.publish?.("Cupón publicado en tu historia", { description: "Visible 24 h con enlace para aplicarlo." }) || brunoToast.success("Cupón publicado en tu historia"); }
            catch (e) { brunoToast.error(detailMsg(e) || "No se pudo publicar la historia"); }
            finally { setStoryBusy(""); }
          }} />)}</div>}
    </section>
  );
};
