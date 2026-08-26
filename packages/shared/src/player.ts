export type PlayerStatus = "active" | "inactive";

export interface PlayerAffiliation {
  name: string;
  isPrimary: boolean;
}

export const PLAYER_AFFILIATION_MAX_COUNT = 5;
export const PLAYER_AFFILIATION_NAME_MAX_LENGTH = 30;
export const PLAYER_STATUS_MESSAGE_MAX_LENGTH = 20;
export const PLAYER_BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD 형식의 생년월일을 현지 날짜 기준으로 검증합니다. */
export const isValidPlayerBirthDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !PLAYER_BIRTH_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

/** 생년월일이 지나지 않은 해에는 한 살을 빼 만 나이를 계산합니다. */
export const getPlayerFullAge = (
  birthDate: string | null | undefined,
  now: Date = new Date(),
): number | null => {
  if (!isValidPlayerBirthDate(birthDate)) return null;

  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const age = now.getFullYear() - birthYear;
  const hasHadBirthday =
    now.getMonth() + 1 > birthMonth ||
    (now.getMonth() + 1 === birthMonth && now.getDate() >= birthDay);
  return Math.max(0, age - Number(!hasHadBirthday));
};

/**
 * 소속 비교와 매치 스냅샷에 쓰는 정규화된 이름입니다.
 * 표기만 다른 같은 소속을 하나로 취급하기 위해 앞뒤/연속 공백과 대소문자를
 * 정리합니다.
 */
export const normalizeAffiliationName = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return normalized || undefined;
};

export const normalizeAffiliationNames = (values: Iterable<unknown>): string[] => {
  const seen = new Set<string>();
  const normalizedNames: string[] = [];

  for (const value of values) {
    const normalizedName = normalizeAffiliationName(value);
    if (!normalizedName || seen.has(normalizedName)) {
      continue;
    }
    seen.add(normalizedName);
    normalizedNames.push(normalizedName);
  }

  return normalizedNames;
};

export type PlayerCreationSource =
  | "self_register"
  | "admin_register"
  | "bootstrap";

export interface PlayerDupr {
  singles: number;
  doubles: number;
}

export interface PublicPlayerDupr {
  singles: number | null;
  doubles: number | null;
}

export type PlayerDuprCategory = keyof PlayerDupr;

export interface PlayerDuprMetric {
  confidence: number;
  accuracy: number | null;
}

export interface PlayerDuprMetrics {
  singles: PlayerDuprMetric;
  doubles: PlayerDuprMetric;
}

export interface StoredPlayerDupr {
  rating: PlayerDupr;
  metrics: PlayerDuprMetrics;
}

export interface OfficialDuprAdjustmentLog {
  id: string;
  playerId: string;
  changedByPlayerId: string;
  changedByUsername: string;
  ratings: Partial<PlayerDupr>;
  confidence: Partial<Record<PlayerDuprCategory, number>>;
  previousRating: PlayerDupr;
  nextRating: PlayerDupr;
  preUpdateAccuracy: Partial<Record<PlayerDuprCategory, number | null>>;
  reason: string | null;
  createdAt: Date;
}

export type PlayerRatingChangeSource =
  | "official_adjustment_recalculation"
  | "manual_recalculation"
  | "match_completed";

export interface PlayerRatingChangeLog {
  id: string;
  playerId: string;
  source: PlayerRatingChangeSource;
  sourceLogId: string;
  previousRating: PlayerDupr;
  nextRating: PlayerDupr;
  delta: PlayerDupr;
  createdAt: Date;
}

/** 프로필 차트에 표시하는 재계산 완료 레이팅 지점입니다. */
export interface PlayerRatingHistoryPoint {
  rating: number;
  createdAt: Date;
  /**
   * 완료 경기, 현재 레이팅 또는 차트 표시 범위 시작을 위한 기준점입니다.
   * `anchor`는 원본 경기 데이터를 변형하지 않고 90일 projection의 시작값을
   * 연속적으로 연결하기 위한 파생 지점입니다.
   */
  source: "match" | "current" | "anchor";
}

export type PlayerRatingHistory = Record<
  PlayerDuprCategory,
  PlayerRatingHistoryPoint[]
>;

export interface OfficialDuprAdjustmentImpact {
  playerId: string;
  username: string;
  previousRating: PlayerDupr;
  nextRating: PlayerDupr;
  delta: PlayerDupr;
  relatedMatchCount: number;
}

export interface OfficialDuprAdjustmentPreview {
  player: Player;
  impacts: OfficialDuprAdjustmentImpact[];
}

export const DUPR_DEFAULT_RATING = 3.0;
export const DUPR_MIN_RATING = 2;
export const DUPR_MAX_RATING = 8;
const LEGACY_DUPR_DEFAULT_RATING = 3.5;
const LEGACY_SINGLES_KEYS = ["standard", "unrestricted"] as const;
const LEGACY_DOUBLES_KEYS = ["mixed", "men", "women", "unrestricted"] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const average = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

const averagePresent = (values: Array<number | null | undefined>) => {
  const presentValues = values.filter(
    (value): value is number => typeof value === "number",
  );
  return presentValues.length ? average(presentValues) : null;
};

export const roundDuprRating = (value: number) =>
  Math.round(value * 1000) / 1000;

export const normalizeDuprRatingValue = (value: unknown): number => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return DUPR_DEFAULT_RATING;
  }

  if (parsed === 1000) {
    return DUPR_DEFAULT_RATING;
  }

  const officialScaleValue = parsed > 10 ? parsed / 1000 : parsed;
  return roundDuprRating(
    clamp(officialScaleValue, DUPR_MIN_RATING, DUPR_MAX_RATING),
  );
};

const normalizeMetricValue = (
  value: unknown,
  fallback: PlayerDuprMetric = { confidence: 0, accuracy: null },
): PlayerDuprMetric => {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const confidence = Number(record.confidence ?? fallback.confidence);
  const rawAccuracy = record.accuracy ?? fallback.accuracy;
  const accuracy = rawAccuracy == null ? null : Number(rawAccuracy);

  return {
    confidence: Math.round(
      clamp(Number.isFinite(confidence) ? confidence : 0, 0, 100),
    ),
    accuracy:
      accuracy == null || !Number.isFinite(accuracy)
        ? null
        : Math.round(clamp(accuracy, 0, 100)),
  };
};

const getPrimitiveSeed = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number") {
      return normalizeDuprRatingValue(value);
    }

    if (typeof value === "string" && value.trim()) {
      return normalizeDuprRatingValue(value);
    }
  }

  return DUPR_DEFAULT_RATING;
};

const collapseLegacyRatings = (
  value: unknown,
  keys: readonly string[],
): number | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const values = keys
    .filter((key) => key in record)
    .map((key) => normalizeDuprRatingValue(record[key]));

  return values.length ? roundDuprRating(average(values)) : null;
};

const collapseLegacyMetricValues = (
  value: unknown,
  keys: readonly string[],
): PlayerDuprMetric | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const metrics = keys
    .filter((key) => key in record)
    .map((key) => normalizeMetricValue(record[key]));

  if (!metrics.length) {
    return null;
  }

  return {
    confidence: Math.round(average(metrics.map((metric) => metric.confidence))),
    accuracy: averagePresent(metrics.map((metric) => metric.accuracy)),
  };
};

const normalizeTrackRating = (
  value: unknown,
  fallback: number,
  legacyKeys: readonly string[],
) =>
  collapseLegacyRatings(value, legacyKeys) ??
  normalizeDuprRatingValue(value ?? fallback);

const normalizeTrackMetric = (
  value: unknown,
  fallback: PlayerDuprMetric = { confidence: 0, accuracy: null },
  legacyKeys: readonly string[],
) =>
  collapseLegacyMetricValues(value, legacyKeys) ??
  normalizeMetricValue(value, fallback);

export const getCompositeSinglesRating = (
  duprRating?: PlayerDupr | PublicPlayerDupr | null,
): number | null => duprRating?.singles ?? null;

export const getCompositeDoublesRating = (
  duprRating?: PlayerDupr | PublicPlayerDupr | null,
): number | null => duprRating?.doubles ?? null;

export const createDefaultPlayerDuprMetrics = (
  confidence = 0,
  accuracy: number | null = null,
): PlayerDuprMetrics => ({
  singles: { confidence, accuracy },
  doubles: { confidence, accuracy },
});

export const createDefaultPlayerDupr = (
  seed: unknown = DUPR_DEFAULT_RATING,
): PlayerDupr => {
  const normalizedSeed = normalizeDuprRatingValue(seed);
  return {
    singles: normalizedSeed,
    doubles: normalizedSeed,
  };
};

export const isDefaultPlayerDupr = (rating: PlayerDupr) =>
  rating.singles === DUPR_DEFAULT_RATING &&
  rating.doubles === DUPR_DEFAULT_RATING;

const isLegacyDefaultPlayerDupr = (rating: PlayerDupr) =>
  rating.singles === LEGACY_DUPR_DEFAULT_RATING &&
  rating.doubles === LEGACY_DUPR_DEFAULT_RATING;

export const normalizePlayerDupr = (value: unknown): PlayerDupr => {
  if (typeof value === "number" || typeof value === "string") {
    return createDefaultPlayerDupr(value);
  }

  if (!value || typeof value !== "object") {
    return createDefaultPlayerDupr();
  }

  const record = value as Record<string, unknown>;
  const ratingSource =
    record.rating && typeof record.rating === "object"
      ? (record.rating as Record<string, unknown>)
      : record;
  const baseSeed = getPrimitiveSeed(
    ratingSource.total,
    ratingSource.singles,
    ratingSource.doubles,
  );

  return {
    singles: normalizeTrackRating(
      ratingSource.singles,
      baseSeed,
      LEGACY_SINGLES_KEYS,
    ),
    doubles: normalizeTrackRating(
      ratingSource.doubles,
      baseSeed,
      LEGACY_DOUBLES_KEYS,
    ),
  };
};

const isDefaultPlayerDuprMetrics = (metrics: PlayerDuprMetrics) =>
  metrics.singles.confidence === 0 &&
  metrics.singles.accuracy == null &&
  metrics.doubles.confidence === 0 &&
  metrics.doubles.accuracy == null;

const hasMeaningfulMetric = (metric: PlayerDuprMetric) =>
  metric.confidence > 0 || metric.accuracy != null;

export const normalizeStoredPlayerDupr = (value: unknown): StoredPlayerDupr => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return {
        rating: createDefaultPlayerDupr(),
        metrics: createDefaultPlayerDuprMetrics(),
      };
    }

    if (trimmed.startsWith("{")) {
      try {
        return normalizeStoredPlayerDupr(JSON.parse(trimmed));
      } catch {
        return {
          rating: createDefaultPlayerDupr(),
          metrics: createDefaultPlayerDuprMetrics(),
        };
      }
    }

    return {
      rating: createDefaultPlayerDupr(trimmed),
      metrics: createDefaultPlayerDuprMetrics(),
    };
  }

  const rating = normalizePlayerDupr(value);
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const metricsSource =
    record.metrics && typeof record.metrics === "object"
      ? (record.metrics as Record<string, unknown>)
      : {};

  return {
    rating,
    metrics: {
      singles: normalizeTrackMetric(
        metricsSource.singles,
        { confidence: 0, accuracy: null },
        LEGACY_SINGLES_KEYS,
      ),
      doubles: normalizeTrackMetric(
        metricsSource.doubles,
        { confidence: 0, accuracy: null },
        LEGACY_DOUBLES_KEYS,
      ),
    },
  };
};

export const shouldStorePlayerDuprAsNull = (value: unknown): boolean => {
  if (value == null) {
    return true;
  }

  if (typeof value === "string" && !value.trim()) {
    return true;
  }

  const state = normalizeStoredPlayerDupr(value);
  return (
    (isDefaultPlayerDupr(state.rating) ||
      isLegacyDefaultPlayerDupr(state.rating)) &&
    isDefaultPlayerDuprMetrics(state.metrics)
  );
};

export const toPublicPlayerDupr = (
  state: StoredPlayerDupr,
): PublicPlayerDupr | null => {
  if (shouldStorePlayerDuprAsNull(state)) {
    return null;
  }

  if (isDefaultPlayerDuprMetrics(state.metrics)) {
    return {
      singles: state.rating.singles,
      doubles: state.rating.doubles,
    };
  }

  return {
    singles: hasMeaningfulMetric(state.metrics.singles)
      ? state.rating.singles
      : null,
    doubles: hasMeaningfulMetric(state.metrics.doubles)
      ? state.rating.doubles
      : null,
  };
};

export const normalizeNullablePlayerDupr = (
  value: unknown,
): PublicPlayerDupr | null =>
  toPublicPlayerDupr(normalizeStoredPlayerDupr(value));

export const serializeStoredPlayerDupr = (value: StoredPlayerDupr) =>
  JSON.stringify({
    rating: normalizePlayerDupr(value.rating),
    metrics: value.metrics,
  });

export const getDuprRatingByCategory = (
  rating: PlayerDupr,
  category: PlayerDuprCategory,
) => rating[category];

export const setDuprRatingByCategory = (
  rating: PlayerDupr,
  category: PlayerDuprCategory,
  value: number,
): PlayerDupr => ({
  ...rating,
  [category]: normalizeDuprRatingValue(value),
});

export const getDuprMetricByCategory = (
  metrics: PlayerDuprMetrics,
  category: PlayerDuprCategory,
) => metrics[category];

export const setDuprMetricByCategory = (
  metrics: PlayerDuprMetrics,
  category: PlayerDuprCategory,
  value: PlayerDuprMetric,
): PlayerDuprMetrics => ({
  ...metrics,
  [category]: normalizeMetricValue(value),
});

export interface Player {
  id: string;
  username: string;
  duprRating: PublicPlayerDupr | null;
  gender: "M" | "F";
  /** 내부 자격 판정에만 쓰는 YYYY-MM-DD 형식의 생년월일입니다. 공개 API에는 포함하지 않습니다. */
  birthDate?: string;
  /** 공개 프로필에 표시하는 계산된 만 나이입니다. */
  age?: number | null;
  status: PlayerStatus;
  avatarUrl?: string;
  affiliations?: PlayerAffiliation[];
  statusMessage?: string;
  statusMessageBackgroundColor?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 모든 참가자가 공통으로 가진 소속명만 정규화해 반환합니다. */
export const getCommonAffiliationNames = (
  participants: ReadonlyArray<Pick<Player, "affiliations">>,
): string[] => {
  if (participants.length === 0) {
    return [];
  }

  const [firstParticipant, ...remainingParticipants] = participants;
  const firstNames = normalizeAffiliationNames(
    (firstParticipant.affiliations ?? []).map((affiliation) =>
      affiliation.name,
    ),
  );

  return firstNames.filter((name) =>
    remainingParticipants.every((participant) =>
      normalizeAffiliationNames(
        (participant.affiliations ?? []).map((affiliation) => affiliation.name),
      ).includes(name),
    ),
  );
};

export interface MemberListPlayer extends Player {
  lastPlayedAt: Date | null;
}

export interface PlayerProfile extends Player {
  totalMatches: number;
  winRate: number;
}

export interface PlayerCreationLog {
  id: string;
  playerId: string;
  createdByPlayerId: string | null;
  createdByUsername: string;
  creationSource: PlayerCreationSource;
  createdAt: Date;
}

export interface PlayerStatusChangeLog {
  id: string;
  playerId: string;
  previousStatus: PlayerStatus;
  nextStatus: PlayerStatus;
  changedByPlayerId: string;
  changedByUsername: string;
  changedAt: Date;
}
