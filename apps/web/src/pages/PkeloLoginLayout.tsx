import React from "react";

type PkeloLoginLayoutProps = React.PropsWithChildren<{
  variant?: "centered" | "consent";
}>;

const PkeloLoginLayout: React.FC<PkeloLoginLayoutProps> = ({
  children,
  variant = "centered",
}) => (
  <div
    className={`flex h-full w-full flex-col items-center overflow-y-auto bg-gradient-to-br from-pkpk-secondary-bg to-pkpk-primary-bg px-4 pb-[calc(var(--safe-bottom)+var(--app-keyboard-offset)+1.5rem)] ${
      variant === "consent"
        ? "justify-start pt-[calc(env(safe-area-inset-top)+8rem)]"
        : "justify-center pt-[calc(env(safe-area-inset-top)+1.5rem)]"
    }`}
  >
    <div
      className={`w-full max-w-sm shrink-0 self-center py-4 ${
        variant === "centered" ? "h-[320px]" : ""
      }`}
    >
      <header
        className={`text-center text-white ${
          variant === "consent" ? "mb-12" : "mb-8"
        }`}
      >
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
