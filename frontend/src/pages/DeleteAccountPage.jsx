import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import axios from "axios";
import { 
  ArrowLeft, 
  AlertTriangle, 
  Trash2, 
  Download,
  CheckCircle,
  XCircle,
  Loader2,
  Shield
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const DeleteAccountPage = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  
  const [step, setStep] = useState(1); // 1: Info, 2: Confirm, 3: Final
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloadData, setDownloadData] = useState(false);
  const [understood, setUnderstood] = useState({
    permanent: false,
    content: false,
    subscriptions: false,
  });

  const allUnderstood = understood.permanent && understood.content && understood.subscriptions;

  const handleExportData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/profile/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bruno-data-${user?.email || 'export'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setDownloadData(true);
    } catch (err) {
      setError("Error al exportar datos");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== "ELIMINAR MI CUENTA") {
      setError("Por favor escribe exactamente 'ELIMINAR MI CUENTA'");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      await axios.delete(`${API}/profile/delete-account`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { password, confirm_text: confirmText }
      });
      
      setStep(3);
      
      // Logout after 5 seconds
      setTimeout(() => {
        logout();
        navigate("/");
      }, 5000);
      
    } catch (err) {
      setError(err.response?.data?.detail || "Error al eliminar la cuenta");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Account deleted confirmation
  if (step === 3) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Cuenta Eliminada</h1>
          <p className="text-muted-foreground mb-6">
            Tu solicitud de eliminación ha sido procesada. Todos tus datos serán eliminados 
            permanentemente en un plazo de 30 días.
          </p>
          <p className="text-sm text-muted-foreground">
            Serás redirigido a la página de inicio...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Trash2 className="w-5 h-5 text-destructive" />
          <h1 className="text-xl font-bold">Eliminar Cuenta</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Warning Banner */}
        <div className="p-4 bg-destructive/10 rounded-2xl border border-destructive/30 mb-8">
          <div className="flex gap-3">
            <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
            <div>
              <h3 className="font-bold text-destructive mb-1">Acción Irreversible</h3>
              <p className="text-sm text-muted-foreground">
                Eliminar tu cuenta es permanente. Todos tus datos, contenido, tarjetas, 
                conexiones y suscripciones serán eliminados y no podrán ser recuperados.
              </p>
            </div>
          </div>
        </div>

        {step === 1 && (
          <>
            {/* What will be deleted */}
            <section className="mb-8">
              <h2 className="text-lg font-bold mb-4">¿Qué se eliminará?</h2>
              <div className="space-y-3">
                {[
                  "Tu perfil y toda la información personal",
                  "Todas tus tarjetas profesionales",
                  "Todos tus posts, fotos, videos e historias",
                  "Tus mensajes y conversaciones",
                  "Tu historial de compras y productos en el marketplace",
                  "Tus conexiones y seguidores",
                  "Tus puntos y recompensas",
                  "Tus suscripciones activas"
                ].map((item, idx) => (
                  <div key={`item-${idx}`} className="flex items-center gap-3 text-muted-foreground">
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Export Data Option */}
            <section className="mb-8 p-4 bg-card rounded-2xl border">
              <div className="flex items-start gap-3">
                <Download className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Descargar tus datos</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Antes de eliminar tu cuenta, puedes descargar una copia de todos tus datos.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={handleExportData}
                    disabled={loading || downloadData}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : downloadData ? (
                      <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    {downloadData ? "Datos Descargados" : "Descargar Mis Datos"}
                  </Button>
                </div>
              </div>
            </section>

            {/* Alternatives */}
            <section className="mb-8 p-4 bg-primary/5 rounded-2xl border border-primary/20">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Antes de irte...
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                ¿Has considerado estas alternativas?
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• <strong>Desactivar temporalmente:</strong> Tu cuenta permanecerá oculta pero podrás reactivarla</li>
                <li>• <strong>Ajustar privacidad:</strong> Limita quién puede ver tu perfil y contenido</li>
                <li>• <strong>Silenciar notificaciones:</strong> Reduce las interrupciones sin eliminar la cuenta</li>
              </ul>
            </section>

            <Button 
              variant="destructive" 
              className="w-full"
              onClick={() => setStep(2)}
            >
              Continuar con la Eliminación
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            {/* Confirmation Checkboxes */}
            <section className="mb-8 space-y-4">
              <h2 className="text-lg font-bold mb-4">Confirma que entiendes:</h2>
              
              <label className="flex items-start gap-3 p-3 bg-card rounded-xl border cursor-pointer hover:bg-muted/50">
                <Checkbox 
                  checked={understood.permanent}
                  onCheckedChange={(checked) => setUnderstood({...understood, permanent: !!checked})}
                />
                <span className="text-sm">
                  Esta acción es <strong>permanente e irreversible</strong>. No podré recuperar mi cuenta.
                </span>
              </label>
              
              <label className="flex items-start gap-3 p-3 bg-card rounded-xl border cursor-pointer hover:bg-muted/50">
                <Checkbox 
                  checked={understood.content}
                  onCheckedChange={(checked) => setUnderstood({...understood, content: !!checked})}
                />
                <span className="text-sm">
                  Todo mi <strong>contenido será eliminado</strong>: posts, tarjetas, mensajes, fotos y videos.
                </span>
              </label>
              
              <label className="flex items-start gap-3 p-3 bg-card rounded-xl border cursor-pointer hover:bg-muted/50">
                <Checkbox 
                  checked={understood.subscriptions}
                  onCheckedChange={(checked) => setUnderstood({...understood, subscriptions: !!checked})}
                />
                <span className="text-sm">
                  Mis <strong>suscripciones serán canceladas</strong> sin reembolso del período actual.
                </span>
              </label>
            </section>

            {/* Final Confirmation */}
            <section className="mb-8">
              <h2 className="text-lg font-bold mb-4">Confirmación Final</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Escribe "ELIMINAR MI CUENTA" para confirmar:
                  </label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="ELIMINAR MI CUENTA"
                    className="font-mono"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Ingresa tu contraseña:
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña actual"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive mt-3">{error}</p>
              )}
            </section>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setStep(1)}
              >
                Volver
              </Button>
              <Button 
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteAccount}
                disabled={!allUnderstood || confirmText !== "ELIMINAR MI CUENTA" || !password || loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Eliminar Permanentemente
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DeleteAccountPage;
