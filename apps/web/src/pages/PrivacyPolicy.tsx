import React from "react";
import { Link } from "react-router-dom";
import PrivacyPolicyContent from "@/components/PrivacyPolicyContent";

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="relative h-full bg-white text-pkpk-main-font">
      <div className="h-full overflow-y-auto">
        <header className="sticky top-0 z-10 border-b border-border bg-white/95 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[480px] items-center justify-between gap-4">
            <h1 className="text-lg font-bold">개인정보 처리방침</h1>
            <Link
              to="/login"
              className="text-sm font-semibold text-pkpk-primary-bg underline underline-offset-4"
            >
              로그인으로
            </Link>
          </div>
        </header>

        <article className="mx-auto w-full max-w-[480px] px-4 pt-6 pb-[calc(var(--safe-bottom)+2rem)]">
          <PrivacyPolicyContent />
        </article>
      </div>

    </div>
  );
};

export default PrivacyPolicy;
