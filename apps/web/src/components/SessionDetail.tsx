import React from "react";
import { Button } from "@heroui/react";
import DetailPageHeader from "@/components/DetailPageHeader";
import Match, {
  type MatchInfo,
  type MatchSessionSummaryInfo,
} from "@/components/Match";
import SessionCard from "@/components/SessionCard";
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
    <DetailPageHeader title="Session Detail" tabKey="match" />
    <div className="p-2">
      <div className="mx-auto flex w-full flex-col gap-3">
        <SessionCard
          session={session}
          showMatchCount={false}
          showChevron={false}
        />

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
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-pkpk-sub-font">
              Matches
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {matches.map((match) => (
                <Match
                  key={match.id}
                  match={match}
                  currentPlayerId={currentPlayerId}
                  onPress={onPressMatch}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  </div>
);

export default SessionDetail;
