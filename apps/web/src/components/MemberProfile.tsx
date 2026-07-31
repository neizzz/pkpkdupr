import React, { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@heroui/react";
import type { PlayerAffiliation } from "@pkpkdupr/shared/player";
import type { MatchTopLevelType } from "@pkpkdupr/shared/match";
import { matchTopLevelTypeLabels } from "@pkpkdupr/shared/match";
import { IoChevronForward, IoPeople, IoPerson } from "react-icons/io5";
import Avatar from "@/components/Avatar";
import AvatarUploadConfirmSheetBody from "@/components/AvatarUploadConfirmSheetBody";
import BottomSheet from "@/components/BottomSheet";
import CopyableId from "@/components/CopyableId";
import DetailPageHeader from "@/components/DetailPageHeader";
import RatingDeltaChip from "@/components/RatingDeltaChip";
import RatingHistoryChart from "@/components/RatingHistoryChart";
import PlayerProfileMeta from "@/components/PlayerProfileMeta";
import ProfileMatchList, {
  type ProfileMatchListItem,
} from "@/components/ProfileMatchList";
import SkeletonBlock from "@/components/SkeletonBlock";
import StatusMessageEditSheetBody from "@/components/StatusMessageEditSheetBody";
import type { PlayerInfo } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";
import { useMinimumLoading } from "@/hooks/useMinimumLoading";
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

export interface MemberProfileRatingHistoryPoint {
  rating: number;
  createdAt: string;
  source: "match" | "official-adjustment" | "current";
}

export type MemberProfileRatingHistory = Record<
  MatchTopLevelType,
  MemberProfileRatingHistoryPoint[]
>;

interface MemberProfileProps {
  player: PlayerInfo | null;
  memberName?: string;
  isMe: boolean;
  showDetailHeader?: boolean;
  headerAction?: React.ReactNode;
  matchStats?: MemberProfileMatchStats;
  ratingDelta?: MemberProfileRatingDelta;
  ratingHistory?: MemberProfileRatingHistory;
  isStatsLoading?: boolean;
  recentMatches?: ProfileMatchListItem[];
  showPlayerId?: boolean;
  onPressRecentMatch?: (match: ProfileMatchListItem["match"]) => void;
  onViewAllMatches?: () => void;
  onProfileUpdated?: (player: PlayerInfo) => void;
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
  ratingHistory,
  isStatsLoading = false,
  recentMatches = [],
  showPlayerId = false,
  onPressRecentMatch,
  onViewAllMatches,
  onProfileUpdated,
}) => {
  const [profileOverride, setProfileOverride] = useState<PlayerInfo | null>(null);
  const displayName =
    memberName || player?.username || player?.id || "Unknown Member";
  const [expandedType, setExpandedType] = useState<MatchTopLevelType | null>(
    "doubles",
  );
  const [isUploading, setIsUploading] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isAvatarConfirmOpen, setIsAvatarConfirmOpen] = useState(false);
  const [isStatusEditorOpen, setIsStatusEditorOpen] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const { uploadAvatar, refreshMe, updateProfile } = useAuth();
  const { closeDepth, pushDepth, selectedTab } = useTabNavigation();
  const isOnline = useOnlineStatus();
  const isProfileStatsLoading = useMinimumLoading(isStatsLoading);
  const displayedPlayer: PlayerInfo | null =
    profileOverride?.id === player?.id && player
      ? { ...player, ...profileOverride }
      : player;
  const avatarConfirmDepthId = `profile-avatar-confirm:${player?.id ?? "unknown"}`;
  const statusEditorDepthId = `profile-status-editor:${player?.id ?? "unknown"}`;

  useEffect(() => {
    setProfileOverride(null);
  }, [player]);

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
        ? formatRating(getCompositeSinglesRating(displayedPlayer?.duprRating))
        : formatRating(getCompositeDoublesRating(displayedPlayer?.duprRating));
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

  const closeAvatarConfirm = useCallback(() => {
    setIsAvatarConfirmOpen(false);
    setAvatarPreviewUrl(null);
  }, []);

  const openAvatarConfirm = useCallback(
    (previewUrl: string) => {
      pushDepth(selectedTab, {
        id: avatarConfirmDepthId,
        kind: "bottom-sheet",
        onClose: closeAvatarConfirm,
      });
      setAvatarPreviewUrl(previewUrl);
      setIsAvatarConfirmOpen(true);
    },
    [avatarConfirmDepthId, closeAvatarConfirm, pushDepth, selectedTab],
  );

  const handleAvatarFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isUploading || !isOnline) return;

    try {
      const dataUrl = await resizeAvatarImage(file);
      openAvatarConfirm(dataUrl);
    } catch {
      // silently ignore upload errors
    }
  };

  const confirmAvatarUpload = async () => {
    if (!avatarPreviewUrl || isUploading || !isOnline) return;

    setIsUploading(true);
    try {
      await uploadAvatar(avatarPreviewUrl);
      await refreshMe();
      closeDepth(selectedTab, avatarConfirmDepthId);
      closeAvatarConfirm();
    } catch {
      // keep the preview open so the user can retry or cancel
    } finally {
      setIsUploading(false);
    }
  };

  const handleAvatarConfirmOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setIsAvatarConfirmOpen(true);
      return;
    }
    closeDepth(selectedTab, avatarConfirmDepthId);
    closeAvatarConfirm();
  };

  const closeStatusEditor = useCallback(() => {
    setIsStatusEditorOpen(false);
  }, []);

  const openStatusEditor = () => {
    if (!isMe) return;
    pushDepth(selectedTab, {
      id: statusEditorDepthId,
      kind: "bottom-sheet",
      onClose: closeStatusEditor,
    });
    setIsStatusEditorOpen(true);
  };

  const handleStatusEditorOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      openStatusEditor();
      return;
    }
    closeDepth(selectedTab, statusEditorDepthId);
    setIsStatusEditorOpen(false);
  };

  const saveStatusMessage = async (input: {
    statusMessage: string | null;
    statusMessageBackgroundColor: string | null;
  }) => {
    setIsProfileSaving(true);
    try {
      const updated = await updateProfile(input);
      setProfileOverride(updated);
      onProfileUpdated?.(updated);
      closeDepth(selectedTab, statusEditorDepthId);
      setIsStatusEditorOpen(false);
    } finally {
      setIsProfileSaving(false);
    }
  };

  const saveAffiliationUpdate = async (input: {
    affiliations: PlayerAffiliation[];
    statusMessage: string | null;
    statusMessageBackgroundColor: string | null;
  }) => {
    setIsProfileSaving(true);
    try {
      const updated = await updateProfile(input);
      setProfileOverride(updated);
      onProfileUpdated?.(updated);
      closeDepth(selectedTab, statusEditorDepthId);
      setIsStatusEditorOpen(false);
    } finally {
      setIsProfileSaving(false);
    }
  };

  const setPrimaryAffiliation = async (name: string) => {
    if (!displayedPlayer?.affiliations || isProfileSaving) return;
    const affiliations = displayedPlayer.affiliations.map((affiliation) => ({
      ...affiliation,
      isPrimary: affiliation.name === name,
    }));
    await saveAffiliationUpdate({
      affiliations,
      statusMessage: displayedPlayer.statusMessage ?? null,
      statusMessageBackgroundColor:
        displayedPlayer.statusMessageBackgroundColor ?? null,
    });
  };

  return (
    <div className="min-h-full">
      {showDetailHeader ? <DetailPageHeader title="Member Profile" /> : null}
      <div className="p-2">
        <div className="mx-auto flex w-full flex-col gap-3">
          <div className="flex items-start justify-center gap-4 pt-5 pb-5">
            <Avatar
              size="lg"
              avatarUrl={displayedPlayer?.avatarUrl}
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
            <div className="flex min-w-[180px] w-full max-w-[50%] flex-1 flex-col items-start gap-0.5">
              <div className="flex min-w-0 max-w-full flex-nowrap items-baseline gap-2">
                <h2 className="min-w-0 flex-1 truncate whitespace-nowrap text-[clamp(1.5rem,7.2cqw,2.16rem)] font-bold text-pkpk-main-font">
                  {displayName}
                </h2>
                {showPlayerId && player?.id ? (
                  <CopyableId
                    label="Player ID"
                    value={displayedPlayer?.id ?? player.id}
                    showLabel={false}
                  />
                ) : null}
                {headerAction}
              </div>
              <PlayerProfileMeta
                affiliations={displayedPlayer?.affiliations}
                statusMessage={displayedPlayer?.statusMessage}
                statusMessageBackgroundColor={
                  displayedPlayer?.statusMessageBackgroundColor
                }
                align="start"
                isMe={isMe}
                showEmptyAffiliation
                isUpdatingPrimary={isProfileSaving}
                onEditStatus={openStatusEditor}
                onSetPrimary={(name) => void setPrimaryAffiliation(name)}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-pkpk-secondary-bg to-pkpk-primary-bg p-4">
            <h3
              className={`text-[clamp(1.4rem,6.5cqw,1.95rem)] font-bold text-pkpk-secondary-font ${
                showDetailHeader ? "pl-2" : ""
              }`}
            >
              Rating
            </h3>

            <div
              role="tablist"
              aria-label="Rating type"
              className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-white/10"
            >
              {duprItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    role="tab"
                    aria-selected={expandedType === item.type}
                    onClick={() => handleCardClick(item.type)}
                    className={`min-w-0 rounded-lg px-3 py-3 text-left transition-colors ${
                      expandedType === item.type
                        ? "bg-white/25"
                        : "bg-transparent opacity-80 hover:bg-white/15"
                    }`}
                  >
                    <p className="text-[clamp(1.3rem,6cqw,1.8rem)] font-bold leading-none text-pkpk-secondary-font">
                      {item.rating}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[clamp(0.6875rem,3cqw,0.9rem)] font-medium text-pkpk-secondary-font/70">
                      <Icon className="size-3" />
                      {item.label}
                    </p>
                  </button>
                );
              })}
            </div>

            {isProfileStatsLoading ? (
              <>
                <div className="mt-2 flex h-36 items-center justify-center">
                  <Spinner
                    aria-label="평점 이력 로딩 중"
                    className="text-pkpk-accent-bg"
                    color="current"
                    size="md"
                  />
                </div>
                <div className="mt-3">
                  <ProfileStatsSkeleton />
                </div>
              </>
            ) : expandedItem ? (
              <>
                <RatingHistoryChart
                  key={expandedItem.type}
                  history={ratingHistory?.[expandedItem.type] ?? []}
                  label={expandedItem.label}
                />
                <div className="mt-3 flex flex-col">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl px-4 py-3">
                      <p className="text-[clamp(0.6875rem,3cqw,0.9rem)] font-semibold text-pkpk-secondary-font/80">
                        매치 승률
                      </p>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <p className="text-[clamp(1rem,4.5cqw,1.35rem)] font-semibold leading-tight text-pkpk-secondary-font">
                          {expandedItem.matchWinRate}
                        </p>
                        <p className="text-[clamp(0.6875rem,3cqw,0.9rem)] text-pkpk-secondary-font/70">
                          {expandedItem.matchWinLoss}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl px-4 py-3">
                      <p className="text-[clamp(0.6875rem,3cqw,0.9rem)] font-semibold text-pkpk-secondary-font/80">
                        세트 승률
                      </p>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <p className="text-[clamp(1rem,4.5cqw,1.35rem)] font-semibold leading-tight text-pkpk-secondary-font">
                          {expandedItem.setWinRate}
                        </p>
                        <p className="text-[clamp(0.6875rem,3cqw,0.9rem)] text-pkpk-secondary-font/70">
                          {expandedItem.setWinLoss}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl px-4 py-3">
                      <p className="text-[clamp(0.6875rem,3cqw,0.9rem)] font-semibold text-pkpk-secondary-font/80">
                        최근 7일 변동
                      </p>
                      <div className="mt-1">
                        <RatingDeltaChip
                          delta={expandedItem.delta7d}
                          hasData={expandedItem.hasDelta7d}
                          appearance="rating"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl px-4 py-3">
                      <p className="text-[clamp(0.6875rem,3cqw,0.9rem)] font-semibold text-pkpk-secondary-font/80">
                        최근 30일 변동
                      </p>
                      <div className="mt-1">
                        <RatingDeltaChip
                          delta={expandedItem.delta30d}
                          hasData={expandedItem.hasDelta30d}
                          appearance="rating"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <section
            aria-labelledby="profile-recent-matches-title"
            className="mt-3"
          >
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <h3
                id="profile-recent-matches-title"
                className="text-[clamp(1.1rem,5cqw,1.45rem)] font-bold text-pkpk-main-font"
              >
                최근 매치
              </h3>
              {onViewAllMatches ? (
                <button
                  type="button"
                  onClick={onViewAllMatches}
                  className="inline-flex shrink-0 items-center gap-0.5 text-sm font-bold text-pkpk-primary-bg transition-opacity hover:opacity-75"
                >
                  전체 보기
                  <IoChevronForward aria-hidden="true" className="size-4" />
                </button>
              ) : null}
            </div>
            <ProfileMatchList
              matches={recentMatches}
              isLoading={isProfileStatsLoading}
              emptyMessage="최근 완료된 매치가 없어요."
              onPressMatch={onPressRecentMatch}
            />
          </section>
        </div>
      </div>
      <BottomSheet
        isOpen={isAvatarConfirmOpen}
        isActive
        onOpenChange={handleAvatarConfirmOpenChange}
        ariaLabel="프로필 사진 확인"
        className="px-5 pt-6"
      >
        {avatarPreviewUrl ? (
          <AvatarUploadConfirmSheetBody
            previewUrl={avatarPreviewUrl}
            name={displayName}
            isSaving={isUploading}
            onConfirm={() => void confirmAvatarUpload()}
            onCancel={() => handleAvatarConfirmOpenChange(false)}
          />
        ) : (
          <div />
        )}
      </BottomSheet>
      <BottomSheet
        isOpen={isStatusEditorOpen}
        isActive
        onOpenChange={handleStatusEditorOpenChange}
        ariaLabel="상태메시지 수정"
        className="px-5 pt-6"
      >
        <StatusMessageEditSheetBody
          key={`${displayedPlayer?.id ?? "unknown"}-${isStatusEditorOpen}`}
          player={displayedPlayer}
          isSaving={isProfileSaving}
          onSave={saveStatusMessage}
        />
      </BottomSheet>
    </div>
  );
};

export default MemberProfile;
