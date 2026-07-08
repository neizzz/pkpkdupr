import React from "react";
import type { MatchType } from "@pkpkdupr/shared/match";
import UserChip from "@/components/UserChip";
import {
  canSwapMembers,
  type MatchMember,
  type MatchTeams,
  type TeamIndex,
} from "./CreateMatchDrawerBody.utils";

interface CreateMatchTeamGridProps {
  previewTeams: MatchTeams;
  teams: MatchTeams;
  previewTeamSlotCount: number;
  selectedMatchType: MatchType | null;
  selectedSwapMemberId: string | null;
  currentPlayerMemberId?: string;
  interactive: boolean;
  onRemoveMember: (memberId: string) => void;
  onPressMember: (member: MatchMember) => void;
}

const CreateMatchTeamGrid: React.FC<CreateMatchTeamGridProps> = ({
  previewTeams,
  teams,
  previewTeamSlotCount,
  selectedMatchType,
  selectedSwapMemberId,
  currentPlayerMemberId,
  interactive,
  onRemoveMember,
  onPressMember,
}) => (
  <div className="grid grid-cols-2 gap-3">
    {previewTeams.map((team, teamIndex) => {
      const typedTeamIndex = teamIndex as TeamIndex;
      const emptySlotCount = Math.max(0, previewTeamSlotCount - team.length);

      return (
        <div
          key={typedTeamIndex}
          className="rounded-2xl border border-border bg-white px-3 py-3"
        >
          <p className="bs-text-caption font-semibold uppercase tracking-wide text-amber-700/70">
            Team {typedTeamIndex === 0 ? "A" : "B"}
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {team.map((member) => {
              const isSelected = selectedSwapMemberId === member.id;
              const isSwappable = canSwapMembers(
                teams,
                selectedMatchType,
                selectedSwapMemberId,
                member,
              );
              const isClickable =
                !selectedSwapMemberId || isSelected || isSwappable;
              const isMe = member.id === currentPlayerMemberId;

              return (
                <div key={member.id} className="w-fit max-w-full rounded-full">
                  <UserChip
                    player={member}
                    onRemove={isMe ? undefined : () => onRemoveMember(member.id)}
                    isMe={isMe}
                    reserveRemoveSlot={isMe}
                    onPress={
                      interactive && isClickable
                        ? () => onPressMember(member)
                        : undefined
                    }
                    isPressable={interactive}
                    isSelected={isSelected}
                    isDisabled={
                      interactive &&
                      !!selectedSwapMemberId &&
                      !isSelected &&
                      !isSwappable
                    }
                  />
                </div>
              );
            })}
            {Array.from({ length: emptySlotCount }).map((_, emptyIndex) => (
              <div
                key={`empty-${typedTeamIndex}-${emptyIndex}`}
                className="flex h-6 w-30 items-center rounded-full border border-dashed border-border bg-slate-50 px-3 text-sm text-slate-400"
              >
                빈 자리
              </div>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

export default CreateMatchTeamGrid;
