import React from "react";
import { Card } from "@heroui/react";
import type { MatchType } from "@pkpkdupr/shared/match";
import { matchTypeLabels, matchTypeValues } from "@pkpkdupr/shared/match";
import Avatar from "@/components/Avatar";
import type { PlayerInfo } from "@/context/AuthContext";

export type MemberProfileMatchStats = Record<
  MatchType,
  {
    wins: number;
    losses: number;
  }
>;

interface MemberProfileProps {
  player: PlayerInfo | null;
  memberName?: string;
  isMe: boolean;
  headerAction?: React.ReactNode;
  matchStats?: MemberProfileMatchStats;
}

const formatRating = (rating?: number | null) => rating?.toFixed(3) ?? "NR";

const MemberProfile: React.FC<MemberProfileProps> = ({
  player,
  memberName,
  isMe,
  headerAction,
  matchStats,
}) => {
  const displayName =
    memberName || player?.username || player?.id || "Unknown Member";
  const genderDoublesType: MatchType =
    player?.gender === "F" ? "women-doubles" : "men-doubles";

  const ratingByMatchType: Record<MatchType, string> = {
    singles: formatRating(player?.duprRating?.singles),
    "mixed-doubles": formatRating(player?.duprRating?.doubles.mixed),
    "men-doubles": formatRating(player?.duprRating?.doubles.men),
    "women-doubles": formatRating(player?.duprRating?.doubles.women),
  };

  const hiddenGenderDoublesType: MatchType =
    genderDoublesType === "men-doubles" ? "women-doubles" : "men-doubles";
  const displayedRatingTypes: MatchType[] = matchStats
    ? matchTypeValues.filter((type) => type !== hiddenGenderDoublesType)
    : ["singles", "mixed-doubles", genderDoublesType];

  const duprItems = displayedRatingTypes.map((type) => {
    const stats = matchStats?.[type];
    const playedCount = stats ? stats.wins + stats.losses : 0;
    const winRate =
      stats && playedCount > 0
        ? `${Math.round((stats.wins / playedCount) * 100)}%`
        : stats
          ? "0%"
          : "-";

    return {
      type,
      label: matchTypeLabels[type],
      rating: ratingByMatchType[type],
      cards: [
        {
          label: "Rating",
          value: ratingByMatchType[type],
        },
        {
          label: "승률",
          value: winRate,
        },
        {
          label: "승-패",
          value: stats ? `${stats.wins}-${stats.losses}` : "-",
        },
      ],
    };
  });

  const renderStatCard = (card: { label: string; value: string }) => (
    <Card
      key={card.label}
      className="rounded-2xl bg-[rgba(255,205,0,0.07)] px-4 py-5 shadow-sm"
    >
      <p className="text-lg font-semibold leading-[0.85] text-amber-950">
        {card.value}
      </p>
      <p className="text-xs leading-[0.7] text-amber-700/80">{card.label}</p>
    </Card>
  );

  return (
    <div className="min-h-full p-2">
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-3">
        <div className="flex items-start gap-4">
          <Avatar
            size="sm"
            avatarUrl={player?.avatarUrl}
            name={displayName}
            isMe={isMe}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="mt-1 truncate text-2xl font-bold text-amber-950">
                  {displayName}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {headerAction}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-amber-950">
            PkpkDUPR Rating
          </h3>
          {matchStats ? (
            <div className="mt-4 flex flex-col gap-4">
              {duprItems.map((item) => (
                <div key={item.type}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                    {item.label}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    {item.cards.map(renderStatCard)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {duprItems.map((item) => (
                <Card
                  key={item.type}
                  className="rounded-2xl bg-[rgba(255,205,0,0.07)] px-4 py-5 shadow-sm"
                >
                  <p className="text-lg font-semibold leading-[0.85] text-amber-950">
                    {item.rating}
                  </p>
                  <p className="text-xs leading-[0.7] text-amber-700/80">
                    {item.label}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberProfile;
