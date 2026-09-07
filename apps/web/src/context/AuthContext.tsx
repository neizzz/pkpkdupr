import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  PlayerAffiliation,
  PlayerFontSizePreference,
  PublicPlayerDupr,
  WithdrawalEligibility,
} from "@pkpkdupr/shared/player";
import { isPlayerFontSizePreference } from "@pkpkdupr/shared/player";
import { buildApiUrl } from "@/lib/api";

export interface PlayerInfo {
  id: string;
  username?: string;
  duprRating?: PublicPlayerDupr | null;
  gender?: "M" | "F";
  age?: number | null;
  avatarUrl?: string;
  affiliations?: PlayerAffiliation[];
  statusMessage?: string;
  statusMessageBackgroundColor?: string;
  authProvider?: "password" | "kakao" | "kakao-mock";
  privacyPolicyConsentVersion?: string | null;
  fontSizePreference?: PlayerFontSizePreference | null;
}

interface AuthContextType {
  token: string | null;
  player: PlayerInfo | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requiresPasswordChange: boolean;
  login: (
    username: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<void>;
  loginWithSession: () => Promise<void>;
  changePassword: (
    currentPassword: string | undefined,
    newPassword: string,
  ) => Promise<void>;
  updateProfile: (input: {
    avatarUrl?: string | null;
    affiliations?: PlayerAffiliation[];
    statusMessage?: string | null;
    statusMessageBackgroundColor?: string | null;
  }) => Promise<PlayerInfo>;
  uploadAvatar: (imageDataUrl: string) => Promise<PlayerInfo>;
  deleteAvatar: () => Promise<PlayerInfo>;
  updateFontSizePreference: (
    preference: PlayerFontSizePreference,
  ) => Promise<PlayerFontSizePreference>;
  refreshMe: () => Promise<PlayerInfo>;
  getWithdrawalEligibility: () => Promise<WithdrawalEligibility>;
  withdrawAccount: (confirmation: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const CACHED_AUTH_STATE_KEY = "pkpkdupr:auth-state";
const ONLINE_REQUIRED_MESSAGE = "온라인 연결이 필요합니다.";

type MeResponse = PlayerInfo & {
  isFirstLogin?: boolean;
};

type CachedAuthState = {
  player: PlayerInfo;
  requiresPasswordChange: boolean;
};

type SessionFetchResult =
  | { status: "authenticated"; player: PlayerInfo }
  | { status: "invalid" }
  | { status: "unavailable" };

type SessionState = "checking" | "anonymous" | "authenticated" | "unavailable";

type MeErrorResponse = {
  code?: string;
};

type SessionBootstrapResponse =
  | { authenticated: false }
  | { authenticated: true; player: MeResponse };

const SESSION_RETRY_DELAYS_MS = [2_000, 5_000, 10_000];
const SESSION_RETRY_INTERVAL_MS = 30_000;

const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

const shouldRequirePasswordChange = (isFirstLogin?: boolean) =>
  isFirstLogin === true;

const normalizePlayerInfo = (player: PlayerInfo): PlayerInfo => ({
  ...player,
  fontSizePreference:
    player.fontSizePreference === null ||
    isPlayerFontSizePreference(player.fontSizePreference)
      ? player.fontSizePreference
      : "default",
});

const readCachedAuthState = (): CachedAuthState | null => {
  try {
    const cachedState = localStorage.getItem(CACHED_AUTH_STATE_KEY);
    if (!cachedState) return null;
    const parsed = JSON.parse(cachedState) as CachedAuthState;
    return { ...parsed, player: normalizePlayerInfo(parsed.player) };
  } catch {
    return null;
  }
};

const persistAuthState = (
  player: PlayerInfo,
  requiresPasswordChange: boolean,
) => {
  localStorage.setItem(
    CACHED_AUTH_STATE_KEY,
    JSON.stringify({
      player,
      requiresPasswordChange,
    } satisfies CachedAuthState),
  );
};

const clearStoredAuthState = () => {
  localStorage.removeItem(CACHED_AUTH_STATE_KEY);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>("checking");

  const retryTimeoutRef = useRef<number | null>(null);
  const retryAttemptRef = useRef(0);
  const sessionValidationInFlightRef = useRef(false);
  const activeTokenRef = useRef<string | null>(null);
  const hasSessionProfileRef = useRef(false);
  const sessionValidationRef = useRef<
    ((accessToken?: string) => Promise<void>) | null
  >(null);

  const clearSessionRetry = useCallback((resetAttempt = true) => {
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (resetAttempt) {
      retryAttemptRef.current = 0;
    }
  }, []);

  const clearSession = useCallback(() => {
    clearSessionRetry();
    activeTokenRef.current = null;
    hasSessionProfileRef.current = false;
    clearStoredAuthState();
    setToken(null);
    setPlayer(null);
    setRequiresPasswordChange(false);
    setSessionState("anonymous");
  }, [clearSessionRetry]);

  const restoreCachedAuthState = useCallback(() => {
    const cachedAuthState = readCachedAuthState();
    if (!cachedAuthState) {
      return null;
    }

    hasSessionProfileRef.current = true;
    setPlayer(cachedAuthState.player);
    setRequiresPasswordChange(cachedAuthState.requiresPasswordChange);
    return cachedAuthState;
  }, []);

  const fetchMe = useCallback(
    async (accessToken: string): Promise<SessionFetchResult> => {
      const isCurrentSession = () => activeTokenRef.current === accessToken;

      try {
        const res = await fetch(buildApiUrl("/api/me"), {
          credentials: "same-origin",
        });

        if (res.ok) {
          const data = (await res.json()) as MeResponse;
          if (!data.id) {
            // 새 web 번들이 먼저 반영되어 이전 API의 빈 200 응답을 받더라도
            // 세션을 지우지 않고 배포 완료를 기다립니다.
            restoreCachedAuthState();
            setSessionState("unavailable");
            return { status: "unavailable" };
          }

          if (!isCurrentSession()) {
            return { status: "unavailable" };
          }

          const { isFirstLogin, ...rawPlayerInfo } = data;
          const playerInfo = normalizePlayerInfo(rawPlayerInfo);
          const nextRequiresPasswordChange =
            shouldRequirePasswordChange(isFirstLogin);

          hasSessionProfileRef.current = true;
          setPlayer(playerInfo);
          setRequiresPasswordChange(nextRequiresPasswordChange);
          setSessionState("authenticated");
          persistAuthState(playerInfo, nextRequiresPasswordChange);
          return { status: "authenticated", player: playerInfo };
        }

        const errorData = (await res.json().catch(() => ({}))) as MeErrorResponse;
        if (res.status === 401 || errorData.code === "SESSION_INVALID") {
          if (isCurrentSession()) {
            clearSession();
          }
          return { status: "invalid" };
        }

        restoreCachedAuthState();
        setSessionState("unavailable");
        return { status: "unavailable" };
      } catch {
        console.error("Failed to fetch user info");
        restoreCachedAuthState();
        setSessionState("unavailable");
        return { status: "unavailable" };
      }
    },
    [clearSession, restoreCachedAuthState],
  );

  const bootstrapSession = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl("/api/auth/session"), {
        credentials: "same-origin",
      });
      if (!res.ok) {
        restoreCachedAuthState();
        setSessionState("unavailable");
        return;
      }

      const data = (await res.json()) as SessionBootstrapResponse;
      if (!data.authenticated) {
        clearSession();
        setIsLoading(false);
        return;
      }

      const { isFirstLogin, ...rawPlayerInfo } = data.player;
      const playerInfo = normalizePlayerInfo(rawPlayerInfo);
      if (!playerInfo.id) {
        throw new Error("세션 사용자 정보가 없습니다.");
      }
      const nextRequiresPasswordChange = shouldRequirePasswordChange(isFirstLogin);
      activeTokenRef.current = "cookie-session";
      hasSessionProfileRef.current = true;
      setToken("cookie-session");
      setPlayer(playerInfo);
      setRequiresPasswordChange(nextRequiresPasswordChange);
      setSessionState("authenticated");
      persistAuthState(playerInfo, nextRequiresPasswordChange);
      setIsLoading(false);
    } catch {
      restoreCachedAuthState();
      setSessionState("unavailable");
    }
  }, [clearSession, restoreCachedAuthState]);

  const validateSession = useCallback(
    async (requestedToken?: string) => {
      const accessToken = requestedToken ?? activeTokenRef.current;
      if (
        !accessToken ||
        activeTokenRef.current !== accessToken ||
        sessionValidationInFlightRef.current
      ) {
        return;
      }

      clearSessionRetry(false);
      sessionValidationInFlightRef.current = true;
      const result = await fetchMe(accessToken);
      sessionValidationInFlightRef.current = false;

      if (result.status === "authenticated" || result.status === "invalid") {
        clearSessionRetry();
        setIsLoading(false);
        return;
      }

      if (activeTokenRef.current !== accessToken) {
        return;
      }

      if (!hasSessionProfileRef.current) {
        setIsLoading(true);
      }

      const retryDelay =
        SESSION_RETRY_DELAYS_MS[retryAttemptRef.current] ??
        SESSION_RETRY_INTERVAL_MS;
      retryAttemptRef.current += 1;
      retryTimeoutRef.current = window.setTimeout(() => {
        retryTimeoutRef.current = null;
        void sessionValidationRef.current?.();
      }, retryDelay);
    },
    [clearSessionRetry, fetchMe],
  );

  sessionValidationRef.current = validateSession;

  useEffect(() => {
    activeTokenRef.current = null;
    setToken(null);
    setSessionState("checking");
    const cachedAuthState = restoreCachedAuthState();
    setIsLoading(!cachedAuthState);
    void bootstrapSession();

    const validateWhenActive = () => {
      void sessionValidationRef.current?.();
    };
    const validateWhenVisible = () => {
      if (document.visibilityState === "visible") {
        validateWhenActive();
      }
    };

    window.addEventListener("online", validateWhenActive);
    window.addEventListener("focus", validateWhenActive);
    document.addEventListener("visibilitychange", validateWhenVisible);

    return () => {
      clearSessionRetry();
      window.removeEventListener("online", validateWhenActive);
      window.removeEventListener("focus", validateWhenActive);
      document.removeEventListener("visibilitychange", validateWhenVisible);
    };
  }, [bootstrapSession, clearSessionRetry, restoreCachedAuthState]);

  const loginWithSession = async () => {
    clearSessionRetry();
    activeTokenRef.current = "cookie-session";
    setToken("cookie-session");
    setIsLoading(true);
    const result = await fetchMe("cookie-session");

    if (result.status === "unavailable") {
      if (!hasSessionProfileRef.current) {
        setIsLoading(true);
      }
      throw new Error("서버 세션을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }

    if (result.status === "invalid") {
      throw new Error("세션을 만들지 못했습니다. 카카오 로그인을 다시 시도해주세요.");
    }

    setIsLoading(false);
  };

  const login = async (
    username: string,
    password: string,
    rememberMe = false,
  ) => {
    if (!isOnline()) {
      throw new Error(
        "오프라인에서는 로그인할 수 없습니다. 온라인 연결이 필요합니다.",
      );
    }

    const res = await fetch(buildApiUrl("/api/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, rememberMe }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "로그인 실패");
    }
    await loginWithSession();
  };

  const changePassword = async (
    currentPassword: string | undefined,
    newPassword: string,
  ) => {
    if (!player) {
      throw new Error("로그인이 필요합니다.");
    }
    if (!isOnline()) {
      throw new Error(
        "오프라인에서는 패스워드를 변경할 수 없습니다. 온라인 연결이 필요합니다.",
      );
    }

    const res = await fetch(buildApiUrl("/api/change-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "비밀번호 변경 실패");
    }

    setRequiresPasswordChange(false);
  };

  const updateProfile = async (input: {
    avatarUrl?: string | null;
    affiliations?: PlayerAffiliation[];
    statusMessage?: string | null;
    statusMessageBackgroundColor?: string | null;
  }) => {
    if (!player) {
      throw new Error("로그인이 필요합니다.");
    }
    if (!isOnline()) {
      throw new Error(ONLINE_REQUIRED_MESSAGE);
    }

    const res = await fetch(buildApiUrl("/api/me/profile"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "프로필 변경 실패");
    }
    const data = (await res.json()) as PlayerInfo;
    const nextPlayer = {
      ...data,
      privacyPolicyConsentVersion: player?.privacyPolicyConsentVersion ?? null,
      fontSizePreference:
        player.fontSizePreference === undefined
          ? "default"
          : player.fontSizePreference,
    };
    setPlayer(nextPlayer);
    persistAuthState(nextPlayer, requiresPasswordChange);
    return nextPlayer;
  };

  const uploadAvatar = async (imageDataUrl: string) => {
    if (!player) {
      throw new Error("로그인이 필요합니다.");
    }
    if (!isOnline()) {
      throw new Error(ONLINE_REQUIRED_MESSAGE);
    }

    const res = await fetch(buildApiUrl("/api/me/avatar"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ imageDataUrl }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "프로필 이미지 업로드 실패");
    }
    const data = (await res.json()) as PlayerInfo;
    const nextPlayer = {
      ...data,
      privacyPolicyConsentVersion: player?.privacyPolicyConsentVersion ?? null,
      fontSizePreference:
        player.fontSizePreference === undefined
          ? "default"
          : player.fontSizePreference,
    };
    setPlayer(nextPlayer);
    persistAuthState(nextPlayer, requiresPasswordChange);
    return nextPlayer;
  };

  const deleteAvatar = async () => {
    if (!player) {
      throw new Error("로그인이 필요합니다.");
    }
    if (!isOnline()) {
      throw new Error(ONLINE_REQUIRED_MESSAGE);
    }

    const res = await fetch(buildApiUrl("/api/me/avatar"), {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "프로필 이미지 삭제 실패");
    }
    const data = (await res.json()) as PlayerInfo;
    const nextPlayer = {
      ...data,
      privacyPolicyConsentVersion: player?.privacyPolicyConsentVersion ?? null,
      fontSizePreference:
        player.fontSizePreference === undefined
          ? "default"
          : player.fontSizePreference,
    };
    setPlayer(nextPlayer);
    persistAuthState(nextPlayer, requiresPasswordChange);
    return nextPlayer;
  };

  const refreshMe = async () => {
    if (!player) {
      throw new Error("로그인이 필요합니다.");
    }

    const result = await fetchMe("cookie-session");
    if (result.status !== "authenticated") {
      throw new Error("내 정보를 새로고침하지 못했습니다.");
    }

    return result.player;
  };

  const updateFontSizePreference = async (
    preference: PlayerFontSizePreference,
  ) => {
    if (!player) throw new Error("로그인이 필요합니다.");
    if (!isOnline()) throw new Error(ONLINE_REQUIRED_MESSAGE);

    const res = await fetch(buildApiUrl("/api/me/preferences"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ fontSizePreference: preference }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      fontSizePreference?: unknown;
    };
    if (!res.ok || !isPlayerFontSizePreference(data.fontSizePreference)) {
      throw new Error(data.error || "글자 크기 설정을 저장하지 못했습니다.");
    }

    const nextPlayer = {
      ...player,
      fontSizePreference: data.fontSizePreference,
    };
    setPlayer(nextPlayer);
    persistAuthState(nextPlayer, requiresPasswordChange);
    return data.fontSizePreference;
  };

  const getWithdrawalEligibility = async (): Promise<WithdrawalEligibility> => {
    if (!player) throw new Error("로그인이 필요합니다.");
    if (!isOnline()) throw new Error(ONLINE_REQUIRED_MESSAGE);
    const res = await fetch(buildApiUrl("/api/me/withdrawal-eligibility"), {
      credentials: "same-origin",
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "탈퇴 가능 여부를 확인하지 못했습니다.");
    }
    const data = (await res.json()) as WithdrawalEligibility;
    return {
      ...data,
      blockers: {
        ...data.blockers,
        upcomingSessions: data.blockers.upcomingSessions.map((session) => ({
          ...session,
          date: new Date(session.date),
        })),
      },
    };
  };

  const withdrawAccount = async (confirmation: string) => {
    if (!player) throw new Error("로그인이 필요합니다.");
    if (!isOnline()) throw new Error(ONLINE_REQUIRED_MESSAGE);
    const res = await fetch(buildApiUrl("/api/me/withdrawal"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ confirmation }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "회원 탈퇴를 완료하지 못했습니다.");
    }
    localStorage.clear();
    sessionStorage.clear();
    clearSession();
  };

  const logout = async () => {
    if (isOnline()) {
      await fetch(buildApiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "same-origin",
      }).catch(() => undefined);
    }
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        player,
        isLoading,
        isAuthenticated: sessionState === "authenticated",
        requiresPasswordChange,
        login,
        loginWithSession,
        changePassword,
        updateProfile,
        uploadAvatar,
        deleteAvatar,
        updateFontSizePreference,
        refreshMe,
        getWithdrawalEligibility,
        withdrawAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
