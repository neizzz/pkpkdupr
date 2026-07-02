import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, CloseButton } from "@heroui/react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const isStandaloneDisplay = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  ("standalone" in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));

const isLocalhost = () =>
  ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

const isIosLike = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  (window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1);

const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const installMessage = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    if (window.isSecureContext || isLocalhost()) {
      if (isIosLike()) {
        return "iPhone/iPad에서는 공유 버튼에서 ‘홈 화면에 추가’를 선택해주세요.";
      }
      return deferredPrompt ? "PkpkDupr를 앱처럼 설치할 수 있어요." : null;
    }

    return "앱 설치는 HTTPS 또는 localhost에서만 가능합니다.";
  }, [deferredPrompt]);

  useEffect(() => {
    setIsInstalled(isStandaloneDisplay());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsDismissed(false);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (isInstalled || isDismissed || !installMessage) {
    return null;
  }

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (choice.outcome !== "accepted") {
      setIsDismissed(true);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[430px] px-3">
      <Alert
        status={deferredPrompt ? "accent" : "warning"}
        className="items-start rounded-2xl border border-[#409eff]/20 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
      >
        <Alert.Indicator className="mt-0.5 shrink-0 self-start" />
        <Alert.Content className="min-w-0 gap-0">
          <Alert.Title className="text-sm font-bold text-amber-950">
            앱 설치 안내
          </Alert.Title>
          <Alert.Description className="text-xs font-semibold text-[#888]">
            {installMessage}
          </Alert.Description>
        </Alert.Content>
        {deferredPrompt ? (
          <Button
            size="sm"
            className="shrink-0 rounded-full bg-[#409eff] px-3 text-white"
            onPress={() => void handleInstall()}
          >
            앱 설치
          </Button>
        ) : null}
        <CloseButton
          className="shrink-0 self-start"
          aria-label="설치 안내 닫기"
          onClick={() => setIsDismissed(true)}
        />
      </Alert>
    </div>
  );
};

export default PwaInstallPrompt;
