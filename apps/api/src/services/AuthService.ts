import { Player } from "@pkpkdupr/shared/player";

/**
 * AuthService - 플레이어 인증 및 계정 관리
 */
export class AuthService {
    /** 회원가입 (신규 선수 등록)
     * @param username 유저 이름
     * @param gender 성별
     * @returns 등록된 Player 객체
     */
    async register(username: string, gender: "M" | "F"): Promise<Player> {
        const now = new Date();
        return {
            id: `player-${Date.now()}`,
            username,
            duprRating: 1000,
            gender,
            createdAt: now,
            updatedAt: now
        };
    }

    /** 로그인 - PW 검증후 JWT 발급 */
    async login(username: string): Promise<{ accessToken: string }> {
        return {
            accessToken: `jwt-token-${username}`
        };
    }

    /** JWT 유효성 검사 */
    async verifyToken(accessToken: string): Promise<{ playerId: string }> {
        return { playerId: "player-" + (accessToken.split("-").pop() as string) };
    }

    /** 선수 정보 조회 (internal) */
    async getPlayerById(playerId: string): Promise<Player | undefined> {
        return undefined;
    }
}
