import React, { createContext, useContext, useState, useEffect } from 'react';

export interface PlayerInfo {
    id: string;
    username?: string;
    duprRating?: number;
    gender?: 'M' | 'F';
}

interface AuthContextType {
    token: string | null;
    player: PlayerInfo | null;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, gender: 'M' | 'F') => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);
    const [player, setPlayer] = useState<PlayerInfo | null>(null);

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            setToken(storedToken);
            fetchMe(storedToken);
        }
    }, []);

    const fetchMe = async (accessToken: string) => {
        try {
            const res = await fetch('/api/me', {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (res.ok) {
                setPlayer(await res.json());
            }
        } catch {
            console.error('Failed to fetch user info');
        }
    };

    const login = async (username: string, password: string) => {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) throw new Error('로그인 실패');
        const data = await res.json();
        localStorage.setItem('token', data.accessToken);
        setToken(data.accessToken);
        fetchMe(data.accessToken);
    };

    const register = async (username: string, password: string, gender: 'M' | 'F') => {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, gender }),
        });
        if (!res.ok) throw new Error('회원가입 실패');
        const data = await res.json();
        localStorage.setItem('token', data.accessToken);
        setToken(data.accessToken);
        setPlayer(data);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setPlayer(null);
    };

    return (
        <AuthContext.Provider value={{ token, player, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
