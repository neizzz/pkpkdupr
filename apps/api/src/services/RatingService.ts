import type { MatchType } from "@pkpkdupr/shared/match";
import {
  computeTotalDuprRating,
  getDuprMetricByCategory,
  getDuprRatingByCategory,
  normalizeDuprRatingValue,
  roundDuprRating,
  setDuprMetricByCategory,
  setDuprRatingByCategory,
  type PlayerDuprCategory,
  type StoredPlayerDupr,
} from "@pkpkdupr/shared/player";

export interface RatingCalculation {
  expectedWinProbability: number;
  actualResultWeight: number;
  kFactor: number;
  ratingChange: number;
  oldRating: number;
  newRating: number;
  oldConfidence: number;
  newConfidence: number;
}

export interface MatchParticipantRatingInput {
  playerId: string;
  teamIndex: 0 | 1;
  state: StoredPlayerDupr;
}

export interface MatchReplayInput {
  type: MatchType;
  winnerTeamIndex: 0 | 1;
  participants: MatchParticipantRatingInput[];
}

const CONFIDENCE_K_FACTORS = [
  { maxExclusive: 20, kFactor: 0.064 },
  { maxExclusive: 50, kFactor: 0.048 },
  { maxExclusive: 80, kFactor: 0.032 },
  { maxExclusive: Infinity, kFactor: 0.016 },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const getDuprCategoryForMatchType = (
  matchType: MatchType,
): PlayerDuprCategory => {
  if (matchType === "singles") return "singles";
  if (matchType === "mixed-doubles") return "doubles.mixed";
  if (matchType === "men-doubles") return "doubles.men";
  return "doubles.women";
};

export class RatingService {
  getKFactor(confidence: number): number {
    const normalized = clamp(Math.round(confidence), 0, 100);
    return CONFIDENCE_K_FACTORS.find(
      ({ maxExclusive }) => normalized < maxExclusive,
    )!.kFactor;
  }

  getAccuracy(internalRating: number, officialRating: number): number {
    const accuracy = 100 - (Math.abs(internalRating - officialRating) / 0.5) * 100;
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
    opponentRating: number;
    isWinner: boolean;
    confidence: number;
    peerConfidence: number;
    correctionWeight?: number;
  }): RatingCalculation {
    const {
      currentRating,
      opponentRating,
      isWinner,
      confidence,
      peerConfidence,
      correctionWeight = 1,
    } = calcParams;
    const expectedWinProbability =
      1 / (1 + Math.pow(10, (opponentRating - currentRating) / 0.4));
    const actualResultWeight = isWinner ? 1 : 0;
    const kFactor = this.getKFactor(confidence) * correctionWeight;
    const ratingChange = roundDuprRating(
      (actualResultWeight - expectedWinProbability) * kFactor,
    );
    const oldRating = normalizeDuprRatingValue(currentRating);
    const newRating = normalizeDuprRatingValue(oldRating + ratingChange);
    const confidenceGain = clamp(Math.round(1 + (peerConfidence / 100) * 4), 1, 5);
    const newConfidence = Math.round(clamp(confidence + confidenceGain, 0, 100));

    return {
      expectedWinProbability,
      actualResultWeight,
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
    });

    const nextStates: Record<string, StoredPlayerDupr> = {};

    for (const participant of match.participants) {
      const peers = match.participants.filter(
        (candidate) => candidate.playerId !== participant.playerId,
      );
      const peerConfidence = average(
        peers.map(
          (peer) => getDuprMetricByCategory(peer.state.metrics, category).confidence,
        ),
      );
      const currentMetric = getDuprMetricByCategory(
        participant.state.metrics,
        category,
      );
      const result = this.calculate({
        currentRating: getDuprRatingByCategory(participant.state.rating, category),
        opponentRating: teamRatings[participant.teamIndex === 0 ? 1 : 0],
        isWinner: participant.teamIndex === match.winnerTeamIndex,
        confidence: currentMetric.confidence,
        peerConfidence,
        correctionWeight: correctionWeightByPlayerId[participant.playerId] ?? 1,
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
        rating: {
          ...nextRating,
          total: computeTotalDuprRating(nextRating),
        },
        metrics: nextMetrics,
      };
    }

    return nextStates;
  }
}
