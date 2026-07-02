export type PlayerStatus = "active" | "inactive";

export type PlayerCreationSource =
  | "self_register"
  | "admin_register"
  | "bootstrap";

export interface PlayerDuprDoubles {
  mixed: number;
  men: number;
  women: number;
}

export interface PlayerDupr {
  total: number;
  doubles: PlayerDuprDoubles;
  singles: number;
}

export type PlayerDuprDoublesKey = keyof PlayerDuprDoubles;
export type PlayerDuprCategory = "singles" | `doubles.${PlayerDuprDoublesKey}`;

export interface PlayerDuprMetric {
  confidence: number;
  accuracy: number | null;
}

export interface PlayerDuprMetricsDoubles {
  mixed: PlayerDuprMetric;
  men: PlayerDuprMetric;
  women: PlayerDuprMetric;
}

export interface PlayerDuprMetrics {
  doubles: PlayerDuprMetricsDoubles;
  singles: PlayerDuprMetric;
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
  ratings: Partial<{
    singles: number;
    doubles: Partial<PlayerDuprDoubles>;
  }>;
  confidence: Partial<{
    singles: number;
    doubles: Partial<Record<PlayerDuprDoublesKey, number>>;
  }>;
  previousRating: PlayerDupr;
  nextRating: PlayerDupr;
  preUpdateAccuracy: Partial<{
    singles: number | null;
    doubles: Partial<Record<PlayerDuprDoublesKey, number | null>>;
  }>;
  reason: string | null;
  createdAt: Date;
}

export type PlayerRatingChangeSource =
  | "official_adjustment_recalculation"
  | "manual_recalculation";

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

export const DUPR_DEFAULT_RATING = 3.5;
export const DUPR_MIN_RATING = 2;
export const DUPR_MAX_RATING = 8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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
    confidence: Math.round(clamp(Number.isFinite(confidence) ? confidence : 0, 0, 100)),
    accuracy:
      accuracy == null || !Number.isFinite(accuracy)
        ? null
        : Math.round(clamp(accuracy, 0, 100)),
  };
};

export const createDefaultPlayerDuprMetrics = (
  confidence = 0,
  accuracy: number | null = null,
): PlayerDuprMetrics => ({
  doubles: {
    mixed: { confidence, accuracy },
    men: { confidence, accuracy },
    women: { confidence, accuracy },
  },
  singles: { confidence, accuracy },
});

export const computeTotalDuprRating = (rating: Omit<PlayerDupr, "total">) =>
  roundDuprRating(
    (rating.singles +
      rating.doubles.mixed +
      rating.doubles.men +
      rating.doubles.women) /
      4,
  );

export const createDefaultPlayerDupr = (
  seed: unknown = DUPR_DEFAULT_RATING,
): PlayerDupr => {
  const normalizedSeed = normalizeDuprRatingValue(seed);
  const rating = {
    doubles: {
      mixed: normalizedSeed,
      men: normalizedSeed,
      women: normalizedSeed,
    },
    singles: normalizedSeed,
  };

  return {
    ...rating,
    total: computeTotalDuprRating(rating),
  };
};

export const isDefaultPlayerDupr = (rating: PlayerDupr) =>
  rating.total === DUPR_DEFAULT_RATING &&
  rating.singles === DUPR_DEFAULT_RATING &&
  rating.doubles.mixed === DUPR_DEFAULT_RATING &&
  rating.doubles.men === DUPR_DEFAULT_RATING &&
  rating.doubles.women === DUPR_DEFAULT_RATING;

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
  const baseTotal = normalizeDuprRatingValue(ratingSource.total);
  const doubles =
    ratingSource.doubles && typeof ratingSource.doubles === "object"
      ? (ratingSource.doubles as Record<string, unknown>)
      : {};
  const rating = {
    doubles: {
      mixed: normalizeDuprRatingValue(doubles.mixed ?? baseTotal),
      men: normalizeDuprRatingValue(doubles.men ?? baseTotal),
      women: normalizeDuprRatingValue(doubles.women ?? baseTotal),
    },
    singles: normalizeDuprRatingValue(ratingSource.singles ?? baseTotal),
  };

  return {
    ...rating,
    total: computeTotalDuprRating(rating),
  };
};

const isDefaultPlayerDuprMetrics = (metrics: PlayerDuprMetrics) =>
  metrics.singles.confidence === 0 &&
  metrics.singles.accuracy == null &&
  metrics.doubles.mixed.confidence === 0 &&
  metrics.doubles.mixed.accuracy == null &&
  metrics.doubles.men.confidence === 0 &&
  metrics.doubles.men.accuracy == null &&
  metrics.doubles.women.confidence === 0 &&
  metrics.doubles.women.accuracy == null;

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
  const doubles =
    metricsSource.doubles && typeof metricsSource.doubles === "object"
      ? (metricsSource.doubles as Record<string, unknown>)
      : {};

  return {
    rating,
    metrics: {
      doubles: {
        mixed: normalizeMetricValue(doubles.mixed),
        men: normalizeMetricValue(doubles.men),
        women: normalizeMetricValue(doubles.women),
      },
      singles: normalizeMetricValue(metricsSource.singles),
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
    isDefaultPlayerDupr(state.rating) && isDefaultPlayerDuprMetrics(state.metrics)
  );
};

export const normalizeNullablePlayerDupr = (value: unknown): PlayerDupr | null =>
  shouldStorePlayerDuprAsNull(value)
    ? null
    : normalizeStoredPlayerDupr(value).rating;

export const serializeStoredPlayerDupr = (value: StoredPlayerDupr) =>
  JSON.stringify({
    rating: normalizePlayerDupr(value.rating),
    metrics: value.metrics,
  });

export const getDuprRatingByCategory = (
  rating: PlayerDupr,
  category: PlayerDuprCategory,
) => {
  if (category === "singles") {
    return rating.singles;
  }
  return rating.doubles[category.split(".")[1] as PlayerDuprDoublesKey];
};

export const setDuprRatingByCategory = (
  rating: PlayerDupr,
  category: PlayerDuprCategory,
  value: number,
): PlayerDupr => {
  const next: Omit<PlayerDupr, "total"> = {
    doubles: { ...rating.doubles },
    singles: rating.singles,
  };

  if (category === "singles") {
    next.singles = normalizeDuprRatingValue(value);
  } else {
    next.doubles[category.split(".")[1] as PlayerDuprDoublesKey] =
      normalizeDuprRatingValue(value);
  }

  return {
    ...next,
    total: computeTotalDuprRating(next),
  };
};

export const getDuprMetricByCategory = (
  metrics: PlayerDuprMetrics,
  category: PlayerDuprCategory,
) => {
  if (category === "singles") {
    return metrics.singles;
  }
  return metrics.doubles[category.split(".")[1] as PlayerDuprDoublesKey];
};

export const setDuprMetricByCategory = (
  metrics: PlayerDuprMetrics,
  category: PlayerDuprCategory,
  value: PlayerDuprMetric,
): PlayerDuprMetrics => {
  if (category === "singles") {
    return { ...metrics, singles: normalizeMetricValue(value) };
  }

  const key = category.split(".")[1] as PlayerDuprDoublesKey;
  return {
    ...metrics,
    doubles: {
      ...metrics.doubles,
      [key]: normalizeMetricValue(value),
    },
  };
};

export interface Player {
  id: string;
  username: string;
  duprRating: PlayerDupr | null;
  gender: "M" | "F";
  status: PlayerStatus;
  //   birthYear?: number;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerProfile extends Player {
  //   bio?: string;
  //   city?: string;
  //   state?: string;
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
