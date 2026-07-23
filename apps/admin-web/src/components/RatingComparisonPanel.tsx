import React, { useMemo, useState } from "react";
import type { PublicPlayerDupr } from "@pkpkdupr/shared/player";

export interface RatingMethodComparisonPlayer {
  playerId: string;
  username: string;
  currentRating: PublicPlayerDupr | null;
  legacyRating: PublicPlayerDupr | null;
  scorePerformanceRating: PublicPlayerDupr | null;
  difference: PublicPlayerDupr;
  relatedMatchCount: number;
}

export interface RatingMethodComparison {
  completedMatchCount: number;
  players: RatingMethodComparisonPlayer[];
}

interface RatingComparisonPanelProps {
  comparison: RatingMethodComparison | null;
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
}

const formatRating = (value: number | null) =>
  value == null ? "NR" : value.toFixed(3);

const RatingCell: React.FC<{ rating: PublicPlayerDupr | null }> = ({
  rating,
}) => (
  <div className="space-y-1 whitespace-nowrap text-xs">
    <div>
      <span className="mr-2 text-slate-400">S</span>
      <span className="font-semibold text-slate-800">
        {formatRating(rating?.singles ?? null)}
      </span>
    </div>
    <div>
      <span className="mr-2 text-slate-400">D</span>
      <span className="font-semibold text-slate-800">
        {formatRating(rating?.doubles ?? null)}
      </span>
    </div>
  </div>
);

const RatingComparisonPanel: React.FC<RatingComparisonPanelProps> = ({
  comparison,
  isLoading,
  error,
  onReload,
}) => {
  const [query, setQuery] = useState("");
  const filteredPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!comparison || !normalizedQuery) {
      return comparison?.players ?? [];
    }
    return comparison.players.filter((player) =>
      player.username.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [comparison, query]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            방식별 회원 레이팅
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            완료 매치를 재계산해 누락된 레이팅 데이터를 보강한 뒤 방식별 레이팅을 표시합니다.
          </p>
        </div>
        <button
          type="button"
          disabled={isLoading}
          onClick={onReload}
          className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:text-slate-300"
        >
          {isLoading ? "재계산 중..." : "재계산 후 보기"}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {!comparison && isLoading ? (
        <div className="py-16 text-center text-sm text-slate-400">
          방법별 레이팅을 계산하고 있습니다.
        </div>
      ) : comparison ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              완료 매치 {comparison.completedMatchCount.toLocaleString()}개 ·
              회원 {comparison.players.length.toLocaleString()}명
            </p>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="회원명 검색"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm md:w-64"
            />
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">회원</th>
                  <th className="px-4 py-3">기존 승패식</th>
                  <th className="bg-blue-100 px-4 py-3 text-blue-700">
                    신규 득점률식
                  </th>
                  <th className="px-4 py-3 text-right">관련 매치</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => {
                  return (
                    <tr
                      key={player.playerId}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {player.username}
                      </td>
                      <td className="px-4 py-3">
                        <RatingCell rating={player.legacyRating} />
                      </td>
                      <td className="bg-blue-50/60 px-4 py-3">
                        <RatingCell rating={player.scorePerformanceRating} />
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {player.relatedMatchCount.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredPlayers.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">
                검색 결과가 없습니다.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
};

export default RatingComparisonPanel;
