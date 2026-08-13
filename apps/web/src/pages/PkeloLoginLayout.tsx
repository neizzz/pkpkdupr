import React from "react";

const PkeloLoginLayout: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="flex h-full w-full flex-col items-center justify-start overflow-y-auto bg-gradient-to-br from-pkpk-secondary-bg to-pkpk-primary-bg px-4 pt-[calc(env(safe-area-inset-top)+32vh)] pb-[calc(var(--safe-bottom)+var(--app-keyboard-offset)+1.5rem)]">
    <div className="w-full max-w-sm self-center py-4">
      <header className="mb-8 text-center text-white">
        <img
          src="/pkelo-login-brand.png"
          alt="PKELO 피클볼 로고"
          width={112}
          height={65}
          className="mx-auto mb-0 h-auto w-28"
        />
        <h1 className="text-[1.2rem] font-extrabold tracking-tight">PKELO</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-white/85">
          기록하고, 교류하고, 성장하는 피클볼 라이프
        </p>
      </header>

      <div className="min-h-[81px]">{children}</div>
    </div>
  </div>
);

export default PkeloLoginLayout;
