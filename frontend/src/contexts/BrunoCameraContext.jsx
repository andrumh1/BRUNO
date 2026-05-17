import React, { createContext, useContext, useState, useCallback } from "react";
import BrunoQuickCamera from "@/components/bruno/BrunoQuickCamera";

/**
 * Global Camera Context — lets ANY component open the Bruno Pro Camera
 * without each one having to mount its own instance.
 *
 *   const { open } = useBrunoCamera();
 *   open({ onCapture: (file, meta) => { ... }, mode: "both" });
 */

const CameraCtx = createContext({ open: () => {}, close: () => {}, isOpen: false });

export const BrunoCameraProvider = ({ children }) => {
  const [state, setState] = useState({ open: false, onCapture: null, mode: "both" });

  const open = useCallback((opts = {}) => {
    setState({
      open: true,
      onCapture: opts.onCapture || null,
      mode: opts.mode || "both",
    });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const handleCapture = async (file, meta) => {
    if (state.onCapture) {
      try {
        await state.onCapture(file, meta);
      } catch (_) {
        /* swallow */
      }
    }
    close();
  };

  return (
    <CameraCtx.Provider value={{ open, close, isOpen: state.open }}>
      {children}
      <BrunoQuickCamera
        open={state.open}
        onClose={close}
        onCapture={handleCapture}
        mode={state.mode}
      />
    </CameraCtx.Provider>
  );
};

export const useBrunoCamera = () => useContext(CameraCtx);
