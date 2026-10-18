import React, { createContext, useContext, useEffect, useState } from "react";

const KEY = "bruno_theme";
const ACCENT_KEY = "bruno_accent";
export const ACCENTS = [
  { id: "neutral", label: "Neutro", desc: "Sin color de acento", swatch: "#6b6b6b" },
  { id: "orange", label: "Naranja", desc: "Original BRUNO", swatch: "#ff6a00" },
  { id: "blue", label: "Azul", swatch: "#2f6fe4" },
  { id: "purple", label: "Morado", swatch: "#8b47e8" },
  { id: "green", label: "Verde", swatch: "#25a06f" },
  { id: "red", label: "Rojo", swatch: "#e33b3b" },
  { id: "pink", label: "Rosa", swatch: "#ea3f9a" },
  { id: "teal", label: "Turquesa", swatch: "#20b5ad" },
  { id: "yellow", label: "Amarillo", swatch: "#f9b905" },
  { id: "coral", label: "Coral", swatch: "#f5704a" },
  { id: "wine", label: "Vino", swatch: "#a02240" },
  { id: "indigo", label: "Índigo", swatch: "#4141d6" },
];
const ACCENT_IDS = new Set(ACCENTS.map((a) => a.id));
const ThemeContext = createContext({ theme: "system", resolved: "light", setTheme: () => null, accent: "orange", setAccent: () => null });

const resolve = (theme) =>
  theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;

export function ThemeProvider({ children, ...props }) {
  const [theme, setThemeState] = useState(() => { try { return localStorage.getItem(KEY) || "system"; } catch { return "system"; } });
  const [resolved, setResolved] = useState(() => resolve(theme));
  const [accent, setAccentState] = useState(() => { try { const a = localStorage.getItem(ACCENT_KEY); return ACCENT_IDS.has(a) ? a : "orange"; } catch { return "orange"; } });

  useEffect(() => { document.documentElement.dataset.accent = accent; }, [accent]);
  const setAccent = (a) => { if (!ACCENT_IDS.has(a)) return; try { localStorage.setItem(ACCENT_KEY, a); } catch { /* ignore */ } setAccentState(a); };

  useEffect(() => {
    const root = window.document.documentElement;
    const apply = () => { const r = resolve(theme); root.classList.remove("light", "dark"); root.classList.add(r); setResolved(r); };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = (t) => { try { localStorage.setItem(KEY, t); } catch { /* ignore */ } setThemeState(t); };

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, accent, setAccent }} {...props}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
