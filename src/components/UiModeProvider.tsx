"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type UiMode = "desktop" | "mobile";

type UiModeContextType = {
  uiMode: UiMode;
  setUiMode: (mode: UiMode) => void;
  toggleUiMode: () => void;
  isMobileMode: boolean;
};

const UiModeContext = createContext<UiModeContextType>({
  uiMode: "desktop",
  setUiMode: () => {},
  toggleUiMode: () => {},
  isMobileMode: false,
});

const STORAGE_KEY = "timbangqr_ui_mode";

export function UiModeProvider({ children }: { children: React.ReactNode }) {
  const [uiMode, setUiModeState] = useState<UiMode>("desktop");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as UiMode | null;
    if (saved === "mobile" || saved === "desktop") {
      setUiModeState(saved);
      document.documentElement.setAttribute("data-ui-mode", saved);
    } else {
      const detected: UiMode = window.innerWidth <= 768 ? "mobile" : "desktop";
      setUiModeState(detected);
      document.documentElement.setAttribute("data-ui-mode", detected);
    }
    setMounted(true);
  }, []);

  const setUiMode = (mode: UiMode) => {
    setUiModeState(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, mode);
      document.documentElement.setAttribute("data-ui-mode", mode);
    }
  };

  const toggleUiMode = () => {
    setUiMode(uiMode === "desktop" ? "mobile" : "desktop");
  };

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute("data-ui-mode", uiMode);
    }
  }, [uiMode, mounted]);

  return (
    <UiModeContext.Provider
      value={{
        uiMode,
        setUiMode,
        toggleUiMode,
        isMobileMode: uiMode === "mobile",
      }}
    >
      <div className={`ui-mode-root ui-mode-${uiMode}`} data-ui-mode={uiMode}>
        {children}
      </div>
    </UiModeContext.Provider>
  );
}

export function useUiMode() {
  return useContext(UiModeContext);
}

