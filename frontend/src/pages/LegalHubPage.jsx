import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, FileText, Shield, Cookie, Trash2, Scale, Users, ChevronRight } from "lucide-react";
import { OvcAttribution } from "@/components/brand/OvcAttribution";

const legalPages = [
  { path: "/terms", icon: FileText, title: "Terminos de Servicio", desc: "Condiciones de uso de la plataforma BRUNO", color: "from-blue-500 to-cyan-500" },
  { path: "/privacy", icon: Shield, title: "Politica de Privacidad", desc: "Como recopilamos, usamos y protegemos tus datos", color: "from-green-500 to-emerald-500" },
  { path: "/cookies", icon: Cookie, title: "Politica de Cookies", desc: "Informacion sobre cookies y rastreadores", color: "from-amber-500 to-orange-500" },
  { path: "/legal/community", icon: Users, title: "Normas de la Comunidad", desc: "Reglas de convivencia y contenido permitido", color: "from-purple-500 to-pink-500" },
  { path: "/legal/data-rights", icon: Scale, title: "Derechos de Datos (GDPR)", desc: "Tus derechos sobre tus datos personales", color: "from-indigo-500 to-violet-500" },
  { path: "/settings/delete-account", icon: Trash2, title: "Eliminar Cuenta", desc: "Solicitar la eliminacion permanente de tu cuenta", color: "from-red-500 to-rose-500" },
];

const LegalHubPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-base font-bold">Legal y Condiciones</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        <p className="text-sm text-muted-foreground mb-4">
          Toda la informacion legal y regulatoria de la plataforma BRUNO.
        </p>
        {legalPages.map((page) => {
          const Icon = page.icon;
          return (
            <Link key={page.path} to={page.path}>
              <Card className="glass-card hover:shadow-md transition-all cursor-pointer mb-3">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${page.color} flex items-center justify-center text-white flex-shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{page.title}</h3>
                    <p className="text-xs text-muted-foreground">{page.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
        <OvcAttribution variant="legal" className="pt-8 pb-6" />
      </main>
    </div>
  );
};

export default LegalHubPage;
