import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { buildApiUrl } from "@/lib/api";

type OnboardingState = { registrationTicket?: string };

const PkeloKakaoOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithAccessToken } = useAuth();
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<"M" | "F" | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const registrationTicket = (location.state as OnboardingState | null)?.registrationTicket;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!registrationTicket) {
      setError("가입 정보가 만료되었습니다. 카카오 로그인을 다시 시도해주세요.");
      return;
    }
    if (!gender) {
      setError("성별을 선택해주세요.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(buildApiUrl("/api/auth/kakao/onboarding"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationTicket, username, gender }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        accessToken?: string;
        isFirstLogin?: boolean;
        error?: string;
      };
      if (!res.ok || !data.accessToken) {
        throw new Error(data.error || "가입을 완료하지 못했습니다.");
      }
      await loginWithAccessToken(data.accessToken, data.isFirstLogin);
      navigate("/", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "가입을 완료하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-pkpk-secondary-bg to-pkpk-primary-bg px-4 text-white">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white/10 p-5 shadow-sm">
        <h1 className="text-xl font-bold">PKELO 프로필 만들기</h1>
        <p className="mt-2 text-sm leading-6 text-white/80">
          경기 기록에 표시할 사용자명과 성별을 입력해주세요.
        </p>

        {error && <p className="mt-4 rounded-lg bg-error/20 px-3 py-2 text-sm">{error}</p>}

        <label className="mt-5 block text-sm font-semibold">
          사용자명
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={191}
            required
            autoFocus
            className="app-mobile-input mt-2 w-full rounded-xl border border-transparent bg-white px-4 py-3 text-pkpk-main-font"
          />
        </label>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">성별</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["M", "F"] as const).map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-semibold ${gender === value ? "border-[#FEE500] bg-[#FEE500] text-[#191919]" : "border-white/40"}`}
              >
                <input
                  type="radio"
                  name="gender"
                  value={value}
                  checked={gender === value}
                  onChange={() => setGender(value)}
                  className="sr-only"
                />
                {value === "M" ? "남성" : "여성"}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 w-full rounded-xl bg-[#FEE500] py-3 font-semibold text-[#191919] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "가입 중..." : "가입 완료"}
        </button>
      </form>
    </div>
  );
};

export default PkeloKakaoOnboarding;
