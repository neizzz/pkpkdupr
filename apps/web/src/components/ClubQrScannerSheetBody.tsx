import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { getCameraErrorMessage } from "./CreateMatchDrawerBody.utils";

interface ClubQrScannerSheetBodyProps {
  title: string;
  description: string;
  onScanned: (payload: string) => Promise<void>;
  onClose: () => void;
}

const ClubQrScannerSheetBody: React.FC<ClubQrScannerSheetBodyProps> = ({
  title,
  description,
  onScanned,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledRef = useRef(false);
  const [message, setMessage] = useState(description);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    let cancelled = false;
    const start = async () => {
      const video = videoRef.current;
      if (!video) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("이 브라우저에서는 카메라 스캔을 사용할 수 없어요.");
        return;
      }
      try {
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
            setIsSubmitting(true);
            setMessage("QR을 확인하고 있어요...");
            void onScanned(payload)
              .then(() => {
                setMessage("완료됐어요.");
              })
              .catch((error) => {
                handledRef.current = false;
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "QR을 처리하지 못했어요.",
                );
              })
              .finally(() => setIsSubmitting(false));
          },
        );
        if (cancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
        }
      } catch (error) {
        if (!cancelled) setMessage(getCameraErrorMessage(error));
      }
    };
    void start();
    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [onScanned, stopScanner]);

  return (
    <div className="flex flex-col gap-4 px-5 pb-6 pt-6">
      <div>
        <h2 className="text-xl font-bold text-pkpk-main-font">{title}</h2>
        <p className="mt-1 text-sm text-pkpk-sub-font">{description}</p>
      </div>
      <div className="overflow-hidden rounded-2xl bg-pkpk-dark">
        <video
          ref={videoRef}
          className="aspect-square w-full object-cover"
          muted
          playsInline
        />
      </div>
      <p className="min-h-5 text-center text-sm font-medium text-pkpk-sub-font">
        {message}
      </p>
      <Button
        className="app-action-button rounded-2xl bg-slate-100 font-semibold text-slate-700"
        isDisabled={isSubmitting}
        onPress={() => {
          stopScanner();
          onClose();
        }}
      >
        닫기
      </Button>
    </div>
  );
};

export default ClubQrScannerSheetBody;
