import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";

/** Soft banner: offline / reconnecting / N messages waiting to be sent */
const OfflineBanner = ({ online, wsConnected, pendingCount, onRetry }) => {
  const show = !online || !wsConnected || pendingCount > 0;
  const text = !online
    ? `Sin conexión${pendingCount ? ` · ${pendingCount} mensaje${pendingCount > 1 ? "s" : ""} en espera` : " · tus mensajes se enviarán al volver"}`
    : pendingCount ? `Enviando ${pendingCount} mensaje${pendingCount > 1 ? "s" : ""} pendiente${pendingCount > 1 ? "s" : ""}…`
    : "Reconectando al chat…";
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
          className={`overflow-hidden text-[11px] font-medium ${!online ? "bg-zinc-800 text-zinc-100" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`} data-testid="offline-banner">
          <div className="flex items-center gap-2 px-3 py-1.5">
            {!online ? <CloudOff className="w-3.5 h-3.5 shrink-0" /> : pendingCount ? <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <Wifi className="w-3.5 h-3.5 shrink-0 animate-pulse" />}
            <span className="flex-1 truncate" data-testid="offline-banner-text">{text}</span>
            {online && pendingCount > 0 && <button onClick={onRetry} className="underline underline-offset-2" data-testid="offline-retry-btn">Reintentar</button>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
