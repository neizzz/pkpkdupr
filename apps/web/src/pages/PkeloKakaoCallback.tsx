import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { buildApiUrl } from "@/lib/api";
import PkeloLoginLayout from "@/pages/PkeloLoginLayout";

type KakaoExchangeResponse = { status: "authenticated"; isFirstLogin: boolean };
const kakaoCallbackErrorCodes = [
  "KAKAO_TICKET_MISSING",
  "KAKAO_EXCHANGE_FAILED",
  "KAKAO_RESPONSE_INVALID",
] as const;
type KakaoCallbackErrorCode = (typeof kakaoCallbackErrorCodes)[number];

const isKakaoCallbackErrorCode = (value: string): value is KakaoCallbackErrorCode =>
  kakaoCallbackErrorCodes.includes(value as KakaoCallbackErrorCode);

const PkeloKakaoCallback: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithSession } = useAuth();
  const [errorCode, setErrorCode] = useState<KakaoCallbackErrorCode | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }
    let cancelled = false;

    const exchange = async () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const ticket = fragment.get("ticket");
      window.history.replaceState(null, "", "/login/kakao/callback");

      if (!ticket) {
        throw new Error("KAKAO_TICKET_MISSING");
      }

      const res = await fetch(buildApiUrl("/api/auth/kakao/exchange"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ticket }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<KakaoExchangeResponse>;
      if (!res.ok) {
        throw new Error("KAKAO_EXCHANGE_FAILED");
      }

      if (data.status !== "authenticated") {
        throw new Error("KAKAO_RESPONSE_INVALID");
      }
      await loginWithSession();
      if (!cancelled) navigate("/", { replace: true });
    };

    // React StrictMode 개발 환경의 effect 재실행에서 첫 handoff ticket을
    // 소비한 뒤 cleanup으로 이동을 취소하지 않도록 다음 task에서 시작한다.
    const timer = window.setTimeout(() => {
      if (cancelled || hasStarted.current) return;
      hasStarted.current = true;
      void exchange().catch((caught: unknown) => {
        if (!cancelled) {
          setErrorCode(
            caught instanceof Error && isKakaoCallbackErrorCode(caught.message)
              ? caught.message
              : "KAKAO_EXCHANGE_FAILED",
          );
        }
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loginWithSession, navigate]);

  return (
    <PkeloLoginLayout>
      <section className="text-center text-white" aria-live="polite">
        {errorCode ? (
          <div className="rounded-xl bg-error/15 px-4 py-4">
            <p className="text-sm font-semibold">로그인에 실패했습니다.</p>
            <p className="mt-2 text-xs text-white/80">오류 코드: {errorCode}</p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-pkpk-main-font"
            >
              로그인으로 돌아가기
            </button>
          </div>
        ) : (
          <p className="text-sm font-medium">로그인 중입니다.</p>
        )}
      </section>
    </PkeloLoginLayout>
  );
};

export default PkeloKakaoCallback;
