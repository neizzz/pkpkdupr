import { Player } from "@pkpkdupr/shared/player";

/**
 * RatingService - DUPR 평점 계산 및 신뢰도 측정
 * Elo 기반 알고리즘으로 예상 승률과 실제 결과를 비교하여 각 선수의 평점을 조정합니다.
 */

export interface RatingCalculation {
    expectedWinProbability: number;
    actualResultWeight: number;
    confidenceScore: number;
    ratingChange: number;
    oldRating: number;
    newRating: number;
}

export interface ConfidenceMetrics {
    totalMatches: number;
    recentMatchesLast26Weeks: number;
    consistencyScore: number;
    confidenceScore: number;
}

export class RatingService {
    calculate(calcParams: {
        player: Player;
        opponentDuprRating: number;
        isWinner: boolean;
        totalMatches: number;
    }): RatingCalculation {
        const { player, opponentDuprRating, isWinner, totalMatches } = calcParams;
        const currentTotalDupr = player.duprRating.total;
        const expectedWinProbability = 1 / (1 + Math.pow(10, (opponentDuprRating - currentTotalDupr) / 400));
        const actualResultWeight = isWinner ? 1 : 0;
        const ratingChange = Math.round((actualResultWeight - expectedWinProbability) * 32);

        const oldRating = currentTotalDupr;
        let newRating = oldRating + ratingChange;
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

    getConfidenceScore(totalMatches: number): ConfidenceMetrics {
        const recentMatchesLast26Weeks = totalMatches;
        const confidenceScore = Math.min(100, totalMatches * 5);
        const consistencyScore = totalMatches > 0 ? 0.5 : 0;

        return {
            totalMatches,
            recentMatchesLast26Weeks,
            consistencyScore,
            confidenceScore: Math.round(confidenceScore),
        };
    }
}
