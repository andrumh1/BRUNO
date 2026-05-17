import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { 
  ArrowLeft, Nfc, CheckCircle2, Lock, Unlock, Shield, Settings, 
  Wifi, Heart, Dog, CreditCard, ShoppingCart, MapPin, Calendar,
  Smartphone, QrCode, AlertTriangle, Loader2, ChevronRight,
  Package, Eye, EyeOff
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PRODUCT_ICONS = {
  "nfc-wifi-home": Wifi,
  "nfc-wifi-comercio": Wifi,
  "nfc-emergencia": Heart,
  "nfc-pet-basico": Dog,
  "nfc-pet-gps": Dog,
  "nfc-collar-completo": Dog,
  "nfc-redes-sociales": Smartphone,
  "nfc-citas": Calendar,
  "nfc-pagos": CreditCard,
  "nfc-apps": Smartphone,
  "nfc-menu-qr": QrCode,
  "nfc-inventario": Package,
  "nfc-acceso": Lock,
  "nfc-alarma": Shield,
  "nfc-despensa": ShoppingCart,
  "nfc-llavero-gps": MapPin,
  "nfc-ar-productos": Eye,
};

const PRODUCT_COLORS = {
  "nfc-wifi": "from-blue-500 to-cyan-500",
  "nfc-emergencia": "from-red-500 to-pink-500",
  "nfc-pet": "from-green-500 to-emerald-500",
  "nfc-collar": "from-green-500 to-teal-500",
  "nfc-redes": "from-purple-500 to-pink-500",
  "nfc-citas": "from-amber-500 to-orange-500",
  "nfc-pagos": "from-emerald-500 to-green-500",
  "nfc-apps": "from-indigo-500 to-violet-500",
  "nfc-menu": "from-orange-500 to-red-500",
  "nfc-inventario": "from-slate-500 to-zinc-500",
  "nfc-acceso": "from-yellow-500 to-amber-500",
  "nfc-alarma": "from-red-600 to-rose-500",
  "nfc-despensa": "from-lime-500 to-green-500",
  "nfc-llavero": "from-sky-500 to-blue-500",
  "nfc-ar": "from-fuchsia-500 to-purple-500",
  "nfc-card": "from-primary to-orange-500",
  "nfc-carnet": "from-primary to-orange-500",
};

const getProductGradient = (productId) => {
  for (const [prefix, gradient] of Object.entries(PRODUCT_COLORS)) {
    if (productId?.startsWith(prefix)) return gradient;
  }
  return "from-primary to-orange-500";
};

const getProductIcon = (productId) => {
  return PRODUCT_ICONS[productId] || CreditCard;
};

const NFCManagerPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [myNfcCards, setMyNfcCards] = useState([]);
  const [schemas, setSchemas] = useState({});
  const [storeProducts, setStoreProducts] = useState([]);
  const [userCards, setUserCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("my-tags");
  const [selectedTag, setSelectedTag] = useState(null);
  const [configData, setConfigData] = useState({});
  const [saving, setSaving] = useState(false);
  const [activatingNfc, setActivatingNfc] = useState(false);
  const [newNfcId, setNewNfcId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [nfcRes, schemasRes, productsRes, cardsRes] = await Promise.all([
        axios.get(`${API}/nfc/my-cards`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/nfc/product-schemas`),
        axios.get(`${API}/store/products`),
        axios.get(`${API}/cards`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setMyNfcCards(nfcRes.data);
      setSchemas(schemasRes.data);
      setStoreProducts(productsRes.data.filter(p => p.category?.startsWith("nfc") || p.id?.startsWith("nfc")));
      setUserCards(cardsRes.data);
    } catch (err) {
      // error handled
    } finally {
      setLoading(false);
    }
  };

  const handleActivateTag = async () => {
    if (!newNfcId || !selectedProduct) {
      toast.error("Ingresa el ID NFC y selecciona un producto");
      return;
    }
    setActivatingNfc(true);
    try {
      const dummyCard = userCards[0];
      await axios.post(`${API}/nfc/activate`, {
        nfc_id: newNfcId,
        card_id: dummyCard?.id || "pending"
      }, { headers: { Authorization: `Bearer ${token}` } });

      await axios.post(`${API}/nfc/configure-product`, {
        nfc_id: newNfcId,
        product_id: selectedProduct,
        config: {}
      }, { headers: { Authorization: `Bearer ${token}` } });

      toast.success("Tag NFC activado. Ahora configura los detalles.");
      setNewNfcId("");
      setSelectedProduct(null);
      setActiveView("my-tags");
      await fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al activar el tag");
    } finally {
      setActivatingNfc(false);
    }
  };

  const handleSaveConfig = async (nfcId, productId) => {
    setSaving(true);
    try {
      await axios.post(`${API}/nfc/configure-product`, {
        nfc_id: nfcId,
        product_id: productId,
        config: configData
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Configuracion guardada exitosamente");
      await fetchAll();
      setSelectedTag(null);
      setConfigData({});
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar la configuracion");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async (nfcId, currentLocked) => {
    try {
      await axios.post(`${API}/nfc/lock`, {
        nfc_id: nfcId,
        is_locked: !currentLocked
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(!currentLocked ? "Tag bloqueado" : "Tag desbloqueado");
      await fetchAll();
    } catch (err) {
      toast.error("Error al cambiar el bloqueo");
    }
  };

  const openTagConfig = (tag) => {
    setSelectedTag(tag);
    setConfigData(tag.config || {});
  };

  const renderConfigField = (field) => {
    const value = configData[field.key] || "";

    if (field.type === "select") {
      return (
        <select
          value={value}
          onChange={(e) => setConfigData({ ...configData, [field.key]: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          data-testid={`nfc-config-${field.key}`}
        >
          <option value="">Seleccionar...</option>
          {field.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (field.type === "boolean") {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!configData[field.key]}
            onChange={(e) => setConfigData({ ...configData, [field.key]: e.target.checked })}
            className="rounded border-border"
            data-testid={`nfc-config-${field.key}`}
          />
          <span className="text-sm">Si</span>
        </label>
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          value={value}
          onChange={(e) => setConfigData({ ...configData, [field.key]: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
          placeholder={field.label}
          data-testid={`nfc-config-${field.key}`}
        />
      );
    }

    if (field.type === "card_selector") {
      return (
        <div className="space-y-2">
          {userCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tienes tarjetas. Crea una primero.</p>
          ) : (
            userCards.map(card => (
              <label key={card.id} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${configData[field.key] === card.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                <input
                  type="radio"
                  name="card_selector"
                  value={card.id}
                  checked={configData[field.key] === card.id}
                  onChange={() => setConfigData({ ...configData, [field.key]: card.id })}
                />
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: card.background_color || "#FF6B35" }}>
                  {card.title?.charAt(0) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{card.title}</p>
                  {card.subtitle && <p className="text-xs text-muted-foreground truncate">{card.subtitle}</p>}
                </div>
              </label>
            ))
          )}
        </div>
      );
    }

    if (field.type === "password") {
      return (
        <div className="relative">
          <Input
            type={showPasswords[field.key] ? "text" : "password"}
            value={value}
            onChange={(e) => setConfigData({ ...configData, [field.key]: e.target.value })}
            placeholder={field.label}
            data-testid={`nfc-config-${field.key}`}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPasswords({ ...showPasswords, [field.key]: !showPasswords[field.key] })}
          >
            {showPasswords[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      );
    }

    return (
      <Input
        type={field.type === "number" ? "number" : field.type === "tel" ? "tel" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
        value={value}
        onChange={(e) => setConfigData({ ...configData, [field.key]: e.target.value })}
        placeholder={field.label}
        data-testid={`nfc-config-${field.key}`}
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Tag Configuration View
  if (selectedTag) {
    const schema = schemas[selectedTag.product_id] || { name: "Producto PIUP", fields: [] };
    const Icon = getProductIcon(selectedTag.product_id);
    const gradient = getProductGradient(selectedTag.product_id);

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedTag(null); setConfigData({}); }} className="rounded-full h-9 w-9">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-base font-bold">Configurar {schema.name}</h1>
              <p className="text-xs text-muted-foreground">ID: {selectedTag.nfc_id}</p>
            </div>
            <button
              onClick={() => handleToggleLock(selectedTag.nfc_id, selectedTag.is_locked)}
              className={`p-2 rounded-full transition-colors ${selectedTag.is_locked ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}
              data-testid="nfc-lock-toggle"
            >
              {selectedTag.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
          {/* Product Header Card */}
          <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 text-white`}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Icon className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{schema.name}</h2>
                <p className="text-sm opacity-80">{selectedTag.product_id}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs">
                <Shield className="w-3 h-3" />
                Exclusivo BRUNO
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ${selectedTag.is_locked ? "bg-green-500/30" : "bg-red-500/30"}`}>
                {selectedTag.is_locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                {selectedTag.is_locked ? "Bloqueado" : "Desbloqueado"}
              </div>
            </div>
          </div>

          {/* Lock Warning */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Proteccion BRUNO Exclusiva</p>
              <p className="text-xs text-muted-foreground mt-1">
                Este tag NFC solo puede ser modificado desde la app BRUNO por su propietario. Nadie mas puede cambiar la configuracion mientras este bloqueado.
              </p>
            </div>
          </div>

          {/* Config Fields */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">Configuracion del Producto</CardTitle>
              <CardDescription>Completa los campos para programar tu tag NFC</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {schema.fields.map(field => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {renderConfigField(field)}
                </div>
              ))}

              {schema.fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay configuracion adicional para este producto. Vincula una tarjeta digital desde la seccion de activacion.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Save Button Fixed */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t">
            <div className="max-w-2xl mx-auto">
              <Button
                onClick={() => handleSaveConfig(selectedTag.nfc_id, selectedTag.product_id)}
                disabled={saving}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-orange-500 text-white font-semibold"
                data-testid="nfc-save-config-btn"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Guardar Configuracion
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-bold flex items-center gap-2">
              <Nfc className="w-5 h-5 text-primary" />
              NFC PIUP Manager
            </h1>
            <p className="text-xs text-muted-foreground">Gestiona tus productos NFC exclusivos de BRUNO</p>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4 pb-2 flex gap-2">
          {[
            { id: "my-tags", label: "Mis Tags", count: myNfcCards.length },
            { id: "activate", label: "Activar Nuevo" },
            { id: "store", label: "Tienda PIUP" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${activeView === tab.id ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
              data-testid={`nfc-tab-${tab.id}`}
            >
              {tab.label} {tab.count !== undefined && `(${tab.count})`}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4 pb-20">
        {/* My Tags View */}
        {activeView === "my-tags" && (
          <>
            {myNfcCards.length === 0 ? (
              <Card className="glass-card text-center py-16">
                <CardContent>
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Nfc className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">No tienes tags NFC</h3>
                  <p className="text-sm text-muted-foreground mb-6">Activa tu primer producto PIUP NFC</p>
                  <Button onClick={() => setActiveView("activate")} className="rounded-full">
                    Activar Tag NFC
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {myNfcCards.map(tag => {
                  const Icon = getProductIcon(tag.product_id);
                  const gradient = getProductGradient(tag.product_id);
                  const schema = schemas[tag.product_id];
                  return (
                    <Card
                      key={tag.nfc_id}
                      className="glass-card overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => openTagConfig(tag)}
                      data-testid={`nfc-tag-${tag.nfc_id}`}
                    >
                      <div className={`h-2 bg-gradient-to-r ${gradient}`} />
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white flex-shrink-0`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate">{schema?.name || tag.product_id || "Tag NFC"}</h3>
                            <p className="text-[10px] text-muted-foreground font-mono">ID: {tag.nfc_id}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${tag.is_active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                                {tag.is_active ? "Activo" : "Inactivo"}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${tag.is_locked ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"}`}>
                                {tag.is_locked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                                {tag.is_locked ? "Bloqueado" : "Abierto"}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Activate New Tag */}
        {activeView === "activate" && (
          <div className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">Activar Producto PIUP NFC</CardTitle>
                <CardDescription>Escanea o ingresa el ID de tu tag NFC para vincularlo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">ID del Tag NFC *</label>
                  <Input
                    value={newNfcId}
                    onChange={(e) => setNewNfcId(e.target.value)}
                    placeholder="Ej: PIUP-NFC-123456"
                    data-testid="nfc-new-id-input"
                  />
                  <p className="text-[10px] text-muted-foreground">El ID esta en la parte trasera o dentro del empaque del producto</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Selecciona el Producto *</label>
                  <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto">
                    {storeProducts.map(product => {
                      const Icon = getProductIcon(product.id);
                      const gradient = getProductGradient(product.id);
                      return (
                        <label
                          key={product.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedProduct === product.id ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/30"}`}
                          data-testid={`nfc-product-${product.id}`}
                        >
                          <input
                            type="radio"
                            name="product"
                            value={product.id}
                            checked={selectedProduct === product.id}
                            onChange={() => setSelectedProduct(product.id)}
                            className="hidden"
                          />
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white flex-shrink-0`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{product.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{product.description}</p>
                          </div>
                          {selectedProduct === product.id && (
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <Button
                  onClick={handleActivateTag}
                  disabled={activatingNfc || !newNfcId || !selectedProduct}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-orange-500 text-white font-semibold"
                  data-testid="nfc-activate-btn"
                >
                  {activatingNfc ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Nfc className="w-4 h-4 mr-2" />}
                  Activar y Vincular Tag NFC
                </Button>
              </CardContent>
            </Card>

            {/* How it works */}
            <Card className="glass-card">
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Sistema Exclusivo BRUNO
                </h4>
                <div className="space-y-3 text-xs text-muted-foreground">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">1</div>
                    <p>Compra tu producto PIUP NFC en la tienda</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">2</div>
                    <p>Ingresa el ID del tag y selecciona el tipo de producto</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">3</div>
                    <p>Configura los datos personalizados del producto</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">4</div>
                    <p>El tag queda bloqueado y solo tu puedes modificarlo desde BRUNO</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Store Products */}
        {activeView === "store" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Todos los productos NFC PIUP disponibles en la tienda:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {storeProducts.map(product => {
                const Icon = getProductIcon(product.id);
                const gradient = getProductGradient(product.id);
                return (
                  <Card key={product.id} className="glass-card overflow-hidden hover:shadow-lg transition-shadow">
                    <div className={`h-24 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                      <Icon className="w-10 h-10 text-white/80" />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm">{product.name}</h3>
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-lg font-bold text-primary">${product.price}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs"
                          onClick={() => navigate("/marketplace")}
                          data-testid={`nfc-buy-${product.id}`}
                        >
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          Comprar
                        </Button>
                      </div>
                      {product.features && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {product.features.slice(0, 3).map((f) => (
                            <span key={f} className="px-2 py-0.5 rounded-full bg-muted text-[9px]">{f}</span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default NFCManagerPage;
