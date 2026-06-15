import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/**
 * NewChatModal — search a user by name/email and start a conversation.
 *
 * Props:
 *   isOpen, onClose, token, onSelectUser(user)
 */
const NewChatModal = ({ isOpen, onClose, onSelectUser, token }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return undefined;
    }
    const debounce = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await axios.get(`${API}/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setResults(r.data);
      } catch (_e) {
        // error handled
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, token]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="new-chat-modal"
    >
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Nueva Conversación</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="pl-10 rounded-full"
              autoFocus
              data-testid="new-chat-search-input"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : results.length > 0 ? (
              results.map((user) => (
                <div
                  key={user.id}
                  onClick={() => onSelectUser(user)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted cursor-pointer transition-colors"
                  data-testid={`new-chat-user-${user.id}`}
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold">
                      {(user.display_name || user.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{user.display_name || user.username}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              ))
            ) : searchQuery ? (
              <p className="text-center text-muted-foreground py-4">No se encontraron usuarios</p>
            ) : (
              <p className="text-center text-muted-foreground py-4">Escribe para buscar usuarios</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewChatModal;
