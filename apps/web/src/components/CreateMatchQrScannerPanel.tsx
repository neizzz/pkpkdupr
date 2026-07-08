import React from "react";
import { Button } from "@heroui/react";
import Avatar from "@/components/Avatar";
import type {
  MatchMember,
  QrScannerStatus,
} from "./CreateMatchDrawerBody.utils";
import {
  formatRating,
  getGenderClassName,
  getGenderLabel,
} from "./CreateMatchDrawerBody.utils";

interface CreateMatchQrScannerPanelProps {
  teamGrid: React.ReactNode;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  qrScannerStatus: QrScannerStatus;
  qrScannerError: string | null;
  pendingQrMember: MatchMember | null;
  currentPlayerId?: string;
  onRetry: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

const CreateMatchQrScannerPanel: React.FC<CreateMatchQrScannerPanelProps> = ({
  teamGrid,
  videoRef,
  qrScannerStatus,
  qrScannerError,
  pendingQrMember,
  currentPlayerId,
  onRetry,
  onConfirm,
  onClose,
}) => (
  <div className="mt-6 flex flex-col gap-4">
    <div className="flex flex-col gap-2">
      <p className="bs-text-title text-amber-950">팀 구성</p>
      {teamGrid}
    </div>

    <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border bg-slate-950">
      {qrScannerStatus === "scanning" ? (
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="aspect-square w-full bg-slate-950 object-cover"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.22)]"
          />
          <p className="bs-text-caption absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-black/55 px-3 py-1 font-semibold text-white">
            QR 코드를 스캔 중입니다.
          </p>
        </div>
      ) : null}

      {qrScannerStatus === "verifying" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white px-5 text-center">
          <div className="size-10 animate-spin rounded-full border-[3px] border-[#409eff]/20 border-t-[#409eff]" />
          <p className="bs-text-title text-amber-950">
            QR 코드를 확인 중입니다...
          </p>
        </div>
      ) : null}

      {qrScannerStatus === "confirm" && pendingQrMember ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white px-5 text-center">
          <div className="flex w-full max-w-[180px] min-w-0 flex-col items-center rounded-2xl bg-white/90 px-3 py-4 text-center shadow-sm ring-1 ring-border">
            <Avatar
              size="sm"
              avatarUrl={pendingQrMember.avatarUrl}
              name={pendingQrMember.username}
              isMe={pendingQrMember.id === currentPlayerId}
            />
            <div className="mt-3 min-w-0">
              <p className="truncate font-semibold text-amber-950">
                {pendingQrMember.username}
              </p>
              <p
                className={`mt-1 text-xs font-medium ${getGenderClassName(
                  pendingQrMember.gender,
                )}`}
              >
                {getGenderLabel(pendingQrMember.gender)}
              </p>
              <p className="mt-2 text-sm font-semibold text-amber-950">
                {formatRating(pendingQrMember.duprRating?.total)}
              </p>
            </div>
          </div>
          <div>
            <p className="bs-text-head text-amber-950">
              {pendingQrMember.username}님을 매치 멤버로 추가할까요?
            </p>
            <p className="bs-text-caption mt-2 text-amber-700/70">
              추가하면 현재 매치 멤버 목록에 반영됩니다.
            </p>
          </div>
        </div>
      ) : null}

      {qrScannerStatus === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white px-5 text-center">
          <div className="bs-text-caption rounded-full bg-error/10 px-3 py-1 font-bold text-error">
            스캔 실패
          </div>
          <p className="bs-text-title text-error">{qrScannerError}</p>
        </div>
      ) : null}
    </div>

    <div className="flex gap-2">
      {qrScannerStatus === "confirm" ? (
        <>
          <Button
            className="flex-1 rounded-2xl bg-red-50 font-semibold text-red-500"
            onPress={onRetry}
          >
            취소
          </Button>
          <Button
            className="flex-1 rounded-2xl bg-[#409eff] font-semibold text-white"
            onPress={onConfirm}
          >
            추가
          </Button>
        </>
      ) : null}

      {qrScannerStatus === "error" ? (
        <>
          <Button
            className="flex-1 rounded-2xl bg-slate-100 text-slate-700"
            onPress={onClose}
          >
            닫기
          </Button>
          <Button
            className="flex-1 rounded-2xl bg-[#409eff] font-semibold text-white"
            onPress={onRetry}
          >
            다시 스캔
          </Button>
        </>
      ) : null}

      {qrScannerStatus === "scanning" || qrScannerStatus === "verifying" ? (
        <Button
          className="w-full rounded-2xl bg-[#409eff] font-semibold text-white"
          onPress={onClose}
        >
          완료
        </Button>
      ) : null}
    </div>
  </div>
);

export default CreateMatchQrScannerPanel;
