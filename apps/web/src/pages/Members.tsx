import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LiaUserFriendsSolid } from "react-icons/lia";
import { IoAdd, IoChevronForward, IoPerson } from "react-icons/io5";
import { TbAffiliate } from "react-icons/tb";
import type { Club, ClubMembership } from "@pkpkdupr/shared/club";
import Avatar from "@/components/Avatar";
import HeaderFilterTabs from "@/components/HeaderFilterTabs";
import type {
  MatchInfo,
  MatchListResponse,
  PlayerProfileSummaryResponse,
} from "@/components/Match";
import MemberProfile from "@/components/MemberProfile";
import PlayerProfileMeta from "@/components/PlayerProfileMeta";
import ProfileMatchDetailDrawer from "@/components/ProfileMatchDetailDrawer";
import ProfileMatchHistoryDrawer from "@/components/ProfileMatchHistoryDrawer";
import ProfileIdentityLabel from "@/components/ProfileIdentityLabel";
import PlayerQrScannerModal from "@/components/PlayerQrScannerModal";
import RightDrawer from "@/components/RightDrawer";
import SkeletonBlock from "@/components/SkeletonBlock";
import TabPanelHeader, {
  TabPanelHeaderGradientExtension,
} from "@/components/TabPanelHeader";
import TabPanelEmptyState from "@/components/TabPanelEmptyState";
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
const FRIENDS_MEMBER_FILTER_ID = "friends";

type MemberListPlayerInfo = PlayerInfo & {
  lastPlayedAt: string | null;
};

type ClubListItem = { club: Club; membership: ClubMembership };

type MemberFilter =
  | { id: typeof FRIENDS_MEMBER_FILTER_ID; label: "친구" }
  | { id: string; label: string; clubId: string };

const MemberListSkeleton: React.FC = () => (
  <div role="status" aria-label="멤버 목록 로딩 중">
    <div className="relative z-10 mx-1.5 mt-1 overflow-hidden rounded-3xl bg-white pt-1">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className={`relative flex w-full min-w-0 items-center gap-3 px-2.5 py-3 ${
            index < 5
              ? "after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-pkpk-sub-font/10"
              : ""
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <SkeletonBlock className="h-18 w-18 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1 self-start pt-1">
              <SkeletonBlock className="h-5 w-28" />
              <SkeletonBlock className="h-3 w-36" />
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SkeletonBlock className="h-5 w-10" />
            <span aria-hidden="true" className="size-5" />
          </div>
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

const getCalendarDayDifference = (lastPlayedAtMs: number, nowMs: number) => {
  const lastPlayedAt = new Date(lastPlayedAtMs);
  const now = new Date(nowMs);
  const lastPlayedDayMs = Date.UTC(
    lastPlayedAt.getFullYear(),
    lastPlayedAt.getMonth(),
    lastPlayedAt.getDate(),
  );
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.max(
    0,
    Math.floor((todayMs - lastPlayedDayMs) / (24 * 60 * 60 * 1000)),
  );
};

const formatLastPlayedAt = (lastPlayedAt: string | null) => {
  const lastPlayedAtMs = getLastPlayedAtMs(lastPlayedAt);
  if (!Number.isFinite(lastPlayedAtMs)) {
    return "최근 경기 없음";
  }

  const nowMs = Date.now();
  const elapsedMs = Math.max(0, nowMs - lastPlayedAtMs);
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
  return `${getCalendarDayDifference(lastPlayedAtMs, nowMs)}일전 마지막 플레이`;
};

const readCachedMembers = (
  cacheKey: string = CACHED_MEMBERS_KEY,
): MemberListPlayerInfo[] | null => {
  try {
    const cachedMembers = localStorage.getItem(cacheKey);
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
  const [clubs, setClubs] = useState<ClubListItem[]>([]);
  const [selectedMemberFilterId, setSelectedMemberFilterId] = useState(
    FRIENDS_MEMBER_FILTER_ID,
  );
  const [headerElement, setHeaderElement] = useState<HTMLDivElement | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isFriendQrScannerOpen, setIsFriendQrScannerOpen] = useState(false);
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
  const [selectedMemberRecentMatches, setSelectedMemberRecentMatches] =
    useState<MatchInfo[]>([]);
  const [selectedMemberMatchHistoryMatches, setSelectedMemberMatchHistoryMatches] =
    useState<MatchInfo[]>([]);
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
  const selectedMemberProfileRequestIdRef = useRef(0);
  const selectedMemberMatchHistoryRequestIdRef = useRef(0);
  const memberFilters = useMemo<MemberFilter[]>(() => {
    return [
      { id: FRIENDS_MEMBER_FILTER_ID, label: "친구" },
      ...clubs
        .filter((item) => item.membership.status === "active")
        .map((item) => ({
          id: `club:${item.club.id}`,
          label: item.club.name,
          clubId: item.club.id,
        })),
    ];
  }, [clubs]);
  const selectedMemberFilter =
    memberFilters.find((filter) => filter.id === selectedMemberFilterId) ??
    memberFilters[0];
  const selectedClubId =
    selectedMemberFilter && "clubId" in selectedMemberFilter
      ? selectedMemberFilter.clubId
      : null;
  const previousSelectedClubIdRef = useRef<string | null>(selectedClubId);

  const loadMemberClubs = useCallback(async (throwOnError = false) => {
    if (!token) {
      setClubs([]);
      return;
    }

    try {
      const res = await fetch(buildApiUrl("/api/clubs"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "가입한 클럽을 불러오지 못했습니다.");
      }

      setClubs((await res.json()) as ClubListItem[]);
    } catch (error) {
      if (throwOnError) {
        throw error;
      }
    }
  }, [token]);

  const loadMembers = useCallback(
    async (
      preserveVisibleData = false,
      throwOnError = false,
      clubIdOverride: string | null = selectedClubId,
    ) => {
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

        const searchParams = new URLSearchParams();
        if (clubIdOverride) {
          searchParams.set("clubId", clubIdOverride);
        } else {
          searchParams.set("scope", "friends");
        }
        const query = searchParams.toString();
        const cacheKey = clubIdOverride
          ? `${CACHED_MEMBERS_KEY}:${clubIdOverride}`
          : CACHED_MEMBERS_KEY;
        const res = await fetch(buildApiUrl(`/api/players${query ? `?${query}` : ""}`), {
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
        localStorage.setItem(cacheKey, JSON.stringify(data));
        lastSuccessfulLoadAtRef.current = Date.now();
        setError(null);
        setNotice(null);
      } catch (err) {
        if (!isOnline) {
          const cacheKey = clubIdOverride
            ? `${CACHED_MEMBERS_KEY}:${clubIdOverride}`
            : CACHED_MEMBERS_KEY;
          const cachedMembers = readCachedMembers(cacheKey);
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
    [isOnline, selectedClubId, token],
  );

  const loadSelectedMemberMatchStats = useCallback(
    async (
      memberId: string,
      preserveVisibleData = false,
      throwOnError = false,
    ) => {
      if (!token) {
        selectedMemberProfileRequestIdRef.current += 1;
        setSelectedMemberMatchStats(createEmptyMatchStats());
        setSelectedMemberRatingDelta(createEmptyRatingDelta());
        setSelectedMemberRatingHistory(createEmptyRatingHistory());
        setSelectedMemberRecentMatches([]);
        setSelectedMemberMatchHistoryMatches([]);
        setSelectedMemberMatchHistoryPage(0);
        setSelectedMemberMatchHistoryTotal(0);
        setIsSelectedMemberStatsLoading(false);
        return;
      }

      const requestId = selectedMemberProfileRequestIdRef.current + 1;
      selectedMemberProfileRequestIdRef.current = requestId;

      if (!preserveVisibleData) {
        selectedMemberMatchHistoryRequestIdRef.current += 1;
        setSelectedMemberMatchStats(createEmptyMatchStats());
        setSelectedMemberRatingDelta(createEmptyRatingDelta());
        setSelectedMemberRatingHistory(createEmptyRatingHistory());
        setSelectedMemberRecentMatches([]);
        setSelectedMemberMatchHistoryMatches([]);
        setSelectedMemberMatchHistoryPage(0);
        setSelectedMemberMatchHistoryTotal(0);
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
        if (selectedMemberProfileRequestIdRef.current !== requestId) return;
        setSelectedMemberMatchStats(data.matchStats);
        setSelectedMemberRatingDelta(data.ratingDelta);
        setSelectedMemberRecentMatches(data.recentMatches);
        setSelectedMemberRatingHistory(buildRatingHistory(data.ratingHistory));
      } catch (err) {
        if (
          selectedMemberProfileRequestIdRef.current === requestId &&
          !preserveVisibleData
        ) {
          setSelectedMemberMatchStats(createEmptyMatchStats());
          setSelectedMemberRatingDelta(createEmptyRatingDelta());
          setSelectedMemberRatingHistory(createEmptyRatingHistory());
          setSelectedMemberRecentMatches([]);
        }
        if (
          selectedMemberProfileRequestIdRef.current === requestId &&
          throwOnError
        ) {
          throw err;
        }
      } finally {
        if (
          selectedMemberProfileRequestIdRef.current === requestId &&
          !preserveVisibleData
        ) {
          setIsSelectedMemberStatsLoading(false);
        }
      }
    },
    [token],
  );

  const loadSelectedMemberMatchHistory = useCallback(
    async (memberId: string, page: number, append = false) => {
      if (!token) return;

      const requestId = selectedMemberMatchHistoryRequestIdRef.current + 1;
      selectedMemberMatchHistoryRequestIdRef.current = requestId;
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
        if (selectedMemberMatchHistoryRequestIdRef.current !== requestId) return;
        setSelectedMemberMatchHistoryMatches((current) => {
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
        if (selectedMemberMatchHistoryRequestIdRef.current === requestId) {
          setIsSelectedMemberMatchHistoryLoading(false);
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
    void loadMemberClubs();
    if (!isTabRefreshDue(lastSuccessfulLoadAtRef.current)) return;

    void loadMembers(members.length > 0);
  }, [loadMemberClubs, loadMembers, members.length, selectedTab]);

  useEffect(() => {
    if (memberFilters.some((filter) => filter.id === selectedMemberFilterId)) {
      return;
    }

    setSelectedMemberFilterId(FRIENDS_MEMBER_FILTER_ID);
  }, [memberFilters, selectedMemberFilterId]);

  useEffect(() => {
    if (selectedTab !== "members") return;
    if (previousSelectedClubIdRef.current === selectedClubId) return;

    previousSelectedClubIdRef.current = selectedClubId;
    void loadMembers(members.length > 0);
  }, [loadMembers, members.length, selectedClubId, selectedTab]);

  useEffect(() => {
    if (!token || !selectedMemberId) {
      selectedMemberProfileRequestIdRef.current += 1;
      selectedMemberMatchHistoryRequestIdRef.current += 1;
      setSelectedMemberMatchStats(createEmptyMatchStats());
      setSelectedMemberRatingDelta(createEmptyRatingDelta());
      setSelectedMemberRatingHistory(createEmptyRatingHistory());
      setSelectedMemberRecentMatches([]);
      setSelectedMemberMatchHistoryMatches([]);
      setSelectedMemberMatchHistoryPage(0);
      setSelectedMemberMatchHistoryTotal(0);
      setIsSelectedMemberStatsLoading(false);
      setIsSelectedMemberMatchHistoryLoading(false);
      return;
    }

    void loadSelectedMemberMatchStats(selectedMemberId);
  }, [loadSelectedMemberMatchStats, selectedMemberId, token]);

  useEffect(
    () =>
      registerPullToRefresh("members", async () => {
        await loadMemberClubs();
        await loadMembers(true, true);
        if (selectedMemberId) {
          await loadSelectedMemberMatchStats(selectedMemberId, true, true);
        }
      }),
    [
      loadMemberClubs,
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

  const addFriendByQr = useCallback(
    async (payload: string) => {
      if (!token) {
        throw new Error("로그인이 필요합니다.");
      }
      if (!isOnline) {
        throw new Error("인터넷에 연결된 후 다시 시도해 주세요.");
      }

      const res = await fetch(buildApiUrl("/api/friends/player-qr"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "친구를 추가하지 못했어요.");
      }

      setSelectedMemberFilterId(FRIENDS_MEMBER_FILTER_ID);
      await loadMembers(true, true, null);
    },
    [isOnline, loadMembers, token],
  );

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
    selectedMemberMatchHistoryRequestIdRef.current += 1;
    setSelectedMemberMatchHistoryMatches([]);
    setSelectedMemberMatchHistoryPage(0);
    setSelectedMemberMatchHistoryTotal(0);
    setIsSelectedMemberMatchHistoryLoading(false);
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
        ? buildProfileMatchList(
            selectedMemberMatchHistoryMatches,
            selectedMemberId,
          )
        : [],
    [selectedMemberId, selectedMemberMatchHistoryMatches],
  );
  const recentSelectedMemberMatches = useMemo(
    () =>
      selectedMemberId
        ? buildRecentProfileMatches(selectedMemberRecentMatches, selectedMemberId)
        : [],
    [selectedMemberId, selectedMemberRecentMatches],
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
    setSelectedMemberMatchHistoryMatches(selectedMemberRecentMatches);
    setSelectedMemberMatchHistoryPage(0);
    setSelectedMemberMatchHistoryTotal(0);
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
  const selectMemberFilter = useCallback(
    (filterId: string) => {
      if (filterId === selectedMemberFilterId) return;

      setSelectedMemberFilterId(filterId);
      scrollToTop("auto");
    },
    [scrollToTop, selectedMemberFilterId],
  );

  return (
    <>
      <div className="flex h-full min-h-full flex-col">
        <TabPanelHeader
          title="Players"
          onHeaderElementChange={setHeaderElement}
          footer={
            <HeaderFilterTabs
              ariaLabel="플레이어 범위"
              selectedId={selectedMemberFilterId}
              onSelect={selectMemberFilter}
              tabs={memberFilters.map((filter) => ({
                id: filter.id,
                label: filter.label,
                icon:
                  filter.id === FRIENDS_MEMBER_FILTER_ID ? (
                    <LiaUserFriendsSolid aria-hidden="true" className="size-3.5" />
                  ) : (
                    <TbAffiliate aria-hidden="true" className="size-3.5" />
                  ),
              }))}
            />
          }
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="친구 추가"
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm font-semibold text-pkpk-primary-font transition-colors hover:text-pkpk-accent-font disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!isOnline}
              onClick={() => setIsFriendQrScannerOpen(true)}
            >
              <span aria-hidden="true" className="flex items-center -space-x-1.5">
                <IoAdd className="size-4" />
                <IoPerson className="size-4" />
              </span>
              <span className="members-add-friend-label">친구 추가</span>
            </button>
            <button
              type="button"
              className="rounded-full text-pkpk-primary-font transition-colors hover:text-pkpk-accent-font"
              onClick={openMyProfile}
            >
              <ProfileIdentityLabel
                avatarUrl={player?.avatarUrl}
                name={player?.username}
                label="내 프로필"
                showChevron
                chevronClassName="text-pkpk-primary-font/70"
                className="pl-1 pr-0"
              />
            </button>
          </div>
        </TabPanelHeader>
        <div className="tab-panel-header-content flex min-h-0 flex-1 flex-col bg-white">
          <TabPanelHeaderGradientExtension
            headerElement={headerElement}
            className="z-20"
          />
        <div className="relative z-30 mx-auto flex min-h-full w-full flex-1 flex-col">
            <div>
              {notice ? (
                <p className="mx-2 mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-[clamp(0.6875rem,3cqw,0.9rem)] font-semibold text-pkpk-sub-font">
                  {notice}
                </p>
              ) : null}
            </div>

            <div className="flex flex-1 flex-col">
            {isMemberListLoading ? (
              <MemberListSkeleton />
            ) : error ? (
              <TabPanelStatus message={error} tone="error" />
            ) : sortedMembers.length === 0 ? selectedClubId ? (
              <TabPanelStatus
                message={`현재 표시할 ${selectedMemberFilter.label} 소속 멤버가 없어요.`}
              />
            ) : (
              <TabPanelEmptyState message="현재 표시할 친구가 없어요." />
            ) : (
              <div>
                <div className="relative z-10 overflow-hidden rounded-3xl bg-white mx-1.5 mt-1 pt-1">
                  {sortedMembers.map((member, index) => {
                    const doublesRating = getCompositeDoublesRating(
                      member.duprRating,
                    );

                    return (
                      <div
                        key={member.id}
                        className={`relative flex w-full min-w-0 items-center gap-3 px-2.5 py-3 text-left transition-colors hover:bg-pkpk-hover-surface has-[button:active]:bg-pkpk-pressed-surface ${
                          index < sortedMembers.length - 1
                            ? "after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-pkpk-sub-font/10"
                            : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openMemberProfile(member.id)}
                          className="absolute inset-0 z-10"
                          aria-label={`${member.username ?? "멤버"} 프로필 보기`}
                        />
                        <div className="relative z-0 flex min-w-0 flex-1 items-center gap-4 pointer-events-none">
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
                              <div className="relative z-20 pointer-events-auto">
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
                        <div className="relative z-0 ml-auto flex shrink-0 items-center gap-2 pointer-events-none">
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
      </div>
      <PlayerQrScannerModal
        isOpen={isFriendQrScannerOpen}
        onOpenChange={setIsFriendQrScannerOpen}
        ariaLabel="친구 QR 스캔"
        successMessage="친구로 추가했어요."
        onScanned={addFriendByQr}
      />
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
          onPullToRefresh={async () => {
            await loadMembers(true, true);
            if (selectedMemberId) {
              await loadSelectedMemberMatchStats(selectedMemberId, true, true);
            }
          }}
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
          profileName={selectedMember.username ?? selectedMember.id}
          profileAvatarUrl={selectedMember.avatarUrl}
          matches={selectedMemberProfileMatches}
          isLoading={isSelectedMemberMatchHistoryLoading}
          hasMore={
            selectedMemberMatchHistoryMatches.length <
            selectedMemberMatchHistoryTotal
          }
          isLoadingMore={
            isSelectedMemberMatchHistoryLoading &&
            selectedMemberMatchHistoryMatches.length > 0
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
          onPullToRefresh={() =>
            selectedMemberId
              ? loadSelectedMemberMatchHistory(selectedMemberId, 0)
              : Promise.resolve()
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
          profileName={selectedMember?.username ?? selectedMember?.id}
          profileAvatarUrl={selectedMember?.avatarUrl}
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
