import { Match, MatchResult } from "@pkpkdupr/shared/match";

/**
 * MatchRecordService - 경기 기록 등록 및 관리
 */
export class MatchRecordService {
        /**
       * 경기 결과 등록 및 평점 갱신
         *
        * 경기 결과를 저장하고, 이 결과를 기반으로 RatingService를 통해
        * 모든 참여 선수의 DUPR을 갱신합니다.
       *
      * @param match - 완료된 경기 정보
     * @param result - 경기 결과 (승자 팀, 스코어)
       * @returns MatchResult (갱신된 평점 정보 포함)
        */
    async recordMatchResult(match: Match, result: Partial<MatchResult>): Promise<MatchResult> {
           // TODO: DB 저장 및 RatingService 호출 후 실제 평점 갱신 연동
         return {
            matchId: match?.id ?? "match-" + Date.now(),
          winnerTeamIndex: result.winnerTeamIndex! as 0 | 1,
          scores: result.scores || [],
            ratingChanges: []
         };
        }

       /** 특정 경기 조회 */
     async getMatchById(matchId: string): Promise<Match | undefined> {
         return undefined;
       }

        /** 선수별 경기 이력 조회      */
    async getMatchHistory(playerId: string, page: number = 0, limit: number = 20): Promise<{ matches: Match[]; total: number }> {
        return { matches: [], total: 0 };
        }
}
