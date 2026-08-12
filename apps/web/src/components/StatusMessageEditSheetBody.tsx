import React, { useState } from "react";
import { ColorSwatchPicker, parseColor } from "@heroui/react";
import { PLAYER_STATUS_MESSAGE_MAX_LENGTH } from "@pkpkdupr/shared/player";
import type { PlayerInfo } from "@/context/AuthContext";
import { getStatusMessageColors } from "@/utils/statusMessage";
import BottomSheet from "./BottomSheet";
import BottomSheetSection from "./BottomSheetSection";

interface StatusMessageEditSheetBodyProps {
  player: PlayerInfo | null;
  isSaving: boolean;
  onSave: (input: {
    statusMessage: string | null;
    statusMessageBackgroundColor: string | null;
  }) => Promise<void>;
}

const DEFAULT_STATUS_BACKGROUND_COLOR = "#64748B";
const STATUS_BACKGROUND_COLOR_OPTIONS = [
  { color: "#64748B", label: "슬레이트" },
  { color: "#3B82F6", label: "블루" },
  { color: "#14B8A6", label: "민트" },
  { color: "#22C55E", label: "그린" },
  { color: "#F59E0B", label: "옐로" },
  { color: "#F97316", label: "오렌지" },
  { color: "#EC4899", label: "핑크" },
  { color: "#A855F7", label: "퍼플" },
] as const;

const StatusMessageEditSheetBody: React.FC<StatusMessageEditSheetBodyProps> = ({
  player,
  isSaving,
  onSave,
}) => {
  const [statusMessage, setStatusMessage] = useState(
    player?.statusMessage ?? "",
  );
  const [backgroundColor, setBackgroundColor] = useState(
    player?.statusMessageBackgroundColor?.toUpperCase() ??
      DEFAULT_STATUS_BACKGROUND_COLOR,
  );
  const [error, setError] = useState<string | null>(null);
  const hasStatusMessage = Boolean(statusMessage.trim());

  const save = async () => {
    const trimmedStatusMessage = statusMessage.trim();
    if (
      Array.from(trimmedStatusMessage).length > PLAYER_STATUS_MESSAGE_MAX_LENGTH
    ) {
      setError(
        `상태메시지는 ${PLAYER_STATUS_MESSAGE_MAX_LENGTH}자 이하여야 합니다.`,
      );
      return;
    }

    setError(null);
    try {
      await onSave({
        statusMessage: trimmedStatusMessage || null,
        statusMessageBackgroundColor: trimmedStatusMessage
          ? backgroundColor
          : null,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "프로필 저장에 실패했습니다.",
      );
    }
  };

  return (
    <>
      <BottomSheet.Header>
        <h2 className="bs-text-head text-left text-pkpk-main-font">
          상태메시지 수정
        </h2>
      </BottomSheet.Header>
      <BottomSheet.Body>

      <BottomSheetSection>
        <span className="bs-text-title text-pkpk-sub-font">미리보기</span>
        <div className="flex h-8 items-start">
          {hasStatusMessage ? (
            <p
              className="flex h-8 min-w-0 max-w-full items-center truncate rounded-lg px-1.5 py-1 text-[clamp(0.875rem,3.75cqw,1rem)] leading-tight"
              style={getStatusMessageColors(backgroundColor)}
            >
              {statusMessage.trim()}
            </p>
          ) : (
            <div className="flex h-8 items-center rounded-lg border border-dashed border-pkpk-detail-font/70 px-1.5 py-1">
              <p className="text-[clamp(0.875rem,3.75cqw,1rem)] leading-tight text-pkpk-detail-font">
                표시할 상태메시지가 없습니다.
              </p>
            </div>
          )}
        </div>
      </BottomSheetSection>

      <BottomSheetSection>
        <span className="bs-text-title text-pkpk-sub-font">
          상태메시지 배경색
        </span>
        <ColorSwatchPicker
          aria-label="상태메시지 배경색"
          className="w-full !flex-nowrap !justify-between !gap-1"
          value={parseColor(backgroundColor)}
          onChange={(color) => setBackgroundColor(color.toString("hex"))}
        >
          {STATUS_BACKGROUND_COLOR_OPTIONS.map((option) => (
            <ColorSwatchPicker.Item
              key={option.color}
              color={option.color}
              aria-label={`${option.label} 배경색`}
            >
              <ColorSwatchPicker.Swatch
                style={{
                  backgroundColor: getStatusMessageColors(option.color, 0.4)
                    .backgroundColor,
                }}
              />
              <ColorSwatchPicker.Indicator />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
      </BottomSheetSection>

      <BottomSheetSection>
        <label className="flex flex-col gap-2">
          <span className="bs-text-title text-pkpk-sub-font">상태메시지</span>
          <input
            value={statusMessage}
            onChange={(event) => setStatusMessage(event.target.value)}
            maxLength={PLAYER_STATUS_MESSAGE_MAX_LENGTH}
            placeholder="상태메시지를 입력해 주세요"
            className="app-mobile-input w-full rounded-2xl border border-border bg-white px-4 py-2 text-base text-pkpk-sub-font outline-none"
          />
          <span className="text-right text-xs font-normal text-pkpk-detail-font">
            {Array.from(statusMessage).length}/
            {PLAYER_STATUS_MESSAGE_MAX_LENGTH}
          </span>
        </label>
      </BottomSheetSection>

      {error ? (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={isSaving}
        onClick={() => void save()}
        className="app-action-button rounded-2xl bg-pkpk-primary-bg text-base font-semibold text-white disabled:opacity-50"
      >
        {isSaving ? "저장 중..." : "저장"}
      </button>
      </BottomSheet.Body>
    </>
  );
};

export default StatusMessageEditSheetBody;
