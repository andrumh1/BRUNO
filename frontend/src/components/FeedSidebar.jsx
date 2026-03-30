import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  Hash,
  UserPlus,
  Bookmark,
  User,
  Sparkles,
  Crown,
  BarChart3
} from "lucide-react";

export const TrendingSidebar = ({ trending }) => {
  if (!trending || trending.length === 0) return null;
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm">Tendencias</h3>
        </div>
        <div className="space-y-2">
          {trending.slice(0, 6).map((t, i) => (
            <Link key={i} to={`/hashtag/${t.hashtag}`} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted transition-colors group" data-testid={`trending-${t.hashtag}`}>
              <div className="flex items-center gap-2 min-w-0">
                <Hash className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-sm font-medium truncate group-hover:text-primary">#{t.hashtag}</span>
              </div>
              {t.count > 0 && <span className="text-[10px] text-muted-foreground shrink-0">{t.count}</span>}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const SuggestedUsersSidebar = ({ suggested }) => {
  if (!suggested || suggested.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm">Personas sugeridas</h3>
        </div>
        <div className="space-y-2.5">
          {suggested.slice(0, 5).map((u) => (
            <Link key={u.id} to={`/profile/${u.id}`} className="flex items-center gap-2.5 py-1 hover:opacity-80 transition-opacity" data-testid={`suggested-user-${u.id}`}>
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                  {(u.name || "U")[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{u.name || u.username}</p>
                {u.mutual_count > 0 && (
                  <p className="text-[10px] text-muted-foreground">{u.mutual_count} mutual{u.mutual_count > 1 ? "es" : ""}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const QuickLinksSidebar = ({ user }) => {
  if (!user) return null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="space-y-1">
          <Link to="/saved" className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted transition-colors text-sm">
            <Bookmark className="w-4 h-4 text-primary" /> Guardados
          </Link>
          <Link to="/my-profile" className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted transition-colors text-sm">
            <User className="w-4 h-4 text-primary" /> Mi Perfil
          </Link>
          <Link to="/analytics" className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted transition-colors text-sm">
            <BarChart3 className="w-4 h-4 text-primary" /> Analytics
          </Link>
          <Link to="/premium" className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted transition-colors text-sm">
            <Crown className="w-4 h-4 text-amber-500" /> Premium
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export const FeedSidebar = ({ trending, suggested, user }) => (
  <div className="hidden lg:block w-72 shrink-0 space-y-4 sticky top-28 self-start" data-testid="feed-sidebar">
    <TrendingSidebar trending={trending} />
    <SuggestedUsersSidebar suggested={suggested} />
    <QuickLinksSidebar user={user} />
  </div>
);
