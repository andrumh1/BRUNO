import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Home, 
  Film, 
  ShoppingBag, 
  Bell, 
  User,
  Map,
  MessageCircle,
  PlusSquare
} from "lucide-react";

/**
 * MobileBottomNav - Instagram/Facebook style bottom navigation for mobile devices
 * Only visible on mobile screens (< 768px)
 */
const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  
  // Pages where we should hide the bottom nav (fullscreen experiences)
  const hiddenPaths = ['/camera', '/login', '/register', '/landing', '/website', '/bruno'];
  const shouldHide = hiddenPaths.some(path => location.pathname.startsWith(path));
  
  if (shouldHide) return null;

  const navItems = [
    { 
      id: 'home',
      icon: Home, 
      label: 'Inicio', 
      path: '/feed',
      matchPaths: ['/', '/feed']
    },
    { 
      id: 'reels',
      icon: Film, 
      label: 'Reels', 
      path: '/feed?tab=reels',
      matchPaths: ['/reels']
    },
    { 
      id: 'create',
      icon: PlusSquare, 
      label: 'Crear', 
      path: '/camera',
      isCreate: true
    },
    { 
      id: 'map',
      icon: Map, 
      label: 'Mapa', 
      path: '/map',
      matchPaths: ['/map']
    },
    { 
      id: 'profile',
      icon: User, 
      label: 'Perfil', 
      path: '/my-profile',
      matchPaths: ['/my-profile', '/dashboard'],
      showAvatar: true
    }
  ];

  const isActive = (item) => {
    if (item.matchPaths) {
      return item.matchPaths.some(p => location.pathname === p);
    }
    return location.pathname === item.path;
  };

  const handleNavClick = (item) => {
    if (item.id === 'create') {
      navigate('/camera');
    } else {
      navigate(item.path);
    }
  };

  return (
    <>
      {/* Spacer to prevent content from being hidden behind nav */}
      <div className="h-16 md:hidden" />
      
      {/* Bottom Navigation Bar */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-[9999] md:hidden bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        data-testid="mobile-bottom-nav"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={`
                  flex flex-col items-center justify-center 
                  w-16 h-14 rounded-xl
                  transition-all duration-200 ease-out
                  ${item.isCreate 
                    ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/30' 
                    : active 
                      ? 'text-primary' 
                      : 'text-muted-foreground hover:text-foreground'
                  }
                `}
                data-testid={`nav-${item.id}`}
              >
                {item.showAvatar && user?.avatar_url ? (
                  <div className={`
                    w-7 h-7 rounded-full overflow-hidden
                    ${active ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}
                  `}>
                    <img 
                      src={user.avatar_url} 
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <Icon 
                    className={`
                      ${item.isCreate ? 'w-6 h-6' : 'w-6 h-6'}
                      ${active && !item.isCreate ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}
                    `}
                    fill={active && !item.isCreate ? 'currentColor' : 'none'}
                  />
                )}
                <span className={`
                  text-[10px] mt-1 font-medium
                  ${item.isCreate ? 'text-primary-foreground' : ''}
                `}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
