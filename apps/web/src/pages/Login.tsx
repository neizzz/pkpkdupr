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
    <div className="app-safe-bottom-pad flex h-full w-full flex-col items-center justify-center overflow-hidden px-3 pt-6">
      <div className="app-scroll-area max-h-full w-full self-center">
        <h1 className="mb-8 text-2xl font-bold">PkpkDUPR</h1>

        {notice && !error && (
          <div className="mb-4 w-full rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-4 w-full rounded border border-error/20 bg-error/10 px-4 py-2 text-sm text-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="app-mobile-input w-full rounded-lg border px-4 py-3"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="app-mobile-input w-full rounded-lg border px-4 py-3"
          />

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-[#409eff]"
            />
            자동 로그인
          </label>

          <button
            type="submit"
            className="app-action-button w-full rounded-lg bg-[#409eff] py-3 font-semibold text-white transition-colors hover:bg-[#409eff]/90"
          >
            로그인
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
