import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import BubbleSelect from "@/components/BubbleSelect";
import axios from "axios";
import { 
  ArrowLeft, 
  ShoppingCart, 
  CreditCard, 
  Truck, 
  Package,
  MapPin,
  Plus,
  Minus,
  X,
  Check,
  Crown,
  Zap,
  Building2,
  Dog,
  Shield,
  Palette,
  Sparkles,
  ChevronRight
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StorePage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { t } = useLanguage();
  
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: "Home",
    full_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: ""
  });
  const [activeSection, setActiveSection] = useState("products"); // products | subscriptions

  const categories = [
    { value: "all", label: "Todos", icon: "Grid3X3" },
    { value: "nfc_card", label: "Tarjetas NFC", icon: "CreditCard" },
    { value: "hogar", label: "Hogar", icon: "Home" },
    { value: "comercios", label: "Comercios", icon: "Store" },
    { value: "oficinas", label: "Oficinas", icon: "Building2" },
    { value: "mascotas", label: "Mascotas", icon: "Dog" },
    { value: "guardian", label: "Guardian", icon: "Shield" },
    { value: "habladores", label: "Habladores", icon: "MessageSquare" },
    { value: "servicios", label: "Servicios", icon: "Wrench" },
    { value: "meow_services", label: "MEOW APP", icon: "Sparkles" },
  ];

  const fetchProducts = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/store/products`);
      setProducts(response.data);
    } catch (error) {
      console.warn("StorePage: fetchProducts failed", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/user/saved-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAddresses(response.data.addresses || []);
      const defaultAddr = response.data.addresses?.find(a => a.is_default);
      if (defaultAddr) setSelectedAddress(defaultAddr.id);
    } catch (error) {
      console.warn("StorePage: fetchUserData failed", error);
    }
  }, [token]);

  useEffect(() => {
    fetchProducts();
    if (user && token) {
      fetchUserData();
    }
  }, [user, token, fetchProducts, fetchUserData]);

  const addToCart = (product, color = null) => {
    const existingItem = cart.find(item => 
      item.product_id === product.id && item.color === color
    );

    if (existingItem) {
      setCart(cart.map(item =>
        item.product_id === product.id && item.color === color
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product: product,
        quantity: 1,
        color: color || (product.colors?.[0] || null)
      }]);
    }
  };

  const removeFromCart = (productId, color) => {
    setCart(cart.filter(item => 
      !(item.product_id === productId && item.color === color)
    ));
  };

  const updateQuantity = (productId, color, delta) => {
    setCart(cart.map(item => {
      if (item.product_id === productId && item.color === color) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    if (!user) {
      navigate("/login?redirect=/store");
      return;
    }

    try {
      // Create order
      const orderResponse = await axios.post(
        `${API}/store/orders`,
        {
          items: cart.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            color: item.color
          })),
          shipping_address_id: selectedAddress
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Create checkout session
      const checkoutResponse = await axios.post(
        `${API}/store/checkout/${orderResponse.data.order_id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Redirect to Stripe
      window.location.href = checkoutResponse.data.checkout_url;
    } catch (error) {
      // error handled
      alert("Error al procesar el pago. Intenta de nuevo.");
    }
  };

  const handleAddAddress = async () => {
    try {
      await axios.post(
        `${API}/user/addresses`,
        newAddress,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchUserData();
      setShowAddAddress(false);
      setNewAddress({
        label: "Home",
        full_name: "",
        phone: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        postal_code: "",
        country: ""
      });
    } catch (error) {
      console.warn("StorePage: address action failed", error);
    }
  };

  const filteredProducts = selectedCategory === "all" 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  const getCategoryIcon = (category) => {
    switch (category) {
      case "nfc_card": return <CreditCard className="w-5 h-5" />;
      case "nfc_bracelet": return <Shield className="w-5 h-5" />;
      case "nfc_pet_tag": return <Dog className="w-5 h-5" />;
      case "service": return <Sparkles className="w-5 h-5" />;
      default: return <Package className="w-5 h-5" />;
    }
  };

  const getColorStyle = (color) => {
    const colors = {
      black: "#1a1a1a",
      white: "#f5f5f5",
      orange: "#FF6A00",
      gold: "#FFD700",
      silver: "#C0C0C0",
      blue: "#3B82F6",
      red: "#EF4444",
      green: "#22C55E",
      purple: "#A855F7",
      pink: "#EC4899",
      rainbow: "linear-gradient(90deg, red, orange, yellow, green, blue, purple)",
      holographic: "linear-gradient(135deg, #ff00ff, #00ffff, #ff00ff, #ffff00)"
    };
    return colors[color] || color;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5" data-testid="store-page">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="spring-button">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Package className="w-6 h-6 text-primary" />
                Tienda PIUP
              </h1>
              <p className="text-sm text-muted-foreground">Personal Intelligent Unlock Point</p>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            className="relative spring-button"
            onClick={() => setShowCart(true)}
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center spring-bounce">
                {cartCount}
              </span>
            )}
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Category Filter */}
        <div className="mb-8">
          <BubbleSelect
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categories}
            renderOption={(option) => (
              <div className="flex items-center gap-2">
                {getCategoryIcon(option.value)}
                <span>{option.label}</span>
              </div>
            )}
          />
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product, index) => (
            <Card 
              key={product.id} 
              data-testid={`store-product-${product.id}`}
              className="glass-card spring-card spring-item overflow-hidden"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Product Image Placeholder */}
              <div className="aspect-square bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                {getCategoryIcon(product.category)}
                <span className="absolute bottom-2 right-2 text-6xl opacity-10">
                  {product.category === "nfc_card" && "💳"}
                  {product.category === "nfc_bracelet" && "⌚"}
                  {product.category === "nfc_pet_tag" && "🐕"}
                  {product.category === "service" && "✨"}
                </span>
                
                {/* Colors Preview */}
                {product.colors?.length > 0 && (
                  <div className="absolute bottom-3 left-3 flex gap-1">
                    {product.colors.slice(0, 5).map((color) => (
                      <div
                        key={color}
                        className="w-4 h-4 rounded-full border-2 border-white shadow-md"
                        style={{ background: getColorStyle(color) }}
                      />
                    ))}
                    {product.colors.length > 5 && (
                      <span className="text-xs text-white bg-black/50 px-1 rounded">
                        +{product.colors.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <CardHeader className="pb-2">
                <CardTitle className="text-lg line-clamp-1">{product.name}</CardTitle>
                <CardDescription className="line-clamp-2">{product.description}</CardDescription>
              </CardHeader>

              <CardContent className="pb-2">
                {/* Features */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {product.features?.slice(0, 2).map((feature) => (
                    <span key={feature} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {feature}
                    </span>
                  ))}
                </div>
                
                <div className="text-2xl font-bold text-primary">
                  ${product.price.toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">USD</span>
                </div>
              </CardContent>

              <CardFooter>
                <Button 
                  className="w-full spring-button" 
                  onClick={() => addToCart(product)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar al Carrito
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-20">
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No hay productos en esta categoría</h3>
          </div>
        )}
      </main>

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 z-50">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCart(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-background shadow-2xl spring-modal overflow-auto">
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Carrito ({cartCount})
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowCart(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Tu carrito está vacío</p>
                </div>
              ) : (
                <>
                  {cart.map((item, index) => (
                    <Card key={`${item.product_id}-${item.color}`} className="spring-item" style={{ animationDelay: `${index * 0.05}s` }}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            {getCategoryIcon(item.product.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{item.product.name}</h4>
                            {item.color && (
                              <div className="flex items-center gap-2 mt-1">
                                <div 
                                  className="w-4 h-4 rounded-full border"
                                  style={{ background: getColorStyle(item.color) }}
                                />
                                <span className="text-sm text-muted-foreground capitalize">{item.color}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="w-8 h-8"
                                  onClick={() => updateQuantity(item.product_id, item.color, -1)}
                                >
                                  <Minus className="w-4 h-4" />
                                </Button>
                                <span className="w-8 text-center font-medium">{item.quantity}</span>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="w-8 h-8"
                                  onClick={() => updateQuantity(item.product_id, item.color, 1)}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                              <span className="font-bold text-primary">
                                ${(item.product.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="shrink-0"
                            onClick={() => removeFromCart(item.product_id, item.color)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Cart Summary */}
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>${cartTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Envío</span>
                        <span>{cartTotal >= 50 ? "Gratis" : "$5.99"}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-3">
                        <span>Total</span>
                        <span className="text-primary">
                          ${(cartTotal + (cartTotal >= 50 ? 0 : 5.99)).toFixed(2)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Button 
                    className="w-full h-12 text-lg spring-button" 
                    onClick={() => {
                      setShowCart(false);
                      setShowCheckout(true);
                    }}
                  >
                    Continuar al Pago
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCheckout(false)}
          />
          <Card className="relative w-full max-w-lg spring-modal max-h-[90vh] overflow-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Dirección de Envío
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Saved Addresses */}
              {addresses.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Direcciones Guardadas</label>
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      onClick={() => setSelectedAddress(addr.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedAddress === addr.id 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {addr.label}
                            {addr.is_default && (
                              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                                Principal
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {addr.full_name}<br />
                            {addr.address_line1}<br />
                            {addr.city}, {addr.state} {addr.postal_code}<br />
                            {addr.country}
                          </p>
                        </div>
                        {selectedAddress === addr.id && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Address Button */}
              {!showAddAddress && (
                <Button 
                  variant="outline" 
                  className="w-full border-dashed"
                  onClick={() => setShowAddAddress(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Nueva Dirección
                </Button>
              )}

              {/* New Address Form */}
              {showAddAddress && (
                <Card className="border-primary/30">
                  <CardContent className="p-4 space-y-4">
                    <h4 className="font-medium">Nueva Dirección</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        placeholder="Nombre completo"
                        value={newAddress.full_name}
                        onChange={(e) => setNewAddress({...newAddress, full_name: e.target.value})}
                        className="col-span-2"
                      />
                      <Input
                        placeholder="Teléfono"
                        value={newAddress.phone}
                        onChange={(e) => setNewAddress({...newAddress, phone: e.target.value})}
                        className="col-span-2"
                      />
                      <Input
                        placeholder="Dirección línea 1"
                        value={newAddress.address_line1}
                        onChange={(e) => setNewAddress({...newAddress, address_line1: e.target.value})}
                        className="col-span-2"
                      />
                      <Input
                        placeholder="Dirección línea 2 (opcional)"
                        value={newAddress.address_line2}
                        onChange={(e) => setNewAddress({...newAddress, address_line2: e.target.value})}
                        className="col-span-2"
                      />
                      <Input
                        placeholder="Ciudad"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
                      />
                      <Input
                        placeholder="Estado/Provincia"
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({...newAddress, state: e.target.value})}
                      />
                      <Input
                        placeholder="Código Postal"
                        value={newAddress.postal_code}
                        onChange={(e) => setNewAddress({...newAddress, postal_code: e.target.value})}
                      />
                      <Input
                        placeholder="País"
                        value={newAddress.country}
                        onChange={(e) => setNewAddress({...newAddress, country: e.target.value})}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleAddAddress} className="flex-1">
                        Guardar Dirección
                      </Button>
                      <Button variant="outline" onClick={() => setShowAddAddress(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button 
                className="w-full h-12 text-lg spring-button"
                onClick={handleCheckout}
                disabled={!selectedAddress && addresses.length > 0}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Pagar ${(cartTotal + (cartTotal >= 50 ? 0 : 5.99)).toFixed(2)}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Serás redirigido a Stripe para completar el pago de forma segura
              </p>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StorePage;
