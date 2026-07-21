import React, { useMemo, useState } from "react";
import { Button, Card, Switch } from "@heroui/react";
import CopyableId from "@/components/CopyableId";
import DetailPageHeader from "@/components/DetailPageHeader";
import Match, {
  type MatchInfo,
  type MatchSessionSummaryInfo,
} from "@/components/Match";
import SessionCard from "@/components/SessionCard";
import SkeletonBlock from "@/components/SkeletonBlock";
import TabPanelStatus from "@/components/TabPanelStatus";
import { useMinimumLoading } from "@/hooks/useMinimumLoading";

interface SessionDetailProps {
  session: MatchSessionSummaryInfo;
  matches: MatchInfo[];
  currentPlayerId?: string;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onPressMatch: (match: MatchInfo) => void;
}

const SessionMatchListSkeleton: React.FC = () => (
  <div
    className="flex flex-col gap-3"
    role="status"
    aria-label="세션 경기 목록 로딩 중"
  >
    {Array.from({ length: 2 }, (_, index) => (
      <Card key={index} className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <SkeletonBlock className="size-10 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-3 w-44 max-w-full" />
            </div>
          </div>
          <SkeletonBlock className="h-5 w-10" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <SkeletonBlock className="h-11" />
          <SkeletonBlock className="h-11" />
        </div>
      </Card>
    ))}
  </div>
);

const SessionDetail: React.FC<SessionDetailProps> = ({
  session,
  matches,
  currentPlayerId,
  isLoading,
  error,
  onRetry,
  onPressMatch,
}) => {
  const sessionId = `${session.name.trim()} · ${new Date(session.date).toISOString()}`;
  const [isMyMatchOnly, setIsMyMatchOnly] = useState(false);
  const isMatchesLoading = useMinimumLoading(isLoading);
  const displayedMatches = useMemo(
    () =>
      isMyMatchOnly && currentPlayerId
        ? matches.filter((match) =>
            match.teams.some((team) =>
              team.players.some((player) => player.id === currentPlayerId),
            ),
          )
        : matches,
    [currentPlayerId, isMyMatchOnly, matches],
  );

  return (
    <div className="min-h-full">
      <DetailPageHeader title="Session Detail" tabKey="match" />
      <div className="p-2">
        <div className="mx-auto flex w-full flex-col gap-3">
          <SessionCard
            session={session}
            showMatchCount={false}
            showChevron={false}
          />

          <section>
            <div className="flex min-w-0 items-center gap-3">
              <p className="shrink-0 text-sm font-semibold uppercase tracking-wide text-pkpk-sub-font">
                ID
              </p>
              <CopyableId
                label="Session ID"
                value={sessionId}
                showLabel={false}
              />
            </div>
          </section>

        <section>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-pkpk-sub-font">
              Matches
            </p>
            <Switch
              aria-label="내경기만 보기"
              className="shrink-0"
              isSelected={isMyMatchOnly}
              isDisabled={!currentPlayerId}
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
          </div>
          <div>
            {isMatchesLoading ? (
              <SessionMatchListSkeleton />
            ) : error ? (
              <div className="flex flex-col gap-3">
                <TabPanelStatus message={error} tone="error" />
                <Button
                  type="button"
                  className="app-action-button w-full rounded-2xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                  onPress={onRetry}
                >
                  다시 시도
                </Button>
              </div>
            ) : displayedMatches.length === 0 ? (
              <TabPanelStatus
                message={
                  isMyMatchOnly
                    ? "이 세션에 표시할 내 경기가 없어요."
                    : "이 세션에 표시할 경기가 없어요."
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {displayedMatches.map((match) => (
                  <Match
                    key={match.id}
                    match={match}
                    currentPlayerId={currentPlayerId}
                    onPress={onPressMatch}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
        </div>
      </div>
    </div>
  );
};

export default SessionDetail;
