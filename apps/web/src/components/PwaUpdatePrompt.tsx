import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, CloseButton } from "@heroui/react";
import { useLocation } from "react-router-dom";
import { useAppUpdate } from "@/context/AppUpdateContext";
import { useAuth } from "@/context/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const isStandaloneDisplay = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  window.matchMedia("(display-mode: minimal-ui)").matches ||
  ("standalone" in window.navigator &&
    Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone,
    ));

const PwaUpdatePrompt: React.FC = () => {
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { isAuthenticated, isLoading, requiresPasswordChange } = useAuth();
  const {
    isUpdateAvailable,
    isCheckingForUpdate,
    isApplyingUpdate,
    checkForUpdate,
    applyUpdate,
  } = useAppUpdate();
  const hasAutoCheckedRef = useRef(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFullWidthDevPage =
    import.meta.env.DEV && location.pathname === "/dev/qrs";
  const isForcedPasswordChangePage =
    location.pathname === "/force-change-password";
  const isStandalone =
    typeof window !== "undefined" ? isStandaloneDisplay() : false;

  useEffect(() => {
    if (
      hasAutoCheckedRef.current ||
      !isStandalone ||
      isLoading ||
      !isAuthenticated ||
      requiresPasswordChange ||
      isFullWidthDevPage ||
      isForcedPasswordChangePage ||
      !isOnline
    ) {
      return;
    }

    hasAutoCheckedRef.current = true;

    void checkForUpdate().catch((err) => {
      console.error("Failed to auto-check app update", err);
    });
  }, [
    checkForUpdate,
    isAuthenticated,
    isForcedPasswordChangePage,
    isFullWidthDevPage,
    isLoading,
    isOnline,
    isStandalone,
    requiresPasswordChange,
  ]);

  if (
    !isStandalone ||
    isLoading ||
    !isAuthenticated ||
    requiresPasswordChange ||
    isFullWidthDevPage ||
    isForcedPasswordChangePage ||
    !isUpdateAvailable ||
    isDismissed
  ) {
    return null;
  }

  const handleApplyUpdate = async () => {
    setError(null);

    try {
      await applyUpdate();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "업데이트 적용에 실패했습니다.",
      );
    }
  };

  return (
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom)+var(--app-keyboard-offset))] left-1/2 z-30 app-shell-width -translate-x-1/2 px-3">
      <Alert
        status="accent"
        className="items-center rounded-2xl border border-pkpk-primary-bg/20 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
      >
        <Alert.Indicator className="shrink-0 self-center" />
        <Alert.Content className="min-w-0 gap-0 self-center">
          <Alert.Title className="text-sm font-bold text-pkpk-sub-font">
            새 버전이 있어요.
          </Alert.Title>
          <Alert.Description className="text-xs font-semibold text-[#888]">
            {error ?? "업데이트 후 다시 불러올게요."}
          </Alert.Description>
        </Alert.Content>
        <Button
          size="sm"
          className="shrink-0 rounded-full bg-pkpk-primary-bg px-3 text-white"
          isDisabled={isCheckingForUpdate || isApplyingUpdate}
          onPress={() => void handleApplyUpdate()}
        >
          {isApplyingUpdate ? "업데이트 중..." : "업데이트"}
        </Button>
        <CloseButton
          className="shrink-0 self-center"
          aria-label="업데이트 안내 닫기"
          onClick={() => setIsDismissed(true)}
        />
      </Alert>
    </div>
  );
};

export default PwaUpdatePrompt;
