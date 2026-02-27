import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Home, 
  Radio,
  Map,
  ShoppingBag,
  User,
  PlusCircle,
  MessageCircle,
  Bell,
  Search,
  Compass
} from "lucide-react";

/**
 * MobileBottomNav - iOS 26.3 style bubble navigation
 * Features dynamic light effects and compact bubble buttons
 */
const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [activeLight, setActiveLight] = useState(0);
  const [touchRipple, setTouchRipple] = useState(null);
  
  // Pages where we should hide the bottom nav
  const hiddenPaths = ['/camera', '/login', '/register', '/landing', '/website', '/bruno', '/lives/'];
  const shouldHide = hiddenPaths.some(path => location.pathname.startsWith(path)) || 
                     location.pathname.match(/^\/lives\/[^/]+$/);
  
  if (shouldHide) return null;

  // Dynamic light animation
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLight(prev => (prev + 1) % 8);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'home', icon: Home, label: 'Inicio', path: '/feed', matchPaths: ['/', '/feed'] },
    { id: 'explore', icon: Compass, label: 'Explorar', path: '/marketplace', matchPaths: ['/marketplace'] },
    { id: 'create', icon: PlusCircle, label: '', path: '/camera', isCreate: true },
    { id: 'lives', icon: Radio, label: 'Lives', path: '/lives', matchPaths: ['/lives'], hasIndicator: true },
    { id: 'map', icon: Map, label: 'Mapa', path: '/map', matchPaths: ['/map'] },
    { id: 'chat', icon: MessageCircle, label: 'Chat', path: '/chat', matchPaths: ['/chat'] },
    { id: 'profile', icon: User, label: 'Perfil', path: '/my-profile', matchPaths: ['/my-profile', '/dashboard'], showAvatar: true }
  ];

  const isActive = (item) => {
    if (item.matchPaths) {
      return item.matchPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));
    }
    return location.pathname === item.path;
  };

  const handleNavClick = (item, e) => {
    // Create ripple effect
    const rect = e.currentTarget.getBoundingClientRect();
    setTouchRipple({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      id: Date.now()
    });
    setTimeout(() => setTouchRipple(null), 600);
    
    navigate(item.path);
  };

  return (
    <>
      {/* Spacer */}
      <div className="h-20 md:hidden" />
      
      {/* Navigation Container */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-[9999] md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        data-testid="mobile-bottom-nav"
      >
        {/* Animated Background Blur */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Main glass background */}
          <div className="absolute inset-0 bg-background/70 backdrop-blur-2xl" />
          
          {/* Dynamic light orbs */}
          <div 
            className="absolute w-32 h-32 rounded-full transition-all duration-[2000ms] ease-in-out opacity-30"
            style={{
              background: 'radial-gradient(circle, rgba(255,107,53,0.6) 0%, transparent 70%)',
              left: `${10 + (activeLight % 3) * 30}%`,
              top: '-20px',
              filter: 'blur(20px)',
              transform: `scale(${1 + (activeLight % 2) * 0.3})`
            }}
          />
          <div 
            className="absolute w-24 h-24 rounded-full transition-all duration-[2500ms] ease-in-out opacity-25"
            style={{
              background: 'radial-gradient(circle, rgba(236,72,153,0.6) 0%, transparent 70%)',
              right: `${15 + ((activeLight + 1) % 3) * 25}%`,
              top: '-10px',
              filter: 'blur(15px)',
              transform: `scale(${1.2 - (activeLight % 2) * 0.2})`
            }}
          />
          <div 
            className="absolute w-20 h-20 rounded-full transition-all duration-[3000ms] ease-in-out opacity-20"
            style={{
              background: 'radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 70%)',
              left: `${40 + ((activeLight + 2) % 4) * 10}%`,
              top: '10px',
              filter: 'blur(12px)'
            }}
          />
          
          {/* Top border glow line */}
          <div 
            className="absolute top-0 left-0 right-0 h-[1px] transition-all duration-1000"
            style={{
              background: `linear-gradient(90deg, 
                transparent 0%, 
                rgba(255,107,53,${0.3 + (activeLight % 3) * 0.1}) ${20 + activeLight * 5}%, 
                rgba(236,72,153,0.4) 50%, 
                rgba(59,130,246,${0.3 + ((activeLight + 1) % 3) * 0.1}) ${70 - activeLight * 3}%, 
                transparent 100%)`
            }}
          />
          
          {/* Bubble texture overlay */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px),
                               radial-gradient(circle at 80% 30%, white 1px, transparent 1px),
                               radial-gradient(circle at 40% 70%, white 0.5px, transparent 0.5px),
                               radial-gradient(circle at 60% 20%, white 0.5px, transparent 0.5px)`,
              backgroundSize: '60px 60px, 80px 80px, 40px 40px, 50px 50px'
            }}
          />
        </div>

        {/* Navigation Items */}
        <div className="relative flex items-center justify-around px-1 py-2 h-16">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item);
            
            // Create button
            if (item.isCreate) {
              return (
                <button
                  key={item.id}
                  onClick={(e) => handleNavClick(item, e)}
                  className="relative flex items-center justify-center w-12 h-12 -mt-4"
                  data-testid={`nav-${item.id}`}
                >
                  {/* Outer glow ring */}
                  <div 
                    className="absolute inset-0 rounded-full animate-pulse"
                    style={{
                      background: 'linear-gradient(135deg, #FF6B35 0%, #EC4899 50%, #3B82F6 100%)',
                      filter: 'blur(8px)',
                      opacity: 0.6
                    }}
                  />
                  {/* Main button */}
                  <div 
                    className="relative w-11 h-11 rounded-full flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform"
                    style={{
                      background: 'linear-gradient(135deg, #FF6B35 0%, #EC4899 100%)'
                    }}
                  >
                    <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                </button>
              );
            }
            
            return (
              <button
                key={item.id}
                onClick={(e) => handleNavClick(item, e)}
                className={`
                  relative flex flex-col items-center justify-center
                  w-12 h-12 rounded-2xl overflow-hidden
                  transition-all duration-300 ease-out
                  ${active ? 'scale-105' : 'hover:scale-105'}
                `}
                data-testid={`nav-${item.id}`}
              >
                {/* Active bubble background */}
                {active && (
                  <div 
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(255,107,53,0.15) 0%, transparent 70%)',
                    }}
                  />
                )}
                
                {/* Bubble glass effect on hover/active */}
                <div 
                  className={`
                    absolute inset-1 rounded-xl transition-all duration-300
                    ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}
                  `}
                  style={{
                    background: active 
                      ? 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)'
                      : 'transparent',
                    backdropFilter: active ? 'blur(4px)' : 'none',
                    border: active ? '1px solid rgba(255,255,255,0.1)' : 'none'
                  }}
                />
                
                {/* Icon container */}
                <div className="relative z-10 flex flex-col items-center">
                  {item.showAvatar && user?.avatar_url ? (
                    <div className={`
                      w-6 h-6 rounded-full overflow-hidden
                      ${active ? 'ring-2 ring-primary/50 ring-offset-1 ring-offset-transparent' : ''}
                    `}>
                      <img 
                        src={user.avatar_url} 
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <Icon 
                        className={`
                          w-5 h-5 transition-all duration-300
                          ${active ? 'text-primary' : 'text-muted-foreground'}
                        `}
                        strokeWidth={active ? 2.5 : 1.5}
                        fill={active ? 'currentColor' : 'none'}
                      />
                      {item.hasIndicator && (
                        <span 
                          className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full"
                          style={{
                            boxShadow: '0 0 4px rgba(239,68,68,0.8)',
                            animation: 'pulse 2s infinite'
                          }}
                        />
                      )}
                    </div>
                  )}
                  
                  {/* Label - only show for non-create items */}
                  <span className={`
                    text-[9px] mt-0.5 font-medium transition-all duration-300
                    ${active ? 'text-primary' : 'text-muted-foreground'}
                  `}>
                    {item.label}
                  </span>
                </div>
                
                {/* Active indicator dot */}
                {active && (
                  <div 
                    className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary"
                    style={{
                      boxShadow: '0 0 6px rgba(255,107,53,0.8)'
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
