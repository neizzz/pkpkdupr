import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type LoginLocationState = {
  notice?: string;
};

const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const notice =
    typeof (location.state as LoginLocationState | null)?.notice === "string"
      ? (location.state as LoginLocationState).notice
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password, rememberMe);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류입니다.");
    }
  };

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

        <>
          {notice && !error && (
            <div className="mb-4 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          )}

          {error && (
            <div className="mb-4 w-full rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <input
              type="text"
              placeholder="아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="app-mobile-input w-full rounded-xl border bg-white px-4 py-3"
            />

            <input
              type="password"
              placeholder="패스워드"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="app-mobile-input w-full rounded-xl border bg-white px-4 py-3"
            />

            <label className="flex items-center gap-2 text-sm text-white/90">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-pkpk-accent-bg"
              />
              자동 로그인
            </label>

            <button
              type="submit"
              className="app-action-button w-full rounded-xl bg-pkpk-accent-bg py-3 font-semibold text-pkpk-dark shadow-sm transition-colors hover:bg-[#d7dc17]"
            >
              로그인
            </button>
          </form>
        </>
      </div>
    </div>
  );
};

export default Login;
