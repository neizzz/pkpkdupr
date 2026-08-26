import React from "react";
import { IoChevronBack } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import PrivacyPolicyContent from "@/components/PrivacyPolicyContent";

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative h-full bg-white text-pkpk-main-font">
      <div className="h-full overflow-y-auto">
        <header className="sticky top-0 z-10 border-b border-border bg-white/95 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[480px] items-center gap-3">
            <button
              type="button"
              aria-label="뒤로가기"
              onClick={handleBack}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-pkpk-primary-bg hover:bg-pkpk-hover-surface active:bg-pkpk-pressed-surface"
            >
              <IoChevronBack aria-hidden="true" className="size-5" />
            </button>
            <h1 className="text-lg font-bold">개인정보 처리방침</h1>
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
