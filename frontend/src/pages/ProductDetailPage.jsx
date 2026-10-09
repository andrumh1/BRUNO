import React, { useState, useEffect } from "react";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBrunoCheckout } from "@/hooks/useBrunoCheckout";
import { QuoteCard } from "@/components/money/QuoteCard";
import { Button } from "@/components/ui/button";
import axios from "axios";
import {
  ArrowLeft,
  Heart,
  Share2,
  MapPin,
  MessageCircle,
  ShoppingCart,
  User,
  Star,
  Package,
  Truck,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  Loader2,
  Eye,
  Plus,
  Minus,
  Zap,
  CheckCircle2
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

const ProductDetailPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const checkout = useBrunoCheckout();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [dealLoading, setDealLoading] = useState(false);
  const [dealOrderResult, setDealOrderResult] = useState(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.get(`${API}/marketplace/products/${productId}`, { headers });
        setProduct(response.data);
        setIsFavorited(response.data.is_favorited || false);
      } catch (error) {
        // error handled
        navigate('/marketplace');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProduct();
  }, [productId, token, navigate]);

  const handleFavorite = async () => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    try {
      await axios.post(`${API}/marketplace/products/${productId}/favorite`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsFavorited(!isFavorited);
    } catch (error) {
      // error handled
    }
  };

  const handleAddToCart = async () => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    setAddingToCart(true);
    try {
      await axios.post(`${API}/marketplace/cart/add`, {
        product_id: productId,
        quantity
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Show success feedback
      alert('Producto agregado al carrito');
    } catch (error) {
      // error handled
      alert(error.response?.data?.detail || 'Error al agregar al carrito');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleContactSeller = () => {
    if (!token) {
      navigate('/login');
      return;
    }
    navigate(`/chat?new=${product.seller?.id}`);
  };

  const handleDealPurchase = async () => {
    if (!token) {
      navigate('/login');
      return;
    }
    setDealLoading(true);
    try {
      const isService = product.category === "services";
      const response = await axios.post(`${API}/deal/send-order`, {
        product_id: product.id,
        product_name: product.title,
        product_type: isService ? "service" : "product",
        price: product.price,
        currency: product.currency || "USD",
        quantity,
        partner_id: product.deal_partner_id || null,
        referral_code: product.deal_referral_code || null,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDealOrderResult(response.data);
    } catch (error) {
      alert(error.response?.data?.detail || "Error al procesar la orden");
    } finally {
      setDealLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: product.title,
        text: product.description,
        url: window.location.href
      });
    } catch (error) {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Enlace copiado al portapapeles');
    }
  };

  if (loading) {
    return (
      <BrunoLoader />
    );
  }

  if (!product) return null;

  const images = product.images?.length > 0 ? product.images : [null];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleFavorite}>
              <Heart className={`w-5 h-5 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="relative aspect-square max-h-[60vh] bg-muted overflow-hidden">
        {images[currentImageIndex] ? (
          <img
            src={images[currentImageIndex]}
            alt={product.title}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-24 h-24 text-muted-foreground" />
          </div>
        )}
        
        {/* Image navigation */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrentImageIndex(i => (i > 0 ? i - 1 : images.length - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 rounded-full text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => setCurrentImageIndex(i => (i < images.length - 1 ? i + 1 : 0))}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 rounded-full text-white"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            
            {/* Dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, idx) => (
                <button
                  key={`_-${idx}`}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
        
        {/* Condition badge */}
        {product.condition !== "new" && (
          <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-sm">
            {product.condition === "used" ? "Usado" : "Reacondicionado"}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Price and Title */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl font-bold text-primary">
              ${product.price?.toLocaleString()}
            </span>
            <span className="text-muted-foreground">{product.currency}</span>
          </div>
          <h1 className="text-xl font-semibold">{product.title}</h1>
          
          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {product.views || 0} vistas
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              {product.favorites || 0} favoritos
            </span>
            <span className="flex items-center gap-1">
              {CATEGORY_ICONS[product.category] || "📦"}
              {product.category}
            </span>
          </div>
        </div>

        {/* Location */}
        {product.location && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{product.location}</span>
          </div>
        )}

        {/* Seller Info */}
        {product.seller && (
          <div className="p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted overflow-hidden">
                {product.seller.avatar_url ? (
                  <img src={product.seller.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{product.seller.name}</p>
                <p className="text-sm text-muted-foreground">Vendedor</p>
              </div>
              <Button variant="outline" onClick={() => navigate(`/profile/${product.seller.id}`)}>
                Ver perfil
              </Button>
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <h2 className="font-semibold mb-2">Descripción</h2>
          <p className="text-muted-foreground whitespace-pre-wrap">{product.description}</p>
        </div>

        {/* Tags */}
        {product.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag, idx) => (
              <span key={`tag-${idx}`} className="px-3 py-1 bg-muted rounded-full text-sm">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Shipping Info */}
        <div className="p-4 bg-muted/30 rounded-xl space-y-3">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">
                {product.shipping_available ? 'Envío disponible' : 'Sin envío - Solo retiro'}
              </p>
              {product.shipping_cost && (
                <p className="text-sm text-muted-foreground">
                  Costo de envío: ${product.shipping_cost}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-green-500" />
            <p className="text-sm">Compra protegida por BRUNO</p>
          </div>
        </div>
      </div>

      {/* DEAL Order Confirmation */}
      {dealOrderResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setDealOrderResult(null)}>
          <div className="bg-background rounded-2xl p-6 mx-4 max-w-sm w-full space-y-4 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="deal-order-confirmation">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold">Orden Enviada</h3>
              <p className="text-sm text-muted-foreground mt-1">Tu orden fue enviada a DEAL para procesamiento de pago</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Producto</span>
                <span className="font-medium">{dealOrderResult.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-primary">${dealOrderResult.price?.toLocaleString()} {dealOrderResult.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado</span>
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Pendiente de pago</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Orden</span>
                <span className="font-mono text-xs">{dealOrderResult.id?.slice(0, 8)}...</span>
              </div>
            </div>
            <Button className="w-full" onClick={() => setDealOrderResult(null)} data-testid="deal-order-close-btn">
              Entendido
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-40 max-h-[70vh] overflow-y-auto" style={{ paddingBottom: "var(--content-bottom)" }}>
        <div className="max-w-4xl mx-auto flex flex-wrap gap-3">
          {/* Quantity selector */}
          <div className="flex items-center border rounded-lg">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="p-2 hover:bg-muted"
              disabled={quantity <= 1}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="px-4 font-medium">{quantity}</span>
            <button
              onClick={() => setQuantity(q => q + 1)}
              className="p-2 hover:bg-muted"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          {/* Contact button */}
          <Button variant="outline" className="flex-1" onClick={handleContactSeller}>
            <MessageCircle className="w-4 h-4 mr-2" />
            Contactar
          </Button>
          
          {product.seller_id !== user?.id && (
            product.deal_enabled ? (
              /* DEAL Purchase Button */
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleDealPurchase}
                disabled={dealLoading}
                data-testid="deal-purchase-btn"
              >
                {dealLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {product.category === "services" ? "Solicitar Servicio" : "Comprar"}
              </Button>
            ) : (<>
              {product.category !== "services" && product.seller_id !== user?.id && product.user_id !== user?.id && (
                <Button variant="secondary" className="flex-1" onClick={() => checkout.getQuote({ kind: "marketplace", ref_id: product.id })} disabled={checkout.busy} data-testid="product-pay-in-bruno-btn">Pagar en BRUNO</Button>
              )}
              {/* Standard Add to Cart */}
              <Button className="flex-1" onClick={handleAddToCart} disabled={addingToCart}>
                {addingToCart ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ShoppingCart className="w-4 h-4 mr-2" />
                )}
                Agregar
              </Button>
            </>)
          )}
          {checkout.quote && <div className="basis-full"><QuoteCard quote={checkout.quote} busy={checkout.busy} onPay={() => checkout.pay({ kind: "marketplace", ref_id: product.id })} onCancel={() => window.location.reload()} /></div>}
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
