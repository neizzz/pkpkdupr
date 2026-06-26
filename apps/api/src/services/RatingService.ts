import { Player } from "@pkpkdupr/shared/player";

/**
 * RatingService - DUPR 평점 계산 및 신뢰도 측정
 * Elo 기반 알고리즘으로 예상 승률과 실제 결과를 비교하여 각 선수의 평점을 조정합니다.
 */

export interface RatingCalculation {
    /** 팀의 예상 승률 (0 ~ 1) */
    expectedWinProbability: number;

    /** 실제 경기 결과 (승/무/패 기준 가중치: 1 / 0.5 / 0) */
    actualResultWeight: number;

    /** 신뢰도 점수 (0~100). 경기 수가 적을수록 낮아짐 */
    confidenceScore: number;

    /** 평점 변화량 (+/- N) */
    ratingChange: number;

    /** 변경 전 DUPR */
    oldRating: number;

    /** 변경 후 DUPR (소수점 한 자리까지만 반영) */
    newRating: number;
}

/** 신뢰도 측정 결과 */
export interface ConfidenceMetrics {
    /** 총 경기 수 */
    totalMatches: number;

    /** 최근 26주 이내경기 수 */
    recentMatchesLast26Weeks: number;

    /** 승률 편차 (일관성) 기준점수 */
    consistencyScore: number;

    /** 신뢰도 점수 (0~100) */
    confidenceScore: number;
}

export class RatingService {
    /**
     * DUPR 평점 변경량 계산
     * @param calcParams.player            평가 대상 플레이어 정보
     * @param calcParams.opponentDuprRating   상대 D UPR(평균 또는 1인 값)
     * @param calcParams.isWinner           승 여부
     * @param calcParams.totalMatches       선수의 총 경기 수 (신뢰도에 필요)
     */
    calculate(calcParams: {
        player: Player;
        opponentDuprRating: number;
        isWinner: boolean;
        totalMatches: number;
    }): RatingCalculation {
        const { player, opponentDuprRating, isWinner, totalMatches } = calcParams;

        // 예상승률 (Ello 공식)
        const expectedWinProbability = 1 / (1 + Math.pow(10, (opponentDuprRating - player.duprRating) / 400));

        // 실제 결과 가중치
        const actualResultWeight = isWinner ? 1 : 0;

        // 평점 변화량 (K-factor = 32)
        const ratingChange = Math.round((actualResultWeight - expectedWinProbability) * 32);

        const oldRating = player.duprRating;
        let newRating = oldRating + ratingChange;
        // DUPR은 소수점 한 자리까지만 표기
        newRating = Math.round(newRating * 10) / 10;

        return {
            expectedWinProbability,
            actualResultWeight,
            confidenceScore: this.getConfidenceScore(totalMatches).confidenceScore,
            ratingChange,
            oldRating,
            newRating,
        };
    }

    /** 신뢰도 점수 측정 */
    getConfidenceScore(totalMatches: number): ConfidenceMetrics {
        // TODO: 26주 이내 경기 필터링, 일관성 계산 추가
        const recentMatchesLast26Weeks = totalMatches;
        let confidenceScore = Math.min(100, totalMatches * 5);
        const consistencyScore = totalMatches > 0 ? 0.5 : 0; // TODO:승률 표준 편차 계산

        return {
            totalMatches,
            recentMatchesLast26Weeks,
            consistencyScore,
            confidenceScore: Math.round(confidenceScore),
        };
    }
}
