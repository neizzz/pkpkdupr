import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Switch } from "@heroui/react";
import type { MatchScore } from "@pkpkdupr/shared/match";
import { useAuth } from "@/context/AuthContext";
import Match, { type MatchInfo } from "@/components/Match";
import TabPanelStatus from "@/components/TabPanelStatus";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { buildApiUrl } from "@/lib/api";

interface MatchesProps {
  reloadKey?: number;
}

const CACHED_MATCHES_KEY = "pkpkdupr:matches";
const OFFLINE_FALLBACK_MESSAGE =
  "최신 정보를 불러오지 못해 저장된 매치 목록을 표시합니다.";

const readCachedMatches = (): MatchInfo[] | null => {
  try {
    const cachedMatches = localStorage.getItem(CACHED_MATCHES_KEY);
    return cachedMatches ? (JSON.parse(cachedMatches) as MatchInfo[]) : null;
  } catch {
    return null;
  }
};

const Matches: React.FC<MatchesProps> = ({ reloadKey = 0 }) => {
  const { player, token } = useAuth();
  const isOnline = useOnlineStatus();
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isMyMatchOnly, setIsMyMatchOnly] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pendingMatchAction, setPendingMatchAction] = useState<{
    matchId: string;
    type: "submit-result" | "approve-result" | "cancel-approval";
  } | null>(null);

  const loadMatches = useCallback(async () => {
    if (!token) {
      setMatches([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setNotice(null);

      const res = await fetch(buildApiUrl("/api/matches"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "매치 목록을 불러오지 못했습니다.");
      }

      const data = (await res.json()) as {
        matches: MatchInfo[];
        total: number;
      };
      setMatches(data.matches);
      localStorage.setItem(CACHED_MATCHES_KEY, JSON.stringify(data.matches));
    } catch (err) {
      if (!isOnline) {
        const cachedMatches = readCachedMatches();
        if (cachedMatches) {
          setMatches(cachedMatches);
          setNotice(OFFLINE_FALLBACK_MESSAGE);
          setError(null);
          return;
        }
      }

      setError(
        err instanceof Error
          ? err.message
          : "매치 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, token]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches, reloadKey]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 30_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const myMatchCount = useMemo(
    () =>
      matches.filter((match) =>
        match.teams.some((team) =>
          team.players.some((teamPlayer) => teamPlayer.id === player?.id),
        ),
      ).length,
    [matches, player?.id],
  );

  const displayedMatches = useMemo(() => {
    if (!isMyMatchOnly) {
      return matches;
    }

    return matches.filter((match) =>
      match.teams.some((team) =>
        team.players.some((teamPlayer) => teamPlayer.id === player?.id),
      ),
    );
  }, [isMyMatchOnly, matches, player?.id]);

  const handleSubmitResult = useCallback(
    async (matchId: string, scores: MatchScore[]) => {
      if (!token) {
        throw new Error("로그인이 필요해요.");
      }
      if (!isOnline) {
        throw new Error("오프라인에서는 결과를 입력할 수 없습니다. 온라인 연결이 필요합니다.");
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
        throw new Error("오프라인에서는 결과를 승인할 수 없습니다. 온라인 연결이 필요합니다.");
      }

      try {
        setPendingMatchAction({ matchId, type: "approve-result" });
        const res = await fetch(buildApiUrl(`/api/matches/${matchId}/approval`), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });

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
        throw new Error("오프라인에서는 합의를 취소할 수 없습니다. 온라인 연결이 필요합니다.");
      }

      try {
        setPendingMatchAction({ matchId, type: "cancel-approval" });
        const res = await fetch(buildApiUrl(`/api/matches/${matchId}/approval`), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

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

  return (
    <div className="flex min-h-full p-2">
      <div className="mx-auto flex min-h-full w-full flex-1 flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold text-amber-950">Matches</h2>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm text-[#888]">
              전체 {matches.length}경기 · 내 경기 {myMatchCount}경기
            </p>
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
                  "--switch-control-bg-checked": "#409eff",
                  "--switch-control-bg-checked-hover": "#2f8be6",
                } as React.CSSProperties
              }
            >
              <Switch.Content className="gap-2 text-[#409eff]">
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <span className="text-sm font-semibold leading-none">내경기</span>
              </Switch.Content>
            </Switch>
          </div>
          {notice ? (
            <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              {notice}
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <TabPanelStatus ariaLabel="매치 목록 로딩 중" isLoading />
        ) : error ? (
          <TabPanelStatus message={error} tone="error" />
        ) : displayedMatches.length === 0 ? (
          <TabPanelStatus
            message={
              isMyMatchOnly
                ? "현재 표시할 내 경기가 없어요."
                : "현재 표시할 매치가 없어요."
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {displayedMatches.map((match) => (
              <Match
                key={match.id}
                match={match}
                currentPlayerId={player?.id}
                nowMs={nowMs}
                onSubmitResult={handleSubmitResult}
                onApproveResult={handleApproveResult}
                onCancelApproval={handleCancelApproval}
                isOnline={isOnline}
                isSubmittingResult={
                  pendingMatchAction?.matchId === match.id &&
                  pendingMatchAction.type === "submit-result"
                }
                isApprovingResult={
                  pendingMatchAction?.matchId === match.id &&
                  pendingMatchAction.type === "approve-result"
                }
                isCancellingApproval={
                  pendingMatchAction?.matchId === match.id &&
                  pendingMatchAction.type === "cancel-approval"
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Matches;
