import React from "react";
import { Button, useOverlayState } from "@heroui/react";
import AppModal from "./AppModal";

interface DraftRestoreModalProps {
  isOpen: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}

const DraftRestoreModal: React.FC<DraftRestoreModalProps> = ({
  isOpen,
  onRestore,
  onDiscard,
}) => {
  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onDiscard();
    },
  });

  return (
    <AppModal
      state={state}
      ariaLabel="임시 저장 복원"
      title="임시 저장된 내용이 있어요"
      footer={
        <div className="flex w-full gap-2">
          <Button
            type="button"
            className="flex-1 bg-slate-100 font-semibold text-pkpk-sub-font"
            onPress={onDiscard}
          >
            새로 작성
          </Button>
          <Button
            type="button"
            className="flex-1 bg-pkpk-primary-bg font-semibold text-white"
            onPress={onRestore}
          >
            이어서 작성
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-6 text-pkpk-sub-font">
        저장된 작성 내용을 불러올까요? 새로 작성하면 기존 임시 저장 내용은 삭제됩니다.
      </p>
    </AppModal>
  );
};

export default DraftRestoreModal;
