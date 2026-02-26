import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import axios from "axios";
import { 
  Flag, 
  X, 
  AlertTriangle, 
  Shield,
  Users,
  Ban,
  MessageSquare,
  Loader2,
  CheckCircle
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Report reasons
const REPORT_REASONS = [
  { 
    id: "spam", 
    label: "Spam", 
    description: "Contenido repetitivo o promocional no deseado",
    icon: MessageSquare 
  },
  { 
    id: "harassment", 
    label: "Acoso o intimidación", 
    description: "Comportamiento abusivo, amenazas o bullying",
    icon: Users 
  },
  { 
    id: "hate_speech", 
    label: "Discurso de odio", 
    description: "Contenido discriminatorio o que incita al odio",
    icon: Ban 
  },
  { 
    id: "violence", 
    label: "Violencia o contenido peligroso", 
    description: "Glorificación de la violencia o actividades peligrosas",
    icon: AlertTriangle 
  },
  { 
    id: "sexual_content", 
    label: "Contenido sexual o para adultos", 
    description: "Material sexualmente explícito o inapropiado",
    icon: Shield 
  },
  { 
    id: "misinformation", 
    label: "Información falsa", 
    description: "Desinformación que puede causar daño",
    icon: AlertTriangle 
  },
  { 
    id: "impersonation", 
    label: "Suplantación de identidad", 
    description: "Hacerse pasar por otra persona u organización",
    icon: Users 
  },
  { 
    id: "intellectual_property", 
    label: "Infracción de derechos de autor", 
    description: "Uso no autorizado de contenido protegido",
    icon: Shield 
  },
  { 
    id: "illegal_activity", 
    label: "Actividad ilegal", 
    description: "Promoción de actividades ilegales",
    icon: Ban 
  },
  { 
    id: "other", 
    label: "Otro", 
    description: "Otra razón no listada",
    icon: Flag 
  }
];

/**
 * ReportContentModal - Modal component for reporting content
 * Can be used for posts, users, comments, products, etc.
 */
const ReportContentModal = ({ 
  isOpen, 
  onClose, 
  contentType, // 'post' | 'user' | 'comment' | 'product' | 'message'
  contentId,
  contentTitle 
}) => {
  const { token } = useAuth();
  const [selectedReason, setSelectedReason] = useState(null);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [step, setStep] = useState(1); // 1: Select reason, 2: Additional info, 3: Success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmitReport = async () => {
    if (!selectedReason) return;
    
    setLoading(true);
    setError("");
    
    try {
      await axios.post(`${API}/reports`, {
        content_type: contentType,
        content_id: contentId,
        reason: selectedReason,
        additional_info: additionalInfo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al enviar el reporte");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedReason(null);
    setAdditionalInfo("");
    setError("");
    onClose();
  };

  const contentTypeLabels = {
    post: "publicación",
    user: "usuario",
    comment: "comentario",
    product: "producto",
    message: "mensaje"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-destructive" />
            <h2 className="font-bold">Reportar {contentTypeLabels[contentType]}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {step === 1 && (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                ¿Por qué reportas este contenido?
              </p>
              
              <div className="space-y-2">
                {REPORT_REASONS.map((reason) => {
                  const Icon = reason.icon;
                  return (
                    <button
                      key={reason.id}
                      onClick={() => setSelectedReason(reason.id)}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${
                        selectedReason === reason.id 
                          ? "bg-destructive/10 border-destructive/30 border" 
                          : "bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      <Icon className={`w-5 h-5 mt-0.5 ${selectedReason === reason.id ? "text-destructive" : "text-muted-foreground"}`} />
                      <div>
                        <p className={`font-medium ${selectedReason === reason.id ? "text-destructive" : ""}`}>
                          {reason.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{reason.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center gap-2 mb-4 p-3 bg-destructive/10 rounded-xl">
                {REPORT_REASONS.find(r => r.id === selectedReason)?.icon && (
                  React.createElement(REPORT_REASONS.find(r => r.id === selectedReason).icon, {
                    className: "w-5 h-5 text-destructive"
                  })
                )}
                <span className="font-medium">{REPORT_REASONS.find(r => r.id === selectedReason)?.label}</span>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Información adicional (opcional)
                </label>
                <Textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Proporciona más detalles sobre el problema..."
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Esto nos ayuda a revisar el contenido más rápido
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive mb-4">{error}</p>
              )}
            </>
          )}

          {step === 3 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="font-bold text-lg mb-2">Reporte Enviado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Gracias por ayudarnos a mantener BRUNO seguro. Revisaremos tu reporte y tomaremos 
                las medidas necesarias.
              </p>
              <p className="text-xs text-muted-foreground">
                Si encontramos que el contenido viola nuestras políticas, será eliminado.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3">
          {step === 1 && (
            <>
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                className="flex-1"
                onClick={() => setStep(2)}
                disabled={!selectedReason}
              >
                Continuar
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                Volver
              </Button>
              <Button 
                variant="destructive"
                className="flex-1"
                onClick={handleSubmitReport}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Flag className="w-4 h-4 mr-2" />
                )}
                Enviar Reporte
              </Button>
            </>
          )}

          {step === 3 && (
            <Button className="w-full" onClick={handleClose}>
              Cerrar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * ReportButton - Simple button to trigger report modal
 */
export const ReportButton = ({ 
  contentType, 
  contentId, 
  contentTitle,
  variant = "ghost",
  size = "icon",
  className = ""
}) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button 
        variant={variant} 
        size={size}
        className={className}
        onClick={() => setShowModal(true)}
        title="Reportar"
      >
        <Flag className="w-4 h-4" />
      </Button>
      
      <ReportContentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        contentType={contentType}
        contentId={contentId}
        contentTitle={contentTitle}
      />
    </>
  );
};

export default ReportContentModal;
