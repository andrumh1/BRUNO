import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";
import {
  ArrowLeft,
  Camera,
  X,
  Plus,
  MapPin,
  Tag,
  DollarSign,
  Package,
  Truck,
  Loader2,
  Info,
  ChevronDown,
  Zap
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CATEGORIES = [
  { id: "electronics", name: "Electrónica", icon: "💻" },
  { id: "clothing", name: "Ropa y Accesorios", icon: "👕" },
  { id: "home", name: "Hogar y Jardín", icon: "🏠" },
  { id: "services", name: "Servicios", icon: "🔧" },
  { id: "vehicles", name: "Vehículos", icon: "🚗" },
  { id: "sports", name: "Deportes", icon: "⚽" },
  { id: "beauty", name: "Belleza y Salud", icon: "💄" },
  { id: "food", name: "Alimentos", icon: "🍔" },
  { id: "art", name: "Arte y Colecciones", icon: "🎨" },
  { id: "other", name: "Otros", icon: "📦" }
];

const CONDITIONS = [
  { id: "new", label: "Nuevo" },
  { id: "used", label: "Usado" },
  { id: "refurbished", label: "Reacondicionado" }
];

const NewProductPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    currency: "USD",
    category: "",
    condition: "new",
    location: "",
    images: [],
    tags: [],
    shipping_available: false,
    shipping_cost: "",
    stock: "",
    deal_enabled: false,
    deal_partner_id: "",
    deal_referral_code: ""
  });
  
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    if (formData.images.length + files.length > 10) {
      alert('Máximo 10 imágenes por producto');
      return;
    }
    
    setUploading(true);
    
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        
        const response = await axios.post(`${API}/upload/image`, fd, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, response.data.url]
        }));
      } catch (error) {
        // error handled
      }
    }
    
    setUploading(false);
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag) && formData.tags.length < 10) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput("");
    }
  };

  const removeTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) newErrors.title = "Título requerido";
    if (!formData.description.trim()) newErrors.description = "Descripción requerida";
    if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = "Precio inválido";
    if (!formData.category) newErrors.category = "Categoría requerida";
    if (formData.images.length === 0) newErrors.images = "Agrega al menos una imagen";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    
    try {
      const productData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        currency: formData.currency,
        category: formData.category,
        condition: formData.condition,
        location: formData.location.trim() || null,
        images: formData.images,
        tags: formData.tags,
        shipping_available: formData.shipping_available,
        shipping_cost: formData.shipping_cost ? parseFloat(formData.shipping_cost) : null,
        stock: formData.stock ? parseInt(formData.stock) : null,
        deal_enabled: formData.deal_enabled,
        deal_partner_id: formData.deal_partner_id.trim() || null,
        deal_referral_code: formData.deal_referral_code.trim() || null
      };
      
      await axios.post(`${API}/marketplace/products`, productData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      navigate('/marketplace/my-products');
    } catch (error) {
      // error handled
      alert(error.response?.data?.detail || 'Error al publicar producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Nuevo Producto</h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Images */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Fotos <span className="text-red-500">*</span>
          </label>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {formData.images.map((url, idx) => (
              <div key={`url-${idx}`} className="aspect-square relative rounded-xl overflow-hidden bg-muted">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white"
                >
                  <X className="w-4 h-4" />
                </button>
                {idx === 0 && (
                  <span className="absolute bottom-1 left-1 px-2 py-0.5 bg-primary text-white text-xs rounded">
                    Principal
                  </span>
                )}
              </div>
            ))}
            
            {formData.images.length < 10 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 hover:bg-muted/50 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Camera className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Agregar</span>
                  </>
                )}
              </button>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
          
          {errors.images && (
            <p className="text-sm text-red-500 mt-1">{errors.images}</p>
          )}
          
          <p className="text-xs text-muted-foreground mt-2">
            Máximo 10 fotos. La primera será la principal.
          </p>
        </div>

        {/* Title */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Título <span className="text-red-500">*</span>
          </label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="¿Qué estás vendiendo?"
            maxLength={100}
          />
          {errors.title && (
            <p className="text-sm text-red-500 mt-1">{errors.title}</p>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Categoría <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFormData({ ...formData, category: cat.id })}
                className={`p-3 rounded-xl text-left flex items-center gap-2 transition-colors ${
                  formData.category === cat.id
                    ? 'bg-primary text-white'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="text-sm font-medium">{cat.name}</span>
              </button>
            ))}
          </div>
          {errors.category && (
            <p className="text-sm text-red-500 mt-1">{errors.category}</p>
          )}
        </div>

        {/* Price */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Precio <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
                className="pl-9"
                step="0.01"
                min="0"
              />
            </div>
            {errors.price && (
              <p className="text-sm text-red-500 mt-1">{errors.price}</p>
            )}
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Moneda</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full p-2 rounded-lg bg-muted border-0"
            >
              <option value="USD">USD - Dólar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="MXN">MXN - Peso MX</option>
              <option value="COP">COP - Peso CO</option>
              <option value="ARS">ARS - Peso AR</option>
            </select>
          </div>
        </div>

        {/* Condition */}
        <div>
          <label className="text-sm font-medium mb-2 block">Condición</label>
          <div className="flex gap-2">
            {CONDITIONS.map(cond => (
              <button
                key={cond.id}
                type="button"
                onClick={() => setFormData({ ...formData, condition: cond.id })}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  formData.condition === cond.id
                    ? 'bg-primary text-white'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {cond.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Descripción <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe tu producto: características, estado, medidas, etc."
            className="w-full p-3 bg-muted rounded-lg resize-none"
            rows={5}
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {formData.description.length}/2000
          </p>
          {errors.description && (
            <p className="text-sm text-red-500">{errors.description}</p>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="text-sm font-medium mb-2 block">Ubicación</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ciudad, País"
              className="pl-9"
            />
          </div>
        </div>

        {/* Shipping */}
        <div className="p-4 bg-muted/50 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Envío disponible</span>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, shipping_available: !formData.shipping_available })}
              className={`w-12 h-6 rounded-full transition-colors ${
                formData.shipping_available ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                formData.shipping_available ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          
          {formData.shipping_available && (
            <div>
              <label className="text-sm font-medium mb-2 block">Costo de envío</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={formData.shipping_cost}
                  onChange={(e) => setFormData({ ...formData, shipping_cost: e.target.value })}
                  placeholder="0.00 (dejar vacío si es gratis)"
                  className="pl-9"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
          )}
        </div>

        {/* Stock */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Stock disponible <span className="text-muted-foreground">(opcional)</span>
          </label>
          <Input
            type="number"
            value={formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
            placeholder="Dejar vacío si es ilimitado"
            min="1"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Etiquetas <span className="text-muted-foreground">(opcional)</span>
          </label>
          
          <div className="flex gap-2 mb-2">
            <div className="flex-1 relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Agregar etiqueta"
                className="pl-9"
                maxLength={20}
              />
            </div>
            <Button type="button" variant="outline" onClick={addTag}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-muted rounded-full text-sm flex items-center gap-1"
                >
                  #{tag}
                  <button type="button" onClick={() => removeTag(tag)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* DEAL Integration */}
        <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-3" data-testid="deal-integration-section">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span className="font-medium text-sm">Vender via DEAL</span>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, deal_enabled: !formData.deal_enabled })}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                formData.deal_enabled ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
              data-testid="deal-enabled-toggle"
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform absolute top-1 ${
                formData.deal_enabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Habilita la compra directa a través de DEAL. Los clientes podrán pagar desde la app.
          </p>
          
          {formData.deal_enabled && (
            <div className="space-y-3 pt-2 border-t border-emerald-200">
              <div>
                <label className="text-xs font-medium mb-1 block">Partner ID <span className="text-muted-foreground">(opcional)</span></label>
                <Input
                  value={formData.deal_partner_id}
                  onChange={(e) => setFormData({ ...formData, deal_partner_id: e.target.value })}
                  placeholder="ID del partner asociado"
                  className="h-9 text-sm"
                  data-testid="deal-partner-id-input"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Código de referido <span className="text-muted-foreground">(opcional)</span></label>
                <Input
                  value={formData.deal_referral_code}
                  onChange={(e) => setFormData({ ...formData, deal_referral_code: e.target.value })}
                  placeholder="Ej: BRUNO2026"
                  className="h-9 text-sm"
                  data-testid="deal-referral-code-input"
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Package className="w-5 h-5 mr-2" />
          )}
          Publicar Producto
        </Button>
      </form>
    </div>
  );
};

export default NewProductPage;
