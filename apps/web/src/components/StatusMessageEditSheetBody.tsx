import React, { useState } from "react";
import { PLAYER_STATUS_MESSAGE_MAX_LENGTH } from "@pkpkdupr/shared/player";
import type { PlayerInfo } from "@/context/AuthContext";
import { getStatusMessageColors } from "@/utils/statusMessage";
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
    <div className="flex max-h-[75vh] flex-col gap-5 overflow-y-auto pb-2">
      <h2 className="bs-text-head text-left text-pkpk-main-font">
        상태메시지 수정
      </h2>

      <BottomSheetSection>
        <label className="flex flex-col gap-2">
          <span className="bs-text-title text-pkpk-sub-font">상태메시지</span>
          <input
            value={statusMessage}
            onChange={(event) => setStatusMessage(event.target.value)}
            maxLength={PLAYER_STATUS_MESSAGE_MAX_LENGTH}
            placeholder="상태메시지를 입력해 주세요"
            className="app-mobile-input rounded-2xl border border-border bg-white px-4 py-2 text-base text-pkpk-sub-font outline-none"
          />
          <span className="text-right text-xs font-normal text-pkpk-detail-font">
            {Array.from(statusMessage).length}/
            {PLAYER_STATUS_MESSAGE_MAX_LENGTH}
          </span>
        </label>
      </BottomSheetSection>

      <BottomSheetSection>
        <span className="bs-text-title text-pkpk-sub-font">
          상태메시지 배경색
        </span>
        <div
          role="radiogroup"
          aria-label="상태메시지 배경색"
          className="grid justify-between gap-y-3"
          style={{ gridTemplateColumns: "repeat(4, 3.75rem)" }}
        >
          {STATUS_BACKGROUND_COLOR_OPTIONS.map((option) => {
            const isSelected = backgroundColor === option.color;
            return (
              <button
                key={option.color}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={option.label + " 배경색"}
                onClick={() => setBackgroundColor(option.color)}
                className={
                  "h-10 w-[3.75rem] rounded-xl transition-shadow " +
                  (isSelected
                    ? "ring-2 ring-pkpk-primary-bg ring-offset-2"
                    : "ring-1 ring-black/20")
                }
                style={{
                  backgroundColor: getStatusMessageColors(option.color)
                    .backgroundColor,
                }}
              />
            );
          })}
        </div>
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
    </div>
  );
};

export default StatusMessageEditSheetBody;
