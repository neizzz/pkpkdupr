import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { PRIVACY_POLICY_VERSION } from "@pkpkdupr/shared/privacyPolicy";
import { useAuth } from "@/context/AuthContext";
import { buildApiUrl } from "@/lib/api";
import PkeloLoginLayout from "@/pages/PkeloLoginLayout";

const PrivacyPolicyConsentGate: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { isAuthenticated, isLoading, player, refreshMe, token } = useAuth();
  const [isChecked, setIsChecked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCurrentAccountConsent =
    player?.privacyPolicyConsentVersion === PRIVACY_POLICY_VERSION;
  const needsConsent = isAuthenticated && !hasCurrentAccountConsent;

  const saveAccountConsent = useCallback(async () => {
    if (!token) {
      throw new Error("로그인이 필요합니다.");
    }

    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(
        buildApiUrl("/api/me/privacy-policy-consent"),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        privacyPolicyConsentVersion?: string;
      };
      if (
        !response.ok ||
        data.privacyPolicyConsentVersion !== PRIVACY_POLICY_VERSION
      ) {
        throw new Error(
          data.error || "개인정보 처리방침 동의를 저장하지 못했습니다.",
        );
      }

      await refreshMe();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "개인정보 처리방침 동의를 저장하지 못했습니다.",
      );
      throw caught;
    } finally {
      setIsSaving(false);
    }
  }, [refreshMe, token]);

  const handleAgree = async () => {
    if (!isChecked || isSaving || !isAuthenticated) return;
    await saveAccountConsent().catch(() => undefined);
  };

  if (isLoading || !needsConsent) {
    return <>{children}</>;
  }

  return (
    <PkeloLoginLayout>
      <section className="text-white" aria-labelledby="privacy-consent-title">
        <h2 id="privacy-consent-title" className="text-xl font-bold">
          개인정보 처리방침 동의
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/85">
          PKELO 서비스를 시작하려면 개인정보 처리방침을 확인하고 동의해주세요.
        </p>

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold leading-5">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(event) => setIsChecked(event.target.checked)}
            disabled={isSaving}
            className="mt-0.5 size-4 shrink-0 accent-[#FEE500]"
          />
          <span>
            <Link
              to="/privacy"
              className="underline underline-offset-4"
              onClick={(event) => event.stopPropagation()}
            >
              개인정보 처리방침
            </Link>
            에 동의합니다. (필수)
          </span>
        </label>

        {error ? (
          <p className="mt-3 rounded-xl bg-error/20 px-3 py-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!isChecked || isSaving}
          onClick={() => void handleAgree()}
          className="mt-5 w-full rounded-xl bg-[#FEE500] py-3 text-sm font-bold text-[#191919] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "동의 저장 중..." : "동의하고 시작하기"}
        </button>
      </section>
    </PkeloLoginLayout>
  );
};

export default PrivacyPolicyConsentGate;
