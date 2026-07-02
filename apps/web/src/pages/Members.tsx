import React, { useCallback, useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import MemberProfile from "@/components/MemberProfile";
import TabPanelStatus from "@/components/TabPanelStatus";
import type { PlayerInfo } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";

const getGenderLabel = (gender?: PlayerInfo["gender"]) => {
  if (gender === "M") return "Male";
  if (gender === "F") return "Female";
  return "-";
};

const getGenderClassName = (gender?: PlayerInfo["gender"]) => {
  if (gender === "M") return "text-[#409eff]";
  if (gender === "F") return "text-[#f8626c]";
  return "text-amber-700/80";
};

const Members: React.FC = () => {
  const { player, token } = useAuth();
  const {
    pushDepth,
    restoreScrollTop,
    saveScrollPosition,
    scrollToTop,
  } = useTabNavigation();
  const [members, setMembers] = useState<PlayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  useEffect(() => {
    const loadMembers = async () => {
      if (!token) {
        setMembers([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch("/api/players", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || "멤버 목록을 불러오지 못했습니다.",
          );
        }

        const data = (await res.json()) as PlayerInfo[];
        setMembers(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "멤버 목록을 불러오지 못했습니다.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadMembers();
  }, [token]);

  const closeMemberProfile = useCallback(() => {
    setSelectedMemberId(null);
    restoreScrollTop("members");
  }, [restoreScrollTop]);

  const openMemberProfile = (memberId: string) => {
    saveScrollPosition("members");
    pushDepth("members", {
      id: `member-profile:${memberId}`,
      kind: "member-profile",
      onClose: closeMemberProfile,
    });
    setSelectedMemberId(memberId);
    window.requestAnimationFrame(() => scrollToTop("auto"));
  };

  const selectedMember =
    members.find((member) => member.id === selectedMemberId) || null;

  if (selectedMember) {
    return (
      <MemberProfile
        player={selectedMember}
        isMe={selectedMember.id === player?.id}
      />
    );
  }

  return (
    <div className="flex min-h-full p-2">
      <div className="mx-auto flex min-h-full w-full flex-1 flex-col gap-4">
        <h2 className="text-2xl font-bold text-amber-950">Members</h2>

        <div className="flex flex-1 flex-col">
          {isLoading ? (
            <TabPanelStatus ariaLabel="멤버 목록 로딩 중" isLoading />
          ) : error ? (
            <TabPanelStatus message={error} tone="error" />
          ) : members.length === 0 ? (
            <TabPanelStatus message="현재 표시할 멤버가 없어요." />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => openMemberProfile(member.id)}
                  className="flex min-w-0 flex-col items-center rounded-2xl bg-white/90 px-3 py-4 text-center shadow-sm transition-colors hover:bg-amber-50"
                >
                  <Avatar
                    size="sm"
                    avatarUrl={member.avatarUrl}
                    name={member.username}
                    isMe={member.id === player?.id}
                  />
                  <div className="mt-3 min-w-0">
                    <p className="truncate font-semibold text-amber-950">
                      {member.username}
                    </p>
                    <p
                      className={`mt-1 text-xs font-medium ${getGenderClassName(member.gender)}`}
                    >
                      {getGenderLabel(member.gender)}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-amber-950">
                      S {member.duprRating?.singles?.toFixed(3) ?? "-"}
                    </p>
                    <p className="mt-1 text-xs text-amber-700/80">
                      Mx {member.duprRating?.doubles.mixed?.toFixed(3) ?? "-"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Members;
