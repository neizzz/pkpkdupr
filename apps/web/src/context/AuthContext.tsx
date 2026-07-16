import React, { createContext, useContext, useEffect, useState } from "react";
import type { PublicPlayerDupr } from "@pkpkdupr/shared/player";
import { buildApiUrl } from "@/lib/api";

export interface PlayerInfo {
  id: string;
  username?: string;
  duprRating?: PublicPlayerDupr | null;
  gender?: "M" | "F";
  avatarUrl?: string;
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
  changePassword: (
    currentPassword: string | undefined,
    newPassword: string,
  ) => Promise<void>;
  updateProfile: (input: { avatarUrl?: string | null }) => Promise<PlayerInfo>;
  uploadAvatar: (imageDataUrl: string) => Promise<PlayerInfo>;
  deleteAvatar: () => Promise<PlayerInfo>;
  refreshMe: () => Promise<PlayerInfo>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const TOKEN_STORAGE_KEY = "token";
const CACHED_AUTH_STATE_KEY = "pkpkdupr:auth-state";
const ONLINE_REQUIRED_MESSAGE = "온라인 연결이 필요합니다.";

type LoginResponse = {
  accessToken: string;
  isFirstLogin?: boolean;
};

type MeResponse = PlayerInfo & {
  accessToken?: string;
  isFirstLogin?: boolean;
};

type CachedAuthState = {
  player: PlayerInfo;
  requiresPasswordChange: boolean;
};

const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

const shouldRequirePasswordChange = (isFirstLogin?: boolean) =>
  isFirstLogin === true;

const readCachedAuthState = (): CachedAuthState | null => {
  try {
    const cachedState = localStorage.getItem(CACHED_AUTH_STATE_KEY);
    return cachedState ? (JSON.parse(cachedState) as CachedAuthState) : null;
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
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(CACHED_AUTH_STATE_KEY);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
      setToken(storedToken);
      void fetchMe(storedToken).finally(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchMe = async (accessToken: string) => {
    const useCachedAuthState = () => {
      const cachedAuthState = readCachedAuthState();
      if (cachedAuthState) {
        setPlayer(cachedAuthState.player);
        setRequiresPasswordChange(cachedAuthState.requiresPasswordChange);
        return cachedAuthState;
      }
      return null;
    };

    try {
      const res = await fetch(buildApiUrl("/api/me"), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = (await res.json()) as MeResponse;
        if (!data.id) {
          throw new Error("Empty /api/me response");
        }
        const {
          accessToken: refreshedAccessToken,
          isFirstLogin,
          ...playerInfo
        } = data;
        const nextRequiresPasswordChange =
          shouldRequirePasswordChange(isFirstLogin);

        if (refreshedAccessToken) {
          localStorage.setItem(TOKEN_STORAGE_KEY, refreshedAccessToken);
          setToken(refreshedAccessToken);
        }
        setPlayer(playerInfo);
        setRequiresPasswordChange(nextRequiresPasswordChange);
        persistAuthState(playerInfo, nextRequiresPasswordChange);
        return playerInfo;
      }

      if (!isOnline()) {
        const cachedAuthState = useCachedAuthState();
        if (cachedAuthState) {
          return cachedAuthState.player;
        }
      }

      clearStoredAuthState();
      setToken(null);
      setPlayer(null);
      setRequiresPasswordChange(false);
    } catch {
      console.error("Failed to fetch user info");
      if (!isOnline()) {
        const cachedAuthState = useCachedAuthState();
        if (cachedAuthState) {
          return cachedAuthState.player;
        }
      }
      clearStoredAuthState();
      setToken(null);
      setPlayer(null);
      setRequiresPasswordChange(false);
    }
    return null;
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
    const data = (await res.json()) as LoginResponse;
    localStorage.setItem(TOKEN_STORAGE_KEY, data.accessToken);
    setToken(data.accessToken);
    setRequiresPasswordChange(shouldRequirePasswordChange(data.isFirstLogin));
    setIsLoading(true);
    await fetchMe(data.accessToken);
    setIsLoading(false);
  };

  const changePassword = async (
    currentPassword: string | undefined,
    newPassword: string,
  ) => {
    if (!token) {
      throw new Error("로그인이 필요합니다.");
    }
    if (!isOnline()) {
      throw new Error(
        "오프라인에서는 패스워드를 변경할 수 없습니다. 온라인 연결이 필요합니다.",
      );
    }

    const res = await fetch(buildApiUrl("/api/change-password"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "비밀번호 변경 실패");
    }

    setRequiresPasswordChange(false);
  };

  const updateProfile = async (input: { avatarUrl?: string | null }) => {
    if (!token) {
      throw new Error("로그인이 필요합니다.");
    }
    if (!isOnline()) {
      throw new Error(ONLINE_REQUIRED_MESSAGE);
    }

    const res = await fetch(buildApiUrl("/api/me/profile"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "프로필 변경 실패");
    }
    const data = (await res.json()) as PlayerInfo;
    setPlayer(data);
    persistAuthState(data, requiresPasswordChange);
    return data;
  };

  const uploadAvatar = async (imageDataUrl: string) => {
    if (!token) {
      throw new Error("로그인이 필요합니다.");
    }
    if (!isOnline()) {
      throw new Error(ONLINE_REQUIRED_MESSAGE);
    }

    const res = await fetch(buildApiUrl("/api/me/avatar"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ imageDataUrl }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "프로필 이미지 업로드 실패");
    }
    const data = (await res.json()) as PlayerInfo;
    setPlayer(data);
    persistAuthState(data, requiresPasswordChange);
    return data;
  };

  const deleteAvatar = async () => {
    if (!token) {
      throw new Error("로그인이 필요합니다.");
    }
    if (!isOnline()) {
      throw new Error(ONLINE_REQUIRED_MESSAGE);
    }

    const res = await fetch(buildApiUrl("/api/me/avatar"), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "프로필 이미지 삭제 실패");
    }
    const data = (await res.json()) as PlayerInfo;
    setPlayer(data);
    persistAuthState(data, requiresPasswordChange);
    return data;
  };

  const refreshMe = async () => {
    if (!token) {
      throw new Error("로그인이 필요합니다.");
    }

    const refreshedPlayer = await fetchMe(token);
    if (!refreshedPlayer) {
      throw new Error("내 정보를 새로고침하지 못했습니다.");
    }

    return refreshedPlayer;
  };

  const logout = () => {
    clearStoredAuthState();
    setToken(null);
    setPlayer(null);
    setRequiresPasswordChange(false);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        player,
        isLoading,
        isAuthenticated: !!token,
        requiresPasswordChange,
        login,
        changePassword,
        updateProfile,
        uploadAvatar,
        deleteAvatar,
        refreshMe,
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
