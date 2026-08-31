import React, { useState } from "react";
import {
  Alert,
  CloseButton,
  TooltipArrow,
  TooltipContent,
  TooltipRoot,
  TooltipTrigger,
} from "@heroui/react";
import { IoInformationCircleOutline } from "react-icons/io5";
import { useSearchParams } from "react-router-dom";
import { buildApiUrl } from "@/lib/api";
import PkeloLoginLayout from "@/pages/PkeloLoginLayout";

const PkeloLogin: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [persist, setPersist] = useState(false);
  const [isAutoLoginTooltipOpen, setIsAutoLoginTooltipOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [dismissedErrorCode, setDismissedErrorCode] = useState<string | null>(null);
  const errorCode = searchParams.get("error");
  const error =
    errorCode === "kakao_age_restricted"
      ? "PKELO는 만 14세 이상만 가입하고 경기 참여할 수 있습니다."
      : errorCode === "kakao_verified_profile_required"
        ? "카카오 본인확인정보(법정 실명·성별·생년월일) 제공 동의가 필요합니다."
        : errorCode === "kakao_login_failed"
          ? "카카오 로그인을 완료하지 못했습니다. 다시 시도해주세요."
          : errorCode;
  const displayedError =
    startError ?? (errorCode !== dismissedErrorCode ? error : null);

  const startKakaoLogin = async () => {
    if (isStarting) return;
    setIsStarting(true);
    setStartError(null);
    try {
      const response = await fetch(buildApiUrl("/api/auth/kakao/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          persist,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        redirectUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.redirectUrl) {
        throw new Error(data.error || "카카오 로그인을 시작하지 못했습니다.");
      }
      window.location.assign(data.redirectUrl);
    } catch (caught) {
      setStartError(
        caught instanceof Error ? caught.message : "카카오 로그인을 시작하지 못했습니다.",
      );
      setIsStarting(false);
    }
  };

  return (
    <PkeloLoginLayout>
      {displayedError ? (
        <div className="fixed left-1/2 top-0 z-[70] app-shell-width -translate-x-1/2 px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <Alert
            status="danger"
            role="alert"
            className="items-center rounded-2xl border border-error/20 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
          >
            <Alert.Indicator className="shrink-0 self-center text-error" />
            <Alert.Content className="min-w-0 gap-0 self-center">
              <Alert.Title className="text-sm font-bold text-error">
                로그인을 완료하지 못했어요.
              </Alert.Title>
              <Alert.Description className="text-xs font-semibold text-[#888]">
                {displayedError}
              </Alert.Description>
            </Alert.Content>
            <CloseButton
              className="shrink-0 self-center"
              aria-label="로그인 오류 닫기"
              onClick={() => {
                setStartError(null);
                setDismissedErrorCode(errorCode);
              }}
            />
          </Alert>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void startKakaoLogin()}
        disabled={isStarting}
        aria-label="카카오 로그인"
        className="mx-auto block h-[45px] w-[183px] rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FEE500] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <img src="/login-button_kakao.png" alt="" className="h-full w-full" />
      </button>
      <div className="mx-auto mt-8 flex w-[183px] items-center gap-2 text-base font-semibold text-white">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={persist}
            onChange={(event) => setPersist(event.target.checked)}
            className="size-5 shrink-0"
          />
          <span>자동 로그인</span>
        </label>
        <TooltipRoot
          isOpen={isAutoLoginTooltipOpen}
          onOpenChange={setIsAutoLoginTooltipOpen}
          delay={0}
          closeDelay={0}
        >
          <TooltipTrigger<"button">
            type="button"
            aria-label="메인 기기 한 대 제한 안내 보기"
            onClick={() => setIsAutoLoginTooltipOpen((isOpen) => !isOpen)}
            className="shrink-0 text-white/70 transition-colors hover:text-white"
          >
            <IoInformationCircleOutline className="size-5" />
          </TooltipTrigger>
          <TooltipContent
            placement="bottom"
            shouldFlip
            containerPadding={12}
            showArrow
            className="w-64 rounded-2xl bg-white p-3 text-left text-sm font-normal leading-5 text-pkpk-main-font shadow-xl ring-1 ring-black/10"
            style={{ "--overlay": "#fff" } as React.CSSProperties}
          >
            <TooltipArrow />
            자동 로그인은 한 대의 메인 기기에서만 유지됩니다. 다른 기기에서
            설정하면 기존 기기의 자동 로그인이 해제됩니다.
          </TooltipContent>
        </TooltipRoot>
      </div>
    </PkeloLoginLayout>
  );
};

export default PkeloLogin;
