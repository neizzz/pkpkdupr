import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Match, { type MatchInfo } from "@/components/Match";

const Matches: React.FC = () => {
  const { player, token } = useAuth();
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [token]);

  const myMatchCount = useMemo(
    () =>
      matches.filter((match) =>
        match.teams.some((team) =>
          team.players.some((teamPlayer) => teamPlayer.id === player?.id),
        ),
      ).length,
    [matches, player?.id],
  );

  return (
    <div className="min-h-full p-2">
      <div className="mx-auto flex h-full w-full flex-col gap-4">
        <div className="rounded-3xl bg-[#409eff] px-5 py-5 text-white shadow-sm">
          <p className="text-sm font-medium text-white/80">Matches</p>
          <h2 className="mt-1 text-2xl font-bold">
            {player?.username ? `${player.username}님의 경기` : "Mock Match"}
          </h2>
          <p className="mt-2 text-sm text-white/85">
            전체 {matches.length}경기 · 내 경기 {myMatchCount}경기
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-2xl bg-white/90 px-3 py-8 text-center text-sm text-amber-700/80 shadow-sm">
            매치 목록을 불러오는 중이에요.
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white/90 px-3 py-8 text-center text-sm text-red-500 shadow-sm">
            {error}
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-2xl bg-white/90 px-3 py-8 text-center text-sm text-amber-700/80 shadow-sm">
            현재 표시할 매치가 없어요.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {matches.map((match) => (
              <Match
                key={match.id}
                match={match}
                currentPlayerId={player?.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Matches;
