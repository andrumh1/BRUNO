import React, { useState, useEffect } from "react";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import axios from "axios";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  Package,
  Loader2,
  MessageCircle,
  CreditCard,
  Truck
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CartPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    fetchCart();
  }, [token, navigate]);

  const fetchCart = async () => {
    try {
      const response = await axios.get(`${API}/marketplace/cart`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCart(response.data);
    } catch (error) {
      // error handled
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (productId, newQuantity) => {
    if (newQuantity < 1) {
      await removeItem(productId);
      return;
    }
    
    try {
      // Remove and re-add with new quantity
      await axios.delete(`${API}/marketplace/cart/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await axios.post(`${API}/marketplace/cart/add`, {
        product_id: productId,
        quantity: newQuantity
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCart();
    } catch (error) {
      // error handled
    }
  };

  const removeItem = async (productId) => {
    try {
      await axios.delete(`${API}/marketplace/cart/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCart();
    } catch (error) {
      // error handled
    }
  };

  const clearCart = async () => {
    if (!confirm('¿Vaciar carrito?')) return;
    
    try {
      await axios.delete(`${API}/marketplace/cart`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCart({ items: [], total: 0 });
    } catch (error) {
      // error handled
    }
  };

  const handleCheckout = async () => {
    setProcessing(true);
    // For now, just redirect to contact sellers
    // In production, integrate with Stripe/payment gateway
    const sellerIds = [...new Set(cart.items.map(item => item.product.seller_id))];
    
    if (sellerIds.length === 1) {
      navigate(`/chat?new=${sellerIds[0]}`);
    } else {
      alert('Por favor contacta a cada vendedor por separado para coordinar tu compra.');
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <BrunoLoader />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/marketplace">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Mi Carrito</h1>
          </div>
          
          {cart.items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart}>
              Vaciar
            </Button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {cart.items.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Tu carrito está vacío</h2>
            <p className="text-muted-foreground mb-6">
              Explora el marketplace y encuentra productos increíbles
            </p>
            <Link to="/marketplace">
              <Button>Ver Marketplace</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.items.map((item) => (
              <div
                key={item.product_id}
                className="flex gap-4 p-4 bg-card rounded-xl border"
              >
                {/* Product Image */}
                <div className="w-24 h-24 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {item.product.images?.[0] ? (
                    <img
                      src={item.product.images[0]}
                      alt={item.product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <Link to={`/marketplace/${item.product_id}`}>
                    <h3 className="font-medium line-clamp-2 hover:text-primary">
                      {item.product.title}
                    </h3>
                  </Link>
                  
                  <p className="text-lg font-bold text-primary mt-1">
                    ${item.product.price?.toLocaleString()}
                  </p>
                  
                  {/* Quantity Controls */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        className="p-1.5 hover:bg-muted"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-3 text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className="p-1.5 hover:bg-muted"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    
                    <button
                      onClick={() => removeItem(item.product_id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Subtotal */}
                  <p className="text-sm text-muted-foreground mt-2">
                    Subtotal: ${item.subtotal?.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Checkout Bar */}
      {cart.items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-40">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {cart.items.length} producto{cart.items.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xl font-bold">
                  Total: ${cart.total?.toLocaleString()} {cart.currency}
                </p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCheckout}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Contactar vendedor{cart.items.length > 1 ? 'es' : ''}
              </Button>
              
              <Button
                className="flex-1"
                onClick={handleCheckout}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Comprar
              </Button>
            </div>
            
            <p className="text-xs text-center text-muted-foreground">
              El pago se coordina directamente con el vendedor
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
