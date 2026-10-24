import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { API, StatusPill, auth } from "@/pages/service/serviceApi";

/** Pedidos del servicio «Creamos tu tarjeta» vinculados a la cuenta (Perfil › Tarjetas). */
export default function MyServiceOrders() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  useEffect(() => { if (token) axios.get(`${API}/orders/mine`, auth(token)).then((r) => setOrders(r.data.filter((o) => o.production_status !== "delivered" && o.production_status !== "cancelled"))).catch(() => {}); }, [token]);
  if (!orders.length) return null;
  return (
    <div className="mb-4 space-y-2" data-testid="my-service-orders">
      {orders.map((o) => (
        <button key={o.id} type="button" onClick={() => navigate(`/pedido/${o.id}?from=${encodeURIComponent("/my-profile?tab=cards")}`)} className="w-full text-left rounded-2xl border border-orange-200/70 bg-orange-50/60 p-3 flex items-center gap-3 hover:bg-orange-50 transition-colors" data-testid={`my-service-order-${o.id}`}>
          <span className="w-9 h-9 rounded-full bg-white grid place-items-center shadow-sm"><Package className="w-4 h-4 text-[#fa632e]" /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold truncate">Pedido · Creamos tu tarjeta · {o.label}</span>
            <span className="flex flex-wrap gap-1.5 mt-1"><StatusPill kind="production" value={o.production_status} lang="es" /><StatusPill kind="payment" value={o.payment_status} lang="es" /></span>
          </span>
        </button>
      ))}
    </div>
  );
}
