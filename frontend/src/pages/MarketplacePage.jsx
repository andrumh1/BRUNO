import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { 
  ArrowLeft,
  Search,
  Filter,
  Plus,
  ShoppingCart,
  Heart,
  MapPin,
  Tag,
  Package,
  Grid3X3,
  List,
  X,
  ChevronRight,
  MessageCircle,
  Loader2,
  Star,
  Eye,
  Share2,
  Crown,
  Sparkles,
  Zap
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Category icons mapping
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

// Product Card Component
const ProductCard = ({ product, onFavorite, isFavorited }) => {
  const navigate = useNavigate();
  
  return (
    <div 
      className="bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer group"
      onClick={() => navigate(`/marketplace/${product.id}`)}
    >
      {/* Image */}
      <div className="aspect-square relative overflow-hidden bg-muted">
        {product.images?.[0] ? (
          <img 
            src={product.images[0]} 
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        
        {/* Favorite button */}
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite?.(product.id); }}
          className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
        >
          <Heart className={`w-4 h-4 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
        </button>
        
        {/* Condition badge */}
        {product.condition !== "new" && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-xs">
            {product.condition === "used" ? "Usado" : "Reacondicionado"}
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="p-3">
        <p className="font-bold text-lg text-primary">
          ${product.price?.toLocaleString()} <span className="text-xs text-muted-foreground">{product.currency}</span>
        </p>
        <h3 className="font-medium text-sm line-clamp-2 mt-1">{product.title}</h3>
        
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          {product.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {product.location}
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-3 pt-2 border-t">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {product.views || 0}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {product.favorites || 0}
            </span>
          </div>
          <span className="text-2xl">{CATEGORY_ICONS[product.category] || "📦"}</span>
        </div>
      </div>
    </div>
  );
};

// Filter Panel
const FilterPanel = ({ isOpen, onClose, filters, setFilters, categories }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div 
        className="absolute right-0 top-0 bottom-0 w-80 bg-card shadow-xl animate-in slide-in-from-right"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold">Filtros</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-120px)]">
          {/* Category */}
          <div>
            <label className="text-sm font-medium mb-2 block">Categoría</label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setFilters({ ...filters, category: filters.category === cat.id ? null : cat.id })}
                  className={`p-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                    filters.category === cat.id 
                      ? 'bg-primary text-white' 
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Price Range */}
          <div>
            <label className="text-sm font-medium mb-2 block">Precio</label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Mín"
                value={filters.minPrice || ''}
                onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Máx"
                value={filters.maxPrice || ''}
                onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
              />
            </div>
          </div>
          
          {/* Condition */}
          <div>
            <label className="text-sm font-medium mb-2 block">Condición</label>
            <div className="flex gap-2">
              {[
                { id: "new", label: "Nuevo" },
                { id: "used", label: "Usado" },
                { id: "refurbished", label: "Reacondicionado" }
              ].map(cond => (
                <button
                  key={cond.id}
                  onClick={() => setFilters({ ...filters, condition: filters.condition === cond.id ? null : cond.id })}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    filters.condition === cond.id 
                      ? 'bg-primary text-white' 
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {cond.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Sort */}
          <div>
            <label className="text-sm font-medium mb-2 block">Ordenar por</label>
            <select
              value={filters.sort || 'newest'}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="w-full p-2 rounded-lg bg-muted border-0"
            >
              <option value="newest">Más recientes</option>
              <option value="price_asc">Precio: menor a mayor</option>
              <option value="price_desc">Precio: mayor a menor</option>
              <option value="popular">Más populares</option>
            </select>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-card">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setFilters({})}
            >
              Limpiar
            </Button>
            <Button className="flex-1" onClick={onClose}>
              Aplicar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Marketplace Page
const MarketplacePage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || null,
    sort: 'newest'
  });
  const [cartCount, setCartCount] = useState(0);
  const [favorites, setFavorites] = useState(new Set());
  const [viewMode, setViewMode] = useState('grid');

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(`${API}/marketplace/categories`);
        setCategories(response.data);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filters.category) params.append('category', filters.category);
      if (filters.minPrice) params.append('min_price', filters.minPrice);
      if (filters.maxPrice) params.append('max_price', filters.maxPrice);
      if (filters.condition) params.append('condition', filters.condition);
      if (filters.sort) params.append('sort', filters.sort);
      
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/marketplace/products?${params.toString()}`, { headers });
      setProducts(response.data.products || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters, token]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Fetch cart count
  useEffect(() => {
    if (!token) return;
    const fetchCart = async () => {
      try {
        const response = await axios.get(`${API}/marketplace/cart`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCartCount(response.data.items?.length || 0);
      } catch (error) {
        console.error("Error fetching cart:", error);
      }
    };
    fetchCart();
  }, [token]);

  // Handle favorite toggle
  const handleFavorite = async (productId) => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    try {
      await axios.post(`${API}/marketplace/products/${productId}/favorite`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setFavorites(prev => {
        const newFavs = new Set(prev);
        if (newFavs.has(productId)) {
          newFavs.delete(productId);
        } else {
          newFavs.add(productId);
        }
        return newFavs;
      });
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/feed">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold flex-1">Marketplace</h1>
            
            {user && (
              <>
                <Link to="/marketplace/my-products">
                  <Button variant="ghost" size="sm">Mis productos</Button>
                </Link>
                <Link to="/marketplace/cart">
                  <Button variant="ghost" size="icon" className="relative">
                    <ShoppingCart className="w-5 h-5" />
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center">
                        {cartCount}
                      </span>
                    )}
                  </Button>
                </Link>
              </>
            )}
          </div>
          
          {/* Search */}
          <div className="flex gap-2 mt-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => setShowFilters(true)}>
              <Filter className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        {/* Categories horizontal scroll */}
        <div className="overflow-x-auto px-4 py-2 border-t">
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => setFilters({ ...filters, category: null })}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                !filters.category ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setFilters({ ...filters, category: cat.id })}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                  filters.category === cat.id ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <span>{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <FilterPanel 
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        setFilters={setFilters}
        categories={categories}
      />

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No hay productos</h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery ? `No se encontraron resultados para "${searchQuery}"` : "Sé el primero en publicar"}
            </p>
            {user && (
              <Link to="/marketplace/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Publicar producto
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            : "space-y-4"
          }>
            {products.map(product => (
              <ProductCard 
                key={product.id}
                product={product}
                onFavorite={handleFavorite}
                isFavorited={favorites.has(product.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB - Create Product */}
      {user && (
        <Link to="/marketplace/new">
          <Button 
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
            size="icon"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </Link>
      )}
    </div>
  );
};

export default MarketplacePage;
