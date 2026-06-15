/**
 * CurrencySelector — dropdown to switch the active display currency + country.
 * Lives in the user settings area but can be embedded anywhere.
 */
import React, { useMemo, useState } from "react";
import { Check, ChevronDown, Globe, Loader2 } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export default function CurrencySelector({ compact = false }) {
  const { country, currency, locale, countries, currencies, setPreference, isEU, countryName } = useI18n();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("country"); // 'country' | 'currency'

  const eu = useMemo(() => countries.filter((c) => c.is_eu), [countries]);
  const nonEu = useMemo(() => countries.filter((c) => !c.is_eu), [countries]);
  const otherCurrencies = useMemo(() => currencies.slice(0, 12), [currencies]);

  const handlePick = async (next) => {
    setSaving(true);
    try {
      await setPreference(next.currency, next.country, next.locale);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative" data-testid="currency-selector">
      <button
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border/60 bg-card/80 hover:bg-muted/60 transition-colors ${compact ? "text-[11px]" : "text-xs font-semibold"}`}
        data-testid="currency-selector-toggle"
      >
        <Globe className="w-3.5 h-3.5 text-orange-500" />
        <span>{country}</span>
        <span className="text-muted-foreground">·</span>
        <span>{currency}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-72 max-h-[60vh] bg-card border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col" data-testid="currency-selector-panel">
            <div className="px-3 py-2 border-b flex items-center gap-1">
              <button
                onClick={() => setTab("country")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${tab === "country" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
                data-testid="currency-tab-country"
              >País</button>
              <button
                onClick={() => setTab("currency")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${tab === "currency" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
                data-testid="currency-tab-currency"
              >Moneda</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {saving && (
                <div className="absolute inset-x-0 top-12 grid place-items-center py-2"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
              )}
              {tab === "country" ? (
                <>
                  {eu.length > 0 && (
                    <div className="mb-1">
                      <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Unión Europea</p>
                      {eu.map((c) => (
                        <CountryRow key={c.code} c={c} active={country === c.code} onPick={() => handlePick({ currency: c.currency, country: c.code, locale: c.locale })} />
                      ))}
                    </div>
                  )}
                  {nonEu.length > 0 && (
                    <div>
                      <p className="px-2 py-1 mt-1 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Otros</p>
                      {nonEu.map((c) => (
                        <CountryRow key={c.code} c={c} active={country === c.code} onPick={() => handlePick({ currency: c.currency, country: c.code, locale: c.locale })} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {otherCurrencies.map((cu) => (
                    <button
                      key={cu.code}
                      onClick={() => handlePick({ currency: cu.code, country, locale })}
                      className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted text-sm"
                      data-testid={`currency-option-${cu.code}`}
                    >
                      <span className="font-semibold">{cu.code}</span>
                      <span className="text-[11px] text-muted-foreground">{cu.rate_vs_usd ? `1 USD = ${(+cu.rate_vs_usd).toFixed(cu.code === "COP" ? 0 : 2)}` : ""}</span>
                      {currency === cu.code && <Check className="w-3.5 h-3.5 text-emerald-500 ml-2" />}
                    </button>
                  ))}
                </>
              )}
            </div>
            <div className="px-3 py-2 border-t bg-muted/30 text-[10px] text-muted-foreground">
              {countryName ? `${countryName} · ${locale}` : locale}
              {isEU && <span className="ml-1 text-violet-500 font-semibold">· UE</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CountryRow({ c, active, onPick }) {
  return (
    <button
      onClick={onPick}
      className={`w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted text-sm ${active ? "bg-primary/10" : ""}`}
      data-testid={`country-option-${c.code}`}
    >
      <span className="flex items-center gap-2">
        <span className="text-[10px] font-mono w-7 text-muted-foreground">{c.code}</span>
        <span className="truncate">{c.name}</span>
      </span>
      <span className="text-[10px] text-muted-foreground">{c.currency}</span>
      {active && <Check className="w-3.5 h-3.5 text-emerald-500 ml-1" />}
    </button>
  );
}
