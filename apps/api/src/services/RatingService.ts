import type { MatchScore, MatchType } from "@pkpkdupr/shared/match";
import {
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
  /** 현재 레이팅 차이로 계산한 승리 확률 */
  expectedWinProbability: number;
  /** 실제 승패를 1(승) 또는 0(패)으로 표현한 값 */
  actualResultWeight: number;
  /** confidence 구간과 외부 보정값을 모두 반영한 최종 K-factor */
  kFactor: number;
  /** 이번 경기에서 적용할 레이팅 증감값 */
  ratingChange: number;
  oldRating: number;
  newRating: number;
  oldConfidence: number;
  newConfidence: number;
}

export interface MatchParticipantRatingInput {
  playerId: string;
  teamIndex: 0 | 1;
  /** 해당 경기를 처리하기 직전의 레이팅과 confidence 스냅샷 */
  state: StoredPlayerDupr;
}

/**
 * 한 경기를 재생하기 위한 알고리즘 공통 입력입니다.
 *
 * AuthService는 완료 경기를 시간순으로 정렬하고, 직전 경기의 출력 상태를
 * 다음 경기의 입력 상태로 전달합니다. 구현체는 전달받은 값을 직접 수정하지
 * 않고 참가자별 새 상태를 반환해야 합니다.
 */
export interface MatchReplayInput {
  type: MatchType;
  winnerTeamIndex: 0 | 1;
  participants: MatchParticipantRatingInput[];
  scores?: MatchScore[];
  inactiveElapsedMsByPlayerId?: Record<string, number>;
}

/**
 * 평점 알고리즘 구현체가 AuthService에 제공해야 하는 최소 계약입니다.
 *
 * 세부 계산식과 K-factor는 구현체마다 달라도 AuthService의 전체 경기 재생,
 * 공식 DUPR 보정, 미리보기 흐름은 이 계약만 의존합니다. 따라서 알고리즘을
 * 교체해도 저장과 전체 재생 처리 흐름은 바뀌지 않습니다.
 */
export interface RatingServiceContract {
  /** 내부 레이팅이 공식 DUPR과 얼마나 가까운지 0~100으로 환산합니다. */
  getAccuracy(internalRating: number, officialRating: number): number;
  /** 공식값 반영 전 accuracy를 후속 경기 보정 가중치로 변환합니다. */
  getCorrectionWeight(preUpdateAccuracy: number | null): number;
  /** 한 경기의 모든 참가자를 같은 경기 전 상태에서 계산해 새 상태로 반환합니다. */
  replayMatch(
    match: MatchReplayInput,
    correctionWeightByPlayerId?: Record<string, number>,
  ): Record<string, StoredPlayerDupr>;
}

/**
 * 기존 승패식의 confidence별 기본 K-factor입니다.
 * confidence가 낮을수록 아직 불확실한 레이팅으로 보고 더 크게 움직입니다.
 */
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
/** 마지막 경기 후 14일까지는 confidence를 유지합니다. */
const CONFIDENCE_DECAY_GRACE_PERIOD_MS = 14 * DAY_MS;
/** 유예기간 이후 미참여 하루마다 감소하는 confidence입니다. */
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

/**
 * 전체 득점 차이를 기존 승패식의 추가 K-factor 배율로 변환합니다.
 *
 * 득점 차이가 없으면 1이고 한쪽이 모든 점수를 가져간 이론상 최대값은
 * 1.5입니다. 스코어가 없는 과거 경기는 중립값 1을 반환합니다.
 */
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

/**
 * 여러 게임으로 구성된 경기에서 세트 스코어 차이를 추가 가중치로 환산합니다.
 * 2:0처럼 명확한 승리는 1.08, 2:1 승리는 1.03을 적용하며 단판에는 적용하지
 * 않습니다.
 */
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

/**
 * 장기간 경기가 없었던 선수의 confidence를 경기 직전에 감쇠합니다.
 *
 * 저장된 confidence 자체를 매일 갱신하지 않고, 다음 경기를 재생하는 순간
 * 경과일을 계산하기 때문에 배치 작업 없이도 동일한 결과를 재현할 수 있습니다.
 */
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

/** 경기 세부 타입을 실제로 갱신할 singles/doubles 트랙으로 변환합니다. */
export const getDuprCategoryForMatchType = (
  matchType: MatchType,
): PlayerDuprCategory => {
  if (matchType === "singles" || matchType === "unrestricted-singles") {
    return "singles";
  }

  return "doubles";
};

/**
 * 기존 승패 기반 레이팅 구현체입니다.
 *
 * 팀 평균 레이팅으로 기대 승률을 구하고 실제 승패(1 또는 0)와의 차이에
 * K-factor를 곱합니다. 점수 차와 세트 차는 기대 승률을 바꾸지 않고
 * K-factor 보정값으로만 사용합니다.
 */
export class RatingService implements RatingServiceContract {
  /** confidence를 정규화한 뒤 해당 구간의 K-factor를 선택합니다. */
  getKFactor(confidence: number): number {
    const normalized = clamp(Math.round(confidence), 0, 100);
    return CONFIDENCE_K_FACTORS.find(
      ({ maxExclusive }) => normalized < maxExclusive,
    )!.kFactor;
  }

  /**
   * 공식 DUPR과 0.5 이상 차이가 나면 accuracy가 0이 되도록 선형 환산합니다.
   * 이 값은 공식값 자체를 계산하는 공식이 아니라 보정 강도를 정하기 위한
   * 내부 지표입니다.
   */
  getAccuracy(internalRating: number, officialRating: number): number {
    const accuracy =
      100 - (Math.abs(internalRating - officialRating) / 0.5) * 100;
    return Math.round(clamp(accuracy, 0, 100));
  }

  /**
   * accuracy가 낮을수록 후속 경기의 영향을 크게 전달합니다.
   * 최소값 0.1은 accuracy가 높아도 경기 영향이 완전히 사라지지 않게 합니다.
   */
  getCorrectionWeight(preUpdateAccuracy: number | null): number {
    if (preUpdateAccuracy == null) {
      return 1;
    }
    return clamp((100 - preUpdateAccuracy) / 100, 0.1, 1);
  }

  /**
   * 한 선수를 대상으로 기존 승패식의 단일 레이팅 변화를 계산합니다.
   *
   * `correctionWeight`에는 공식값 보정, 최근 경기 감쇠, 점수 차 및 세트 차
   * 가중치가 호출부에서 합산되어 들어올 수 있습니다.
   */
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

    /*
     * 기존 승패식 계산 공식 (Elo 시스템 변형):
     *
     * expectedWinProbability = 1 / (1 + 10^((opponentRating - currentRating) / 0.4))
     *   → 상대 팀 평균보다 레이팅이 높을수록 1에 가까워집니다.
     *
     * actualResultWeight = isWinner ? 1 : 0
     *   → 실제 결과 가중치. 승자=1, 패자=0
     *
     * kFactor = CONFIDENCE_K_FACTORS[confidence_bucket].kFactor × correctionWeight
     *   → confidence가 높을수록 변화가 작고 외부 보정값이 클수록 커집니다.
     *   신뢰도 구간별 kFactor:
     *     - 0 ≤ confidence < 20:   0.064
     *     - 20 ≤ confidence < 50:  0.048
     *     - 50 ≤ confidence < 80:  0.032
     *     - 80 ≤ confidence ≤ 100: 0.016
     *
     * ratingChange = roundDuprRating((actualResultWeight - expectedWinProbability) × kFactor)
     *   → 이변일수록 절댓값이 커지고 예상된 결과일수록 작아집니다.
     *
     * newRating = normalizeDuprRatingValue(oldRating + ratingChange)
     *   → 레이팅 허용 범위와 소수점 정밀도를 정규화합니다.
     *
     * confidenceGain = clamp(round(1 + (peerConfidence / 100) × 4), 1, 5)
     *   → 자신을 제외한 경기 참가자들의 평균 confidence가 높을수록 이번
     *     경기의 정보 신뢰도가 높다고 보고 1~5만큼 증가시킵니다.
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

  /**
   * 완료 경기 한 건을 참가자 전체에 재생합니다.
   *
   * 처리 순서:
   * 1. 경기 타입에 맞는 singles/doubles 트랙과 양 팀 평균 레이팅을 계산
   * 2. 점수 차·세트 차, 공식값 보정 및 최근 경기 가중치를 최종 weight로 결합
   * 3. 장기 미참여자의 confidence를 경기 시점 기준으로 감쇠
   * 4. 모든 참가자를 동일한 경기 전 스냅샷에서 계산
   * 5. 대상 트랙만 교체하고 다른 트랙과 accuracy는 그대로 보존
   */
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
        rating: nextRating,
        metrics: nextMetrics,
      };
    }

    return nextStates;
  }
}
