import React, { useRef, useState } from "react";
import type { MatchTopLevelType } from "@pkpkdupr/shared/match";
import { matchTopLevelTypeLabels } from "@pkpkdupr/shared/match";
import { IoPeople, IoPerson } from "react-icons/io5";
import Avatar from "@/components/Avatar";
import CopyableId from "@/components/CopyableId";
import DetailPageHeader from "@/components/DetailPageHeader";
import RatingDeltaChip from "@/components/RatingDeltaChip";
import SkeletonBlock from "@/components/SkeletonBlock";
import type { PlayerInfo } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { resizeAvatarImage } from "@/utils/avatar";
import {
  formatRating,
  getCompositeDoublesRating,
  getCompositeSinglesRating,
} from "@/utils/dupr";

export type MemberProfileMatchStats = Record<
  MatchTopLevelType,
  {
    matchWins: number;
    matchLosses: number;
    setWins: number;
    setLosses: number;
  }
>;

export type MemberProfileRatingDelta = Record<
  MatchTopLevelType,
  {
    last7Days: number;
    last30Days: number;
  }
>;

interface MemberProfileProps {
  player: PlayerInfo | null;
  memberName?: string;
  isMe: boolean;
  showDetailHeader?: boolean;
  headerAction?: React.ReactNode;
  matchStats?: MemberProfileMatchStats;
  ratingDelta?: MemberProfileRatingDelta;
  isStatsLoading?: boolean;
  showPlayerId?: boolean;
}

const ProfileStatsSkeleton: React.FC = () => (
  <div
    className="flex flex-col gap-3"
    role="status"
    aria-label="프로필 통계 로딩 중"
  >
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 2 }, (_, index) => (
        <SkeletonBlock key={index} className="h-[4.75rem] rounded-xl" />
      ))}
    </div>
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 2 }, (_, index) => (
        <SkeletonBlock key={index} className="h-[4.75rem] rounded-xl" />
      ))}
    </div>
  </div>
);

const MemberProfile: React.FC<MemberProfileProps> = ({
  player,
  memberName,
  isMe,
  showDetailHeader = true,
  headerAction,
  matchStats,
  ratingDelta,
  isStatsLoading = false,
  showPlayerId = false,
}) => {
  const displayName =
    memberName || player?.username || player?.id || "Unknown Member";
  const [expandedType, setExpandedType] = useState<MatchTopLevelType | null>(
    "doubles",
  );
  const [isUploading, setIsUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const { uploadAvatar, refreshMe } = useAuth();
  const isOnline = useOnlineStatus();

  const duprItems = (["doubles", "singles"] as const).map((type) => {
    const stats = matchStats?.[type];
    const matchPlayed = stats ? stats.matchWins + stats.matchLosses : 0;
    const matchWinRate =
      stats && matchPlayed > 0
        ? `${Math.round((stats.matchWins / matchPlayed) * 100)}%`
        : stats
          ? "0%"
          : "-";
    const setPlayed = stats ? stats.setWins + stats.setLosses : 0;
    const setWinRate =
      stats && setPlayed > 0
        ? `${Math.round((stats.setWins / setPlayed) * 100)}%`
        : stats
          ? "0%"
          : "-";
    const rating =
      type === "singles"
        ? formatRating(getCompositeSinglesRating(player?.duprRating))
        : formatRating(getCompositeDoublesRating(player?.duprRating));
    const delta = ratingDelta?.[type];

    return {
      type,
      label: matchTopLevelTypeLabels[type],
      icon: type === "doubles" ? IoPeople : IoPerson,
      rating,
      matchWinRate,
      matchWinLoss: stats ? `${stats.matchWins}-${stats.matchLosses}` : "-",
      setWinRate,
      setWinLoss: stats ? `${stats.setWins}-${stats.setLosses}` : "-",
      delta7d: delta?.last7Days ?? 0,
      delta30d: delta?.last30Days ?? 0,
      hasDelta7d: (delta?.last7Days ?? 0) !== 0,
      hasDelta30d: (delta?.last30Days ?? 0) !== 0,
    };
  });

  const handleCardClick = (type: MatchTopLevelType) => {
    setExpandedType(type);
  };

  const expandedItem = duprItems.find((item) => item.type === expandedType);

  const handleAvatarEditClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isUploading || !isOnline) return;

    setIsUploading(true);
    try {
      const dataUrl = await resizeAvatarImage(file);
      await uploadAvatar(dataUrl);
      await refreshMe();
    } catch {
      // silently ignore upload errors
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-full">
      {showDetailHeader ? <DetailPageHeader title="Member Profile" /> : null}
      <div className="p-2">
        <div className="mx-auto flex w-full max-w-[390px] flex-col gap-3">
          <div className="flex flex-col items-center gap-2 pt-5 mb-1">
            <Avatar
              size="lg"
              avatarUrl={player?.avatarUrl}
              name={displayName}
              onEditClick={
                isMe && !isUploading ? handleAvatarEditClick : undefined
              }
            />
            {isMe ? (
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                className="hidden"
              />
            ) : null}
            <div className="flex max-w-full flex-col items-center gap-1">
              <div className="flex max-w-full items-center gap-2">
                <h2 className="min-w-0 truncate text-2xl text-pkpk-main-font">
                  {displayName}
                </h2>
                {headerAction}
              </div>
              {showPlayerId && player?.id ? (
                <CopyableId
                  label="Player ID"
                  value={player.id}
                  showLabel={false}
                />
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-pkpk-secondary-bg to-pkpk-primary-bg p-4">
            <h3 className="text-[1.625rem] font-bold text-pkpk-secondary-font">
              Rating
            </h3>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {duprItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleCardClick(item.type)}
                    className={`rounded-xl px-4 py-4 text-left transition-colors ${
                      expandedType === item.type
                        ? "bg-white/25"
                        : "bg-white/15 hover:bg-white/20"
                    }`}
                  >
                    <p className="text-2xl font-bold leading-none text-pkpk-secondary-font">
                      {item.rating}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-pkpk-secondary-font/70">
                      <Icon className="size-3" />
                      {item.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {isStatsLoading ? (
            <ProfileStatsSkeleton />
          ) : expandedItem ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold text-pkpk-sub-font">
                    매치 승률
                  </p>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <p className="text-lg font-semibold leading-tight text-pkpk-main-font">
                      {expandedItem.matchWinRate}
                    </p>
                    <p className="text-xs text-pkpk-sub-font">
                      {expandedItem.matchWinLoss}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold text-pkpk-sub-font">
                    세트 승률
                  </p>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <p className="text-lg font-semibold leading-tight text-pkpk-main-font">
                      {expandedItem.setWinRate}
                    </p>
                    <p className="text-xs text-pkpk-sub-font">
                      {expandedItem.setWinLoss}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold text-pkpk-sub-font">
                    최근 7일 변동
                  </p>
                  <div className="mt-1">
                    <RatingDeltaChip
                      delta={expandedItem.delta7d}
                      hasData={expandedItem.hasDelta7d}
                    />
                  </div>
                </div>
                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold text-pkpk-sub-font">
                    최근 30일 변동
                  </p>
                  <div className="mt-1">
                    <RatingDeltaChip
                      delta={expandedItem.delta30d}
                      hasData={expandedItem.hasDelta30d}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MemberProfile;
