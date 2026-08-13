import React from "react";
import { useSearchParams } from "react-router-dom";
import { buildPublicAuthUrl } from "@/lib/api";
import PkeloLoginLayout from "@/pages/PkeloLoginLayout";

const PkeloLogin: React.FC = () => {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  return (
    <PkeloLoginLayout>
      {error && (
        <div className="mb-4 w-full rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <a
        href={buildPublicAuthUrl("/auth/kakao/login")}
        aria-label="카카오 로그인"
        className="mx-auto block h-[45px] w-[183px] rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FEE500]"
      >
        <img src="/login-button_kakao.png" alt="" className="h-full w-full" />
      </a>
      <p className="mt-4 text-center text-xs leading-5 text-white/75">
        카카오 계정으로만 로그인할 수 있습니다.
      </p>
    </PkeloLoginLayout>
  );
};

export default PkeloLogin;
