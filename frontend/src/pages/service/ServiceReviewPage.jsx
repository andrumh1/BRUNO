import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, LogIn, MailCheck, MessageSquareText, ShieldAlert, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import CardRenderer from "@/components/cards/CardRenderer";
import { resolveDesign } from "@/lib/cardDesign";
import { API, StatusPill, auth, errText, getReview, t, glass } from "./serviceApi";

const Box = ({ children, testId }) => <div className={`${glass} p-7 sm:p-9`} data-testid={testId}>{children}</div>;

export default function ServiceReviewPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { token: jwt, user, isLoading, logout } = useAuth();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState("");
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const here = `/pedido/revisar/${token}`;

  const load = () => getReview(token, jwt).then((d) => { setData(d); setState(d.state); }).catch((e) => setState(e.response?.data?.detail?.state || "invalid"));
  useEffect(() => { if (!isLoading) load(); }, [jwt, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const call = async (path, body) => {
    setBusy(true); setError("");
    try { const r = await axios.post(`${API}/review/${token}/${path}`, body || {}, auth(jwt)); return r.data; }
    catch (e) { const d = e.response?.data?.detail; setError(errText(e, t("No se pudo completar la acción.", "The action could not be completed."))); if (d?.state === "stale") load(); return null; }
    finally { setBusy(false); }
  };

  const order = data?.order;
  const wrap = (child) => <div className="min-h-screen bg-[linear-gradient(160deg,#fff7f1,#ffffff_45%,#fff1e6)] px-4 py-8" data-testid="service-review-page"><div className="max-w-5xl mx-auto">{child}</div></div>;

  if (state === "loading") return wrap(<Box testId="review-loading"><p className="text-sm text-gray-600">{t("Cargando…", "Loading…")}</p></Box>);
  if (state === "invalid" || state === "expired" || state === "revoked") return wrap(<Box testId="review-link-invalid">
    <ShieldAlert className="w-10 h-10 text-amber-500 mb-3" />
    <h1 className="text-2xl font-semibold mb-2">{state === "expired" ? t("Este enlace venció", "This link has expired") : state === "revoked" ? t("Este enlace ya no es válido", "This link is no longer valid") : t("Enlace no válido", "Invalid link")}</h1>
    <p className="text-sm text-gray-600">{t("Por seguridad los enlaces de revisión caducan o se reemplazan cuando hay una versión nueva. Pide al equipo que reenvíe la invitación desde bruno@brunocard.com.", "For security, review links expire or are replaced when a new version exists. Ask the team to resend the invitation from bruno@brunocard.com.")}</p>
  </Box>);

  if (state === "login") return wrap(<Box testId="review-login-required">
    <LogIn className="w-10 h-10 text-[#fa632e] mb-3" />
    <h1 className="text-2xl font-semibold mb-2">{t("Identifícate para revisar tu tarjeta", "Sign in to review your card")}</h1>
    <p className="text-sm text-gray-600 mb-5">{t(`Este pedido pertenece a ${data.email_masked}. Abrir este enlace no aprueba nada: primero confirmamos que eres tú.`, `This order belongs to ${data.email_masked}. Opening this link approves nothing: first we confirm it is you.`)}</p>
    <div className="flex flex-wrap gap-3">
      <Button className="rounded-full" onClick={() => navigate(`/login?next=${encodeURIComponent(here)}`)} data-testid="review-login-btn">{t("Iniciar sesión", "Sign in")}</Button>
      {!data.has_account && <Button variant="outline" className="rounded-full" onClick={() => navigate(`/register?next=${encodeURIComponent(here)}`)} data-testid="review-register-btn">{t("Crear mi cuenta", "Create my account")}</Button>}
    </div>
    <p className="text-xs text-gray-500 mt-4">{t("Tu pedido se conserva: puedes continuar más tarde con este mismo enlace mientras esté vigente.", "Your order is kept: you can continue later with this same link while it is valid.")}</p>
  </Box>);

  if (state === "switch_account") return wrap(<Box testId="review-switch-account">
    <UserRoundX className="w-10 h-10 text-amber-500 mb-3" />
    <h1 className="text-2xl font-semibold mb-2">{t("Esta cuenta no corresponde al pedido", "This account does not match the order")}</h1>
    <p className="text-sm text-gray-600 mb-5">{t(`Has iniciado sesión como ${user?.email}, pero el pedido fue solicitado por ${data.email_masked}. Cambia de cuenta para continuar. Si cambiaste de correo, escríbenos a bruno@brunocard.com.`, `You are signed in as ${user?.email}, but the order was requested by ${data.email_masked}. Switch accounts to continue. If you changed your email, write to bruno@brunocard.com.`)}</p>
    <Button className="rounded-full" onClick={async () => { await logout(); navigate(`/login?next=${encodeURIComponent(here)}`); }} data-testid="review-switch-btn">{t("Cambiar de cuenta", "Switch account")}</Button>
  </Box>);

  if (state === "verify_email") return wrap(<Box testId="review-verify-email">
    <MailCheck className="w-10 h-10 text-[#fa632e] mb-3" />
    <h1 className="text-2xl font-semibold mb-2">{t("Confirma tu correo", "Confirm your email")}</h1>
    <p className="text-sm text-gray-600 mb-5">{t(`Enviaremos un código a ${data.email_masked} para vincular este pedido a tu cuenta. Así nadie puede reclamar tu tarjeta solo con escribir tu correo.`, `We will send a code to ${data.email_masked} to link this order to your account. That way nobody can claim your card just by typing your email.`)}</p>
    {!codeSent ? <Button className="rounded-full" disabled={busy} onClick={async () => { const r = await call("send-code"); if (r?.sent) setCodeSent(true); else if (r) setError(t("No pudimos enviar el código ahora. Inténtalo más tarde.", "We could not send the code right now. Try again later.")); }} data-testid="review-send-code-btn">{t("Enviar código", "Send code")}</Button>
      : <div className="flex flex-wrap gap-3 items-center">
        <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="000000" className="w-36 text-center tracking-[6px] font-bold" data-testid="review-code-input" />
        <Button className="rounded-full" disabled={busy || code.length !== 6} onClick={async () => { const r = await call("verify-code", { code }); if (r) load(); }} data-testid="review-verify-code-btn">{t("Confirmar", "Confirm")}</Button>
        <button type="button" className="text-xs underline text-gray-500" onClick={() => call("send-code")} data-testid="review-resend-code-btn">{t("Reenviar código", "Resend code")}</button>
      </div>}
    {error && <p className="text-sm text-red-600 mt-3" data-testid="review-error">{error}</p>}
  </Box>);

  // state === "ok"
  const stale = !data.version_current || data.card_changed;
  const reviewable = ["pending_approval", "changes_requested"].includes(order.production_status) && !stale;
  const card = data.card;
  return wrap(<div className="grid lg:grid-cols-[1fr_420px] gap-6 items-start">
    <div className={`${glass} p-4 sm:p-6`} data-testid="review-preview">
      <p className="text-[11px] tracking-[2px] uppercase font-bold text-[#fa632e] mb-2">{t("Vista previa privada · versión", "Private preview · version")} {data.version}</p>
      {card ? <div className="flex justify-center"><CardRenderer data={card} design={resolveDesign(card)} seal={false} lang={t("es", "en")} /></div> : <p className="text-sm text-gray-600">{t("La tarjeta aún no está disponible.", "The card is not available yet.")}</p>}
    </div>
    <div className="space-y-4">
      <Box testId="review-actions">
        <h1 className="text-2xl font-semibold mb-1">{t("Revisa tu tarjeta", "Review your card")}</h1>
        <div className="flex flex-wrap gap-2 mb-4"><StatusPill kind="production" value={order.production_status} testId="review-production-status" /><StatusPill kind="payment" value={order.payment_status} testId="review-payment-status" /></div>
        {data.note && <p className="text-sm text-gray-700 bg-white/80 border border-orange-100 rounded-2xl p-3 mb-4" data-testid="review-team-note">{t("Nota del equipo", "Team note")}: {data.note}</p>}
        {stale && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4" data-testid="review-stale">{t("El equipo modificó la tarjeta después de enviarla. Espera el nuevo enlace de revisión antes de aprobar.", "The team modified the card after sending it. Wait for the new review link before approving.")}</p>}
        {done ? <div className="text-sm text-gray-700 space-y-3" data-testid="review-done">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          {done.kind === "changes" ? <p>{t(`Enviamos tus observaciones al equipo (ronda ${done.round}${done.included ? ", incluida en la oferta" : "; trabajos adicionales se acuerdan por separado"}). Te avisaremos cuando haya una nueva versión.`, `We sent your notes to the team (round ${done.round}${done.included ? ", included in the offer" : "; additional work is agreed separately"}). We will let you know when a new version is ready.`)}</p>
            : done.production_status === "delivered" ? <><p>{t("¡Listo! La tarjeta ya está en tu cuenta.", "Done! The card is now in your account.")}</p><Button className="rounded-full" onClick={() => navigate("/my-profile?tab=cards")} data-testid="review-open-cards-btn">{t("Ver en Perfil → Tarjetas", "Open Profile → Cards")}</Button></>
            : <p>{t("Aprobación registrada. La tarjeta pasará a tu cuenta en cuanto el pago esté confirmado.", "Approval recorded. The card will move to your account as soon as the payment is confirmed.")}</p>}
        </div> : (
          <>
            {order.production_status === "approved" && <p className="text-sm text-gray-700" data-testid="review-approved-waiting">{t("Ya aprobaste esta versión. La entrega se completa cuando el pago esté confirmado.", "You already approved this version. Delivery completes once the payment is confirmed.")}</p>}
            {order.production_status === "delivered" && <Button className="rounded-full" onClick={() => navigate("/my-profile?tab=cards")} data-testid="review-open-cards-btn">{t("Ver en Perfil → Tarjetas", "Open Profile → Cards")}</Button>}
            {reviewable && <>
              <label className="flex items-start gap-3 text-sm text-gray-800 rounded-2xl border border-orange-100 bg-white/80 p-3 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={publish} onChange={(e) => setPublish(e.target.checked)} data-testid="review-publish-checkbox" />
                <span><b>{t("También autorizo publicar esta tarjeta y hacer visible su contenido según la configuración indicada.", "I also authorize publishing this card and making its content visible according to the indicated settings.")}</b><br /><span className="text-xs text-gray-600">{t("Si la publicas, su nombre, foto, descripción, enlaces y datos de contacto incluidos serán visibles para cualquier persona con el enlace o el QR y podrá aparecer en BRUNO. Si no la autorizas, la recibirás como privada y podrás publicarla después desde Perfil → Tarjetas.", "If published, its name, photo, description, links and included contact details will be visible to anyone with the link or QR and it may appear in BRUNO. If you do not authorize it, you receive it as private and can publish it later from Profile → Cards.")}</span></span>
              </label>
              <Button className="w-full rounded-full h-12 mt-3" disabled={busy} onClick={async () => { const r = await call("approve", { version: data.version, publish }); if (r) setDone(r); }} data-testid="review-approve-btn"><CheckCircle2 className="w-4 h-4 mr-2" />{t("Aprobar y recibir mi tarjeta", "Approve and receive my card")}</Button>
              <p className="text-[11px] text-gray-500 mt-2">{t(`Apruebas exactamente la versión ${data.version} que estás viendo.`, `You approve exactly version ${data.version} you are viewing.`)}</p>
              <div className="mt-5 pt-5 border-t border-orange-100">
                <p className="text-sm font-semibold mb-2 inline-flex items-center gap-2"><MessageSquareText className="w-4 h-4" />{t("Solicitar ajustes", "Request changes")}</p>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder={t("Cuéntanos qué cambiar…", "Tell us what to change…")} data-testid="review-changes-input" />
                <Button variant="outline" className="rounded-full mt-2" disabled={busy || message.trim().length < 3} onClick={async () => { const r = await call("changes", { message }); if (r) setDone({ kind: "changes", ...r }); }} data-testid="review-changes-btn">{t("Enviar observaciones", "Send notes")}</Button>
                <p className="text-[11px] text-gray-500 mt-2">{t("La oferta incluye una ronda de ajustes; trabajos adicionales se acuerdan por separado.", "The offer includes one round of adjustments; additional work is agreed separately.")}</p>
              </div>
            </>}
            {error && <p className="text-sm text-red-600 mt-3" data-testid="review-error">{error}</p>}
          </>
        )}
      </Box>
    </div>
  </div>);
}
