import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PointsPage as PointsContent } from "@/components/PointsSystem";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const PointsPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/feed">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold">Mis Puntos</h1>
        </div>
      </div>

      {/* Content */}
      <PointsContent />

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-2 md:hidden">
        <div className="flex justify-around">
          <Link to="/feed" className="flex flex-col items-center p-2 text-muted-foreground hover:text-primary">
            <Home className="w-5 h-5" />
            <span className="text-xs mt-1">Inicio</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PointsPage;
