import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Home, 
  Radio,
  Map,
  ShoppingBag,
  User,
  Plus,
  MessageCircle,
  Search,
  Settings
} from "lucide-react";

/**
 * MobileBottomNav - iOS 26.3 style compact bubble navigation
 */
const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [activeLight, setActiveLight] = useState(0);
  
  // Pages where we should hide the bottom nav
  const hiddenPaths = ['/camera', '/login', '/register', '/landing', '/website', '/bruno'];
  const shouldHide = hiddenPaths.some(path => location.pathname.startsWith(path)) || 
                     location.pathname.match(/^\/lives\/[^/]+$/) ||
                     location.pathname.startsWith('/chat/');

  // Dynamic light animation
  useEffect(() => {
    if (shouldHide) return;
    const interval = setInterval(() => {
      setActiveLight(prev => (prev + 1) % 8);
    }, 2500);
    return () => clearInterval(interval);
  }, [shouldHide]);
  
  if (shouldHide) return null;

  const navItems = [
    { id: 'home', icon: Home, label: 'Inicio', path: '/feed', matchPaths: ['/', '/feed'] },
    { id: 'marketplace', icon: ShoppingBag, label: 'Tienda', path: '/marketplace', matchPaths: ['/marketplace'] },
    { id: 'create', icon: Plus, label: '', path: '/camera', isCreate: true },
    { id: 'lives', icon: Radio, label: 'Live', path: '/lives', matchPaths: ['/lives'], hasIndicator: true },
    { id: 'map', icon: Map, label: 'Mapa', path: '/map', matchPaths: ['/map'] },
    { id: 'profile', icon: User, label: 'Perfil', path: '/my-profile', matchPaths: ['/my-profile', '/dashboard'], showAvatar: true }
  ];

  const isActive = (item) => {
    if (item.matchPaths) {
      return item.matchPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));
    }
    return location.pathname === item.path;
  };

  const handleNavClick = (item) => {
    navigate(item.path);
  };

  return (
    <>
      {/* Spacer */}
      <div className="h-16 md:hidden" />
      
      {/* Navigation Container */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-[9999] md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        data-testid="mobile-bottom-nav"
      >
        {/* Background with blur */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-2xl border-t border-border/50">
          {/* Animated light orbs */}
          <div 
            className="absolute w-20 h-20 rounded-full opacity-20 transition-all duration-[2000ms]"
            style={{
              background: 'radial-gradient(circle, rgba(255,107,53,0.5) 0%, transparent 70%)',
              left: `${5 + (activeLight % 4) * 20}%`,
              top: '-10px',
              filter: 'blur(15px)',
            }}
          />
          <div 
            className="absolute w-16 h-16 rounded-full opacity-15 transition-all duration-[2500ms]"
            style={{
              background: 'radial-gradient(circle, rgba(236,72,153,0.5) 0%, transparent 70%)',
              right: `${10 + ((activeLight + 2) % 4) * 15}%`,
              top: '-5px',
              filter: 'blur(12px)',
            }}
          />
          
          {/* Top glow line */}
          <div 
            className="absolute top-0 left-0 right-0 h-[1px]"
            style={{
              background: `linear-gradient(90deg, transparent 0%, rgba(255,107,53,0.3) 30%, rgba(236,72,153,0.3) 70%, transparent 100%)`
            }}
          />
        </div>

        {/* Navigation Items - Compact */}
        <div className="relative flex items-center justify-around px-2 py-1.5 h-14">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            
            // Create button - same style as others but highlighted
            if (item.isCreate) {
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className="relative flex flex-col items-center justify-center w-10 h-10"
                  data-testid={`nav-${item.id}`}
                >
                  <div 
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-orange-500 shadow-lg shadow-primary/30"
                  >
                    <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
                  </div>
                </button>
              );
            }
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className="relative flex flex-col items-center justify-center w-10 h-10 rounded-xl transition-all duration-200"
                data-testid={`nav-${item.id}`}
              >
                {/* Active background bubble */}
                {active && (
                  <div 
                    className="absolute inset-0.5 rounded-xl bg-primary/10"
                    style={{
                      boxShadow: 'inset 0 0 8px rgba(255,107,53,0.2)'
                    }}
                  />
                )}
                
                {/* Icon */}
                <div className="relative z-10 flex flex-col items-center">
                  {item.showAvatar && user?.avatar_url ? (
                    <div className={`w-5 h-5 rounded-full overflow-hidden ${active ? 'ring-1 ring-primary' : ''}`}>
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="relative">
                      <Icon 
                        className={`w-4 h-4 transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}
                        strokeWidth={active ? 2.5 : 1.5}
                      />
                      {item.hasIndicator && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      )}
                    </div>
                  )}
                  
                  <span className={`text-[8px] mt-0.5 font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                    {item.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
