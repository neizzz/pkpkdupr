import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IoChevronForward } from "react-icons/io5";
import Avatar from "@/components/Avatar";
import type {
  MatchInfo,
  MatchListResponse,
  PlayerProfileSummaryResponse,
} from "@/components/Match";
import MemberProfile from "@/components/MemberProfile";
import PlayerProfileMeta from "@/components/PlayerProfileMeta";
import ProfileMatchDetailDrawer from "@/components/ProfileMatchDetailDrawer";
import ProfileMatchHistoryDrawer from "@/components/ProfileMatchHistoryDrawer";
import RightDrawer from "@/components/RightDrawer";
import SkeletonBlock from "@/components/SkeletonBlock";
import TabPanelHeader, {
  TabPanelHeaderGradientExtension,
} from "@/components/TabPanelHeader";
import TabPanelStatus from "@/components/TabPanelStatus";
import type { PlayerInfo } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";
import { useMinimumLoading } from "@/hooks/useMinimumLoading";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { buildApiUrl } from "@/lib/api";
import { isTabRefreshDue } from "@/lib/tabRefresh";
import MyProfile from "@/pages/Me";
import { formatRating, getCompositeDoublesRating } from "@/utils/dupr";
import {
  buildProfileMatchList,
  buildRecentProfileMatches,
  buildRatingHistory,
  createEmptyMatchStats,
  createEmptyRatingDelta,
  createEmptyRatingHistory,
} from "@/utils/matchStats";

const CACHED_MEMBERS_KEY = "pkpkdupr:members";
const OFFLINE_FALLBACK_MESSAGE =
  "최신 정보를 불러오지 못해 저장된 멤버 목록을 표시합니다.";

const noop = () => {};
const MEMBER_MATCH_HISTORY_PAGE_SIZE = 20;
const MY_PROFILE_DEPTH_ID = "my-profile";

type MemberListPlayerInfo = PlayerInfo & {
  lastPlayedAt: string | null;
};

const MemberListSkeleton: React.FC<{
  headerElement: HTMLDivElement | null;
}> = ({ headerElement }) => (
  <div role="status" aria-label="멤버 목록 로딩 중" className="px-3 pt-3">
    <TabPanelHeaderGradientExtension
      headerElement={headerElement}
      className="z-0"
    />
    <div className="relative z-10 overflow-hidden rounded-3xl bg-white">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className={`relative flex w-full items-center gap-3 px-4 py-3 ${
            index < 5
              ? "after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-pkpk-sub-font/10"
              : ""
          }`}
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

  if (elapsedMs < 15 * minute) return "방금 전 플레이";
  if (elapsedMs < hour) {
    return `${Math.floor(elapsedMs / minute)}분전 마지막 플레이`;
  }
  if (elapsedMs < day) {
    return `${Math.floor(elapsedMs / hour)}시간전 마지막 플레이`;
  }
  return `${Math.floor(elapsedMs / day)}일전 마지막 플레이`;
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
  const { player, token, updateProfile } = useAuth();
  const isOnline = useOnlineStatus();
  const {
    depthStacks,
    pushDepth,
    registerScrollContainer,
    restoreScrollTop,
    saveScrollPosition,
    selectedTab,
    scrollToTop,
    registerPullToRefresh,
  } = useTabNavigation();
  const [members, setMembers] = useState<MemberListPlayerInfo[]>([]);
  const [headerElement, setHeaderElement] = useState<HTMLDivElement | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isMyProfileRequested, setIsMyProfileRequested] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberMatchStats, setSelectedMemberMatchStats] = useState(
    createEmptyMatchStats,
  );
  const [selectedMemberRatingDelta, setSelectedMemberRatingDelta] = useState(
    createEmptyRatingDelta,
  );
  const [selectedMemberRatingHistory, setSelectedMemberRatingHistory] =
    useState(createEmptyRatingHistory);
  const [selectedMemberMatches, setSelectedMemberMatches] = useState<
    MatchInfo[]
  >([]);
  const [isSelectedMemberStatsLoading, setIsSelectedMemberStatsLoading] =
    useState(false);
  const [isMemberMatchHistoryRequested, setIsMemberMatchHistoryRequested] =
    useState(false);
  const [
    isSelectedMemberMatchHistoryLoading,
    setIsSelectedMemberMatchHistoryLoading,
  ] = useState(false);
  const [selectedMemberMatchHistoryPage, setSelectedMemberMatchHistoryPage] =
    useState(0);
  const [selectedMemberMatchHistoryTotal, setSelectedMemberMatchHistoryTotal] =
    useState(0);
  const [selectedMemberProfileMatch, setSelectedMemberProfileMatch] =
    useState<MatchInfo | null>(null);
  const isMemberListLoading = useMinimumLoading(isLoading);
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
        setSelectedMemberRatingHistory(createEmptyRatingHistory());
        setSelectedMemberMatches([]);
        setIsSelectedMemberStatsLoading(false);
        return;
      }

      if (!preserveVisibleData) {
        setSelectedMemberMatchStats(createEmptyMatchStats());
        setSelectedMemberRatingDelta(createEmptyRatingDelta());
        setSelectedMemberRatingHistory(createEmptyRatingHistory());
        setSelectedMemberMatches([]);
        setIsSelectedMemberStatsLoading(true);
      }

      try {
        const res = await fetch(
          buildApiUrl(
            `/api/players/${encodeURIComponent(memberId)}/profile-summary`,
          ),
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!res.ok) {
          throw new Error("매치 목록을 불러오지 못했습니다.");
        }

        const data = (await res.json()) as PlayerProfileSummaryResponse;
        setSelectedMemberMatchStats(data.matchStats);
        setSelectedMemberRatingDelta(data.ratingDelta);
        setSelectedMemberMatches(data.recentMatches);
        setSelectedMemberRatingHistory(buildRatingHistory(data.ratingHistory));
        setSelectedMemberMatchHistoryPage(0);
        setSelectedMemberMatchHistoryTotal(0);
      } catch (err) {
        if (!preserveVisibleData) {
          setSelectedMemberMatchStats(createEmptyMatchStats());
          setSelectedMemberRatingDelta(createEmptyRatingDelta());
          setSelectedMemberRatingHistory(createEmptyRatingHistory());
          setSelectedMemberMatches([]);
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

  const loadSelectedMemberMatchHistory = useCallback(
    async (memberId: string, page: number, append = false) => {
      if (!token) return;

      setIsSelectedMemberMatchHistoryLoading(true);
      try {
        const searchParams = new URLSearchParams({
          playerId: memberId,
          page: String(page),
          limit: String(MEMBER_MATCH_HISTORY_PAGE_SIZE),
        });
        const res = await fetch(
          buildApiUrl(`/api/matches?${searchParams.toString()}`),
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error("매치 목록을 불러오지 못했습니다.");

        const data = (await res.json()) as MatchListResponse;
        setSelectedMemberMatches((current) => {
          if (!append) return data.matches;
          const ids = new Set(current.map((match) => match.id));
          return [
            ...current,
            ...data.matches.filter((match) => !ids.has(match.id)),
          ];
        });
        setSelectedMemberMatchHistoryPage(page + 1);
        setSelectedMemberMatchHistoryTotal(data.total);
      } finally {
        setIsSelectedMemberMatchHistoryLoading(false);
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
      setSelectedMemberRatingHistory(createEmptyRatingHistory());
      setSelectedMemberMatches([]);
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

  const completeMemberProfileClose = useCallback(() => {
    setSelectedMemberId(null);
    setIsSelectedMemberStatsLoading(false);
    restoreScrollTop("members");
  }, [restoreScrollTop]);

  const handleMemberProfileUpdated = useCallback(
    (updatedPlayer: PlayerInfo) => {
      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          member.id === updatedPlayer.id
            ? { ...member, ...updatedPlayer }
            : member,
        ),
      );
    },
    [],
  );

  const openMyProfile = () => {
    saveScrollPosition("members");
    pushDepth("members", {
      id: MY_PROFILE_DEPTH_ID,
      kind: "member-profile",
      onClose: noop,
    });
    setIsMyProfileRequested(true);
    window.requestAnimationFrame(() => scrollToTop("auto"));
  };

  const completeMyProfileClose = useCallback(() => {
    setIsMyProfileRequested(false);
    restoreScrollTop("members");
  }, [restoreScrollTop]);

  const isMyProfileDrawerOpen =
    isMyProfileRequested && depthStacks.members.includes(MY_PROFILE_DEPTH_ID);
  const registerMyProfileScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      registerScrollContainer("members", MY_PROFILE_DEPTH_ID, element);
    },
    [registerScrollContainer],
  );

  const setMemberPrimaryAffiliation = async (
    member: MemberListPlayerInfo,
    affiliationName: string,
  ) => {
    if (member.id !== player?.id || !member.affiliations) return;
    const updatedPlayer = await updateProfile({
      affiliations: member.affiliations.map((affiliation) => ({
        ...affiliation,
        isPrimary: affiliation.name === affiliationName,
      })),
    });
    handleMemberProfileUpdated(updatedPlayer);
  };

  const openMemberProfile = (memberId: string) => {
    saveScrollPosition("members");
    pushDepth("members", {
      id: `member-profile:${memberId}`,
      kind: "member-profile",
      onClose: noop,
    });
    setIsSelectedMemberStatsLoading(true);
    setSelectedMemberId(memberId);
    window.requestAnimationFrame(() => scrollToTop("auto"));
  };

  const selectedMember =
    members.find((member) => member.id === selectedMemberId) || null;
  const memberDepthId = selectedMemberId
    ? `member-profile:${selectedMemberId}`
    : null;
  const isMemberDrawerOpen =
    !!memberDepthId && depthStacks.members.includes(memberDepthId);
  const selectedMemberProfileMatches = useMemo(
    () =>
      selectedMemberId
        ? buildProfileMatchList(selectedMemberMatches, selectedMemberId)
        : [],
    [selectedMemberId, selectedMemberMatches],
  );
  const recentSelectedMemberMatches = useMemo(
    () =>
      selectedMemberId
        ? buildRecentProfileMatches(selectedMemberMatches, selectedMemberId)
        : [],
    [selectedMemberId, selectedMemberMatches],
  );
  const memberMatchHistoryDepthId = selectedMemberId
    ? `member-match-history:${selectedMemberId}`
    : null;
  const isMemberMatchHistoryDrawerOpen =
    isMemberMatchHistoryRequested &&
    !!memberMatchHistoryDepthId &&
    depthStacks.members.includes(memberMatchHistoryDepthId);
  const memberProfileMatchDetailDepthId = selectedMemberProfileMatch
    ? `member-match-detail:${selectedMemberProfileMatch.id}`
    : null;
  const isMemberProfileMatchDetailDrawerOpen =
    !!memberProfileMatchDetailDepthId &&
    depthStacks.members.includes(memberProfileMatchDetailDepthId);
  const registerMemberScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      if (!memberDepthId) return;
      registerScrollContainer("members", memberDepthId, element);
    },
    [memberDepthId, registerScrollContainer],
  );
  const registerMemberMatchHistoryScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      if (!memberMatchHistoryDepthId) return;
      registerScrollContainer("members", memberMatchHistoryDepthId, element);
    },
    [memberMatchHistoryDepthId, registerScrollContainer],
  );
  const registerMemberProfileMatchDetailScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      if (!memberProfileMatchDetailDepthId) return;
      registerScrollContainer(
        "members",
        memberProfileMatchDetailDepthId,
        element,
      );
    },
    [memberProfileMatchDetailDepthId, registerScrollContainer],
  );

  const openMemberMatchHistory = () => {
    if (!memberMatchHistoryDepthId || !selectedMemberId) return;

    saveScrollPosition("members");
    pushDepth("members", {
      id: memberMatchHistoryDepthId,
      kind: "match-history",
      onClose: noop,
    });
    setIsMemberMatchHistoryRequested(true);
    void loadSelectedMemberMatchHistory(selectedMemberId, 0);
    window.requestAnimationFrame(() => scrollToTop("auto"));
  };

  const openMemberProfileMatchDetail = (match: MatchInfo) => {
    saveScrollPosition("members");
    pushDepth("members", {
      id: `member-match-detail:${match.id}`,
      kind: "match-detail",
      onClose: noop,
    });
    setSelectedMemberProfileMatch(match);
    window.requestAnimationFrame(() => scrollToTop("auto"));
  };

  const completeMemberMatchHistoryClose = useCallback(() => {
    setIsMemberMatchHistoryRequested(false);
    restoreScrollTop("members");
  }, [restoreScrollTop]);

  const completeMemberProfileMatchDetailClose = useCallback(() => {
    setSelectedMemberProfileMatch(null);
    restoreScrollTop("members");
  }, [restoreScrollTop]);
  const sortedMembers = useMemo(
    () =>
      [...members].sort((left, right) => {
        const leftRating = getCompositeDoublesRating(left.duprRating);
        const rightRating = getCompositeDoublesRating(right.duprRating);

        if (
          leftRating != null &&
          rightRating != null &&
          leftRating !== rightRating
        ) {
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

  return (
    <>
      <TabPanelHeader
        title="Players"
        showGradientExtension={false}
        onHeaderElementChange={setHeaderElement}
      >
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-full pl-1 pr-0 text-sm font-semibold text-pkpk-primary-font transition-opacity hover:opacity-80"
          onClick={openMyProfile}
        >
          <Avatar
            size="xs"
            avatarUrl={player?.avatarUrl}
            name={player?.username}
          />
          <span>내 프로필</span>
          <IoChevronForward
            aria-hidden="true"
            className="-mr-1.5 size-4 text-pkpk-primary-font/70"
          />
        </button>
      </TabPanelHeader>
      <div className="tab-panel-header-content flex min-h-full bg-white">
        <div className="mx-auto flex min-h-full w-full flex-1 flex-col">
          <div>
            {notice ? (
              <p className="mx-2 mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-[clamp(0.6875rem,3cqw,0.9rem)] font-semibold text-pkpk-sub-font">
                {notice}
              </p>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col">
            {isMemberListLoading ? (
              <MemberListSkeleton headerElement={headerElement} />
            ) : error ? (
              <TabPanelStatus message={error} tone="error" />
            ) : sortedMembers.length === 0 ? (
              <TabPanelStatus message="현재 표시할 멤버가 없어요." />
            ) : (
              <div>
                <TabPanelHeaderGradientExtension
                  headerElement={headerElement}
                  className="z-0"
                />
                <div className="relative z-10 overflow-hidden rounded-3xl bg-white mx-1.5 mt-1">
                  {sortedMembers.map((member, index) => {
                    const doublesRating = getCompositeDoublesRating(
                      member.duprRating,
                    );

                    return (
                      <div
                        key={member.id}
                        className={`relative flex w-full min-w-0 items-center gap-3 px-2.5 py-3 text-left transition-colors hover:bg-pkpk-accent-bg/30 active:bg-amber-50 ${
                          index < sortedMembers.length - 1
                            ? "after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-pkpk-sub-font/10"
                            : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openMemberProfile(member.id)}
                          className="absolute inset-0 z-0"
                          aria-label={`${member.username ?? "멤버"} 프로필 보기`}
                        />
                        <div className="relative z-10 flex min-w-0 flex-1 items-center gap-4 pointer-events-none">
                          <Avatar
                            size="md"
                            avatarUrl={member.avatarUrl}
                            name={member.username}
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-1 self-start pt-1">
                            <p className="truncate text-[clamp(1rem,4.5cqw,1.35rem)] font-semibold text-pkpk-main-font">
                              {member.username}
                            </p>
                            {member.statusMessage ||
                            member.affiliations?.length ? (
                              <div className="pointer-events-auto">
                                <PlayerProfileMeta
                                  affiliations={member.affiliations}
                                  statusMessage={member.statusMessage}
                                  statusMessageBackgroundColor={
                                    member.statusMessageBackgroundColor
                                  }
                                  isMe={member.id === player?.id}
                                  onSetPrimary={(name) =>
                                    void setMemberPrimaryAffiliation(
                                      member,
                                      name,
                                    )
                                  }
                                />
                              </div>
                            ) : null}
                            <p className="truncate text-[clamp(0.6875rem,3cqw,0.9rem)] text-pkpk-detail-font">
                              {formatLastPlayedAt(member.lastPlayedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-2 pointer-events-none">
                          <span
                            className={`text-[clamp(1rem,4.5cqw,1.35rem)] font-semibold tabular-nums ${
                              doublesRating == null
                                ? "text-pkpk-detail-font"
                                : "text-pkpk-dupr-font"
                            }`}
                          >
                            {formatRating(doublesRating)}
                          </span>
                          <IoChevronForward
                            aria-hidden="true"
                            className="size-5 text-pkpk-sub-font"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {isMyProfileRequested ? (
        <RightDrawer
          isOpen={isMyProfileDrawerOpen}
          isActive={selectedTab === "members"}
          ariaLabel="내 프로필"
          onExited={completeMyProfileClose}
          onScrollContainerChange={registerMyProfileScrollContainer}
        >
          <MyProfile
            tabKey="members"
            isActive={isMyProfileDrawerOpen && selectedTab === "members"}
            onProfileUpdated={handleMemberProfileUpdated}
          />
        </RightDrawer>
      ) : null}
      {selectedMember && memberDepthId ? (
        <RightDrawer
          isOpen={isMemberDrawerOpen}
          isActive={selectedTab === "members"}
          ariaLabel="멤버 프로필"
          onExited={completeMemberProfileClose}
          onScrollContainerChange={registerMemberScrollContainer}
        >
          <MemberProfile
            player={selectedMember}
            isMe={selectedMember.id === player?.id}
            onProfileUpdated={handleMemberProfileUpdated}
            matchStats={selectedMemberMatchStats}
            ratingDelta={selectedMemberRatingDelta}
            ratingHistory={selectedMemberRatingHistory}
            isStatsLoading={isSelectedMemberStatsLoading}
            recentMatches={recentSelectedMemberMatches}
            onPressRecentMatch={openMemberProfileMatchDetail}
            onViewAllMatches={openMemberMatchHistory}
          />
        </RightDrawer>
      ) : null}
      {selectedMember && memberMatchHistoryDepthId ? (
        <ProfileMatchHistoryDrawer
          isOpen={isMemberMatchHistoryDrawerOpen}
          isActive={selectedTab === "members"}
          tabKey="members"
          matches={selectedMemberProfileMatches}
          isLoading={isSelectedMemberMatchHistoryLoading}
          hasMore={
            selectedMemberMatches.length < selectedMemberMatchHistoryTotal
          }
          isLoadingMore={
            isSelectedMemberMatchHistoryLoading &&
            selectedMemberMatches.length > 0
          }
          onLoadMore={() =>
            selectedMemberId
              ? void loadSelectedMemberMatchHistory(
                  selectedMemberId,
                  selectedMemberMatchHistoryPage,
                  true,
                )
              : undefined
          }
          onPressMatch={openMemberProfileMatchDetail}
          onExited={completeMemberMatchHistoryClose}
          onScrollContainerChange={registerMemberMatchHistoryScrollContainer}
          layer={60}
        />
      ) : null}
      {selectedMemberProfileMatch && memberProfileMatchDetailDepthId ? (
        <ProfileMatchDetailDrawer
          isOpen={isMemberProfileMatchDetailDrawerOpen}
          isActive={selectedTab === "members"}
          tabKey="members"
          match={selectedMemberProfileMatch}
          currentPlayerId={player?.id}
          onExited={completeMemberProfileMatchDetailClose}
          onScrollContainerChange={
            registerMemberProfileMatchDetailScrollContainer
          }
          layer={70}
        />
      ) : null}
    </>
  );
};

export default Members;
