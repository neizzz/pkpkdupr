import { Player } from "@pkpkdupr/shared/player";

/**
 * PlayerRepository - 선수 데이터 저장소
 *
 * 모든 플레이어의 CRUD 작업을 담당합니다.
 */
export class PlayerRepository {
       /** ID로 플레이어 조회 */
    async findById(id: string): Promise<Player | undefined> {
         return undefined;
      }

     /**.username으로 중복 확인 */
    async findByUsername(username: string): Promise<Player | undefined> {
        return undefined;
       }

       /** 신규 선수 추가 */
    async create(player: Omit<Player, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Player> {
          const now = new Date();
         return player as Player;
      }

       /** 평점 업데이트 */
   async updateRating(playerId: string, newRating: number): Promise<Player | undefined> {
        return undefined;
     }

     /** 전체 선수 목록 조회 (페이징)  */
    async findAll(page: number = 0, limit: number = 20): Promise<{ players: Player[]; total: number }> {
         return { players: [], total: 0 };
      }
}
