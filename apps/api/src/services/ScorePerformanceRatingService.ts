import type { MatchScore } from "@pkpkdupr/shared/match";
import {
  getDuprMetricByCategory,
  getDuprRatingByCategory,
  normalizeDuprRatingValue,
  roundDuprRating,
  setDuprMetricByCategory,
  setDuprRatingByCategory,
  type StoredPlayerDupr,
} from "@pkpkdupr/shared/player";
import {
  getDecayedConfidenceByInactivity,
  getDuprCategoryForMatchType,
  type MatchReplayInput,
  type RatingServiceContract,
} from "./RatingService";

export interface ScorePerformanceRatingCalculation {
  expectedPointShare: number;
  actualPointShare: number;
  performanceGap: number;
  kFactor: number;
  ratingChange: number;
  oldRating: number;
  newRating: number;
  oldConfidence: number;
  newConfidence: number;
}

const CONFIDENCE_K_FACTORS = [
  { maxExclusive: 20, kFactor: 0.32 },
  { maxExclusive: 50, kFactor: 0.2 },
  { maxExclusive: 80, kFactor: 0.12 },
  { maxExclusive: Infinity, kFactor: 0.08 },
];

const SCORE_EXPECTATION_SCALE = 1.48;
const BINARY_EXPECTATION_SCALE = 0.4;
const MAX_RATING_CHANGE = 0.2;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const average = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

export const getTeamPointShares = (
  scores?: MatchScore[],
): [number, number] | null => {
  if (!scores?.length) {
    return null;
  }

  const [teamAPoints, teamBPoints] = scores.reduce<[number, number]>(
    (totals, score) => [
      totals[0] + Math.max(0, score.scoreA),
      totals[1] + Math.max(0, score.scoreB),
    ],
    [0, 0],
  );
  const totalPoints = teamAPoints + teamBPoints;

  if (totalPoints <= 0) {
    return null;
  }

  return [teamAPoints / totalPoints, teamBPoints / totalPoints];
};

export const getExpectedPointShare = (
  teamRating: number,
  opponentTeamRating: number,
  scale = SCORE_EXPECTATION_SCALE,
) => 1 / (1 + Math.pow(10, (opponentTeamRating - teamRating) / scale));

/**
 * 실제 득점률과 팀 평균 평점에서 구한 기대 득점률의 차이로 평점을
 * 갱신합니다. 점수가 없는 과거 경기는 기존 승패 기반 계산으로 fallback합니다.
 */
export class ScorePerformanceRatingService implements RatingServiceContract {
  getKFactor(confidence: number): number {
    const normalized = clamp(Math.round(confidence), 0, 100);
    return CONFIDENCE_K_FACTORS.find(
      ({ maxExclusive }) => normalized < maxExclusive,
    )!.kFactor;
  }

  getAccuracy(internalRating: number, officialRating: number): number {
    const accuracy =
      100 - (Math.abs(internalRating - officialRating) / 0.5) * 100;
    return Math.round(clamp(accuracy, 0, 100));
  }

  getCorrectionWeight(preUpdateAccuracy: number | null): number {
    if (preUpdateAccuracy == null) {
      return 1;
    }
    return clamp((100 - preUpdateAccuracy) / 100, 0.1, 1);
  }

  calculate(calcParams: {
    currentRating: number;
    expectedPointShare: number;
    actualPointShare: number;
    confidence: number;
    peerConfidence: number;
    correctionWeight?: number;
  }): ScorePerformanceRatingCalculation {
    const {
      currentRating,
      expectedPointShare,
      actualPointShare,
      confidence,
      peerConfidence,
      correctionWeight = 1,
    } = calcParams;
    const performanceGap = actualPointShare - expectedPointShare;
    const kFactor = this.getKFactor(confidence) * correctionWeight;
    const ratingChange = roundDuprRating(
      clamp(
        performanceGap * kFactor,
        -MAX_RATING_CHANGE,
        MAX_RATING_CHANGE,
      ),
    );
    const oldRating = normalizeDuprRatingValue(currentRating);
    const newRating = normalizeDuprRatingValue(oldRating + ratingChange);
    const confidenceGain = clamp(
      Math.round(1 + (peerConfidence / 100) * 4),
      1,
      5,
    );
    const newConfidence = Math.round(
      clamp(confidence + confidenceGain, 0, 100),
    );

    return {
      expectedPointShare,
      actualPointShare,
      performanceGap,
      kFactor,
      ratingChange,
      oldRating,
      newRating,
      oldConfidence: Math.round(clamp(confidence, 0, 100)),
      newConfidence,
    };
  }

  replayMatch(
    match: MatchReplayInput,
    correctionWeightByPlayerId: Record<string, number> = {},
  ): Record<string, StoredPlayerDupr> {
    const category = getDuprCategoryForMatchType(match.type);
    const teamRatings = ([0, 1] as const).map((teamIndex) => {
      const ratings = match.participants
        .filter((participant) => participant.teamIndex === teamIndex)
        .map((participant) =>
          getDuprRatingByCategory(participant.state.rating, category),
        );
      return average(ratings);
    }) as [number, number];
    const pointShares = getTeamPointShares(match.scores);
    const expectationScale = pointShares
      ? SCORE_EXPECTATION_SCALE
      : BINARY_EXPECTATION_SCALE;
    const expectedPointShares: [number, number] = [
      getExpectedPointShare(teamRatings[0], teamRatings[1], expectationScale),
      getExpectedPointShare(teamRatings[1], teamRatings[0], expectationScale),
    ];
    const actualPointShares: [number, number] =
      pointShares ??
      (match.winnerTeamIndex === 0 ? [1, 0] : [0, 1]);
    const decayedConfidenceByPlayerId = Object.fromEntries(
      match.participants.map((participant) => {
        const currentMetric = getDuprMetricByCategory(
          participant.state.metrics,
          category,
        );
        return [
          participant.playerId,
          getDecayedConfidenceByInactivity(
            currentMetric.confidence,
            match.inactiveElapsedMsByPlayerId?.[participant.playerId],
          ),
        ];
      }),
    );
    const nextStates: Record<string, StoredPlayerDupr> = {};

    for (const participant of match.participants) {
      const peers = match.participants.filter(
        (candidate) => candidate.playerId !== participant.playerId,
      );
      const peerConfidence = average(
        peers.map((peer) => decayedConfidenceByPlayerId[peer.playerId] ?? 0),
      );
      const currentMetric = getDuprMetricByCategory(
        participant.state.metrics,
        category,
      );
      const decayedConfidence =
        decayedConfidenceByPlayerId[participant.playerId] ??
        currentMetric.confidence;
      const teamIndex = participant.teamIndex;
      const result = this.calculate({
        currentRating: getDuprRatingByCategory(
          participant.state.rating,
          category,
        ),
        expectedPointShare: expectedPointShares[teamIndex],
        actualPointShare: actualPointShares[teamIndex],
        confidence: decayedConfidence,
        peerConfidence,
        correctionWeight:
          correctionWeightByPlayerId[participant.playerId] ?? 1,
      });
      const nextRating = setDuprRatingByCategory(
        participant.state.rating,
        category,
        result.newRating,
      );
      const nextMetrics = setDuprMetricByCategory(
        participant.state.metrics,
        category,
        {
          ...currentMetric,
          confidence: result.newConfidence,
        },
      );

      nextStates[participant.playerId] = {
        rating: nextRating,
        metrics: nextMetrics,
      };
    }

    return nextStates;
  }
}
