import React from "react";
import { Button } from "@heroui/react";
import { IoRefreshOutline } from "react-icons/io5";
import type { PlayerQrTokenResponse } from "@pkpkdupr/shared/qr";
import QrCode from "react-qr-code";

interface PlayerQrModalContentProps {
  qrToken: PlayerQrTokenResponse | null;
  qrRemainingSeconds: number;
  qrError: string | null;
  isQrLoading: boolean;
  onRefresh: () => void | Promise<void>;
}

const formatRemainingTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const PlayerQrModalContent: React.FC<PlayerQrModalContentProps> = ({
  qrToken,
  qrRemainingSeconds,
  qrError,
  isQrLoading,
  onRefresh,
}) => {
  const canRefresh = !isQrLoading && (!qrToken || qrRemainingSeconds <= 60);
  const refreshButton = canRefresh ? (
    <Button
      type="button"
      isIconOnly
      size="sm"
      aria-label="QR 코드 새로고침"
      onPress={() => {
        if (!canRefresh) return;
        void onRefresh();
      }}
      className="size-8 rounded-full bg-[#409eff] text-white hover:bg-[#2587db]"
    >
      <IoRefreshOutline aria-hidden="true" className="size-4" />
    </Button>
  ) : null;

  return (
    <>
      <p className="w-full text-pkpk-sub-font">
        매치 참가, 소속 참여, 친구 추가에 사용할 수 있어요.
      </p>
      {qrToken ? (
        <>
          <div className="my-5 flex w-full justify-center">
            <QrCode
              value={qrToken.payload}
              size={180}
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <p
              className={`bs-text-title ${
                qrRemainingSeconds > 0 ? "text-pkpk-sub-font" : "text-error"
              }`}
            >
              {qrRemainingSeconds > 0
                ? `남은 시간 ${formatRemainingTime(qrRemainingSeconds)}`
                : "QR 코드가 만료되었습니다."}
            </p>
            {refreshButton}
          </div>
        </>
      ) : (
        <div className="flex min-h-[220px] items-center justify-center">
          <p
            className={`bs-text-body ${isQrLoading ? "text-pkpk-sub-font" : "text-error"}`}
          >
            {isQrLoading ? "QR 코드를 생성 중입니다..." : qrError}
          </p>
        </div>
      )}

      {qrError && qrToken ? (
        <p className="bs-text-caption text-error">{qrError}</p>
      ) : null}

      {!qrToken ? refreshButton : null}
    </>
  );
};

export default PlayerQrModalContent;
