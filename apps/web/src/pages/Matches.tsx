import React, { useEffect, useMemo, useState } from "react";
import { Switch } from "@heroui/react";
import { useAuth } from "@/context/AuthContext";
import Match, { type MatchInfo } from "@/components/Match";
import TabPanelStatus from "@/components/TabPanelStatus";

interface MatchesProps {
  reloadKey?: number;
}

const Matches: React.FC<MatchesProps> = ({ reloadKey = 0 }) => {
  const { player, token } = useAuth();
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMyMatchOnly, setIsMyMatchOnly] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const loadMatches = async () => {
      if (!token) {
        setMatches([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch("/api/matches", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || "매치 목록을 불러오지 못했습니다.",
          );
        }

        const data = (await res.json()) as {
          matches: MatchInfo[];
          total: number;
        };
        setMatches(data.matches);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "매치 목록을 불러오지 못했습니다.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadMatches();
  }, [reloadKey, token]);

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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Matches;
