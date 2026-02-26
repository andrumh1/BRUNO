import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import axios from "axios";
import {
  Bell,
  BellRing,
  X,
  Check,
  MessageCircle,
  Heart,
  UserPlus,
  Phone,
  ShoppingCart,
  Star,
  Camera,
  AtSign,
  Package,
  Tag,
  Settings,
  Loader2,
  CheckCheck
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const NOTIFICATION_ICONS = {
  incoming_call: Phone,
  new_message: MessageCircle,
  new_follower: UserPlus,
  post_like: Heart,
  post_comment: MessageCircle,
  product_favorited: Star,
  product_cart_added: ShoppingCart,
  new_story: Camera,
  mention: AtSign,
  order_update: Package,
  promotion: Tag
};

const NotificationItem = ({ notification, onMarkRead, onClick }) => {
  const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
  const isUnread = !notification.read;
  
  const timeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return "ahora";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  };

  return (
    <div
      onClick={() => {
        if (notification.payload?.url) onClick(notification.payload.url);
        if (isUnread) onMarkRead(notification.id);
      }}
      className={`flex items-start gap-3 p-3 cursor-pointer transition-colors hover:bg-muted ${
        isUnread ? "bg-primary/5" : ""
      }`}
    >
      <div className={`p-2 rounded-full ${isUnread ? "bg-primary/20 text-primary" : "bg-muted"}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isUnread ? "font-semibold" : ""}`}>
          {notification.payload?.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {notification.payload?.body}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {timeAgo(notification.created_at)}
        </p>
      </div>
      {isUnread && (
        <div className="w-2 h-2 bg-primary rounded-full mt-2" />
      )}
    </div>
  );
};

const NotificationBell = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await axios.get(`${API}/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUnreadCount(response.data.count);
      } catch (e) {}
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!isOpen || !token) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API}/notifications/recent?limit=20`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(response.data);
      } catch (e) {}
      setLoading(false);
    };

    fetchNotifications();
  }, [isOpen, token]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkRead = async (notificationId) => {
    try {
      await axios.post(`${API}/notifications/mark-read/${notificationId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.post(`${API}/notifications/mark-all-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  const handleNavigate = (url) => {
    setIsOpen(false);
    navigate(url);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        data-testid="notification-bell-btn"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 animate-pulse" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-card rounded-xl shadow-2xl border overflow-hidden z-50 animate-in slide-in-from-top-2">
          {/* Header */}
          <div className="p-3 border-b flex items-center justify-between bg-gradient-to-r from-primary/5 to-primary/10">
            <h3 className="font-bold">Notificaciones</h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:underline"
                >
                  Marcar todas
                </button>
              )}
              <button
                onClick={() => navigate("/settings/notifications")}
                className="p-1 hover:bg-muted rounded"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No hay notificaciones</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onClick={handleNavigate}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2 border-t">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate("/notifications");
                }}
                className="w-full text-center text-sm text-primary hover:underline py-1"
              >
                Ver todas las notificaciones
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
