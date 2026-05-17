import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Smartphone,
  Tablet,
  Monitor,
  Apple,
  Loader2,
  LogOut,
  ShieldCheck,
  Clock,
  MapPin,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import BrunoModal from "@/components/bruno/BrunoModal";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

function platformIcon(p) {
  switch ((p || "").toLowerCase()) {
    case "ios":
      return Apple;
    case "android":
    case "expo":
    case "huawei":
      return Smartphone;
    case "tablet":
    case "ipad":
      return Tablet;
    default:
      return Monitor;
  }
}

function timeAgo(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Ahora";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return `Hace ${Math.floor(diff / 86400)}d`;
}

export default function DevicesPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mobile/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDevices(Array.isArray(res.data) ? res.data : []);
    } catch (_) {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    load();
  }, [token]);

  const unregister = async (id) => {
    setRemoving(id);
    try {
      await axios.delete(`${API}/mobile/devices/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDevices((arr) => arr.filter((d) => d.id !== id));
      brunoToast.success("Sesión cerrada en ese dispositivo");
    } catch (_) {
      brunoToast.error("No se pudo cerrar la sesión");
    } finally {
      setRemoving(null);
      setPendingRemove(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="devices-page">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-muted"
            aria-label="Volver"
            data-testid="devices-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Smartphone className="w-5 h-5 text-orange-500" />
          <div className="flex-1">
            <h1 className="font-bold text-base leading-tight">Dispositivos</h1>
            <p className="text-[10px] text-muted-foreground">
              Sesiones activas en tu cuenta
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Current device banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 px-4 py-3"
          data-testid="current-session-banner"
        >
          <div className="grid place-items-center h-10 w-10 rounded-full bg-orange-500/20 text-orange-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Este dispositivo</p>
            <p className="text-[11px] text-muted-foreground truncate">
              Navegador actual · sesión activa
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 bg-orange-500/20 rounded-full px-2 py-1">
            Actual
          </span>
        </motion.div>

        {loading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-muted grid place-items-center mb-3">
              <Smartphone className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-sm">Sin dispositivos móviles</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Aún no has iniciado sesión desde la app móvil de Bruno.
              Cuando lo hagas, podrás administrarlas aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="devices-list">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-1">
              Sesiones móviles ({devices.length})
            </p>
            <AnimatePresence>
              {devices.map((d) => {
                const Icon = platformIcon(d.platform);
                return (
                  <motion.div
                    key={d.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className="bg-card border border-border/60 rounded-2xl p-3 flex items-center gap-3"
                    data-testid={`device-${d.id}`}
                  >
                    <div className="grid place-items-center h-11 w-11 rounded-xl bg-muted text-orange-500 shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {d.device_name || d.device_model || "Dispositivo móvil"}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(d.last_used_at)}
                        </span>
                        {d.locale && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {d.locale}
                          </span>
                        )}
                        {d.app_version && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-px font-mono">
                            v{d.app_version}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                        {d.platform}
                      </p>
                    </div>
                    <button
                      onClick={() => setPendingRemove(d)}
                      disabled={removing === d.id}
                      data-testid={`device-logout-${d.id}`}
                      className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20 transition-colors disabled:opacity-60"
                    >
                      {removing === d.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <LogOut className="h-3 w-3" />
                      )}
                      Cerrar
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Bulk action */}
            {devices.length > 1 && (
              <motion.button
                layout
                whileTap={{ scale: 0.97 }}
                onClick={() =>
                  setPendingRemove({
                    bulk: true,
                    count: devices.length,
                  })
                }
                data-testid="devices-logout-all"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 text-red-600 dark:text-red-300 text-sm font-semibold py-3 hover:bg-red-50 dark:hover:bg-red-500/10 mt-2"
              >
                <Trash2 className="h-4 w-4" />
                Cerrar sesión en todos
              </motion.button>
            )}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      <BrunoModal
        open={!!pendingRemove}
        onClose={() => !removing && setPendingRemove(null)}
        variant="danger"
        title={pendingRemove?.bulk ? "Cerrar sesión en todos" : "Cerrar esta sesión"}
        description={
          pendingRemove?.bulk
            ? `Vas a cerrar sesión en ${pendingRemove.count} dispositivos móviles. Tendrás que volver a iniciar sesión en cada uno.`
            : pendingRemove?.device_name
            ? `Vas a cerrar sesión en "${pendingRemove.device_name}". El usuario tendrá que iniciar sesión de nuevo en ese dispositivo.`
            : "El usuario tendrá que iniciar sesión de nuevo en ese dispositivo."
        }
        primaryAction={{
          label: removing ? "Cerrando..." : "Cerrar sesión",
          onClick: async () => {
            if (!pendingRemove) return;
            if (pendingRemove.bulk) {
              setRemoving("__all__");
              try {
                for (const d of devices) {
                  await axios
                    .delete(`${API}/mobile/devices/${d.id}`, {
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    .catch(() => {});
                }
                setDevices([]);
                brunoToast.success("Sesiones cerradas en todos los dispositivos");
              } finally {
                setRemoving(null);
                setPendingRemove(null);
              }
            } else {
              unregister(pendingRemove.id);
            }
          },
          loading: !!removing,
        }}
        secondaryAction={{
          label: "Cancelar",
          onClick: () => setPendingRemove(null),
        }}
        testId="devices-confirm-modal"
      />
    </div>
  );
}
