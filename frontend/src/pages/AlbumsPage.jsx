import React, { useState, useEffect, useCallback } from "react";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import axios from "axios";
import {
  Plus,
  FolderPlus,
  Image as ImageIcon,
  Video,
  Trash2,
  ArrowLeft,
  Upload,
  X,
  Lock,
  Globe,
  MoreVertical,
  Edit2,
  Loader2,
  Grid3X3,
  Play
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AlbumsPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumMedia, setAlbumMedia] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newAlbum, setNewAlbum] = useState({ name: "", description: "", is_private: true });

  // Fetch albums
  const fetchAlbums = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API}/albums`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlbums(response.data);
    } catch (error) {
      // error handled
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchAlbums();
  }, [user, fetchAlbums, navigate]);

  // Fetch album media
  const fetchAlbumMedia = async (albumId) => {
    setMediaLoading(true);
    try {
      const response = await axios.get(`${API}/albums/${albumId}/media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlbumMedia(response.data);
    } catch (error) {
      // error handled
    } finally {
      setMediaLoading(false);
    }
  };

  // Select album
  const handleSelectAlbum = (album) => {
    setSelectedAlbum(album);
    fetchAlbumMedia(album.id);
  };

  // Create album
  const handleCreateAlbum = async () => {
    if (!newAlbum.name.trim()) return;
    
    try {
      const response = await axios.post(`${API}/albums`, newAlbum, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlbums([response.data, ...albums]);
      setShowCreateModal(false);
      setNewAlbum({ name: "", description: "", is_private: true });
    } catch (error) {
      // error handled
    }
  };

  // Delete album
  const handleDeleteAlbum = async (albumId) => {
    if (!window.confirm("¿Eliminar este álbum y todo su contenido?")) return;
    
    try {
      await axios.delete(`${API}/albums/${albumId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlbums(albums.filter(a => a.id !== albumId));
      if (selectedAlbum?.id === albumId) {
        setSelectedAlbum(null);
        setAlbumMedia([]);
      }
    } catch (error) {
      // error handled
    }
  };

  // Upload media
  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files.length || !selectedAlbum) return;

    setUploading(true);
    
    for (const file of files) {
      try {
        // Upload to Cloudinary via backend
        const formData = new FormData();
        formData.append("file", file);
        
        const uploadResponse = await axios.post(`${API}/albums/upload`, formData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data"
          }
        });

        // Add to album
        const mediaResponse = await axios.post(
          `${API}/albums/${selectedAlbum.id}/media`,
          {
            media_url: uploadResponse.data.url,
            media_type: uploadResponse.data.media_type,
            thumbnail_url: uploadResponse.data.thumbnail_url
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setAlbumMedia(prev => [mediaResponse.data, ...prev]);
        
        // Update album count locally
        setAlbums(prev => prev.map(a => 
          a.id === selectedAlbum.id 
            ? { ...a, media_count: a.media_count + 1, cover_url: a.cover_url || uploadResponse.data.url }
            : a
        ));
        setSelectedAlbum(prev => ({
          ...prev,
          media_count: prev.media_count + 1,
          cover_url: prev.cover_url || uploadResponse.data.url
        }));
        
      } catch (error) {
        // error handled
      }
    }
    
    setUploading(false);
    e.target.value = "";
  };

  // Delete media
  const handleDeleteMedia = async (mediaId) => {
    if (!selectedAlbum) return;
    
    try {
      await axios.delete(`${API}/albums/${selectedAlbum.id}/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlbumMedia(prev => prev.filter(m => m.id !== mediaId));
      
      // Update count
      setAlbums(prev => prev.map(a => 
        a.id === selectedAlbum.id 
          ? { ...a, media_count: Math.max(0, a.media_count - 1) }
          : a
      ));
      setSelectedAlbum(prev => ({
        ...prev,
        media_count: Math.max(0, prev.media_count - 1)
      }));
    } catch (error) {
      // error handled
    }
  };

  if (loading) {
    return (
      <BrunoLoader />
    );
  }

  // Album detail view
  if (selectedAlbum) {
    return (
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedAlbum(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-semibold text-sm truncate">{selectedAlbum.name}</h1>
              <p className="text-xs text-muted-foreground">
                {selectedAlbum.media_count} elementos
                {selectedAlbum.is_private && <Lock className="inline w-3 h-3 ml-1" />}
              </p>
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
              <Button variant="default" size="sm" disabled={uploading} asChild>
                <span>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span className="ml-1 hidden sm:inline">Añadir</span>
                </span>
              </Button>
            </label>
          </div>
        </header>

        {/* Media Grid */}
        <div className="p-2">
          {mediaLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : albumMedia.length === 0 ? (
            <div className="text-center py-16">
              <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Álbum vacío</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleUpload}
                />
                <Button variant="outline" size="sm" asChild>
                  <span><Upload className="w-4 h-4 mr-1" /> Subir fotos/videos</span>
                </Button>
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {albumMedia.map((media) => (
                <div key={media.id} className="relative aspect-square group">
                  {media.media_type === "video" ? (
                    <div className="w-full h-full bg-black rounded-sm overflow-hidden">
                      <img
                        src={media.thumbnail_url || media.media_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play className="w-8 h-8 text-white/80" />
                      </div>
                    </div>
                  ) : (
                    <img
                      src={media.media_url}
                      alt=""
                      className="w-full h-full object-cover rounded-sm"
                    />
                  )}
                  <button
                    onClick={() => handleDeleteMedia(media.id)}
                    className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Albums list view
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold">Mis Álbumes</h1>
          </div>
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button size="sm">
                <FolderPlus className="w-4 h-4 mr-1" />
                Nuevo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Crear Álbum</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Nombre del álbum"
                  value={newAlbum.name}
                  onChange={(e) => setNewAlbum({ ...newAlbum, name: e.target.value })}
                />
                <Input
                  placeholder="Descripción (opcional)"
                  value={newAlbum.description}
                  onChange={(e) => setNewAlbum({ ...newAlbum, description: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant={newAlbum.is_private ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewAlbum({ ...newAlbum, is_private: true })}
                  >
                    <Lock className="w-3 h-3 mr-1" /> Privado
                  </Button>
                  <Button
                    variant={!newAlbum.is_private ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewAlbum({ ...newAlbum, is_private: false })}
                  >
                    <Globe className="w-3 h-3 mr-1" /> Público
                  </Button>
                </div>
                <Button onClick={handleCreateAlbum} className="w-full" disabled={!newAlbum.name.trim()}>
                  Crear Álbum
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Albums Grid */}
      <div className="p-4">
        {albums.length === 0 ? (
          <div className="text-center py-16">
            <Grid3X3 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No tienes álbumes</p>
            <Button variant="outline" onClick={() => setShowCreateModal(true)}>
              <FolderPlus className="w-4 h-4 mr-1" /> Crear primer álbum
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {albums.map((album) => (
              <Card
                key={album.id}
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                onClick={() => handleSelectAlbum(album)}
              >
                <div className="aspect-square relative bg-muted">
                  {album.cover_url ? (
                    <img
                      src={album.cover_url}
                      alt={album.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteAlbum(album.id); }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  </button>
                  {album.is_private && (
                    <div className="absolute top-2 left-2 p-1 bg-black/60 rounded-full">
                      <Lock className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <CardContent className="p-2">
                  <p className="font-medium text-sm truncate">{album.name}</p>
                  <p className="text-xs text-muted-foreground">{album.media_count} elementos</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlbumsPage;
