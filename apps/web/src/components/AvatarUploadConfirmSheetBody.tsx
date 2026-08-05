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
  <BottomSheet.Body className="items-center text-center">
    <h2 className="bs-text-head self-stretch text-left text-pkpk-main-font">
      프로필 사진 확인
    </h2>
    <img
      src={previewUrl}
      alt={`${name} 프로필 사진 미리보기`}
      className="size-32 rounded-full object-cover shadow-inner ring-1 ring-border"
    />
    <p className="bs-text-body text-pkpk-sub-font">
      이 사진을 프로필 사진으로 사용할까요?
    </p>
    <div className="grid w-full grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving}
        className="app-action-button rounded-2xl bg-slate-100 text-base font-semibold text-pkpk-sub-font disabled:opacity-50"
      >
        취소
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isSaving}
        className="app-action-button rounded-2xl bg-pkpk-primary-bg text-base font-semibold text-white disabled:opacity-50"
      >
        {isSaving ? "적용 중..." : "적용"}
      </button>
    </div>
  </BottomSheet.Body>
);

export default AvatarUploadConfirmSheetBody;
