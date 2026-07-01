import React, { createContext, useContext, useState, useEffect } from 'react';
import type { PlayerDupr } from '@pkpkdupr/shared/player';

export interface PlayerInfo {
    id: string;
    username?: string;
    duprRating?: PlayerDupr;
    gender?: 'M' | 'F';
    avatarUrl?: string;
}

interface AuthContextType {
    token: string | null;
    player: PlayerInfo | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    updateProfile: (input: { avatarUrl?: string | null }) => Promise<PlayerInfo>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

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
        try {
            const res = await fetch('/api/me', {
                headers: { Authorization: `Bearer ${accessToken}` },
             });
            if (res.ok) {
                const data = await res.json();
                setPlayer(data);
                return data;
             }
            localStorage.removeItem('token');
            setToken(null);
            setPlayer(null);
         } catch {
            console.error('Failed to fetch user info');
            localStorage.removeItem('token');
            setToken(null);
            setPlayer(null);
         }
        return null;
     };

    const login = async (username: string, password: string) => {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
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
        return data;
     };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setPlayer(null);
     };

    return (
         <AuthContext.Provider value={{ token, player, isLoading, isAuthenticated: !!token, login, updateProfile, logout }}>
             {children}
         </AuthContext.Provider>
     );
};

export const useAuth = (): AuthContextType => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
