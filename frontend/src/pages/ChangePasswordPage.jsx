import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Lock, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const Field = ({ label, value, onChange, show, onToggleShow, testId, error }) => (
  <label className="block">
    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {label}
    </span>
    <div className="mt-1.5 relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className={`w-full rounded-2xl bg-muted/50 border px-3 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 ${
          error ? "border-red-500/60" : "border-border/60"
        }`}
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center h-8 w-8 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Ocultar" : "Mostrar"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </label>
);

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!current) e.current = "Requerido";
    if (!next) e.next = "Requerido";
    else if (next.length < 8) e.next = "Mínimo 8 caracteres";
    else if (!/[A-Z]/.test(next) && !/[0-9]/.test(next)) e.next = "Usa una mayúscula o un número";
    if (next !== confirm) e.confirm = "No coincide";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await axios.post(
        `${API}/auth/change-password`,
        { current_password: current, new_password: next },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      brunoToast.success("Contraseña actualizada", {
        description: "Tu nueva contraseña ya está activa.",
      });
      navigate(-1);
    } catch (e) {
      brunoToast.error("No se pudo cambiar", {
        description: e?.response?.data?.detail || "Inténtalo de nuevo.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Password strength meter
  const strength = (() => {
    let s = 0;
    if (next.length >= 8) s++;
    if (/[A-Z]/.test(next)) s++;
    if (/[0-9]/.test(next)) s++;
    if (/[^A-Za-z0-9]/.test(next)) s++;
    return s;
  })();
  const strengthLabels = ["Muy débil", "Débil", "Media", "Fuerte", "Excelente"];
  const strengthColors = ["#EF4444", "#F59E0B", "#FBBF24", "#10B981", "#059669"];

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="change-password-page">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-muted"
            aria-label="Volver"
            data-testid="change-password-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-base">Cambiar contraseña</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        <div className="flex flex-col items-center text-center mb-4">
          <div className="h-14 w-14 rounded-2xl bg-orange-500/15 grid place-items-center mb-3">
            <Lock className="h-7 w-7 text-orange-500" />
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Usa una contraseña fuerte que no estés usando en otros sitios.
          </p>
        </div>

        <Field
          label="Contraseña actual"
          value={current}
          onChange={setCurrent}
          show={showCurrent}
          onToggleShow={() => setShowCurrent((v) => !v)}
          testId="change-password-current"
          error={errors.current}
        />
        <Field
          label="Nueva contraseña"
          value={next}
          onChange={setNext}
          show={showNext}
          onToggleShow={() => setShowNext((v) => !v)}
          testId="change-password-new"
          error={errors.next}
        />

        {/* Strength meter */}
        {next && (
          <div className="space-y-1.5" data-testid="password-strength">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex-1 h-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      i < strength ? strengthColors[strength - 1] : "rgba(161,161,170,0.25)",
                  }}
                />
              ))}
            </div>
            <p
              className="text-xs font-semibold"
              style={{ color: strength > 0 ? strengthColors[strength - 1] : undefined }}
            >
              {strengthLabels[strength]}
            </p>
          </div>
        )}

        <Field
          label="Confirmar nueva contraseña"
          value={confirm}
          onChange={setConfirm}
          show={showConfirm}
          onToggleShow={() => setShowConfirm((v) => !v)}
          testId="change-password-confirm"
          error={errors.confirm}
        />

        <button
          onClick={submit}
          disabled={saving || !current || !next || !confirm}
          data-testid="change-password-submit"
          className="w-full rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold py-3 shadow-lg shadow-orange-500/30 inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" /> Actualizar contraseña
            </>
          )}
        </button>
      </div>
    </div>
  );
}
