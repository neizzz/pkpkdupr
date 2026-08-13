import React from "react";

type PkeloTemporaryNoticeProps = {
  title: string;
  message: string;
};

const PkeloTemporaryNotice: React.FC<PkeloTemporaryNoticeProps> = ({
  title,
  message,
}) => (
  <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-pkpk-secondary-bg to-pkpk-primary-bg px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(var(--safe-bottom)+var(--app-keyboard-offset)+1.5rem)] text-center text-white">
    <section className="w-full max-w-sm self-center py-4" aria-live="polite">
      <img
        src="/pkelo-login-brand.png"
        alt="PKELO 피클볼 로고"
        className="mx-auto mb-5 h-auto w-28"
      />
      <h1 className="text-[1.2rem] font-extrabold tracking-tight">{title}</h1>
      <p className="mt-4 whitespace-pre-wrap text-xl font-bold leading-8 text-white">
        {message}
      </p>
    </section>
  </div>
);

export const PkeloNoticeLoading: React.FC = () => (
  <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-pkpk-secondary-bg to-pkpk-primary-bg px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(var(--safe-bottom)+var(--app-keyboard-offset)+1.5rem)] text-center text-white">
    <section className="w-full max-w-sm self-center py-4" role="status">
      <img
        src="/pkelo-login-brand.png"
        alt="PKELO 피클볼 로고"
        className="mx-auto mb-5 h-auto w-28"
      />
      <p className="text-sm font-medium text-white/85">
        안내를 확인하고 있습니다.
      </p>
    </section>
  </div>
);

export default PkeloTemporaryNotice;
