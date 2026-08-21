import React from "react";
import { useOverlayState } from "@heroui/react";
import AppModal from "./AppModal";
import PlayerQrScannerModalContent from "./PlayerQrScannerModalContent";

interface PlayerQrScannerModalProps {
  isOpen: boolean;
  ariaLabel: string;
  successMessage: string;
  onOpenChange: (isOpen: boolean) => void;
  onScanned: (payload: string) => Promise<void>;
}

const PlayerQrScannerModal: React.FC<PlayerQrScannerModalProps> = ({
  isOpen,
  ariaLabel,
  successMessage,
  onOpenChange,
  onScanned,
}) => {
  const state = useOverlayState({ isOpen, onOpenChange });

  return (
    <AppModal
      state={state}
      ariaLabel={ariaLabel}
      title="QR 코드 스캔"
      bodyClassName="flex flex-col"
    >
      {isOpen ? (
        <PlayerQrScannerModalContent
          successMessage={successMessage}
          onScanned={onScanned}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </AppModal>
  );
};

export default PlayerQrScannerModal;
