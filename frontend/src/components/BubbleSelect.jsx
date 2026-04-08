import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

/**
 * BubbleSelect - Dropdown con estilo iOS / Glassmorphism
 * Corregido para funcionar correctamente en pantallas tactiles
 */
const BubbleSelect = ({ 
  value, 
  onChange, 
  options = [], 
  placeholder = "Seleccionar...",
  className = "",
  disabled = false,
  renderOption = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const optionsRef = useRef(null);

  // Close on outside click/touch — checks BOTH containerRef AND optionsRef
  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (event) => {
      const target = event.target;
      if (
        containerRef.current?.contains(target) ||
        optionsRef.current?.contains(target)
      ) return;
      setIsOpen(false);
    };

    // Use pointerdown which works uniformly for mouse and touch
    document.addEventListener("pointerdown", handleOutside, true);
    return () => document.removeEventListener("pointerdown", handleOutside, true);
  }, [isOpen]);

  // Scroll to selected on open
  useEffect(() => {
    if (isOpen && optionsRef.current && value) {
      const el = optionsRef.current.querySelector(`[data-value="${value}"]`);
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, value]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const handleSelect = useCallback((optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  }, [onChange]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div 
      ref={containerRef} 
      className={`bubble-select-container relative ${className}`}
      style={{ zIndex: isOpen ? 9997 : "auto" }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          bubble-select-trigger
          w-full flex items-center justify-between gap-2
          min-h-[42px] px-3 py-2
          rounded-xl
          text-left text-sm
          transition-all duration-200 ease-out
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"}
          ${isOpen ? "bubble-select-trigger-open" : ""}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        data-testid="bubble-select-trigger"
      >
        <span className={`flex-1 truncate ${!selectedOption ? "text-muted-foreground" : ""}`}>
          {selectedOption ? (
            renderOption ? renderOption(selectedOption, true) : selectedOption.label
          ) : placeholder}
        </span>
        <ChevronDown 
          className={`w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} 
        />
      </button>

      {/* Options Dropdown via Portal */}
      {isOpen && createPortal(
        <>
          {/* Backdrop — closes on tap */}
          <div 
            className="fixed inset-0"
            style={{ zIndex: 99998 }}
            onClick={() => setIsOpen(false)}
          />
          
          {/* Options Container */}
          <div
            ref={optionsRef}
            role="listbox"
            className="bubble-select-options fixed left-4 right-4 sm:left-auto sm:right-auto"
            style={{
              ...(containerRef.current ? (() => {
                const rect = containerRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom - 16;
                const dropUp = spaceBelow < 200 && rect.top > 200;
                return {
                  ...(dropUp 
                    ? { bottom: window.innerHeight - rect.top + 8 }
                    : { top: rect.bottom + 8 }),
                  left: window.innerWidth >= 640 ? rect.left : undefined,
                  width: window.innerWidth >= 640 ? rect.width : undefined,
                };
              })() : { top: "50%" }),
              zIndex: 99999,
              maxHeight: "280px",
            }}
          >
            <div className="bubble-select-options-inner overflow-y-auto" style={{ maxHeight: "250px" }}>
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  data-value={option.value}
                  data-testid={`bubble-option-${option.value}`}
                  aria-selected={option.value === value}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(option.value);
                  }}
                  className={`
                    bubble-select-option
                    w-full flex items-center gap-3 px-4 py-3.5
                    text-left text-sm
                    transition-all duration-150
                    touch-manipulation select-none
                    ${option.value === value ? "bubble-select-option-selected" : ""}
                  `}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <span className="flex-1">
                    {renderOption ? renderOption(option, false) : (
                      <span>{option.label}</span>
                    )}
                  </span>
                  {option.value === value && (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default BubbleSelect;
