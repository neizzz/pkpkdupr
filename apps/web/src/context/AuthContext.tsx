import React, { createContext, useContext, useState, useEffect } from 'react';
import type { PlayerDupr } from '@pkpkdupr/shared/player';

export interface PlayerInfo {
    id: string;
    username?: string;
    duprRating?: PlayerDupr | null;
    gender?: 'M' | 'F';
    avatarUrl?: string;
}

interface AuthContextType {
    token: string | null;
    player: PlayerInfo | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
    updateProfile: (input: { avatarUrl?: string | null }) => Promise<PlayerInfo>;
    uploadAvatar: (imageDataUrl: string) => Promise<PlayerInfo>;
    deleteAvatar: () => Promise<PlayerInfo>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const CACHED_PLAYER_KEY = 'pkpkdupr:player';
const ONLINE_REQUIRED_MESSAGE = '온라인 연결이 필요합니다.';

type MeResponse = PlayerInfo & {
    accessToken?: string;
};

const isOnline = () =>
    typeof navigator === 'undefined' ? true : navigator.onLine;

const readCachedPlayer = (): PlayerInfo | null => {
    try {
        const cachedPlayer = localStorage.getItem(CACHED_PLAYER_KEY);
        return cachedPlayer ? (JSON.parse(cachedPlayer) as PlayerInfo) : null;
    } catch {
        return null;
    }
};

const persistPlayer = (playerInfo: PlayerInfo) => {
    localStorage.setItem(CACHED_PLAYER_KEY, JSON.stringify(playerInfo));
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);
    const [player, setPlayer] = useState<PlayerInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
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
        const useCachedPlayer = () => {
            const cachedPlayer = readCachedPlayer();
            if (cachedPlayer) {
                setPlayer(cachedPlayer);
                return cachedPlayer;
            }
            return null;
        };

        try {
            const res = await fetch('/api/me', {
                headers: { Authorization: `Bearer ${accessToken}` },
             });
            if (res.ok) {
                const data = (await res.json()) as MeResponse;
                const { accessToken: refreshedAccessToken, ...playerInfo } = data;
                if (refreshedAccessToken) {
                    localStorage.setItem('token', refreshedAccessToken);
                    setToken(refreshedAccessToken);
                }
                setPlayer(playerInfo);
                persistPlayer(playerInfo);
                return playerInfo;
             }

            if (!isOnline()) {
                const cachedPlayer = useCachedPlayer();
                if (cachedPlayer) {
                    return cachedPlayer;
                }
            }

            localStorage.removeItem('token');
            setToken(null);
            setPlayer(null);
         } catch {
            console.error('Failed to fetch user info');
            if (!isOnline()) {
                const cachedPlayer = useCachedPlayer();
                if (cachedPlayer) {
                    return cachedPlayer;
                }
            }
            localStorage.removeItem('token');
            setToken(null);
            setPlayer(null);
         }
        return null;
     };

    const login = async (username: string, password: string, rememberMe = false) => {
        if (!isOnline()) {
            throw new Error('오프라인에서는 로그인할 수 없습니다. 온라인 연결이 필요합니다.');
        }

        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, rememberMe }),
         });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || '로그인 실패');
         }
        const data = await res.json();
        localStorage.setItem('token', data.accessToken);
        setToken(data.accessToken);
        setIsLoading(true);
        await fetchMe(data.accessToken);
        setIsLoading(false);
     };

    const updateProfile = async (input: { avatarUrl?: string | null }) => {
        if (!token) {
            throw new Error('로그인이 필요합니다.');
        }
        if (!isOnline()) {
            throw new Error(ONLINE_REQUIRED_MESSAGE);
        }

        const res = await fetch('/api/me/profile', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(input),
         });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || '프로필 변경 실패');
         }
        const data = await res.json();
        setPlayer(data);
        persistPlayer(data);
        return data;
     };

    const uploadAvatar = async (imageDataUrl: string) => {
        if (!token) {
            throw new Error('로그인이 필요합니다.');
        }
        if (!isOnline()) {
            throw new Error(ONLINE_REQUIRED_MESSAGE);
        }

        const res = await fetch('/api/me/avatar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ imageDataUrl }),
         });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || '프로필 이미지 업로드 실패');
         }
        const data = await res.json();
        setPlayer(data);
        persistPlayer(data);
        return data;
     };

    const deleteAvatar = async () => {
        if (!token) {
            throw new Error('로그인이 필요합니다.');
        }
        if (!isOnline()) {
            throw new Error(ONLINE_REQUIRED_MESSAGE);
        }

        const res = await fetch('/api/me/avatar', {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
         });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || '프로필 이미지 삭제 실패');
         }
        const data = await res.json();
        setPlayer(data);
        persistPlayer(data);
        return data;
     };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem(CACHED_PLAYER_KEY);
        setToken(null);
        setPlayer(null);
     };

    return (
         <AuthContext.Provider value={{ token, player, isLoading, isAuthenticated: !!token, login, updateProfile, uploadAvatar, deleteAvatar, logout }}>
             {children}
         </AuthContext.Provider>
     );
};

export const useAuth = (): AuthContextType => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
