import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Shield, ShieldOff, Loader2, UserX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function BlockedUsersPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);

  const load = async () => {
    try {
      const res = await axios.get(`${API}/users/me/blocked`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (_) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    load();
  }, [token]);

  const unblock = async (userId) => {
    setUnblockingId(userId);
    try {
      // toggle endpoint: POST /users/{id}/block toggles state
      await axios.post(
        `${API}/users/${userId}/block`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers((arr) => arr.filter((u) => u.id !== userId));
      brunoToast.success("Usuario desbloqueado");
    } catch (_) {
      brunoToast.error("No se pudo desbloquear");
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="blocked-users-page">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-muted"
            aria-label="Volver"
            data-testid="blocked-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Shield className="w-5 h-5 text-orange-500" />
          <h1 className="font-bold text-base">Usuarios bloqueados</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-500/15 grid place-items-center mb-3">
              <ShieldOff className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="font-semibold text-sm">No tienes usuarios bloqueados</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Cuando bloquees a alguien, aparecerá aquí. Podrás desbloquearlo en cualquier momento.
            </p>
          </div>
        ) : (
          <ul className="space-y-2" data-testid="blocked-users-list">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 bg-card border border-border/60 rounded-2xl p-3"
              >
                <Link to={`/profile/${u.id}`} className="shrink-0">
                  <div className="h-11 w-11 rounded-full bg-muted overflow-hidden grid place-items-center">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserX className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/profile/${u.id}`}
                    className="text-sm font-semibold hover:text-orange-500"
                  >
                    {u.display_name || u.username || "Usuario"}
                  </Link>
                  {u.username && (
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  )}
                </div>
                <button
                  onClick={() => unblock(u.id)}
                  disabled={unblockingId === u.id}
                  data-testid={`unblock-${u.id}`}
                  className="text-xs font-semibold rounded-full px-3 py-1.5 bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {unblockingId === u.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ShieldOff className="h-3 w-3" />
                  )}
                  Desbloquear
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
