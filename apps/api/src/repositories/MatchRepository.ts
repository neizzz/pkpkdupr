import { Match } from "@pkpkdupr/shared/match";

/**
 * MatchRepository - 경기 데이터 저장소
 *
 * 모든 경기의 CRUD 작업을 담당합니다.
 */
export class MatchRepository {
        /** ID로 단일 경기 조회    */
    async findById(matchId: string): Promise<Match | undefined> {
         return undefined;
       }

      /** 신규 경기 추가*/
   async create(match: Omit<Match, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Match> {
            const now = new Date();
             return match as Match;
       }

      /** 특정 플레이어의 경기 이력 조회 */
    async findByPlayerId(playerId: string, page: number = 0, limit: number = 20): Promise<{ matches: Match[]; total: number }> {
         return { matches: [], total: 0 };
          }

       /** 모든 경기 목록     */
    async findAll(page: number = 0, limit: number = 20): Promise<{ matches: Match[]; total: number }> {
        return { matches: [], total: 0 };
      }
}
