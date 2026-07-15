import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, Switch } from "@heroui/react";
import type { MatchScore } from "@pkpkdupr/shared/match";
import { useAuth } from "@/context/AuthContext";
import Match, { type MatchInfo } from "@/components/Match";
import MatchDetail from "@/components/MatchDetail";
import TabPanelHeader from "@/components/TabPanelHeader";
import TabPanelStatus from "@/components/TabPanelStatus";
import { useTabNavigation } from "@/context/TabNavigationContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { buildApiUrl } from "@/lib/api";
import { isTabRefreshDue } from "@/lib/tabRefresh";

interface MatchesProps {
  reloadKey?: number;
}

const CACHED_MATCHES_KEY = "pkpkdupr:matches:v2-public-dupr";
const CACHED_MY_MATCHES_KEY = `${CACHED_MATCHES_KEY}:my`;
const LEGACY_CACHED_MATCHES_KEYS = ["pkpkdupr:matches"];
const MATCHES_PAGE_SIZE = 20;
const OFFLINE_FALLBACK_MESSAGE =
  "최신 정보를 불러오지 못해 저장된 매치 목록을 표시합니다.";

interface CachedMatches {
  matches: MatchInfo[];
  total: number;
}

interface MatchesResponse {
  matches: MatchInfo[];
  total: number;
}

const clearLegacyCachedMatches = () => {
  for (const key of LEGACY_CACHED_MATCHES_KEYS) {
    localStorage.removeItem(key);
  }
};

const getCachedMatchesKey = (isMyMatchOnly: boolean) =>
  isMyMatchOnly ? CACHED_MY_MATCHES_KEY : CACHED_MATCHES_KEY;

const readCachedMatches = (key: string): CachedMatches | null => {
  try {
    const cachedMatches = localStorage.getItem(key);
    if (!cachedMatches) {
      return null;
    }

    const parsed = JSON.parse(cachedMatches) as unknown;
    if (Array.isArray(parsed)) {
      return { matches: parsed as MatchInfo[], total: parsed.length };
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as CachedMatches).matches) &&
      typeof (parsed as CachedMatches).total === "number"
    ) {
      const { matches, total } = parsed as CachedMatches;
      return { matches, total: Math.max(matches.length, total) };
    }

    return null;
  } catch {
    return null;
  }
};

const writeCachedMatches = (key: string, cachedMatches: CachedMatches) => {
  localStorage.setItem(key, JSON.stringify(cachedMatches));
};

const mergeMatches = (
  currentMatches: MatchInfo[],
  nextMatches: MatchInfo[],
) => {
  const existingMatchIds = new Set(currentMatches.map((match) => match.id));
  return [
    ...currentMatches,
    ...nextMatches.filter((match) => !existingMatchIds.has(match.id)),
  ];
};

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
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [nextPage, setNextPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isMyMatchOnly, setIsMyMatchOnly] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchInfo | null>(null);
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

  const loadMatches = useCallback(
    async (
      page = 0,
      append = false,
      preserveVisibleData = false,
      throwOnError = false,
    ) => {
      if (!token) {
        latestRequestIdRef.current += 1;
        setMatches([]);
        setTotal(0);
        setNextPage(0);
        setIsLoading(false);
        lastSuccessfulLoadAtRef.current = null;
        return;
      }

      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      const cachedMatchesKey = getCachedMatchesKey(isMyMatchOnly);

      try {
        if (append) {
          setIsLoadingMore(true);
          setLoadMoreError(null);
        } else if (!preserveVisibleData) {
          setMatches([]);
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
          buildApiUrl(`/api/matches?${searchParams.toString()}`),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || "매치 목록을 불러오지 못했습니다.",
          );
        }

        const data = (await res.json()) as MatchesResponse;
        if (latestRequestIdRef.current !== requestId) {
          return;
        }

        setMatches((currentMatches) => {
          const nextMatches = append
            ? mergeMatches(currentMatches, data.matches)
            : data.matches;
          writeCachedMatches(cachedMatchesKey, {
            matches: nextMatches,
            total: data.total,
          });
          return nextMatches;
        });
        setTotal(data.total);
        setNextPage(page + 1);
        if (!append) {
          lastSuccessfulLoadAtRef.current = Date.now();
          setError(null);
          setNotice(null);
        }
      } catch (err) {
        if (latestRequestIdRef.current !== requestId) {
          return;
        }

        if (!isOnline) {
          const cachedMatches = readCachedMatches(cachedMatchesKey);
          if (cachedMatches && !append && !preserveVisibleData) {
            setMatches(cachedMatches.matches);
            setTotal(cachedMatches.total);
            setNextPage(
              Math.ceil(cachedMatches.matches.length / MATCHES_PAGE_SIZE),
            );
            setNotice(OFFLINE_FALLBACK_MESSAGE);
            setError(null);
            return;
          }
        }

        const message =
          err instanceof Error
            ? err.message
            : "매치 목록을 불러오지 못했습니다.";
        if (append) {
          setLoadMoreError(message);
        } else if (!preserveVisibleData) {
          setError(message);
        }

        if (throwOnError) {
          throw err;
        }
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
      if (!token) {
        throw new Error("로그인이 필요해요.");
      }

      const res = await fetch(buildApiUrl(`/api/matches/${matchId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "매치를 불러오지 못했습니다.");
      }

      const refreshedMatch = (await res.json()) as MatchInfo;
      setSelectedMatch(refreshedMatch);
      setMatches((currentMatches) =>
        currentMatches.map((match) =>
          match.id === refreshedMatch.id ? refreshedMatch : match,
        ),
      );
    },
    [token],
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
    void loadMatches(0, false, lastSuccessfulLoadAtRef.current !== null);
  }, [loadMatches, selectedTab]);

  useEffect(() => {
    if (previousReloadKeyRef.current === reloadKey) return;

    previousReloadKeyRef.current = reloadKey;
    if (selectedTab !== "match") {
      pendingReloadRef.current = true;
      return;
    }

    void loadMatches(0, false, matches.length > 0);
  }, [loadMatches, matches.length, reloadKey, selectedTab]);

  useEffect(() => {
    if (previousIsMyMatchOnlyRef.current === isMyMatchOnly) return;

    previousIsMyMatchOnlyRef.current = isMyMatchOnly;
    if (selectedTab !== "match") {
      pendingReloadRef.current = true;
      return;
    }

    void loadMatches();
  }, [isMyMatchOnly, loadMatches, selectedTab]);

  useEffect(() => {
    if (!selectedMatchId) {
      return;
    }

    const refreshedMatch = matches.find(
      (match) => match.id === selectedMatchId,
    );
    if (refreshedMatch) {
      setSelectedMatch(refreshedMatch);
    }
  }, [matches, selectedMatchId]);

  useEffect(
    () =>
      registerPullToRefresh("match", async () => {
        if (selectedMatch) {
          await loadSelectedMatch(selectedMatch.id);
          return;
        }

        await loadMatches(0, false, true, true);
      }),
    [loadMatches, loadSelectedMatch, registerPullToRefresh, selectedMatch],
  );

  const hasMoreMatches = isOnline && matches.length < total;

  const handleSubmitResult = useCallback(
    async (matchId: string, scores: MatchScore[]) => {
      if (!token) {
        throw new Error("로그인이 필요해요.");
      }
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

        await loadMatches();
      } finally {
        setPendingMatchAction(null);
      }
    },
    [isOnline, loadMatches, token],
  );

  const handleApproveResult = useCallback(
    async (matchId: string) => {
      if (!token) {
        throw new Error("로그인이 필요해요.");
      }
      if (!isOnline) {
        throw new Error(
          "오프라인에서는 결과를 승인할 수 없습니다. 온라인 연결이 필요합니다.",
        );
      }

      try {
        setPendingMatchAction({ matchId, type: "approve-result" });
        const res = await fetch(
          buildApiUrl(`/api/matches/${matchId}/approval`),
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "결과를 승인하지 못했어요.");
        }

        await loadMatches();
      } finally {
        setPendingMatchAction(null);
      }
    },
    [isOnline, loadMatches, token],
  );

  const handleCancelApproval = useCallback(
    async (matchId: string) => {
      if (!token) {
        throw new Error("로그인이 필요해요.");
      }
      if (!isOnline) {
        throw new Error(
          "오프라인에서는 합의를 취소할 수 없습니다. 온라인 연결이 필요합니다.",
        );
      }

      try {
        setPendingMatchAction({ matchId, type: "cancel-approval" });
        const res = await fetch(
          buildApiUrl(`/api/matches/${matchId}/approval`),
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "합의를 취소하지 못했어요.");
        }

        await loadMatches();
      } finally {
        setPendingMatchAction(null);
      }
    },
    [isOnline, loadMatches, token],
  );

  const closeMatchDetail = useCallback(() => {
    setSelectedMatchId(null);
    setSelectedMatch(null);
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
      void loadSelectedMatch(match.id).catch(() => {});
    },
    [
      closeMatchDetail,
      loadSelectedMatch,
      pushDepth,
      saveScrollPosition,
      scrollToTop,
    ],
  );

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
              "--switch-control-bg-checked": "#eaff19",
              "--switch-control-bg-checked-hover": "#d4e600",
            } as React.CSSProperties
          }
        >
          <Switch.Content className="-mx-2 -my-1 min-h-11 gap-2 rounded-full px-2 py-1 text-pkpk-accent-font touch-manipulation">
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="text-sm font-bold leading-none">내경기</span>
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

          {isLoading ? (
            <TabPanelStatus ariaLabel="매치 목록 로딩 중" isLoading />
          ) : error ? (
            <TabPanelStatus message={error} tone="error" />
          ) : matches.length === 0 ? (
            <TabPanelStatus
              message={
                isMyMatchOnly
                  ? "현재 표시할 내 경기가 없어요."
                  : "현재 표시할 매치가 없어요."
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {matches.map((match) => (
                <Match
                  key={match.id}
                  match={match}
                  currentPlayerId={player?.id}
                  onPress={openMatchDetail}
                />
              ))}
              {loadMoreError ? (
                <p
                  className="text-center text-sm font-medium text-error"
                  role="alert"
                >
                  {loadMoreError}
                </p>
              ) : null}
              {hasMoreMatches ? (
                <Button
                  type="button"
                  className="app-action-button w-full rounded-2xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                  isDisabled={isLoadingMore}
                  onPress={() => void loadMatches(nextPage, true)}
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
