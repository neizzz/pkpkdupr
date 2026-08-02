import React from "react";
import { useSearchParams } from "react-router-dom";
import { buildPublicAuthUrl } from "@/lib/api";

const PkeloLogin: React.FC = () => {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-pkpk-secondary-bg to-pkpk-primary-bg px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(var(--safe-bottom)+var(--app-keyboard-offset)+1.5rem)]">
      <div className="w-full max-w-sm self-center py-4">
        <header className="mb-8 text-center text-white">
          <img
            src="/pkelo-login-brand.png"
            alt="PKELO 피클볼 로고"
            className="mx-auto mb-0 h-auto w-28"
          />
          <h1 className="text-[1.2rem] font-extrabold tracking-tight">PKELO</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-white/85">
            기록하고, 교류하고, 성장하는 피클볼 라이프
          </p>
        </header>

        {error && (
          <div className="mb-4 w-full rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <a
          href={buildPublicAuthUrl("/auth/kakao/login")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-3 font-semibold text-[#191919] shadow-sm transition-colors hover:bg-[#f5dc00]"
        >
          <span aria-hidden="true" className="text-lg font-black leading-none">
            K
          </span>
          카카오로 계속하기
        </a>
        <p className="mt-4 text-center text-xs leading-5 text-white/75">
          카카오 계정으로만 로그인할 수 있습니다.
        </p>
      </div>
    </div>
  );
};

export default PkeloLogin;
