import {
  getMatchTopLevelType,
  type MatchType,
} from "@pkpkdupr/shared/match";
import {
  getCompositeDoublesRating as getSharedCompositeDoublesRating,
  getCompositeSinglesRating as getSharedCompositeSinglesRating,
  type PlayerDupr,
} from "@pkpkdupr/shared/player";

export const formatRating = (rating?: number | null) =>
  rating?.toFixed(3) ?? "NR";

export const getCompositeSinglesRating = (
  duprRating?: PlayerDupr | null,
) => getSharedCompositeSinglesRating(duprRating);

export const getCompositeDoublesRating = (
  duprRating?: PlayerDupr | null,
) => getSharedCompositeDoublesRating(duprRating);

export const getDisplayRatingForMatchType = (
  matchType: MatchType,
  duprRating?: PlayerDupr | null,
) =>
  getMatchTopLevelType(matchType) === "singles"
    ? getCompositeSinglesRating(duprRating)
    : getCompositeDoublesRating(duprRating);
