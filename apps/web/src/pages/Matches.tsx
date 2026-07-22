import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Switch } from "@heroui/react";
import type { MatchScore } from "@pkpkdupr/shared/match";
import Match, {
  type MatchFeedItemInfo,
  type MatchInfo,
  type MatchSessionSummaryInfo,
} from "@/components/Match";
import MatchDetail, { MatchDetailSkeleton } from "@/components/MatchDetail";
import DetailPageHeader from "@/components/DetailPageHeader";
import SessionCard from "@/components/SessionCard";
import SessionDetail from "@/components/SessionDetail";
import SkeletonBlock from "@/components/SkeletonBlock";
import TabPanelHeader from "@/components/TabPanelHeader";
import TabPanelStatus from "@/components/TabPanelStatus";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";
import { useMinimumLoading } from "@/hooks/useMinimumLoading";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { buildApiUrl } from "@/lib/api";
import { isTabRefreshDue } from "@/lib/tabRefresh";

interface MatchesProps {
  reloadKey?: number;
}

const CACHED_MATCH_FEED_KEY = "pkpkdupr:matches:v3-session-feed";
const CACHED_MY_MATCH_FEED_KEY = `${CACHED_MATCH_FEED_KEY}:my`;
const LEGACY_CACHED_MATCH_KEYS = [
  "pkpkdupr:matches",
  "pkpkdupr:matches:v2-public-dupr",
  "pkpkdupr:matches:v2-public-dupr:my",
];
const MATCHES_PAGE_SIZE = 20;
const OFFLINE_FALLBACK_MESSAGE =
  "최신 정보를 불러오지 못해 저장된 매치 목록을 표시합니다.";

interface CachedMatchFeed {
  items: MatchFeedItemInfo[];
  total: number;
}

interface MatchFeedResponse {
  items: MatchFeedItemInfo[];
  total: number;
}

const MatchFeedSkeleton: React.FC = () => (
  <div
    className="flex flex-col gap-3"
    role="status"
    aria-label="매치 목록 로딩 중"
  >
    {Array.from({ length: 4 }, (_, index) => (
      <Card key={index} className="rounded-3xl bg-white/95 p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="h-5 w-10 rounded-full" />
          </div>
          <SkeletonBlock className="size-5 rounded-full" />
        </div>
        <SkeletonBlock className="mt-2 h-5 w-36" />
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <div className="flex flex-col gap-2">
            <SkeletonBlock className="h-3 w-12" />
            <SkeletonBlock className="h-7 w-24 rounded-full" />
          </div>
          <SkeletonBlock className="h-9 w-14" />
          <div className="flex flex-col items-end gap-2">
            <SkeletonBlock className="h-3 w-12" />
            <SkeletonBlock className="h-7 w-24 rounded-full" />
          </div>
        </div>
      </Card>
    ))}
  </div>
);

const clearLegacyCachedMatches = () => {
  for (const key of LEGACY_CACHED_MATCH_KEYS) {
    localStorage.removeItem(key);
  }
};

const getCachedMatchFeedKey = (isMyMatchOnly: boolean) =>
  isMyMatchOnly ? CACHED_MY_MATCH_FEED_KEY : CACHED_MATCH_FEED_KEY;

const readCachedMatchFeed = (key: string): CachedMatchFeed | null => {
  try {
    const cachedFeed = localStorage.getItem(key);
    if (!cachedFeed) return null;

    const parsed = JSON.parse(cachedFeed) as Partial<CachedMatchFeed>;
    if (!Array.isArray(parsed.items) || typeof parsed.total !== "number") {
      return null;
    }

    return {
      items: parsed.items as MatchFeedItemInfo[],
      total: Math.max(parsed.items.length, parsed.total),
    };
  } catch {
    return null;
  }
};

const writeCachedMatchFeed = (key: string, cachedFeed: CachedMatchFeed) => {
  localStorage.setItem(key, JSON.stringify(cachedFeed));
};

const getFeedItemKey = (item: MatchFeedItemInfo) =>
  item.kind === "match"
    ? `match:${item.match.id}`
    : `session:${item.session.name}\u0000${item.session.date}`;

const mergeFeedItems = (
  currentItems: MatchFeedItemInfo[],
  nextItems: MatchFeedItemInfo[],
) => {
  const existingItemKeys = new Set(currentItems.map(getFeedItemKey));
  return [
    ...currentItems,
    ...nextItems.filter((item) => !existingItemKeys.has(getFeedItemKey(item))),
  ];
};

const isSameSession = (
  left: MatchSessionSummaryInfo,
  right: MatchSessionSummaryInfo,
) => left.name === right.name && left.date === right.date;

const Matches: React.FC<MatchesProps> = ({ reloadKey = 0 }) => {
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
  const [feedItems, setFeedItems] = useState<MatchFeedItemInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [nextPage, setNextPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isMyMatchOnly, setIsMyMatchOnly] = useState(false);
  const [selectedSession, setSelectedSession] =
    useState<MatchSessionSummaryInfo | null>(null);
  const [selectedSessionMatches, setSelectedSessionMatches] = useState<
    MatchInfo[]
  >([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchInfo | null>(null);
  const [isLoadingSelectedMatch, setIsLoadingSelectedMatch] = useState(false);
  const [selectedMatchError, setSelectedMatchError] = useState<string | null>(
    null,
  );
  const isMatchFeedLoading = useMinimumLoading(isLoading);
  const isSelectedMatchLoading = useMinimumLoading(isLoadingSelectedMatch);
  const latestRequestIdRef = useRef(0);
  const lastSuccessfulLoadAtRef = useRef<number | null>(null);
  const wasTabActiveRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const previousReloadKeyRef = useRef(reloadKey);
  const previousIsMyMatchOnlyRef = useRef(isMyMatchOnly);
  const [pendingMatchAction, setPendingMatchAction] = useState<{
    matchId: string;
    type: "submit-result" | "approve-result" | "cancel-approval";
  } | null>(null);

  useEffect(() => {
    clearLegacyCachedMatches();
  }, []);

  const loadFeed = useCallback(
    async (
      page = 0,
      append = false,
      preserveVisibleData = false,
      throwOnError = false,
    ) => {
      if (!token) {
        latestRequestIdRef.current += 1;
        setFeedItems([]);
        setTotal(0);
        setNextPage(0);
        setIsLoading(false);
        lastSuccessfulLoadAtRef.current = null;
        return;
      }

      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      const cachedFeedKey = getCachedMatchFeedKey(isMyMatchOnly);

      try {
        if (append) {
          setIsLoadingMore(true);
          setLoadMoreError(null);
        } else if (!preserveVisibleData) {
          setFeedItems([]);
          setTotal(0);
          setNextPage(0);
          setIsLoading(true);
          setError(null);
          setLoadMoreError(null);
          setNotice(null);
        }

        const searchParams = new URLSearchParams({
          page: String(page),
          limit: String(MATCHES_PAGE_SIZE),
        });
        if (isMyMatchOnly && player?.id) {
          searchParams.set("playerId", player.id);
        }

        const res = await fetch(
          buildApiUrl(`/api/match-feed?${searchParams.toString()}`),
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || "매치 목록을 불러오지 못했습니다.",
          );
        }

        const data = (await res.json()) as MatchFeedResponse;
        if (latestRequestIdRef.current !== requestId) return;

        setFeedItems((currentItems) => {
          const nextItems = append
            ? mergeFeedItems(currentItems, data.items)
            : data.items;
          writeCachedMatchFeed(cachedFeedKey, {
            items: nextItems,
            total: data.total,
          });
          return nextItems;
        });
        setTotal(data.total);
        setNextPage(page + 1);
        if (!append) {
          lastSuccessfulLoadAtRef.current = Date.now();
          setError(null);
          setNotice(null);
        }
      } catch (err) {
        if (latestRequestIdRef.current !== requestId) return;

        if (!isOnline) {
          const cachedFeed = readCachedMatchFeed(cachedFeedKey);
          if (cachedFeed && !append && !preserveVisibleData) {
            setFeedItems(cachedFeed.items);
            setTotal(cachedFeed.total);
            setNextPage(Math.ceil(cachedFeed.items.length / MATCHES_PAGE_SIZE));
            setNotice(OFFLINE_FALLBACK_MESSAGE);
            setError(null);
            return;
          }
        }

        const message =
          err instanceof Error ? err.message : "매치 목록을 불러오지 못했습니다.";
        if (append) {
          setLoadMoreError(message);
        } else if (!preserveVisibleData) {
          setError(message);
        }
        if (throwOnError) throw err;
      } finally {
        if (latestRequestIdRef.current === requestId) {
          if (append) {
            setIsLoadingMore(false);
          } else if (!preserveVisibleData) {
            setIsLoading(false);
          }
        }
      }
    },
    [isMyMatchOnly, isOnline, player?.id, token],
  );

  const loadSelectedMatch = useCallback(
    async (matchId: string) => {
      if (!token) throw new Error("로그인이 필요해요.");

      const res = await fetch(buildApiUrl(`/api/matches/${matchId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "매치를 불러오지 못했습니다.");
      }

      const refreshedMatch = (await res.json()) as MatchInfo;
      setSelectedMatch(refreshedMatch);
      setFeedItems((currentItems) =>
        currentItems.map((item) =>
          item.kind === "match" && item.match.id === refreshedMatch.id
            ? { kind: "match", match: refreshedMatch }
            : item,
        ),
      );
      setSelectedSessionMatches((currentMatches) =>
        currentMatches.map((match) =>
          match.id === refreshedMatch.id ? refreshedMatch : match,
        ),
      );
    },
    [token],
  );

  const loadMatchDetail = useCallback(
    async (matchId: string) => {
      setIsLoadingSelectedMatch(true);
      setSelectedMatchError(null);

      try {
        await loadSelectedMatch(matchId);
      } catch (err) {
        setSelectedMatchError(
          err instanceof Error ? err.message : "매치를 불러오지 못했습니다.",
        );
      } finally {
        setIsLoadingSelectedMatch(false);
      }
    },
    [loadSelectedMatch],
  );

  const loadSessionMatches = useCallback(
    async (
      session: MatchSessionSummaryInfo,
      preserveVisibleData = false,
      throwOnError = false,
    ) => {
      if (!token) {
        const nextError = "로그인이 필요해요.";
        setSessionError(nextError);
        if (throwOnError) throw new Error(nextError);
        return;
      }
      if (!isOnline) {
        const nextError = "오프라인에서는 세션의 전체 경기를 불러올 수 없습니다.";
        setSessionError(nextError);
        if (throwOnError) throw new Error(nextError);
        return;
      }

      try {
        if (!preserveVisibleData) {
          setSelectedSessionMatches([]);
          setIsLoadingSession(true);
          setSessionError(null);
        }
        const res = await fetch(
          buildApiUrl(`/api/match-sessions/${session.id}/matches`),
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || "세션 경기를 불러오지 못했습니다.",
          );
        }

        setSelectedSessionMatches((await res.json()) as MatchInfo[]);
        setSessionError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "세션 경기를 불러오지 못했습니다.";
        setSessionError(message);
        if (throwOnError) throw err;
      } finally {
        setIsLoadingSession(false);
      }
    },
    [isOnline, token],
  );

  useEffect(() => {
    const isTabActive = selectedTab === "match";
    if (!isTabActive) {
      wasTabActiveRef.current = false;
      return;
    }
    if (wasTabActiveRef.current) return;

    wasTabActiveRef.current = true;
    if (
      !pendingReloadRef.current &&
      !isTabRefreshDue(lastSuccessfulLoadAtRef.current)
    ) {
      return;
    }

    pendingReloadRef.current = false;
    void loadFeed(0, false, lastSuccessfulLoadAtRef.current !== null);
  }, [loadFeed, selectedTab]);

  useEffect(() => {
    if (previousReloadKeyRef.current === reloadKey) return;

    previousReloadKeyRef.current = reloadKey;
    if (selectedTab !== "match") {
      pendingReloadRef.current = true;
      return;
    }
    void loadFeed(0, false, feedItems.length > 0);
  }, [feedItems.length, loadFeed, reloadKey, selectedTab]);

  useEffect(() => {
    if (previousIsMyMatchOnlyRef.current === isMyMatchOnly) return;

    previousIsMyMatchOnlyRef.current = isMyMatchOnly;
    if (selectedTab !== "match") {
      pendingReloadRef.current = true;
      return;
    }
    void loadFeed();
  }, [isMyMatchOnly, loadFeed, selectedTab]);

  useEffect(() => {
    if (!selectedMatchId) return;

    const refreshedMatch =
      selectedSessionMatches.find((match) => match.id === selectedMatchId) ??
      feedItems.find(
        (item): item is Extract<MatchFeedItemInfo, { kind: "match" }> =>
          item.kind === "match" && item.match.id === selectedMatchId,
      )?.match;
    if (refreshedMatch) setSelectedMatch(refreshedMatch);
  }, [feedItems, selectedMatchId, selectedSessionMatches]);

  useEffect(() => {
    if (!selectedSession) return;

    const refreshedSession = feedItems.find(
      (item): item is Extract<MatchFeedItemInfo, { kind: "session" }> =>
        item.kind === "session" && isSameSession(item.session, selectedSession),
    )?.session;
    if (refreshedSession) setSelectedSession(refreshedSession);
  }, [feedItems, selectedSession]);

  useEffect(
    () =>
      registerPullToRefresh("match", async () => {
        if (selectedMatch) {
          await loadSelectedMatch(selectedMatch.id);
          return;
        }
        if (selectedSession) {
          await loadSessionMatches(selectedSession, true, true);
          return;
        }
        await loadFeed(0, false, true, true);
      }),
    [
      loadFeed,
      loadSelectedMatch,
      loadSessionMatches,
      registerPullToRefresh,
      selectedMatch,
      selectedSession,
    ],
  );

  const refreshFeedAndSession = useCallback(async () => {
    await loadFeed();
    if (selectedSession) {
      await loadSessionMatches(selectedSession, true);
    }
  }, [loadFeed, loadSessionMatches, selectedSession]);

  const handleSubmitResult = useCallback(
    async (matchId: string, scores: MatchScore[]) => {
      if (!token) throw new Error("로그인이 필요해요.");
      if (!isOnline) {
        throw new Error(
          "오프라인에서는 결과를 입력할 수 없습니다. 온라인 연결이 필요합니다.",
        );
      }

      try {
        setPendingMatchAction({ matchId, type: "submit-result" });
        const res = await fetch(buildApiUrl(`/api/matches/${matchId}/result`), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scores }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "결과를 입력하지 못했어요.");
        }
        await refreshFeedAndSession();
      } finally {
        setPendingMatchAction(null);
      }
    },
    [isOnline, refreshFeedAndSession, token],
  );

  const handleApproveResult = useCallback(
    async (matchId: string) => {
      if (!token) throw new Error("로그인이 필요해요.");
      if (!isOnline) {
        throw new Error(
          "오프라인에서는 결과를 승인할 수 없습니다. 온라인 연결이 필요합니다.",
        );
      }

      try {
        setPendingMatchAction({ matchId, type: "approve-result" });
        const res = await fetch(
          buildApiUrl(`/api/matches/${matchId}/approval`),
          { method: "POST", headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "결과를 승인하지 못했어요.");
        }
        await refreshFeedAndSession();
      } finally {
        setPendingMatchAction(null);
      }
    },
    [isOnline, refreshFeedAndSession, token],
  );

  const handleCancelApproval = useCallback(
    async (matchId: string) => {
      if (!token) throw new Error("로그인이 필요해요.");
      if (!isOnline) {
        throw new Error(
          "오프라인에서는 합의를 취소할 수 없습니다. 온라인 연결이 필요합니다.",
        );
      }

      try {
        setPendingMatchAction({ matchId, type: "cancel-approval" });
        const res = await fetch(
          buildApiUrl(`/api/matches/${matchId}/approval`),
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "합의를 취소하지 못했어요.");
        }
        await refreshFeedAndSession();
      } finally {
        setPendingMatchAction(null);
      }
    },
    [isOnline, refreshFeedAndSession, token],
  );

  const closeMatchDetail = useCallback(() => {
    setSelectedMatchId(null);
    setSelectedMatch(null);
    setSelectedMatchError(null);
    setIsLoadingSelectedMatch(false);
    restoreScrollTop("match");
  }, [restoreScrollTop]);

  const closeSessionDetail = useCallback(() => {
    setSelectedSession(null);
    setSelectedSessionMatches([]);
    setSessionError(null);
    restoreScrollTop("match");
  }, [restoreScrollTop]);

  const openMatchDetail = useCallback(
    (match: MatchInfo) => {
      saveScrollPosition("match");
      pushDepth("match", {
        id: `match-detail:${match.id}`,
        kind: "match-detail",
        onClose: closeMatchDetail,
      });
      setSelectedMatchId(match.id);
      setSelectedMatch(match);
      window.requestAnimationFrame(() => scrollToTop("auto"));
      void loadMatchDetail(match.id);
    },
    [
      closeMatchDetail,
      loadMatchDetail,
      pushDepth,
      saveScrollPosition,
      scrollToTop,
    ],
  );

  const openSessionDetail = useCallback(
    (session: MatchSessionSummaryInfo) => {
      saveScrollPosition("match");
      pushDepth("match", {
        id: `session-detail:${session.id}`,
        kind: "session-detail",
        onClose: closeSessionDetail,
      });
      setSelectedSession(session);
      setSelectedSessionMatches([]);
      setSessionError(null);
      window.requestAnimationFrame(() => scrollToTop("auto"));
      void loadSessionMatches(session).catch(() => {});
    },
    [
      closeSessionDetail,
      loadSessionMatches,
      pushDepth,
      saveScrollPosition,
      scrollToTop,
    ],
  );

  const hasMoreItems = isOnline && feedItems.length < total;

  if (selectedMatchId && selectedMatchError && !isSelectedMatchLoading) {
    return (
      <div className="min-h-full">
        <DetailPageHeader title="Match Detail" tabKey="match" />
        <div className="p-2">
          <div className="flex flex-col gap-3">
            <TabPanelStatus
              message={selectedMatchError ?? undefined}
              tone="error"
            />
            <Button
              type="button"
              className="app-action-button w-full rounded-2xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              onPress={() => void loadMatchDetail(selectedMatchId)}
            >
              다시 시도
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedMatchId && isSelectedMatchLoading && !selectedMatch) {
    return <MatchDetailSkeleton />;
  }

  if (selectedMatch) {
    return (
      <MatchDetail
        match={selectedMatch}
        currentPlayerId={player?.id}
        onSubmitResult={handleSubmitResult}
        onApproveResult={handleApproveResult}
        onCancelApproval={handleCancelApproval}
        isOnline={isOnline}
        isSubmittingResult={
          pendingMatchAction?.matchId === selectedMatch.id &&
          pendingMatchAction.type === "submit-result"
        }
        isApprovingResult={
          pendingMatchAction?.matchId === selectedMatch.id &&
          pendingMatchAction.type === "approve-result"
        }
        isCancellingApproval={
          pendingMatchAction?.matchId === selectedMatch.id &&
          pendingMatchAction.type === "cancel-approval"
        }
        isLoading={isSelectedMatchLoading}
      />
    );
  }

  if (selectedSession) {
    return (
      <SessionDetail
        session={selectedSession}
        matches={selectedSessionMatches}
        currentPlayerId={player?.id}
        isLoading={isLoadingSession}
        error={sessionError}
        onRetry={() => void loadSessionMatches(selectedSession)}
        onPressMatch={openMatchDetail}
      />
    );
  }

  return (
    <>
      <TabPanelHeader title="Matches">
        <Switch
          aria-label="내경기만 보기"
          className="shrink-0"
          isSelected={isMyMatchOnly}
          onChange={setIsMyMatchOnly}
          size="sm"
          style={
            {
              "--switch-control-bg": "#d1d5db",
              "--switch-control-bg-hover": "#cbd5e1",
              "--switch-control-bg-checked": "#3b52cc",
              "--switch-control-bg-checked-hover": "#2d42a8",
            } as React.CSSProperties
          }
        >
          <Switch.Content className="-mx-2 -my-1 min-h-11 gap-2 rounded-full px-2 py-1 text-pkpk-accent-font touch-manipulation">
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="text-sm font-bold leading-none text-pkpk-primary-bg">
              내경기
            </span>
          </Switch.Content>
        </Switch>
      </TabPanelHeader>
      <div className="flex min-h-full p-2">
        <div className="mx-auto flex min-h-full w-full flex-1 flex-col gap-4">
          {notice ? (
            <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-pkpk-sub-font">
              {notice}
            </p>
          ) : null}

          {isMatchFeedLoading ? (
            <MatchFeedSkeleton />
          ) : error ? (
            <TabPanelStatus message={error} tone="error" />
          ) : feedItems.length === 0 ? (
            <TabPanelStatus
              message={
                isMyMatchOnly
                  ? "현재 표시할 내 경기가 없어요."
                  : "현재 표시할 매치가 없어요."
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {feedItems.map((item) =>
                item.kind === "session" ? (
                  <SessionCard
                    key={getFeedItemKey(item)}
                    session={item.session}
                    onPress={openSessionDetail}
                  />
                ) : (
                  <Match
                    key={item.match.id}
                    match={item.match}
                    currentPlayerId={player?.id}
                    onPress={openMatchDetail}
                  />
                ),
              )}
              {loadMoreError ? (
                <p
                  className="text-center text-sm font-medium text-error"
                  role="alert"
                >
                  {loadMoreError}
                </p>
              ) : null}
              {hasMoreItems ? (
                <Button
                  type="button"
                  className="app-action-button w-full rounded-2xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                  isDisabled={isLoadingMore}
                  onPress={() => void loadFeed(nextPage, true)}
                >
                  {isLoadingMore ? "불러오는 중..." : "더 보기"}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Matches;
