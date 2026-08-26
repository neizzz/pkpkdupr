import React, { useEffect, useState } from "react";
import { Button, useOverlayState } from "@heroui/react";
import { IoChevronForward, IoLogOutOutline } from "react-icons/io5";
import ActionChipButton from "@/components/ActionChipButton";
import AppModal from "@/components/AppModal";
import OperatingPolicyDrawer from "@/components/OperatingPolicyDrawer";
import TabPanelHeader from "@/components/TabPanelHeader";
import {
  APP_UPDATE_APPLIED_AT_STORAGE_KEY,
  useAppUpdate,
} from "@/context/AppUpdateContext";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const OPERATING_POLICY_DEPTH_ID = "operating-policy";
const noop = () => {};

const Settings: React.FC = () => {
  const UPDATE_CHECK_COOLDOWN_MS = 10_000;
  const UPDATE_APPLIED_COOLDOWN_MS = 10 * 60_000;
  const isOnline = useOnlineStatus();
  const { logout } = useAuth();
  const {
    selectedTab,
    depthStacks,
    pushDepth,
    closeDepth,
    saveScrollPosition,
    restoreScrollTop,
  } = useTabNavigation();
  const {
    appVersion,
    isUpdateAvailable,
    isCheckingForUpdate,
    isApplyingUpdate,
    checkForUpdate,
    applyUpdate,
  } = useAppUpdate();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextUpdateCheckAt, setNextUpdateCheckAt] = useState<number | null>(
    () => {
      if (typeof window === "undefined") return null;

      const appliedAt = Number(
        window.sessionStorage.getItem(APP_UPDATE_APPLIED_AT_STORAGE_KEY),
      );
      if (!Number.isFinite(appliedAt)) return null;

      const cooldownEndsAt = appliedAt + UPDATE_APPLIED_COOLDOWN_MS;
      return cooldownEndsAt > Date.now() ? cooldownEndsAt : null;
    },
  );
  const [isPostUpdateCooldown, setIsPostUpdateCooldown] = useState(
    nextUpdateCheckAt !== null,
  );
  const logoutConfirmation = useOverlayState();
  const isOperatingPolicyDrawerOpen = depthStacks.settings.includes(
    OPERATING_POLICY_DEPTH_ID,
  );

  const openOperatingPolicyDrawer = () => {
    saveScrollPosition("settings");
    pushDepth("settings", {
      id: OPERATING_POLICY_DEPTH_ID,
      kind: "modal",
      onClose: noop,
    });
  };

  const closeOperatingPolicyDrawer = () => {
    if (!closeDepth("settings", OPERATING_POLICY_DEPTH_ID)) {
      restoreScrollTop("settings");
    }
  };

  useEffect(() => {
    if (!nextUpdateCheckAt) return;

    const remainingMs = nextUpdateCheckAt - Date.now();
    if (remainingMs <= 0) {
      setNextUpdateCheckAt(null);
      if (isPostUpdateCooldown) {
        window.sessionStorage.removeItem(APP_UPDATE_APPLIED_AT_STORAGE_KEY);
        setIsPostUpdateCooldown(false);
      }
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNextUpdateCheckAt(null);
      if (isPostUpdateCooldown) {
        window.sessionStorage.removeItem(APP_UPDATE_APPLIED_AT_STORAGE_KEY);
        setIsPostUpdateCooldown(false);
      }
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [isPostUpdateCooldown, nextUpdateCheckAt]);

  const handleUpdateAction = async () => {
    setMessage(null);
    setError(null);

    try {
      if (isUpdateAvailable) {
        await applyUpdate();
        return;
      }

      setNextUpdateCheckAt(Date.now() + UPDATE_CHECK_COOLDOWN_MS);
      setIsPostUpdateCooldown(false);
      const result = await checkForUpdate();
      setMessage(
        result === "update-available"
          ? "새 버전이 있어요. 업데이트 버튼을 눌러 적용하세요."
          : "최신 버전입니다. 10초 후 다시 확인할 수 있어요.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "업데이트 처리에 실패했습니다.",
      );
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <TabPanelHeader title="Settings">
        <button
          type="button"
          className="flex h-9 items-center gap-1 px-1 text-sm font-semibold text-pkpk-primary-font transition-colors hover:text-pkpk-accent-font"
          onClick={logoutConfirmation.open}
        >
          <IoLogOutOutline aria-hidden="true" className="size-4" />
          로그아웃
        </button>
      </TabPanelHeader>
      <div className="tab-panel-header-content flex min-h-0 flex-1 flex-col bg-white">
        <div className="relative z-30 mx-auto flex min-h-full w-full flex-1 flex-col">
          {!isOnline ? (
            <section className="border-b-[6px] border-pkpk-section-border px-4 py-4">
              <div className="rounded-2xl bg-amber-50 px-3 py-2 text-base leading-5 text-pkpk-sub-font">
                오프라인에서는 업데이트 확인이 제한됩니다.
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-4 border-b-[6px] border-pkpk-section-border px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg leading-5 font-semibold text-pkpk-sub-font">
                  앱 버전
                </h3>
                <p className="mt-1 text-sm font-semibold text-[#666]">
                  {appVersion}
                </p>
              </div>
              <ActionChipButton
                disabled={
                  !isOnline ||
                  isCheckingForUpdate ||
                  isApplyingUpdate ||
                  (nextUpdateCheckAt !== null && !isUpdateAvailable)
                }
                onClick={() => void handleUpdateAction()}
              >
                {isApplyingUpdate
                  ? "업데이트 중..."
                  : isCheckingForUpdate
                    ? "확인 중..."
                    : isUpdateAvailable
                      ? "업데이트"
                      : isPostUpdateCooldown
                        ? "업데이트됨"
                        : "업데이트 확인"}
              </ActionChipButton>
            </div>

            {(message || error || isPostUpdateCooldown) && (
              <p
                className={`text-sm leading-5 ${
                  error ? "text-error" : "text-pkpk-sub-font"
                }`}
              >
                {error ??
                  (isPostUpdateCooldown
                    ? "업데이트되었습니다. 10분 후 다시 확인할 수 있어요."
                    : message)}
              </p>
            )}
          </section>

          <section className="border-b-[6px] border-pkpk-section-border px-4 py-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left text-base font-semibold text-pkpk-sub-font"
              onClick={openOperatingPolicyDrawer}
            >
              운영방침
              <IoChevronForward
                aria-hidden="true"
                className="size-5 text-pkpk-detail-font"
              />
            </button>
          </section>

        </div>
      </div>
      <OperatingPolicyDrawer
        isOpen={isOperatingPolicyDrawerOpen}
        isActive={selectedTab === "settings"}
        onClose={closeOperatingPolicyDrawer}
        onExited={() => restoreScrollTop("settings")}
      />
      <AppModal
        state={logoutConfirmation}
        ariaLabel="로그아웃 확인"
        title="로그아웃할까요?"
        footer={
          <Button
            type="button"
            className="bg-[#f8626c] text-white hover:bg-[#e9545e]"
            onPress={async () => {
              logoutConfirmation.close();
              await logout();
            }}
          >
            로그아웃
          </Button>
        }
      >
        <p>현재 기기에서 로그아웃됩니다.</p>
      </AppModal>
    </div>
  );
};

export default Settings;
