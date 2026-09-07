import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { PlayerFontSizePreference } from "@pkpkdupr/shared/player";
import { useAuth } from "@/context/AuthContext";

interface FontSizePreferenceContextValue {
  savedPreference: PlayerFontSizePreference | null;
  activePreference: PlayerFontSizePreference;
  needsInitialSetup: boolean;
  previewPreference: (preference: PlayerFontSizePreference) => void;
  resetPreview: () => void;
  savePreference: (
    preference: PlayerFontSizePreference,
  ) => Promise<PlayerFontSizePreference>;
}

const FontSizePreferenceContext =
  createContext<FontSizePreferenceContextValue | null>(null);

const applyFontSizePreference = (preference: PlayerFontSizePreference) => {
  document.documentElement.dataset.fontSize = preference;
};

export const FontSizePreferenceProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { isAuthenticated, player, updateFontSizePreference } = useAuth();
  const [preview, setPreview] = useState<PlayerFontSizePreference | null>(null);
  const savedPreference = player?.fontSizePreference ?? null;
  const activePreference = preview ?? savedPreference ?? "default";

  useLayoutEffect(() => {
    applyFontSizePreference(activePreference);
  }, [activePreference]);

  useEffect(() => {
    setPreview(null);
  }, [player?.id, player?.fontSizePreference]);

  const previewPreference = useCallback(
    (preference: PlayerFontSizePreference) => setPreview(preference),
    [],
  );
  const resetPreview = useCallback(() => setPreview(null), []);
  const savePreference = useCallback(
    async (preference: PlayerFontSizePreference) => {
      const saved = await updateFontSizePreference(preference);
      setPreview(null);
      return saved;
    },
    [updateFontSizePreference],
  );

  const value = useMemo<FontSizePreferenceContextValue>(
    () => ({
      savedPreference,
      activePreference,
      needsInitialSetup: isAuthenticated && savedPreference === null,
      previewPreference,
      resetPreview,
      savePreference,
    }),
    [
      activePreference,
      isAuthenticated,
      previewPreference,
      resetPreview,
      savePreference,
      savedPreference,
    ],
  );

  return (
    <FontSizePreferenceContext.Provider value={value}>
      {children}
    </FontSizePreferenceContext.Provider>
  );
};

export const useFontSizePreference = () => {
  const context = useContext(FontSizePreferenceContext);
  if (!context) {
    throw new Error(
      "useFontSizePreference는 FontSizePreferenceProvider 안에서 사용해야 합니다.",
    );
  }
  return context;
};
