import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * BubbleSelect - Dropdown con estilo iOS 26 / Glassmorphism
 * Funciona correctamente en móviles con touch events
 */
const BubbleSelect = ({ 
  value, 
  onChange, 
  options = [], 
  placeholder = "Seleccionar...",
  className = "",
  disabled = false,
  renderOption = null // Función opcional para renderizar opciones personalizadas
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const optionsRef = useRef(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Scroll al elemento seleccionado cuando se abre
  useEffect(() => {
    if (isOpen && optionsRef.current && value) {
      const selectedElement = optionsRef.current.querySelector(`[data-value="${value}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, value]);

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div 
      ref={containerRef} 
      className={`bubble-select-container relative ${className}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          bubble-select-trigger
          w-full flex items-center justify-between gap-3
          min-h-[48px] px-4 py-3
          rounded-2xl
          text-left text-base
          transition-all duration-200 ease-out
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"}
          ${isOpen ? "bubble-select-trigger-open" : ""}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`flex-1 truncate ${!selectedOption ? "text-muted-foreground" : ""}`}>
          {selectedOption ? (
            renderOption ? renderOption(selectedOption, true) : selectedOption.label
          ) : placeholder}
        </span>
        <ChevronDown 
          className={`w-5 h-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} 
        />
      </button>

      {/* Options Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop para móviles */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm sm:hidden"
            style={{ zIndex: 9998 }}
            onClick={() => setIsOpen(false)}
          />
          
          {/* Options Container */}
          <div
            ref={optionsRef}
            role="listbox"
            className="bubble-select-options"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: "8px",
              zIndex: 9999,
            }}
          >
            <div className="bubble-select-options-inner">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  data-value={option.value}
                  aria-selected={option.value === value}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(option.value);
                  }}
                  className={`
                    bubble-select-option
                    w-full flex items-center gap-3 px-4 py-3
                    text-left text-base
                    transition-all duration-150
                    ${option.value === value ? "bubble-select-option-selected" : ""}
                  `}
                >
                  <span className="flex-1">
                    {renderOption ? renderOption(option, false) : (
                      <span>{option.label}</span>
                    )}
                  </span>
                  {option.value === value && (
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BubbleSelect;
