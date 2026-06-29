import React, { createContext, useContext, useState, useEffect } from "react";
import type { Player } from "@pkpkdupr/shared/player";

type PlayerInfo = Pick<
  Player,
  "id" | "username" | "duprRating" | "gender" | "status"
>;

interface AuthContextType {
  token: string | null;
  player: PlayerInfo | null;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("admin-token");
    if (storedToken) {
      setToken(storedToken);
      fetchMe(storedToken);
    }
  }, []);

  const fetchMe = async (accessToken: string) => {
    try {
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPlayer(data);
      }
    } catch {
      console.error("Failed to fetch user info");
    }
  };

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "로그인 실패");
    }
    const data = await res.json();
    localStorage.setItem("admin-token", data.accessToken);
    setToken(data.accessToken);
    setIsAdmin(data.isAdmin === true);
    fetchMe(data.accessToken);
  };

  const logout = () => {
    localStorage.removeItem("admin-token");
    setToken(null);
    setPlayer(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ token, player, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
