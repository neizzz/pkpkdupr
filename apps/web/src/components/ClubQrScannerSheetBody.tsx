import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { getCameraErrorMessage } from "./CreateMatchDrawerBody.utils";

interface ClubQrScannerSheetBodyProps {
  successMessage: string;
  onScanned: (payload: string) => Promise<void>;
  onClose: () => void;
}

type ClubQrScannerStatus = "scanning" | "verifying" | "success" | "error";

const ClubQrScannerSheetBody: React.FC<ClubQrScannerSheetBodyProps> = ({
  successMessage,
  onScanned,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledRef = useRef(false);
  const [scannerStatus, setScannerStatus] =
    useState<ClubQrScannerStatus>("scanning");
  const [scannerError, setScannerError] = useState<string | null>(null);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const video = videoRef.current;
    if (video?.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((track) => track.stop());
    }
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (scannerStatus !== "scanning") return;

    let cancelled = false;
    const start = async () => {
      const video = videoRef.current;
      if (!video) {
        setScannerStatus("error");
        setScannerError("QR 스캐너 화면을 준비하지 못했어요.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerStatus("error");
        setScannerError("이 브라우저에서는 카메라 스캔을 사용할 수 없어요.");
        return;
      }
      try {
        stopScanner();
        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 500,
        });
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result, _error, activeControls) => {
            if (!result || handledRef.current) return;
            const payload = result.getText().trim();
            if (!payload) return;
            handledRef.current = true;
            activeControls.stop();
            controlsRef.current = null;
            setScannerStatus("verifying");
            setScannerError(null);
            void onScanned(payload)
              .then(() => {
                setScannerStatus("success");
              })
              .catch((error) => {
                handledRef.current = false;
                setScannerStatus("error");
                setScannerError(
                  error instanceof Error
                    ? error.message
                    : "QR을 처리하지 못했어요.",
                );
              });
          },
        );
        if (cancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
        }
      } catch (error) {
        if (!cancelled) {
          setScannerStatus("error");
          setScannerError(getCameraErrorMessage(error));
        }
      }
    };
    void start();
    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [onScanned, scannerStatus, stopScanner]);

  const retryScan = () => {
    stopScanner();
    handledRef.current = false;
    setScannerError(null);
    setScannerStatus("scanning");
  };

  const closeScanner = () => {
    stopScanner();
    onClose();
  };

  return (
    <div className="mt-6 flex flex-col gap-4 px-3 pb-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border bg-slate-950">
        {scannerStatus === "scanning" ? (
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

        {scannerStatus === "verifying" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white px-5 text-center">
            <div className="size-10 animate-spin rounded-full border-[3px] border-[#409eff]/20 border-t-[#409eff]" />
            <p className="bs-text-title text-pkpk-sub-font">
              QR 코드를 확인 중입니다...
            </p>
          </div>
        ) : null}

        {scannerStatus === "success" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white px-5 text-center">
            <div className="bs-text-caption rounded-full bg-[#409eff]/10 px-3 py-1 font-bold text-[#409eff]">
              처리 완료
            </div>
            <p className="bs-text-title text-pkpk-main-font">
              {successMessage}
            </p>
          </div>
        ) : null}

        {scannerStatus === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white px-5 text-center">
            <div className="bs-text-caption rounded-full bg-error/10 px-3 py-1 font-bold text-error">
              스캔 실패
            </div>
            <p className="bs-text-title text-error">{scannerError}</p>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        {scannerStatus === "error" ? (
          <>
            <Button
              className="app-action-button flex-1 rounded-2xl bg-slate-100 text-slate-700"
              onPress={closeScanner}
            >
              닫기
            </Button>
            <Button
              className="app-action-button flex-1 rounded-2xl bg-[#409eff] font-semibold text-white"
              onPress={retryScan}
            >
              다시 스캔
            </Button>
          </>
        ) : null}

        {scannerStatus === "scanning" || scannerStatus === "verifying" ? (
          <Button
            className="app-action-button w-full rounded-2xl bg-[#409eff] font-semibold text-white"
            onPress={closeScanner}
          >
            완료
          </Button>
        ) : null}

        {scannerStatus === "success" ? (
          <Button
            className="app-action-button w-full rounded-2xl bg-[#409eff] font-semibold text-white"
            onPress={closeScanner}
          >
            닫기
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default ClubQrScannerSheetBody;
