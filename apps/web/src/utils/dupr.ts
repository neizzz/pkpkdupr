import type { PlayerDupr } from "@pkpkdupr/shared/player";
import type { PlayerInfo } from "@/context/AuthContext";

export const formatRating = (rating?: number | null) =>
  rating?.toFixed(3) ?? "NR";

export const getSameGenderDoublesRating = (
  duprRating?: PlayerDupr | null,
  gender?: PlayerInfo["gender"],
) => {
  if (!duprRating) {
    return null;
  }

  if (gender === "F") {
    return duprRating.doubles.women;
  }

  if (gender === "M") {
    return duprRating.doubles.men;
  }

  return null;
};

export const getCompositeDoublesRating = (
  duprRating?: PlayerDupr | null,
  gender?: PlayerInfo["gender"],
) => {
  const ratings = [
    duprRating?.doubles.mixed,
    getSameGenderDoublesRating(duprRating, gender),
  ].filter((rating): rating is number => typeof rating === "number");

  if (ratings.length === 0) {
    return null;
  }

  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
};
