import type { MatchScore, MatchType } from "@pkpkdupr/shared/match";
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
  scores?: MatchScore[];
  inactiveElapsedMsByPlayerId?: Record<string, number>;
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
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

const DAY_MS = 24 * 60 * 60 * 1000;
const CONFIDENCE_DECAY_GRACE_PERIOD_MS = 14 * DAY_MS;
const CONFIDENCE_DECAY_PER_DAY = 1.5;
const CONFIDENCE_DECAY_FLOOR = 0;

const getTeamSetWins = (scores: MatchScore[]) =>
  scores.reduce<[number, number]>(
    (wins, score) => {
      if (score.scoreA > score.scoreB) {
        wins[0] += 1;
      } else if (score.scoreB > score.scoreA) {
        wins[1] += 1;
      }

      return wins;
    },
    [0, 0],
  );

export const getScoreMarginMultiplier = (scores?: MatchScore[]): number => {
  if (!scores?.length) {
    return 1;
  }

  const [teamAPoints, teamBPoints] = scores.reduce<[number, number]>(
    (acc, score) => [acc[0] + score.scoreA, acc[1] + score.scoreB],
    [0, 0],
  );
  const totalPoints = teamAPoints + teamBPoints;

  if (totalPoints <= 0) {
    return 1;
  }

  const marginRatio = clamp(
    Math.abs(teamAPoints - teamBPoints) / totalPoints,
    0,
    1,
  );

  return roundDuprRating(1 + marginRatio * 0.5);
};

export const getSetMarginMultiplier = (scores?: MatchScore[]): number => {
  if (!scores?.length || scores.length === 1) {
    return 1;
  }

  const [teamAWins, teamBWins] = getTeamSetWins(scores);
  const setDiff = Math.abs(teamAWins - teamBWins);
  const decisiveWinnerWins = Math.max(teamAWins, teamBWins);

  if (decisiveWinnerWins < 2) {
    return 1;
  }

  if (setDiff >= 2) {
    return 1.08;
  }

  if (setDiff === 1) {
    return 1.03;
  }

  return 1;
};

export const getDecayedConfidenceByInactivity = (
  confidence: number,
  elapsedMs?: number,
): number => {
  if (
    elapsedMs == null ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs <= CONFIDENCE_DECAY_GRACE_PERIOD_MS
  ) {
    return Math.max(CONFIDENCE_DECAY_FLOOR, confidence);
  }

  const decayDays = Math.floor(
    (elapsedMs - CONFIDENCE_DECAY_GRACE_PERIOD_MS) / DAY_MS,
  );

  if (decayDays <= 0) {
    return Math.max(CONFIDENCE_DECAY_FLOOR, confidence);
  }

  return Math.max(
    CONFIDENCE_DECAY_FLOOR,
    confidence - decayDays * CONFIDENCE_DECAY_PER_DAY,
  );
};

export const getDuprCategoryForMatchType = (
  matchType: MatchType,
): PlayerDuprCategory => {
  if (matchType === "singles") return "singles.standard";
  if (matchType === "unrestricted-singles") return "singles.unrestricted";
  if (matchType === "mixed-doubles") return "doubles.mixed";
  if (matchType === "men-doubles") return "doubles.men";
  if (matchType === "women-doubles") return "doubles.women";
  return "doubles.unrestricted";
};

export class RatingService {
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
    opponentRating: number;
    isWinner: boolean;
    confidence: number;
    peerConfidence: number;
    correctionWeight?: number;
  }): RatingCalculation {
    const {
      currentRating, // 현재 플레이어의 DUPR 점수 (정규화된 값)
      opponentRating, // 상대 플레이어의 DUPR 점수 (정규화된 값)
      isWinner, // 현재 플레이어가 승리했는지 여부 (true/false)
      confidence, // 현재 플레이어의 신뢰도 (0-100, 0=완전 불확실, 100=완전 확신)
      peerConfidence, // 상대 플레이어들의 평균 신뢰도 (0-100)
      correctionWeight = 1, // 보정 가중치 (1=보정 없음, 1보다 작으면 하향 조정, 1보다 크면 상향 조정)
    } = calcParams;

    /*
     * DUPR 점수 계산 공식 (Elo 시스템 변형):
     *
     * expectedWinProbability = 1 / (1 + 10^((opponentRating - currentRating) / 0.4))
     *   → 예상 승률 (0~1 사이). 점수가 높을수록 승리 확률이 높아짐.
     *
     * actualResultWeight = isWinner ? 1 : 0
     *   → 실제 결과 가중치. 승자=1, 패자=0
     *
     * kFactor = CONFIDENCE_K_FACTORS[confidence_bucket].kFactor × correctionWeight
     *   → 점수 변화 민감도 계수. 신뢰도가 높을수록 점수 변화가 작아짐.
     *   신뢰도 구간별 kFactor:
     *     - confidence < 20:    0.064 (신뢰 낮음 → 민감함)
     *     - 50 ≤ confidence < 80: 0.048 (중간)
     *     - 80 ≤ confidence < 100: 0.032 (신뢰 높음 → 둔감함)
     *     - confidence ≥ 100:    0.016 (최대 신뢰 → 매우 둔감)
     *
     * ratingChange = roundDuprRating((actualResultWeight - expectedWinProbability) × kFactor)
     *   → 점수 변화량. 예상과 실제 결과 차이가 클수록 변화가 큼.
     *
     * newRating = normalizeDuprRatingValue(oldRating + ratingChange)
     *   → 새로운 DUPR 점수 (정규화 적용 후)
     *
     * confidenceGain = clamp(round(1 + (peerConfidence / 100) × 4), 1, 5)
     *   → 신뢰도 증가량. 상대의 평균 신뢰도에 따라 1~5 사이로 증가.
     *
     * newConfidence = clamp(confidence + confidenceGain, 0, 100)
     *   → 업데이트된 신뢰도 (0~100 범위 제한).
     */

    const expectedWinProbability =
      1 / (1 + Math.pow(10, (opponentRating - currentRating) / 0.4));
    const actualResultWeight = isWinner ? 1 : 0;
    const kFactor = this.getKFactor(confidence) * correctionWeight;
    const ratingChange = roundDuprRating(
      (actualResultWeight - expectedWinProbability) * kFactor,
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
    const scoreMarginMultiplier = getScoreMarginMultiplier(match.scores);
    const setMarginMultiplier = getSetMarginMultiplier(match.scores);
    const teamRatings = ([0, 1] as const).map((teamIndex) => {
      const ratings = match.participants
        .filter((participant) => participant.teamIndex === teamIndex)
        .map((participant) =>
          getDuprRatingByCategory(participant.state.rating, category),
        );
      return average(ratings);
    });

    const nextStates: Record<string, StoredPlayerDupr> = {};
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
      const result = this.calculate({
        currentRating: getDuprRatingByCategory(
          participant.state.rating,
          category,
        ),
        opponentRating: teamRatings[participant.teamIndex === 0 ? 1 : 0],
        isWinner: participant.teamIndex === match.winnerTeamIndex,
        confidence: decayedConfidence,
        peerConfidence,
        correctionWeight:
          (correctionWeightByPlayerId[participant.playerId] ?? 1) *
          scoreMarginMultiplier *
          setMarginMultiplier,
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
