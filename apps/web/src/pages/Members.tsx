import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IoChevronForward } from "react-icons/io5";
import Avatar from "@/components/Avatar";
import type { MatchInfo } from "@/components/Match";
import MemberProfile from "@/components/MemberProfile";
import SkeletonBlock from "@/components/SkeletonBlock";
import TabPanelHeader from "@/components/TabPanelHeader";
import TabPanelStatus from "@/components/TabPanelStatus";
import type { PlayerInfo } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { buildApiUrl } from "@/lib/api";
import { isTabRefreshDue } from "@/lib/tabRefresh";
import {
  formatRating,
  getCompositeDoublesRating,
} from "@/utils/dupr";
import {
  buildMatchStats,
  buildRatingDelta,
  createEmptyMatchStats,
  createEmptyRatingDelta,
} from "@/utils/matchStats";

const CACHED_MEMBERS_KEY = "pkpkdupr:members";
const OFFLINE_FALLBACK_MESSAGE =
  "최신 정보를 불러오지 못해 저장된 멤버 목록을 표시합니다.";

type MemberListPlayerInfo = PlayerInfo & {
  lastPlayedAt: string | null;
};

const MemberListSkeleton: React.FC = () => (
  <div role="status" aria-label="멤버 목록 로딩 중">
    {Array.from({ length: 6 }, (_, index) => (
      <div
        key={index}
        className="relative flex w-full items-center gap-3 px-3 py-3"
      >
        <SkeletonBlock className="size-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-5 w-28" />
          <SkeletonBlock className="h-3 w-36" />
        </div>
        <SkeletonBlock className="h-5 w-10" />
      </div>
    ))}
  </div>
);

const getLastPlayedAtMs = (lastPlayedAt: string | null) => {
  if (!lastPlayedAt) return Number.NEGATIVE_INFINITY;

  const value = new Date(lastPlayedAt).getTime();
  return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
};

const formatLastPlayedAt = (lastPlayedAt: string | null) => {
  const lastPlayedAtMs = getLastPlayedAtMs(lastPlayedAt);
  if (!Number.isFinite(lastPlayedAtMs)) {
    return "최근 경기 없음";
  }

  const elapsedMs = Math.max(0, Date.now() - lastPlayedAtMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (elapsedMs < minute) return "방금 전 플레이";
  if (elapsedMs < hour) {
    return `${Math.floor(elapsedMs / minute)}분전 마지막 플레이`;
  }
  if (elapsedMs < day) {
    return `${Math.floor(elapsedMs / hour)}시간전 마지막 플레이`;
  }
  if (elapsedMs < week) {
    return `${Math.floor(elapsedMs / day)}일전 마지막 플레이`;
  }
  return `${Math.floor(elapsedMs / week)}주 전 마지막 플레이`;
};

const readCachedMembers = (): MemberListPlayerInfo[] | null => {
  try {
    const cachedMembers = localStorage.getItem(CACHED_MEMBERS_KEY);
    return cachedMembers
      ? (JSON.parse(cachedMembers) as MemberListPlayerInfo[])
      : null;
  } catch {
    return null;
  }
};

const Members: React.FC = () => {
  const { player, token } = useAuth();
  const isOnline = useOnlineStatus();
  const {
    pushDepth,
    restoreScrollTop,
    saveScrollPosition,
    selectedTab,
    scrollToTop,
    registerPullToRefresh,
  } = useTabNavigation();
  const [members, setMembers] = useState<MemberListPlayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberMatchStats, setSelectedMemberMatchStats] = useState(
    createEmptyMatchStats,
  );
  const [selectedMemberRatingDelta, setSelectedMemberRatingDelta] = useState(
    createEmptyRatingDelta,
  );
  const [isSelectedMemberStatsLoading, setIsSelectedMemberStatsLoading] =
    useState(false);
  const lastSuccessfulLoadAtRef = useRef<number | null>(null);
  const wasTabActiveRef = useRef(false);

  const loadMembers = useCallback(
    async (preserveVisibleData = false, throwOnError = false) => {
      if (!token) {
        setMembers([]);
        setIsLoading(false);
        lastSuccessfulLoadAtRef.current = null;
        return;
      }

      try {
        if (!preserveVisibleData) {
          setIsLoading(true);
          setError(null);
          setNotice(null);
        }

        const res = await fetch(buildApiUrl("/api/players"), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || "멤버 목록을 불러오지 못했습니다.",
          );
        }

        const data = (await res.json()) as MemberListPlayerInfo[];
        setMembers(data);
        localStorage.setItem(CACHED_MEMBERS_KEY, JSON.stringify(data));
        lastSuccessfulLoadAtRef.current = Date.now();
        setError(null);
        setNotice(null);
      } catch (err) {
        if (!isOnline) {
          const cachedMembers = readCachedMembers();
          if (cachedMembers) {
            setMembers(cachedMembers);
            if (!preserveVisibleData) {
              setNotice(OFFLINE_FALLBACK_MESSAGE);
              setError(null);
            }
            return;
          }
        }

        if (!preserveVisibleData) {
          setError(
            err instanceof Error
              ? err.message
              : "멤버 목록을 불러오지 못했습니다.",
          );
        }

        if (throwOnError) {
          throw err;
        }
      } finally {
        if (!preserveVisibleData) {
          setIsLoading(false);
        }
      }
    },
    [isOnline, token],
  );

  const loadSelectedMemberMatchStats = useCallback(
    async (
      memberId: string,
      preserveVisibleData = false,
      throwOnError = false,
    ) => {
      if (!token) {
        setSelectedMemberMatchStats(createEmptyMatchStats());
        setSelectedMemberRatingDelta(createEmptyRatingDelta());
        setIsSelectedMemberStatsLoading(false);
        return;
      }

      if (!preserveVisibleData) {
        setSelectedMemberMatchStats(createEmptyMatchStats());
        setSelectedMemberRatingDelta(createEmptyRatingDelta());
        setIsSelectedMemberStatsLoading(true);
      }

      try {
        const searchParams = new URLSearchParams({
          playerId: memberId,
          limit: "1000",
        });
        const res = await fetch(
          buildApiUrl(`/api/matches?${searchParams.toString()}`),
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!res.ok) {
          throw new Error("매치 목록을 불러오지 못했습니다.");
        }

        const data = (await res.json()) as {
          matches: MatchInfo[];
          total: number;
        };
        setSelectedMemberMatchStats(buildMatchStats(data.matches, memberId));
        setSelectedMemberRatingDelta(buildRatingDelta(data.matches, memberId));
      } catch (err) {
        if (!preserveVisibleData) {
          setSelectedMemberMatchStats(createEmptyMatchStats());
          setSelectedMemberRatingDelta(createEmptyRatingDelta());
        }
        if (throwOnError) {
          throw err;
        }
      } finally {
        if (!preserveVisibleData) {
          setIsSelectedMemberStatsLoading(false);
        }
      }
    },
    [token],
  );

  useEffect(() => {
    const isTabActive = selectedTab === "members";
    if (!isTabActive) {
      wasTabActiveRef.current = false;
      return;
    }

    if (wasTabActiveRef.current) return;

    wasTabActiveRef.current = true;
    if (!isTabRefreshDue(lastSuccessfulLoadAtRef.current)) return;

    void loadMembers(members.length > 0);
  }, [loadMembers, members.length, selectedTab]);

  useEffect(() => {
    if (!token || !selectedMemberId) {
      setSelectedMemberMatchStats(createEmptyMatchStats());
      setSelectedMemberRatingDelta(createEmptyRatingDelta());
      setIsSelectedMemberStatsLoading(false);
      return;
    }

    void loadSelectedMemberMatchStats(selectedMemberId);
  }, [loadSelectedMemberMatchStats, selectedMemberId, token]);

  useEffect(
    () =>
      registerPullToRefresh("members", async () => {
        await loadMembers(true, true);
        if (selectedMemberId) {
          await loadSelectedMemberMatchStats(selectedMemberId, true, true);
        }
      }),
    [
      loadMembers,
      loadSelectedMemberMatchStats,
      registerPullToRefresh,
      selectedMemberId,
    ],
  );

  const closeMemberProfile = useCallback(() => {
    setSelectedMemberId(null);
    setIsSelectedMemberStatsLoading(false);
    restoreScrollTop("members");
  }, [restoreScrollTop]);

  const openMemberProfile = (memberId: string) => {
    saveScrollPosition("members");
    pushDepth("members", {
      id: `member-profile:${memberId}`,
      kind: "member-profile",
      onClose: closeMemberProfile,
    });
    setIsSelectedMemberStatsLoading(true);
    setSelectedMemberId(memberId);
    window.requestAnimationFrame(() => scrollToTop("auto"));
  };

  const selectedMember =
    members.find((member) => member.id === selectedMemberId) || null;
  const sortedMembers = useMemo(
    () =>
      [...members].sort((left, right) => {
        const leftRating = getCompositeDoublesRating(left.duprRating);
        const rightRating = getCompositeDoublesRating(right.duprRating);

        if (leftRating != null && rightRating != null && leftRating !== rightRating) {
          return rightRating - leftRating;
        }
        if (leftRating != null) return -1;
        if (rightRating != null) return 1;

        const lastPlayedDifference =
          getLastPlayedAtMs(right.lastPlayedAt) -
          getLastPlayedAtMs(left.lastPlayedAt);
        if (lastPlayedDifference !== 0) return lastPlayedDifference;

        return (left.username ?? "").localeCompare(right.username ?? "", "ko");
      }),
    [members],
  );

  if (selectedMember) {
    return (
      <MemberProfile
        player={selectedMember}
        isMe={selectedMember.id === player?.id}
        matchStats={selectedMemberMatchStats}
        ratingDelta={selectedMemberRatingDelta}
        isStatsLoading={isSelectedMemberStatsLoading}
      />
    );
  }

  return (
    <>
      <TabPanelHeader title="Members" />
      <div className="flex min-h-full">
        <div className="mx-auto flex min-h-full w-full flex-1 flex-col">
          <div>
            {notice ? (
              <p className="mx-2 mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-pkpk-sub-font">
                {notice}
              </p>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col">
            {isLoading ? (
              <MemberListSkeleton />
            ) : error ? (
              <TabPanelStatus message={error} tone="error" />
            ) : sortedMembers.length === 0 ? (
              <TabPanelStatus message="현재 표시할 멤버가 없어요." />
            ) : (
              <div>
                {sortedMembers.map((member, index) => {
                  const doublesRating = getCompositeDoublesRating(
                    member.duprRating,
                  );

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => openMemberProfile(member.id)}
                      className={`relative flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-amber-50 active:bg-amber-50 ${
                        index < sortedMembers.length - 1
                          ? "after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:bg-pkpk-sub-font/10"
                          : ""
                      }`}
                    >
                      <Avatar
                        size="sm"
                        avatarUrl={member.avatarUrl}
                        name={member.username}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold text-pkpk-main-font">
                          {member.username}
                        </p>
                        <p className="truncate text-xs text-pkpk-detail-font">
                          {formatLastPlayedAt(member.lastPlayedAt)}
                        </p>
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        <span
                          className={`text-lg font-semibold tabular-nums ${
                            doublesRating == null
                              ? "text-pkpk-detail-font"
                              : "text-pkpk-dupr-font"
                          }`}
                        >
                          {formatRating(doublesRating)}
                        </span>
                        <IoChevronForward aria-hidden="true" className="size-5 text-pkpk-sub-font" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Members;
