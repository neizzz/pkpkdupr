import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { buildApiUrl } from "@/lib/api";

type KakaoExchangeResponse =
  | { status: "authenticated"; accessToken: string; isFirstLogin: boolean }
  | { status: "onboarding"; registrationTicket: string };

const PkeloKakaoCallback: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithAccessToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;
    let cancelled = false;

    const exchange = async () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const ticket = fragment.get("ticket");
      window.history.replaceState(null, "", "/login/kakao/callback");

      if (!ticket) {
        throw new Error("Kakao 로그인 ticket이 없습니다. 다시 시도해주세요.");
      }

      const res = await fetch(buildApiUrl("/api/auth/kakao/exchange"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<KakaoExchangeResponse> & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Kakao 로그인 처리가 실패했습니다.");
      }

      if (data.status === "authenticated" && typeof data.accessToken === "string") {
        await loginWithAccessToken(data.accessToken, data.isFirstLogin);
        if (!cancelled) navigate("/", { replace: true });
        return;
      }
      if (data.status === "onboarding" && typeof data.registrationTicket === "string") {
        if (!cancelled) {
          navigate("/login/kakao/onboarding", {
            replace: true,
            state: { registrationTicket: data.registrationTicket },
          });
        }
        return;
      }
      throw new Error("Kakao 로그인 응답이 올바르지 않습니다.");
    };

    void exchange().catch((caught: unknown) => {
      if (!cancelled) {
        setError(
          caught instanceof Error ? caught.message : "Kakao 로그인 처리가 실패했습니다.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loginWithAccessToken, navigate]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-pkpk-primary-bg px-4 text-center text-white">
      {error ? (
        <div className="w-full max-w-sm rounded-xl bg-error/15 px-4 py-4">
          <p className="text-sm">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/login", { replace: true })}
            className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-pkpk-main-font"
          >
            로그인으로 돌아가기
          </button>
        </div>
      ) : (
        <p className="text-sm font-medium">카카오 로그인 정보를 확인하고 있습니다.</p>
      )}
    </div>
  );
};

export default PkeloKakaoCallback;
