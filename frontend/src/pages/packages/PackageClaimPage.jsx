import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Clock, CreditCard, LogIn, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import CardRenderer from "@/components/cards/CardRenderer";
import { resolveDesign } from "@/lib/cardDesign";
import { glass } from "@/pages/service/serviceApi";
import { api, DELIV, PAY, Pill, PKG_LABEL, errText, t } from "./packagesApi";

const Box = ({ children, testId }) => <div className={`${glass} p-6 sm:p-8`} data-testid={testId}>{children}</div>;
const FIELD_LABEL = { name: ["Nombre", "Name"], display_name: ["Nombre visible", "Display name"], bio: ["Presentación", "Bio"], avatar_url: ["Foto de perfil", "Profile photo"], location: ["Ubicación", "Location"], website: ["Sitio web", "Website"], profession: ["Profesión", "Profession"], company: ["Empresa", "Company"], social_links: ["Redes sociales", "Social links"], phone: ["Teléfono", "Phone"] };

/** /paquete/:token — vista previa limitada → Activar → sesión → revisión completa → aceptar → pago → activado. */
export default function PackageClaimPage() {
  const { token: claim } = useParams();
  const navigate = useNavigate();
  const { token: jwt, isLoading, logout } = useAuth();
  const [d, setD] = useState(null);
  const [state, setState] = useState("loading");
  const [fields, setFields] = useState(null);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const here = `/paquete/${claim}`;
  const load = () => api.claim(jwt, claim).then((x) => { setD(x); setState(x.state); if (x.profile_diff && fields === null) setFields(x.profile_diff.filter((f) => !f.changes).map((f) => f.field)); }).catch((e) => setState(e.response?.data?.detail?.state || "invalid"));
  useEffect(() => { if (!isLoading) load(); }, [jwt, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  const wrap = (c) => <div className="min-h-screen bg-[linear-gradient(160deg,#fff7f1,#ffffff_45%,#fff1e6)] px-4 py-8" data-testid="package-claim-page"><div className="max-w-5xl mx-auto">{c}</div></div>;
  const act = async (fn) => { setBusy(true); setError(""); try { return await fn(); } catch (e) { setError(errText(e, t("No se pudo completar.", "Could not complete."))); return null; } finally { setBusy(false); } };

  if (state === "loading") return wrap(<Box testId="claim-loading"><p className="text-sm text-gray-600">{t("Cargando…", "Loading…")}</p></Box>);
  if (["invalid", "expired", "revoked"].includes(state)) return wrap(<Box testId="claim-link-invalid"><ShieldAlert className="w-10 h-10 text-amber-500 mb-3" /><h1 className="text-2xl font-semibold mb-2">{state === "expired" ? t("Este enlace venció", "This link has expired") : state === "revoked" ? t("Este enlace fue revocado", "This link was revoked") : t("Enlace no válido", "Invalid link")}</h1><p className="text-sm text-gray-600">{t("Pide a tu asesor un nuevo enlace de activación. Tu paquete se conserva.", "Ask your advisor for a new activation link. Your package is kept.")}</p></Box>);
  if (state === "claimed_by_other") return wrap(<Box testId="claim-other"><ShieldAlert className="w-10 h-10 text-amber-500 mb-3" /><h1 className="text-2xl font-semibold mb-2">{t("Este paquete ya fue reclamado", "This package was already claimed")}</h1><p className="text-sm text-gray-600 mb-4">{t("El enlace es de un solo uso y otra cuenta ya aceptó el paquete. Si es tu paquete, entra con esa cuenta o contacta a tu asesor.", "The link is single-use and another account already accepted the package. If it is yours, sign in with that account or contact your advisor.")}</p>{jwt && <Button variant="outline" className="rounded-full" onClick={async () => { await logout(); navigate(`/login?next=${encodeURIComponent(here)}`); }} data-testid="claim-switch-account">{t("Cambiar de cuenta", "Switch account")}</Button>}</Box>);

  const head = <div className="mb-4"><p className="text-[11px] tracking-[2px] uppercase font-bold text-[#fa632e]">BRUNO · {PKG_LABEL()}</p><p className="text-xs text-gray-500">{t("Referencia", "Reference")} {d.ref} · {t("Asesor", "Advisor")} @{d.advisor_handle} · {d.price_label}</p></div>;

  if (state === "preview") return wrap(<Box testId="claim-preview">{head}
    <h1 className="text-2xl sm:text-3xl font-semibold mb-2">{t(`Hola${d.client_first_name ? ", " + d.client_first_name : ""}: tu paquete BRUNO está listo`, `Hi${d.client_first_name ? ", " + d.client_first_name : ""}: your BRUNO package is ready`)}</h1>
    <p className="text-sm text-gray-600 mb-5">{t("Incluye tu perfil completo y 3 tarjetas digitales preparadas por tu asesor. Para verlo completo y activarlo necesitas entrar con tu cuenta BRUNO (o crear una). Abrir este enlace no activa nada.", "It includes your complete profile and 3 digital cards prepared by your advisor. To see it in full and activate it, sign in to your BRUNO account (or create one). Opening this link activates nothing.")}</p>
    <div className="flex flex-wrap gap-3"><Button className="rounded-full h-12 px-6" onClick={() => navigate(`/login?next=${encodeURIComponent(here)}`)} data-testid="claim-activate-btn"><LogIn className="w-4 h-4 mr-2" />{t("Activar mi paquete", "Activate my package")}</Button><Button variant="outline" className="rounded-full h-12" onClick={() => navigate(`/register?next=${encodeURIComponent(here)}`)} data-testid="claim-register-btn">{t("Crear mi cuenta", "Create my account")}</Button></div>
    <p className="text-[11px] text-gray-500 mt-4 inline-flex gap-1.5"><ShieldCheck className="w-3.5 h-3.5 mt-0.5" />{t("Enlace único de un solo uso; vence en 30 días. No se muestra información privada antes de iniciar sesión.", "Unique single-use link; expires in 30 days. No private information is shown before signing in.")}</p>
  </Box>);

  // review (logged in)
  const activated = d.delivery_status === "activated" || result?.delivery_status === "activated";
  const paid = d.payment_status === "confirmed" || result?.payment_status === "confirmed";
  const accepted = d.accepted || !!result;
  const pay = () => act(async () => { const r = await api.checkout(jwt, d.package_id); window.location.assign(r.url); });
  return wrap(<div className="grid lg:grid-cols-[1fr_420px] gap-6 items-start">
    <div className={`${glass} p-5 sm:p-6`} data-testid="claim-content">{head}
      <div className="flex items-center gap-3 mb-3">{d.client.avatar_url && <img src={d.client.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow" />}<div><p className="font-semibold text-lg">{d.client.name}</p><p className="text-xs text-gray-600">{[d.client.profession, d.client.company, d.client.location].filter(Boolean).join(" · ")}</p></div></div>
      {d.client.bio && <p className="text-sm text-gray-700 whitespace-pre-wrap mb-4">{d.client.bio}</p>}
      <p className="text-xs font-bold uppercase tracking-wide text-[#fa632e] mb-2">{t("Tus 3 tarjetas", "Your 3 cards")}</p>
      <div className="grid sm:grid-cols-3 gap-3">{d.cards.map((c) => <div key={c.id} className="scale-[0.9] origin-top-left sm:scale-100" data-testid="claim-card-preview"><CardRenderer data={c} design={resolveDesign(c)} seal={false} lang={t("es", "en")} /></div>)}</div>
    </div>
    <div className="space-y-4">
      <Box testId="claim-actions">
        <div className="flex flex-wrap gap-2 mb-3"><Pill map={PAY} value={result?.payment_status || d.payment_status} testId="claim-pay" />{(accepted && (result?.delivery_status || d.delivery_status) === "pending_acceptance") ? <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200" data-testid="claim-deliv">{t("Aceptado · pendiente de pago", "Accepted · awaiting payment")}</span> : <Pill map={DELIV} value={result?.delivery_status || d.delivery_status} testId="claim-deliv" />}</div>
        {activated ? <div data-testid="claim-activated"><CheckCircle2 className="w-9 h-9 text-emerald-500 mb-2" /><h2 className="text-xl font-semibold mb-1">{t("¡Paquete activado!", "Package activated!")}</h2><p className="text-sm text-gray-600 mb-4">{t("Tu perfil y tus 3 tarjetas ya están en tu cuenta.", "Your profile and 3 cards are now in your account.")}</p><Button className="rounded-full w-full" onClick={() => navigate("/my-profile?tab=cards")} data-testid="claim-open-profile">{t("Ir a mi perfil y tarjetas", "Go to my profile and cards")}</Button></div>
        : !accepted ? <>
          <h2 className="text-xl font-semibold mb-1">{t("Confirma la cuenta destinataria", "Confirm the receiving account")}</h2>
          <p className="text-sm text-gray-600 mb-3">{t(`El paquete se incorporará a la cuenta @${d.account.handle} (${d.account.email_masked}). ¿No es tu cuenta?`, `The package will be added to account @${d.account.handle} (${d.account.email_masked}). Not your account?`)} <button type="button" className="underline" onClick={async () => { await logout(); navigate(`/login?next=${encodeURIComponent(here)}`); }} data-testid="claim-switch">{t("Cambiar de cuenta", "Switch account")}</button></p>
          {d.profile_diff.length > 0 && <div className="rounded-2xl bg-white/80 border border-orange-100 p-3 mb-3 text-sm" data-testid="claim-profile-diff"><p className="font-semibold mb-2">{t("Datos del perfil a incorporar", "Profile data to add")}</p>{d.profile_diff.map((f) => <label key={f.field} className="flex items-start gap-2 py-1 cursor-pointer"><input type="checkbox" className="mt-1" checked={fields?.includes(f.field)} onChange={(e) => setFields(e.target.checked ? [...fields, f.field] : fields.filter((x) => x !== f.field))} data-testid={`claim-field-${f.field}`} /><span><b>{t(...FIELD_LABEL[f.field])}</b>{f.changes ? <span className="text-amber-800"> · {t("reemplazará", "will replace")} «{String(Array.isArray(f.current) ? f.current.length + " enlaces" : f.current).slice(0, 40)}»</span> : <span className="text-gray-500"> · {t("nuevo", "new")}</span>}<br /><span className="text-xs text-gray-600">{String(Array.isArray(f.incoming) ? f.incoming.map((s) => s.url || s).join(", ") : f.incoming).slice(0, 90)}</span></span></label>)}<p className="text-[11px] text-gray-500 mt-2">{t(`Tus ${d.existing_cards} tarjetas actuales se conservan; se añaden 3 nuevas. Nunca cambiamos contraseñas, métodos de acceso, seguridad ni consentimientos.`, `Your ${d.existing_cards} current cards are kept; 3 new ones are added. We never change passwords, sign-in methods, security or consents.`)}</p></div>}
          <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={`@${d.account.handle}`} className="mb-2" data-testid="claim-handle-input" />
          <Button className="w-full rounded-full h-12" disabled={busy || handle.replace("@", "").toLowerCase() !== d.account.handle.toLowerCase()} onClick={() => act(async () => { const r = await api.accept(jwt, claim, { profile_fields: fields || [], confirm_handle: handle }); setResult(r); return r; })} data-testid="claim-accept-btn"><CheckCircle2 className="w-4 h-4 mr-2" />{t("Aceptar la entrega en esta cuenta", "Accept delivery to this account")}</Button>
          <p className="text-[11px] text-gray-500 mt-2">{t("Escribe tu @ para confirmar. La activación ocurre cuando el pago esté confirmado.", "Type your @ to confirm. Activation happens once payment is confirmed.")}</p>
        </> : paid ? <div data-testid="claim-transferring"><Clock className="w-8 h-8 text-amber-500 mb-2 animate-pulse" /><p className="text-sm text-gray-700 mb-3">{t("Pago confirmado. Estamos transfiriendo tu paquete…", "Payment confirmed. We are transferring your package…")}</p><Button variant="outline" className="rounded-full" onClick={() => act(async () => { const r = await api.retry(jwt, d.package_id); setResult(r); load(); })} data-testid="claim-retry-transfer">{t("Reintentar activación", "Retry activation")}</Button></div>
        : <>
          <h2 className="text-xl font-semibold mb-1">{t("Completa el pago", "Complete the payment")}</h2>
          <p className="text-sm text-gray-600 mb-3">{t(`${d.price_label} · ${PKG_LABEL()} · pago único a Octopus Vision Company (OVC). País de compra: ${d.market === "CO" ? "Colombia" : "Estados Unidos"}.`, `${d.price_label} · ${PKG_LABEL()} · one-time payment to Octopus Vision Company (OVC). Purchase country: ${d.market === "CO" ? "Colombia" : "United States"}.`)}</p>
          {(result?.payment_method || d.payment_method) === "cash" && <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm mb-3" data-testid="claim-cash-pending"><Wallet className="w-4 h-4 inline mr-1" />{t("Pago en efectivo pendiente de confirmar por tu asesor. Cuando lo confirme, el paquete se activará automáticamente en esta cuenta.", "Cash payment pending confirmation by your advisor. Once confirmed, the package activates automatically in this account.")}</div>}
          {(result?.provider_ready ?? d.provider_ready) ? <Button className="w-full rounded-full h-12" disabled={busy} onClick={pay} data-testid="claim-pay-btn"><CreditCard className="w-4 h-4 mr-2" />{t(`Pagar ${d.price_label} con ${d.market === "CO" ? "Wompi" : "Stripe"}`, `Pay ${d.price_label} with ${d.market === "CO" ? "Wompi" : "Stripe"}`)}</Button>
            : <p className="text-sm text-gray-700 bg-white/80 border border-orange-100 rounded-2xl p-3" data-testid="claim-virtual-unavailable">{t("El pago virtual no está disponible para este país por ahora. Puedes pagar en efectivo con tu asesor; él confirmará la recepción.", "Virtual payment is not available for this country right now. You can pay cash to your advisor, who will confirm receipt.")}</p>}
          <p className="text-[11px] text-gray-500 mt-3">{t("El pago se confirma con la notificación verificada de la pasarela, nunca por volver de la página de pago. Si cancelas o falla, tu paquete se conserva para reintentar.", "Payment is confirmed through the gateway's verified notification, never by returning from the checkout page. If you cancel or it fails, your package is kept to retry.")}</p>
        </>}
        {error && <p className="text-sm text-red-600 mt-3" data-testid="claim-error">{error}</p>}
      </Box>
    </div>
  </div>);
}
