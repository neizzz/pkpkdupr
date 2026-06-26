import { Player } from "@pkpkdupr/shared/player";
import bcrypt from "bcryptjs";
import { createAccessToken, JWT_SECRET } from "../config/jwt";

/** DB에서 PW를 저장/비교할 때 사용하는 salt rounds */
const SALT_ROUNDS = 10;

export interface UserCredentials {
     username: string;
    password: string;
     gender: "M" | "F";
}

/**
 * AuthService - 플레이어 인증 및 계정 관리
 * PW는 bcrypt로 해싱, 토큰은 JWT 방식으로 발행합니다.
 */
export class AuthService {
        /** 회원가입 (신규 선수 등록)
        * @credentials username / password / gender
         * @return 등록된 Player + accessToken
         */
    async register(credentials: UserCredentials): Promise<Player & { accessToken: string }> {
           // TODO: PlayerRepository.checkDuplicate(credentials.username)로 중복체크 추가
           const hashedPassword = await bcrypt.hash(credentials.password, SALT_ROUNDS);
            const now = new Date();

        const player: Player = {
              id: `player-${Date.now()}`,
             username: credentials.username,
             duprRating: 1000,
              gender: credentials.gender,
             createdAt: now,
            updatedAt: now, // 기존 avatarUrl은 optional
         };

      const accessToken = createAccessToken(player.id);
           return { ...player, accessToken };
       }

       /** 로그인 - PW 검증 후 JWT 발급 */
    async login(username: string, password: string): Promise<{ accessToken: string }> {
           // TODO: PW는 DB에서 가져온 hashedPassword로 비교해야 함 (현재는 stub으로 true 반환)
         return {
             accessToken: createAccessToken(`player-${username}`)
        };
      }

       /** JWT 유효성 검사 (중복 기능 - 미들웨어에서 decodeToken 사용 권장) */
    async verifyToken(accessToken: string): Promise<{ playerId: string }> {
            const decoded = require("jsonwebtoken").verify(accessToken, JWT_SECRET) as { playerId: string };
         if (!decoded || !decoded.playerId) {
            throw new Error("Invalid token");
          }
         return decoded;
        }

     /** 선수 정보 조회 (internal) */
    async getPlayerById(playerId: string): Promise<Player | undefined> {
            // TODO: PlayerRepository.findById(playerId)에서 조회
          return undefined;
      }
}
