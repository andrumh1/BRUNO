import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { 
  RotateCcw, 
  RotateCw, 
  FlipHorizontal, 
  FlipVertical,
  Sun,
  Contrast,
  Crop,
  Check,
  X,
  RefreshCw
} from "lucide-react";

const ImageEditor = ({ imageUrl, onSave, onCancel }) => {
  const canvasRef = useRef(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState(null);
  const [cropEnd, setCropEnd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // Cargar imagen original - manejo mejorado para data URLs y URLs remotas
  useEffect(() => {
    const loadImage = async () => {
      setLoading(true);
      const img = new Image();
      
      // Si es un data URL (base64), no necesita crossOrigin
      if (imageUrl.startsWith('data:')) {
        img.onload = () => {
          setOriginalImage(img);
          setLoading(false);
        };
        img.onerror = (e) => {
          // error handled
          setLoading(false);
        };
        img.src = imageUrl;
      } else {
        // Para URLs remotas, intentar con crossOrigin
        img.crossOrigin = "anonymous";
        img.onload = () => {
          setOriginalImage(img);
          setLoading(false);
        };
        img.onerror = () => {
          // Reintentar sin crossOrigin si falla
          const imgRetry = new Image();
          imgRetry.onload = () => {
            setOriginalImage(imgRetry);
            setLoading(false);
          };
          imgRetry.onerror = (e) => {
            // error handled
            setLoading(false);
          };
          imgRetry.src = imageUrl;
        };
        img.src = imageUrl;
      }
    };
    
    loadImage();
  }, [imageUrl]);

  // Renderizar imagen con transformaciones
  const renderCanvas = useCallback(() => {
    if (!originalImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Calcular dimensiones rotadas
    const radians = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    
    const rotatedWidth = originalImage.width * cos + originalImage.height * sin;
    const rotatedHeight = originalImage.width * sin + originalImage.height * cos;

    // Escalar para que quepa en el contenedor (max 500px)
    const maxSize = 500;
    const scale = Math.min(maxSize / rotatedWidth, maxSize / rotatedHeight, 1);
    
    canvas.width = rotatedWidth * scale;
    canvas.height = rotatedHeight * scale;

    ctx.save();
    
    // Centrar
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    // Rotación
    ctx.rotate(radians);
    
    // Flip
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    
    // Filtros
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    
    // Dibujar imagen
    ctx.drawImage(
      originalImage,
      -(originalImage.width * scale) / 2,
      -(originalImage.height * scale) / 2,
      originalImage.width * scale,
      originalImage.height * scale
    );
    
    ctx.restore();

    // Dibujar área de recorte si está activo
    if (isCropping && cropStart && cropEnd) {
      ctx.strokeStyle = "#FF5A00";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        Math.min(cropStart.x, cropEnd.x),
        Math.min(cropStart.y, cropEnd.y),
        Math.abs(cropEnd.x - cropStart.x),
        Math.abs(cropEnd.y - cropStart.y)
      );
      
      // Oscurecer área fuera del recorte
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, canvas.width, Math.min(cropStart.y, cropEnd.y));
      ctx.fillRect(0, Math.max(cropStart.y, cropEnd.y), canvas.width, canvas.height - Math.max(cropStart.y, cropEnd.y));
      ctx.fillRect(0, Math.min(cropStart.y, cropEnd.y), Math.min(cropStart.x, cropEnd.x), Math.abs(cropEnd.y - cropStart.y));
      ctx.fillRect(Math.max(cropStart.x, cropEnd.x), Math.min(cropStart.y, cropEnd.y), canvas.width - Math.max(cropStart.x, cropEnd.x), Math.abs(cropEnd.y - cropStart.y));
    }
  }, [originalImage, rotation, flipH, flipV, brightness, contrast, isCropping, cropStart, cropEnd]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handlers de recorte mejorados
  const getEventCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    // Soporte para touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e) => {
    if (!isCropping) return;
    e.preventDefault();
    setIsDragging(true);
    const coords = getEventCoords(e);
    setCropStart(coords);
    setCropEnd(coords);
  };

  const handleMouseMove = (e) => {
    if (!isCropping || !isDragging || !cropStart) return;
    e.preventDefault();
    const coords = getEventCoords(e);
    setCropEnd({
      x: Math.max(0, Math.min(coords.x, canvasRef.current.width)),
      y: Math.max(0, Math.min(coords.y, canvasRef.current.height))
    });
  };

  const handleMouseUp = (e) => {
    if (e) e.preventDefault();
    setIsDragging(false);
  };

  // Aplicar recorte
  const applyCrop = () => {
    if (!cropStart || !cropEnd) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const width = Math.abs(cropEnd.x - cropStart.x);
    const height = Math.abs(cropEnd.y - cropStart.y);

    const imageData = ctx.getImageData(x, y, width, height);
    
    // Crear nueva imagen recortada
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.putImageData(imageData, 0, 0);

    const croppedImg = new Image();
    croppedImg.onload = () => {
      setOriginalImage(croppedImg);
      setIsCropping(false);
      setCropStart(null);
      setCropEnd(null);
    };
    croppedImg.src = tempCanvas.toDataURL();
  };

  // Guardar imagen final
  const handleSave = () => {
    if (!canvasRef.current) return;
    
    const dataUrl = canvasRef.current.toDataURL("image/png");
    
    // Convertir a Blob para subir
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], "edited-image.png", { type: "image/png" });
        onSave(file, dataUrl);
      });
  };

  // Reset
  const handleReset = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setBrightness(100);
    setContrast(100);
    setIsCropping(false);
    setCropStart(null);
    setCropEnd(null);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-card rounded-2xl p-8 text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold">Editar Imagen</h3>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Reset
            </Button>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/30">
          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-[400px] rounded-lg shadow-lg ${isCropping ? 'cursor-crosshair' : 'cursor-default'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          />
        </div>

        {/* Controles */}
        <div className="p-4 border-t border-border space-y-4">
          {/* Botones de transformación */}
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant={isCropping ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setIsCropping(!isCropping);
                setCropStart(null);
                setCropEnd(null);
              }}
            >
              <Crop className="w-4 h-4 mr-1" />
              Recortar
            </Button>
            
            {isCropping && cropStart && cropEnd && (
              <Button size="sm" onClick={applyCrop}>
                <Check className="w-4 h-4 mr-1" />
                Aplicar Recorte
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRotation((r) => (r - 90) % 360)}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              -90°
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCw className="w-4 h-4 mr-1" />
              +90°
            </Button>
            
            <Button
              variant={flipH ? "default" : "outline"}
              size="sm"
              onClick={() => setFlipH(!flipH)}
            >
              <FlipHorizontal className="w-4 h-4 mr-1" />
              Voltear H
            </Button>
            
            <Button
              variant={flipV ? "default" : "outline"}
              size="sm"
              onClick={() => setFlipV(!flipV)}
            >
              <FlipVertical className="w-4 h-4 mr-1" />
              Voltear V
            </Button>
          </div>

          {/* Sliders usando input range nativo para mejor compatibilidad */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4" />
                  <span>Brillo</span>
                </div>
                <span className="font-medium">{brightness}%</span>
              </div>
              <input
                type="range"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                min={50}
                max={150}
                step={5}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Contrast className="w-4 h-4" />
                  <span>Contraste</span>
                </div>
                <span className="font-medium">{contrast}%</span>
              </div>
              <input
                type="range"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                min={50}
                max={150}
                step={5}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSave}>
              <Check className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;
