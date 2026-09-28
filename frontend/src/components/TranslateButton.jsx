import React, { useState } from "react";
import axios from "axios";
import { Languages, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
export const userLang = () => {
  try { const saved = localStorage.getItem("bruno_lang"); if (saved) return saved; } catch { /* ignore */ }
  return ((navigator.language || "es").split("-")[0] || "es").toLowerCase();
};

/** TranslateButton — one-tap translation of any text (chat, transcript, comment) to the user's language */
const TranslateButton = ({ text, tone = "muted", className = "", compact = false, testId = "translate-btn" }) => {
  const { token } = useAuth();
  const [state, setState] = useState("idle"); // idle | loading | shown | original | error
  const [result, setResult] = useState(null);
  if (!text || text.trim().length < 2) return null;

  const run = async () => {
    if (result) { setState((s) => (s === "shown" ? "original" : "shown")); return; }
    setState("loading");
    try {
      const r = await axios.post(`${API}/ai/translate`, { text, target: userLang() }, { headers: { Authorization: `Bearer ${token}` } });
      setResult(r.data); setState("shown");
    } catch { setState("error"); }
  };

  const color = tone === "own" ? "text-primary-foreground/80" : "text-primary";
  return (
    <div className={className} data-no-dbltap>
      {state === "shown" && result && (
        <p className={`mt-1 text-xs leading-snug rounded-lg px-2 py-1.5 ${tone === "own" ? "bg-white/10" : "bg-primary/5"}`} data-testid={`${testId}-result`}>
          {result.same_language ? <span className="italic opacity-80">Ya está en tu idioma</span> : result.translated}
        </p>
      )}
      <button type="button" onClick={(e) => { e.stopPropagation(); run(); }} disabled={state === "loading"}
        className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium underline-offset-2 hover:underline ${color}`} data-testid={testId}>
        {state === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
        {state === "loading" ? "Traduciendo…" : state === "shown" ? "Ver original" : state === "error" ? "Reintentar traducción" : compact ? "Traducir" : `Traducir${result?.detected ? ` (${result.detected})` : ""}`}
      </button>
    </div>
  );
};

export default TranslateButton;
