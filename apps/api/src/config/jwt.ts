import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
export const ACCESS_TOKEN_EXPIRES_IN = "3h";
export const REMEMBER_ME_ACCESS_TOKEN_EXPIRES_IN = "30d";

export interface JwtPayload {
    playerId: string;
    isAdmin?: boolean;
    rememberMe?: boolean;
    passwordFingerprint?: string;
}

export const createAccessToken = (
    payload: string | JwtPayload,
    options?: { expiresIn?: jwt.SignOptions["expiresIn"] },
): string => {
    const expiresIn = options?.expiresIn ?? ACCESS_TOKEN_EXPIRES_IN;
    if (typeof payload === 'string') {
        return jwt.sign({ playerId: payload }, JWT_SECRET, { expiresIn });
    }
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

/** 토큰으로부터 payload를 추출합니다 */
export const decodeToken = (token: string): JwtPayload | null => {
    try {
        return jwt.verify(token, JWT_SECRET) as JwtPayload;
     } catch {
        return null;
     }
};
