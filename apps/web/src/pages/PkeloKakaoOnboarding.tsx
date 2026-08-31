import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { buildApiUrl } from "@/lib/api";
import PkeloLoginLayout from "@/pages/PkeloLoginLayout";

type OnboardingState = { registrationTicket?: string };

const PkeloKakaoOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithSession } = useAuth();
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<"M" | "F" | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const registrationTicket = (location.state as OnboardingState | null)?.registrationTicket;
  const normalizedUsername = username.trim();
  const isFormValid = normalizedUsername.length >= 2 && gender !== "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!registrationTicket) {
      setError("가입 정보가 만료되었습니다. 카카오 로그인을 다시 시도해주세요.");
      return;
    }
    if (!isFormValid) {
      setError("2자 이상의 이름과 성별을 모두 입력해주세요.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(buildApiUrl("/api/auth/kakao/onboarding"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ registrationTicket, username: normalizedUsername, gender }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "PKELO 프로필을 만들지 못했습니다.");
      }

      await loginWithSession();
      navigate("/", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "PKELO 프로필을 만들지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PkeloLoginLayout variant="consent">
      <form onSubmit={submit} className="text-white" aria-labelledby="pkelo-profile-title">
        <h2 id="pkelo-profile-title" className="text-xl font-bold">PKELO 프로필 만들기</h2>
        <p className="mt-3 text-sm leading-6 text-white/85">
          경기 기록과 플레이어 식별에 사용할 정보를 입력해주세요.
        </p>

        {error ? (
          <p className="mt-4 rounded-xl bg-error/20 px-3 py-2 text-sm" role="alert">{error}</p>
        ) : null}

        <label className="mt-5 block text-sm font-semibold">
          이름 <span className="text-pkpk-accent-font">(2자 이상 필수)</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={2}
            maxLength={191}
            required
            autoFocus
            className="app-mobile-input mt-2 w-full rounded-xl border border-transparent bg-white px-4 py-3 text-pkpk-main-font"
          />
        </label>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">성별 <span className="text-pkpk-accent-font">(필수)</span></legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["M", "F"] as const).map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-semibold ${gender === value ? "border-pkpk-accent-font bg-pkpk-accent-font text-[#191919]" : "border-white/40"}`}
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
          disabled={!isFormValid || isSubmitting}
          className="mt-6 w-full rounded-xl bg-pkpk-accent-font py-3 text-sm font-bold text-[#191919] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "프로필 만드는 중..." : "프로필 만들기"}
        </button>
      </form>
    </PkeloLoginLayout>
  );
};

export default PkeloKakaoOnboarding;
