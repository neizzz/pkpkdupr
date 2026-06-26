import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
export const ACCESS_TOKEN_EXPIRES_IN = "60m";

export const createAccessToken = (playerId: string): string => {
    return jwt.sign({ playerId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
};

/** 토큰으로부터 playerId만 안전하게 추출합니다 */
export const decodeToken = (token: string): { playerId: string } | null => {
    try {
        return jwt.verify(token, JWT_SECRET) as { playerId: string };
    } catch {
        return null;
    }
};
