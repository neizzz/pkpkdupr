import React from "react";
import { Button } from "@heroui/react";
import type { PlayerQrTokenResponse } from "@pkpkdupr/shared/qr";
import QrCode from "react-qr-code";

interface PlayerQrSheetBodyProps {
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

const PlayerQrSheetBody: React.FC<PlayerQrSheetBodyProps> = ({
  qrToken,
  qrRemainingSeconds,
  qrError,
  isQrLoading,
  onRefresh,
}) => {
  const canRefresh = !isQrLoading && (!qrToken || qrRemainingSeconds <= 60);

  return (
    <div className="flex flex-col items-center justify-center gap-4 pb-6 pt-6 text-center">
      {qrToken ? (
        <>
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-border">
            <QrCode
              value={qrToken.payload}
              size={180}
              bgColor="#ffffff"
              fgColor="#a16207"
            />
          </div>
          <p
            className={`bs-text-title ${
              qrRemainingSeconds > 0 ? "text-amber-800" : "text-error"
            }`}
          >
            {qrRemainingSeconds > 0
              ? `남은 시간 ${formatRemainingTime(qrRemainingSeconds)}`
              : "QR 코드가 만료되었습니다."}
          </p>
        </>
      ) : (
        <div className="flex min-h-[220px] items-center justify-center">
          <p
            className={`bs-text-body ${isQrLoading ? "text-amber-700/70" : "text-error"}`}
          >
            {isQrLoading ? "QR 코드를 생성 중입니다..." : qrError}
          </p>
        </div>
      )}

      {qrError && qrToken ? (
        <p className="bs-text-caption text-error">{qrError}</p>
      ) : null}

      {canRefresh && (
        <Button
          size="sm"
          onPress={() => {
            if (!canRefresh) return;
            void onRefresh();
          }}
          isDisabled={!canRefresh}
          className="rounded-full bg-[#409eff] px-4 text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isQrLoading ? "갱신 중..." : "새로고침"}
        </Button>
      )}
    </div>
  );
};

export default PlayerQrSheetBody;
