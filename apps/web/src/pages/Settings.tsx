import React, { useEffect, useState } from "react";
import { Button, useOverlayState } from "@heroui/react";
import {
  IoChevronForward,
  IoLogOutOutline,
  IoTrashOutline,
} from "react-icons/io5";
import type { WithdrawalEligibility } from "@pkpkdupr/shared/player";
import ActionChipButton from "@/components/ActionChipButton";
import AppModal from "@/components/AppModal";
import HoldToConfirmButton from "@/components/HoldToConfirmButton";
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
const withdrawalMatchStatusLabel = {
  created: "결과 입력 전",
  "pending-approval": "결과 승인 대기",
  evaluating: "평가 중",
} as const;

const Settings: React.FC = () => {
  const UPDATE_CHECK_COOLDOWN_MS = 10_000;
  const UPDATE_APPLIED_COOLDOWN_MS = 10 * 60_000;
  const isOnline = useOnlineStatus();
  const { logout, getWithdrawalEligibility, withdrawAccount } = useAuth();
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
  const withdrawalConfirmation = useOverlayState();
  const [withdrawalEligibility, setWithdrawalEligibility] =
    useState<WithdrawalEligibility | null>(null);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [withdrawalText, setWithdrawalText] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
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

  useEffect(() => {
    if (!withdrawalConfirmation.isOpen) {
      setWithdrawalEligibility(null);
      setWithdrawalError(null);
      setWithdrawalText("");
      return;
    }
    let active = true;
    setWithdrawalError(null);
    void getWithdrawalEligibility()
      .then((result) => {
        if (active) setWithdrawalEligibility(result);
      })
      .catch((nextError) => {
        if (active) {
          setWithdrawalError(
            nextError instanceof Error
              ? nextError.message
              : "탈퇴 가능 여부를 확인하지 못했습니다.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [getWithdrawalEligibility, withdrawalConfirmation.isOpen]);

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

          <section className="mt-auto px-4 py-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left text-base font-semibold text-error"
              onClick={withdrawalConfirmation.open}
            >
              <span className="flex items-center gap-2">
                <IoTrashOutline aria-hidden="true" className="size-5" />
                회원 탈퇴
              </span>
              <IoChevronForward aria-hidden="true" className="size-5" />
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
      <AppModal
        state={withdrawalConfirmation}
        ariaLabel="회원 탈퇴 확인"
        title="회원 탈퇴"
        bodyClassName="!h-[220px] !min-h-[220px] !max-h-[220px] shrink-0 overflow-y-auto"
        footer={
          <HoldToConfirmButton
            holdDurationMs={1000}
            ariaLabel="길게 눌러 회원탈퇴"
            isDisabled={
              !withdrawalEligibility?.eligible ||
              !isOnline ||
              withdrawalText !== "탈퇴" ||
              isWithdrawing
            }
            className={`!h-10 !w-[135px] justify-center rounded-xl px-3 py-0 text-sm bg-error font-semibold text-white disabled:opacity-40 ${
              withdrawalEligibility?.eligible ? "visible" : "invisible"
            }`}
            progressClassName="bg-white/20"
            onComplete={() => {
              void (async () => {
                setWithdrawalError(null);
                setIsWithdrawing(true);
                try {
                  await withdrawAccount(withdrawalText);
                } catch (nextError) {
                  setWithdrawalError(
                    nextError instanceof Error
                      ? nextError.message
                      : "회원 탈퇴를 완료하지 못했습니다.",
                  );
                } finally {
                  setIsWithdrawing(false);
                }
              })();
            }}
          >
            {isWithdrawing ? "처리 중..." : "길게 눌러 회원탈퇴"}
          </HoldToConfirmButton>
        }
      >
        <div className="space-y-4 text-sm leading-6 text-pkpk-sub-font">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-pkpk-dark">
              탈퇴 즉시 개인정보와 모든 로그인 세션이 삭제됩니다.
            </p>
            <p className="mt-1">
              완료된 경기와 평점 기록은 ‘탈퇴한 사용자’로 익명화해 보존되며,
              계정은 복구할 수 없습니다.
            </p>
          </div>

          {!withdrawalEligibility && !withdrawalError ? (
            <p>탈퇴 가능 여부를 확인하고 있습니다...</p>
          ) : null}

          {withdrawalEligibility && !withdrawalEligibility.eligible ? (
            <div className="space-y-3">
              <p className="font-semibold text-error">
                아래 항목을 먼저 정리한 뒤 다시 시도해주세요.
              </p>
              {withdrawalEligibility.blockers.ownedClubs.length ? (
                <div>
                  <p className="font-semibold text-pkpk-dark">소유 클럽</p>
                  <ul className="list-disc pl-5">
                    {withdrawalEligibility.blockers.ownedClubs.map((club) => (
                      <li key={club.id}>
                        {club.name} — 소유권을 이전하거나 클럽을 삭제해주세요.
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {withdrawalEligibility.blockers.activeMatches.length ? (
                <div>
                  <p className="font-semibold text-pkpk-dark">진행 중인 경기</p>
                  <ul className="list-disc pl-5">
                    {withdrawalEligibility.blockers.activeMatches.map((match) => (
                      <li key={match.id}>
                        {`${match.name || "이름 없는 경기"} (${withdrawalMatchStatusLabel[match.status]}) — 경기를 완료하거나 삭제해주세요.`}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {withdrawalEligibility.blockers.upcomingSessions.length ? (
                <div>
                  <p className="font-semibold text-pkpk-dark">예정 세션</p>
                  <ul className="list-disc pl-5">
                    {withdrawalEligibility.blockers.upcomingSessions.map((session) => (
                      <li key={session.id}>
                        {`${session.name} (${session.date.toLocaleDateString("ko-KR")}) — 참가 등록을 취소해주세요.`}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {withdrawalEligibility?.eligible ? (
            <label className="block space-y-2 text-lg font-normal text-pkpk-dark">
              <span className="block">
                계속하려면 아래에 <strong className="font-bold">'탈퇴'</strong>를
                입력해주세요.
              </span>
              <input
                type="text"
                value={withdrawalText}
                autoComplete="off"
                disabled={isWithdrawing}
                onChange={(event) => setWithdrawalText(event.target.value)}
                placeholder="탈퇴"
                className="app-mobile-input w-full rounded-2xl border border-border px-4 py-3 !text-xl font-normal outline-none focus:border-error"
                aria-label="탈퇴 확인 문구"
              />
            </label>
          ) : null}

          {withdrawalError ? (
            <p className="rounded-xl bg-error/10 px-3 py-2 text-error" role="alert">
              {withdrawalError}
            </p>
          ) : null}
        </div>
      </AppModal>
    </div>
  );
};

export default Settings;
