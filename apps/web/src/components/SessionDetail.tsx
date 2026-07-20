import React from "react";
import { Button, Card } from "@heroui/react";
import AvatarGroup from "@/components/AvatarGroup";
import DetailPageHeader from "@/components/DetailPageHeader";
import Match, {
  type MatchInfo,
  type MatchSessionSummaryInfo,
} from "@/components/Match";
import TabPanelStatus from "@/components/TabPanelStatus";

interface SessionDetailProps {
  session: MatchSessionSummaryInfo;
  matches: MatchInfo[];
  currentPlayerId?: string;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onPressMatch: (match: MatchInfo) => void;
}

const formatDateOnly = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));

const SessionDetail: React.FC<SessionDetailProps> = ({
  session,
  matches,
  currentPlayerId,
  isLoading,
  error,
  onRetry,
  onPressMatch,
}) => (
  <div className="min-h-full">
    <DetailPageHeader title={session.name} tabKey="match" />
    <div className="p-2">
      <div className="mx-auto flex w-full flex-col gap-3">
        <Card className="rounded-3xl bg-white/95 p-3 shadow-sm">
          <p className="text-sm font-medium text-pkpk-sub-font">
            {formatDateOnly(session.date)} · {session.matchCount}경기
          </p>
          <AvatarGroup
            className="mt-3"
            items={session.participants.map((participant) => ({
              id: participant.id,
              avatarUrl: participant.avatarUrl,
              name: participant.username,
            }))}
            max={4}
            size="session"
          />
        </Card>

        {isLoading ? (
          <TabPanelStatus ariaLabel="세션 경기 목록 로딩 중" isLoading />
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
        ) : matches.length === 0 ? (
          <TabPanelStatus message="이 세션에 표시할 경기가 없어요." />
        ) : (
          <div className="flex flex-col gap-3">
            {matches.map((match) => (
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
    </div>
  </div>
);

export default SessionDetail;
