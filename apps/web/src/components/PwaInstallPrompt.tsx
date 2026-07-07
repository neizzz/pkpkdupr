import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, CloseButton } from "@heroui/react";
import { IoShareOutline } from "react-icons/io5";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const isStandaloneDisplay = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  window.matchMedia("(display-mode: minimal-ui)").matches ||
  ("standalone" in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));

const isLocalhost = () =>
  ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

const isIosLike = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  (window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1);

const isSafari = () => {
  const userAgent = window.navigator.userAgent;

  return (
    /safari/i.test(userAgent) &&
    !/crios|fxios|edgios|opios|chrome|android/i.test(userAgent)
  );
};

const isIosSafari = () => isIosLike() && isSafari();

type InstallPrompt =
  | {
      kind: "ios-safari";
      title: string;
    }
  | {
      kind: "installable" | "unsupported";
      title: string;
      message: string;
    };

const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const installPrompt = useMemo<InstallPrompt | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    if (window.isSecureContext || isLocalhost()) {
      if (isIosSafari()) {
        return {
          kind: "ios-safari",
          title: "iPhone 홈 화면에 추가",
        };
      }

      return deferredPrompt
        ? {
            kind: "installable",
            title: "앱 설치 안내",
            message: "PkpkDupr를 앱처럼 설치할 수 있어요.",
          }
        : null;
    }

    return {
      kind: "unsupported",
      title: "앱 설치 안내",
      message: "앱 설치는 HTTPS 또는 localhost에서만 가능합니다.",
    };
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

  if (isInstalled || isDismissed || !installPrompt) {
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
        status={installPrompt.kind === "installable" ? "accent" : "warning"}
        className="items-start rounded-2xl border border-[#409eff]/20 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
      >
        <Alert.Indicator className="mt-0.5 shrink-0 self-start" />
        <Alert.Content className="min-w-0 gap-0">
          <Alert.Title className="text-sm font-bold text-amber-950">
            {installPrompt.title}
          </Alert.Title>
          <Alert.Description className="text-xs font-semibold text-[#888]">
            {installPrompt.kind === "ios-safari" ? (
              <>
                Safari 하단 중앙의{" "}
                <span
                  className="inline-flex size-5 translate-y-0.5 items-center justify-center rounded-md border border-border bg-white text-[#409eff]"
                  aria-label="공유하기 버튼"
                  role="img"
                >
                  <IoShareOutline className="size-3.5" />
                </span>{" "}
                버튼을 누른 뒤 ‘홈 화면에 추가’를 선택해주세요.
              </>
            ) : (
              installPrompt.message
            )}
          </Alert.Description>
        </Alert.Content>
        {installPrompt.kind === "installable" && deferredPrompt ? (
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
