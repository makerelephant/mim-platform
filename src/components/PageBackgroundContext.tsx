"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type PageBackgroundSpec = {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
};

export const MOTION_PAGE_BACKGROUND_DEFAULT: PageBackgroundSpec = {
  backgroundColor: "#f6f5f5",
};

export const LEGACY_PAGE_BACKGROUND_DEFAULT: PageBackgroundSpec = {
  backgroundColor: "#f3f3f3",
};

type Ctx = {
  setOverride: (v: PageBackgroundSpec | null) => void;
};

const PageBackgroundCtx = createContext<Ctx | null>(null);

export function PageBackgroundProvider({
  children,
  defaultSpec,
}: {
  children: ReactNode;
  defaultSpec: PageBackgroundSpec;
}) {
  const [override, setOverrideState] = useState<PageBackgroundSpec | null>(null);

  const setOverride = useCallback((v: PageBackgroundSpec | null) => {
    setOverrideState(v);
  }, []);

  const effective = useMemo(
    () => (override ? { ...defaultSpec, ...override } : defaultSpec),
    [defaultSpec, override]
  );

  const layerStyle: CSSProperties = {
    backgroundColor: effective.backgroundColor,
    backgroundImage: effective.backgroundImage,
    backgroundSize: effective.backgroundSize,
    backgroundPosition: effective.backgroundPosition,
    backgroundRepeat: effective.backgroundRepeat,
  };

  return (
    <PageBackgroundCtx.Provider value={{ setOverride }}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={layerStyle}
      />
      {children}
    </PageBackgroundCtx.Provider>
  );
}

export function usePageBackground(spec: PageBackgroundSpec) {
  const ctx = useContext(PageBackgroundCtx);
  if (!ctx) {
    throw new Error("usePageBackground must be used inside PageBackgroundProvider");
  }
  const { setOverride } = ctx;

  useEffect(() => {
    setOverride(spec);
    return () => setOverride(null);
  }, [setOverride, spec]);
}
