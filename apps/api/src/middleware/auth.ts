import { Request, Response, NextFunction } from "express";
import { decodeToken } from "../config/jwt";

export interface AuthRequest extends Request {
    playerId: string;
}

/** JWT token을 검증하고 req.playerId를 부착하는 미들웨어 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = header.split(" ")[1];
    const decoded = decodeToken(token);
    if (!decoded) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }

    (req as AuthRequest).playerId = decoded.playerId;
    next();
}
