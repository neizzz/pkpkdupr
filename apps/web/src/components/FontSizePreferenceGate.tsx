import React from "react";
import FontSizePreferenceModal from "@/components/FontSizePreferenceModal";
import { useFontSizePreference } from "@/context/FontSizePreferenceContext";

const FontSizePreferenceGate: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const {
    needsInitialSetup,
    savedPreference,
    previewPreference,
    resetPreview,
    savePreference,
  } = useFontSizePreference();

  return (
    <>
      {children}
      <FontSizePreferenceModal
        isOpen={needsInitialSetup}
        isInitialSetup
        savedPreference={savedPreference}
        onPreview={previewPreference}
        onResetPreview={resetPreview}
        onSave={savePreference}
      />
    </>
  );
};

export default FontSizePreferenceGate;
