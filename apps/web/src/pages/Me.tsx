import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { IoSettingsOutline } from "react-icons/io5";
import BottomSheet from "@/components/BottomSheet";
import DetailPageHeader from "@/components/DetailPageHeader";
import type {
  MatchInfo,
  MatchListResponse,
  PlayerProfileSummaryResponse,
} from "@/components/Match";
import MemberProfile from "@/components/MemberProfile";
import ProfileMatchDetailDrawer from "@/components/ProfileMatchDetailDrawer";
import ProfileMatchHistoryDrawer from "@/components/ProfileMatchHistoryDrawer";
import ProfileSettingsSheetBody from "@/components/ProfileSettingsSheetBody";
import type { PlayerInfo } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import { type TabKey, useTabNavigation } from "@/context/TabNavigationContext";
import { buildApiUrl } from "@/lib/api";
import { isTabRefreshDue } from "@/lib/tabRefresh";
import {
  buildProfileMatchList,
  buildRecentProfileMatches,
  buildRatingHistory,
  createEmptyMatchStats,
  createEmptyRatingDelta,
  createEmptyRatingHistory,
} from "@/utils/matchStats";

const noop = () => {};
const MATCH_HISTORY_DEPTH_ID = "my-profile-match-history";
const MATCH_HISTORY_PAGE_SIZE = 20;

interface MyProfileProps {
  tabKey: TabKey;
  isActive: boolean;
  onProfileUpdated?: (player: PlayerInfo) => void;
}

const MyProfile: React.FC<MyProfileProps> = ({
  tabKey,
  isActive,
  onProfileUpdated,
}) => {
  const { player, token } = useAuth();
  const {
    closeDepth,
    depthStacks,
    pushDepth,
    registerScrollContainer,
    restoreScrollTop,
    saveScrollPosition,
    scrollToTop,
  } = useTabNavigation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [matchStats, setMatchStats] = useState(createEmptyMatchStats);
  const [ratingDelta, setRatingDelta] = useState(createEmptyRatingDelta);
  const [ratingHistory, setRatingHistory] = useState(createEmptyRatingHistory);
  const [profileMatches, setProfileMatches] = useState<MatchInfo[]>([]);
  const [isMatchStatsLoading, setIsMatchStatsLoading] = useState(true);
  const [isMatchHistoryRequested, setIsMatchHistoryRequested] = useState(false);
  const [isMatchHistoryLoading, setIsMatchHistoryLoading] = useState(false);
  const [matchHistoryPage, setMatchHistoryPage] = useState(0);
  const [matchHistoryTotal, setMatchHistoryTotal] = useState(0);
  const [selectedProfileMatch, setSelectedProfileMatch] =
    useState<MatchInfo | null>(null);
  const lastSuccessfulLoadAtRef = useRef<number | null>(null);
  const wasTabActiveRef = useRef(false);
  const playerId = player?.id;

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const loadMatchStats = useCallback(
    async (
      signal: AbortSignal,
      preserveVisibleData = false,
      throwOnError = false,
    ) => {
      if (!token || !playerId) {
        lastSuccessfulLoadAtRef.current = null;
        setMatchStats(createEmptyMatchStats());
        setRatingDelta(createEmptyRatingDelta());
        setRatingHistory(createEmptyRatingHistory());
        setProfileMatches([]);
        setIsMatchStatsLoading(false);
        return;
      }

      if (!preserveVisibleData) {
        setIsMatchStatsLoading(true);
      }

      try {
        const res = await fetch(
          buildApiUrl(`/api/players/${encodeURIComponent(playerId)}/profile-summary`),
          {
            headers: { Authorization: `Bearer ${token}` },
            signal,
          },
        );

        if (!res.ok) {
          throw new Error("매치 목록을 불러오지 못했습니다.");
        }

        const data = (await res.json()) as PlayerProfileSummaryResponse;

        if (!signal.aborted) {
          setMatchStats(data.matchStats);
          setRatingDelta(data.ratingDelta);
          setProfileMatches(data.recentMatches);
          setRatingHistory(buildRatingHistory(data.ratingHistory));
          setMatchHistoryPage(0);
          setMatchHistoryTotal(0);
          lastSuccessfulLoadAtRef.current = Date.now();
        }
      } catch {
        if (!signal.aborted && !preserveVisibleData) {
          setMatchStats(createEmptyMatchStats());
          setRatingDelta(createEmptyRatingDelta());
          setRatingHistory(createEmptyRatingHistory());
          setProfileMatches([]);
        }
        if (!signal.aborted && throwOnError) {
          throw new Error("내 경기 통계를 새로고침하지 못했습니다.");
        }
      } finally {
        if (!signal.aborted && !preserveVisibleData) {
          setIsMatchStatsLoading(false);
        }
      }
  },
    [playerId, token],
  );

  const loadMatchHistory = useCallback(
    async (page: number, append = false) => {
      if (!token || !playerId) return;

      setIsMatchHistoryLoading(true);
      try {
        const searchParams = new URLSearchParams({
          playerId,
          page: String(page),
          limit: String(MATCH_HISTORY_PAGE_SIZE),
        });
        const res = await fetch(
          buildApiUrl(`/api/matches?${searchParams.toString()}`),
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error("매치 목록을 불러오지 못했습니다.");

        const data = (await res.json()) as MatchListResponse;
        setProfileMatches((current) => {
          if (!append) return data.matches;
          const ids = new Set(current.map((match) => match.id));
          return [...current, ...data.matches.filter((match) => !ids.has(match.id))];
        });
        setMatchHistoryPage(page + 1);
        setMatchHistoryTotal(data.total);
      } finally {
        setIsMatchHistoryLoading(false);
      }
    },
    [playerId, token],
  );

  useEffect(() => {
    if (!isActive) {
      wasTabActiveRef.current = false;
      return;
    }

    if (wasTabActiveRef.current) return;

    wasTabActiveRef.current = true;
    if (!isTabRefreshDue(lastSuccessfulLoadAtRef.current)) return;

    const abortController = new AbortController();
    void loadMatchStats(
      abortController.signal,
      lastSuccessfulLoadAtRef.current !== null,
    );

    return () => {
      abortController.abort();
      // React Strict Mode와 인증 정보 갱신으로 effect가 다시 실행될 때,
      // 취소된 첫 요청 때문에 다음 요청까지 막히지 않도록 한다.
      wasTabActiveRef.current = false;
    };
  }, [isActive, loadMatchStats]);

  useEffect(() => {
    if (!token || !playerId) {
      lastSuccessfulLoadAtRef.current = null;
      setMatchStats(createEmptyMatchStats());
      setRatingDelta(createEmptyRatingDelta());
      setRatingHistory(createEmptyRatingHistory());
      setProfileMatches([]);
      setIsMatchStatsLoading(false);
    }
  }, [playerId, token]);

  const openSettings = () => {
    pushDepth(tabKey, {
      id: "my-profile-settings",
      kind: "bottom-sheet",
      onClose: closeSettings,
    });
    setIsSettingsOpen(true);
  };

  const handleSettingsOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      openSettings();
      return;
    }

    closeDepth(tabKey, "my-profile-settings");
    setIsSettingsOpen(false);
  };

  const profileMatchList = useMemo(
    () => (playerId ? buildProfileMatchList(profileMatches, playerId) : []),
    [playerId, profileMatches],
  );
  const recentProfileMatches = useMemo(
    () => (playerId ? buildRecentProfileMatches(profileMatches, playerId) : []),
    [playerId, profileMatches],
  );
  const isMatchHistoryDrawerOpen =
    isMatchHistoryRequested && depthStacks[tabKey].includes(MATCH_HISTORY_DEPTH_ID);
  const profileMatchDetailDepthId = selectedProfileMatch
    ? `my-profile-match-detail:${selectedProfileMatch.id}`
    : null;
  const isProfileMatchDetailDrawerOpen =
    !!profileMatchDetailDepthId && depthStacks[tabKey].includes(profileMatchDetailDepthId);

  const registerMatchHistoryScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      registerScrollContainer(tabKey, MATCH_HISTORY_DEPTH_ID, element);
    },
    [registerScrollContainer, tabKey],
  );
  const registerProfileMatchDetailScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      if (!profileMatchDetailDepthId) return;
      registerScrollContainer(tabKey, profileMatchDetailDepthId, element);
    },
    [profileMatchDetailDepthId, registerScrollContainer, tabKey],
  );

  const openMatchHistory = () => {
    saveScrollPosition(tabKey);
    pushDepth(tabKey, {
      id: MATCH_HISTORY_DEPTH_ID,
      kind: "match-history",
      onClose: noop,
    });
    setIsMatchHistoryRequested(true);
    void loadMatchHistory(0);
    window.requestAnimationFrame(() => scrollToTop("auto"));
  };

  const openProfileMatchDetail = (match: MatchInfo) => {
    saveScrollPosition(tabKey);
    pushDepth(tabKey, {
      id: `my-profile-match-detail:${match.id}`,
      kind: "match-detail",
      onClose: noop,
    });
    setSelectedProfileMatch(match);
    window.requestAnimationFrame(() => scrollToTop("auto"));
  };

  const completeMatchHistoryClose = useCallback(() => {
    setIsMatchHistoryRequested(false);
    restoreScrollTop(tabKey);
  }, [restoreScrollTop, tabKey]);

  const completeProfileMatchDetailClose = useCallback(() => {
    setSelectedProfileMatch(null);
    restoreScrollTop(tabKey);
  }, [restoreScrollTop, tabKey]);

  const settingsButton = (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="rounded-full border-0 px-0 font-bold !text-pkpk-primary-bg"
      onPress={openSettings}
    >
      <IoSettingsOutline className="size-4" />
      설정
    </Button>
  );

  return (
    <>
      <DetailPageHeader
        title="내 프로필"
        tabKey={tabKey}
        rightContent={settingsButton}
      />
      <MemberProfile
        player={player}
        isMe
        showDetailHeader={false}
        onProfileUpdated={onProfileUpdated}
        matchStats={matchStats}
        ratingDelta={ratingDelta}
        ratingHistory={ratingHistory}
        isStatsLoading={isMatchStatsLoading}
        recentMatches={recentProfileMatches}
        showPlayerId
        onPressRecentMatch={openProfileMatchDetail}
        onViewAllMatches={openMatchHistory}
      />

      <ProfileMatchHistoryDrawer
        isOpen={isMatchHistoryDrawerOpen}
        isActive={isActive}
        tabKey={tabKey}
        matches={profileMatchList}
        isLoading={isMatchHistoryLoading}
        hasMore={profileMatches.length < matchHistoryTotal}
        isLoadingMore={isMatchHistoryLoading && profileMatches.length > 0}
        onLoadMore={() => void loadMatchHistory(matchHistoryPage, true)}
        onPressMatch={openProfileMatchDetail}
        onExited={completeMatchHistoryClose}
        onScrollContainerChange={registerMatchHistoryScrollContainer}
        layer={60}
      />
      <ProfileMatchDetailDrawer
        isOpen={isProfileMatchDetailDrawerOpen}
        isActive={isActive}
        tabKey={tabKey}
        match={selectedProfileMatch}
        currentPlayerId={playerId}
        onExited={completeProfileMatchDetailClose}
        onScrollContainerChange={registerProfileMatchDetailScrollContainer}
        layer={70}
      />

      <BottomSheet
        isOpen={isSettingsOpen}
        isActive={isActive}
        onOpenChange={handleSettingsOpenChange}
        ariaLabel="설정"
        className="px-5 pt-6"
      >
        <ProfileSettingsSheetBody />
      </BottomSheet>
    </>
  );
};

export default MyProfile;
