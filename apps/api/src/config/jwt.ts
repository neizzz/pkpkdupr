import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
export const ACCESS_TOKEN_EXPIRES_IN = "60m";

export interface JwtPayload {
    playerId: string;
    isAdmin?: boolean;
}

export const createAccessToken = (payload: string | JwtPayload): string => {
    if (typeof payload === 'string') {
        return jwt.sign({ playerId: payload }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
    }
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
};

/** 토큰으로부터 payload를 추출합니다 */
export const decodeToken = (token: string): JwtPayload | null => {
    try {
        return jwt.verify(token, JWT_SECRET) as JwtPayload;
     } catch {
        return null;
     }
};
