import React, { createContext, useContext, useEffect, useState } from "react";

const KEY = "bruno_theme";
const ThemeContext = createContext({ theme: "system", resolved: "light", setTheme: () => null });

const resolve = (theme) =>
  theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;

export function ThemeProvider({ children, ...props }) {
  const [theme, setThemeState] = useState(() => { try { return localStorage.getItem(KEY) || "system"; } catch { return "system"; } });
  const [resolved, setResolved] = useState(() => resolve(theme));

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
    <ThemeContext.Provider value={{ theme, resolved, setTheme }} {...props}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
