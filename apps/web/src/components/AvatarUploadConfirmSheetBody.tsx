import React from "react";
import BottomSheet from "./BottomSheet";

interface AvatarUploadConfirmSheetBodyProps {
  previewUrl: string;
  name: string;
  isSaving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const AvatarUploadConfirmSheetBody: React.FC<
  AvatarUploadConfirmSheetBodyProps
> = ({ previewUrl, name, isSaving, onConfirm, onCancel }) => (
  <>
    <BottomSheet.Header>
      <h2 className="bs-text-head text-left text-pkpk-main-font">
        프로필 사진 확인
      </h2>
    </BottomSheet.Header>
    <BottomSheet.Body className="items-center text-center">
    <img
      src={previewUrl}
      alt={`${name} 프로필 사진 미리보기`}
      className="size-32 rounded-full object-cover shadow-inner ring-1 ring-border"
    />
    <p className="bs-text-body text-pkpk-sub-font">
      이 사진을 프로필 사진으로 사용할까요?
    </p>
    <BottomSheet.Actions>
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving}
        className="app-action-button app-bottom-sheet-action-secondary rounded-2xl text-base font-semibold"
      >
        취소
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isSaving}
        className="app-action-button app-bottom-sheet-action-primary rounded-2xl text-base font-semibold"
      >
        {isSaving ? "적용 중..." : "적용"}
      </button>
    </BottomSheet.Actions>
    </BottomSheet.Body>
  </>
);

export default AvatarUploadConfirmSheetBody;
