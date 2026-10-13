import React, { useState, useEffect } from "react";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MarketplaceOrderCard } from "@/components/marketplace/OrderCards";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import axios from "axios";
import {
  ArrowLeft,
  Plus,
  Package,
  Eye,
  Heart,
  Edit2,
  Trash2,
  MoreVertical,
  Pause,
  Play,
  DollarSign
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CATEGORY_ICONS = {
  electronics: "💻",
  clothing: "👕",
  home: "🏠",
  services: "🔧",
  vehicles: "🚗",
  sports: "⚽",
  beauty: "💄",
  food: "🍔",
  art: "🎨",
  other: "📦"
};

const STATUS_LABELS = {
  active: { label: "Activo", color: "bg-green-100 text-green-700" },
  paused: { label: "Pausado", color: "bg-yellow-100 text-yellow-700" },
  sold: { label: "Vendido", color: "bg-blue-100 text-blue-700" }
};

const MyProductsPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("tab") === "orders" ? "orders" : "products";
  const [sales, setSales] = useState(null);
  useEffect(() => {
    if (view !== "orders" || !token) return;
    axios.get(`${API}/marketplace/orders/sales`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setSales(r.data)).catch(() => setSales({ orders: [], counts: {}, statuses: {} }));
    // eslint-disable-next-line
  }, [view, token]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    fetchProducts();
  }, [token, navigate]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/marketplace/my-products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(response.data);
    } catch (error) {
      // error handled
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (productId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    
    try {
      await axios.put(`${API}/marketplace/products/${productId}`, {
        status: newStatus
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, status: newStatus } : p
      ));
    } catch (error) {
      // error handled
    }
  };

  const deleteProduct = async (productId) => {
    if (!confirm('¿Eliminar este producto?')) return;
    
    try {
      await axios.delete(`${API}/marketplace/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (error) {
      // error handled
    }
  };

  const filteredProducts = filter === "all" 
    ? products 
    : products.filter(p => p.status === filter);

  // Stats
  const stats = {
    total: products.length,
    active: products.filter(p => p.status === "active").length,
    paused: products.filter(p => p.status === "paused").length,
    sold: products.filter(p => p.status === "sold").length,
    totalViews: products.reduce((sum, p) => sum + (p.views || 0), 0),
    totalFavorites: products.reduce((sum, p) => sum + (p.favorites || 0), 0)
  };

  if (loading) {
    return (
      <BrunoLoader />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/marketplace">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Mis Productos</h1>
          </div>
          
          <Link to="/marketplace/new">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Publicar
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex gap-1 p-1 rounded-full bg-muted w-fit" data-testid="my-products-tabs">
          <button onClick={() => setSearchParams({})} className={`px-4 h-8 rounded-full text-xs font-semibold ${view === "products" ? "bg-background shadow" : "text-muted-foreground"}`} data-testid="my-products-tab-products">Productos</button>
          <button onClick={() => setSearchParams({ tab: "orders" })} className={`px-4 h-8 rounded-full text-xs font-semibold ${view === "orders" ? "bg-background shadow" : "text-muted-foreground"}`} data-testid="my-products-tab-orders">Pedidos recibidos{sales?.orders?.length ? ` (${sales.orders.length})` : ""}</button>
        </div>

        {view === "orders" && (
          <div className="space-y-3" data-testid="seller-orders">
            <p className="text-xs text-muted-foreground">Pedidos pagados en BRUNO. Actualiza el estado para avisar al comprador; si cancelas, el reembolso se hace por Stripe automáticamente. Lo que ganas se acumula en <Link to="/earnings" className="text-primary underline">Mis ingresos</Link>.</p>
            {sales === null ? <BrunoLoader fullScreen={false} className="rounded-3xl min-h-[200px]" />
              : sales.orders.length === 0 ? <p className="text-sm text-muted-foreground text-center py-12" data-testid="seller-orders-empty">Aún no has recibido pedidos.</p>
              : sales.orders.map((o) => <MarketplaceOrderCard key={o.id} order={o} role="seller" statuses={sales.statuses} headers={{ Authorization: `Bearer ${token}` }} onChange={(u) => setSales((s) => ({ ...s, orders: s.orders.map((x) => (x.id === u.id ? u : x)) }))} />)}
          </div>
        )}

        {view === "products" && <>
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-card rounded-xl border text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Productos</p>
          </div>
          <div className="p-4 bg-card rounded-xl border text-center">
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            <p className="text-sm text-muted-foreground">Activos</p>
          </div>
          <div className="p-4 bg-card rounded-xl border text-center">
            <p className="text-2xl font-bold">{stats.totalViews}</p>
            <p className="text-sm text-muted-foreground">Vistas totales</p>
          </div>
          <div className="p-4 bg-card rounded-xl border text-center">
            <p className="text-2xl font-bold">{stats.totalFavorites}</p>
            <p className="text-sm text-muted-foreground">Favoritos</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: "all", label: "Todos" },
            { id: "active", label: "Activos" },
            { id: "paused", label: "Pausados" },
            { id: "sold", label: "Vendidos" }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.id ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Products List */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No tienes productos</h2>
            <p className="text-muted-foreground mb-6">
              Comienza a vender publicando tu primer producto
            </p>
            <Link to="/marketplace/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Publicar producto
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="flex gap-4 p-4 bg-card rounded-xl border"
              >
                {/* Image */}
                <Link 
                  to={`/marketplace/${product.id}`}
                  className="w-24 h-24 rounded-lg bg-muted overflow-hidden flex-shrink-0"
                >
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </Link>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link to={`/marketplace/${product.id}`}>
                        <h3 className="font-medium line-clamp-1 hover:text-primary">
                          {product.title}
                        </h3>
                      </Link>
                      <p className="text-lg font-bold text-primary">
                        ${product.price?.toLocaleString()}
                      </p>
                    </div>
                    
                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_LABELS[product.status]?.color || 'bg-gray-100'
                    }`}>
                      {STATUS_LABELS[product.status]?.label || product.status}
                    </span>
                  </div>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {product.views || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {product.favorites || 0}
                    </span>
                    <span>{CATEGORY_ICONS[product.category] || "📦"}</span>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleStatus(product.id, product.status)}
                    >
                      {product.status === "active" ? (
                        <>
                          <Pause className="w-3 h-3 mr-1" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Activar
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/marketplace/${product.id}/edit`)}
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => deleteProduct(product.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </>}
      </div>
    </div>
  );
};

export default MyProductsPage;
