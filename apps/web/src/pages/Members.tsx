import React, { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import MemberProfile from "@/components/MemberProfile";
import type { PlayerInfo } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";

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

  const selectedMember =
    members.find((member) => member.id === selectedMemberId) || null;

  if (selectedMember) {
    return (
      <MemberProfile
        player={selectedMember}
        isMe={selectedMember.id === player?.id}
        onBack={() => setSelectedMemberId(null)}
      />
    );
  }

  return (
    <div className="min-h-full p-2">
      <div className="mx-auto flex w-full h-full flex-col gap-4">
        <h2 className="text-2xl font-bold text-amber-950">Members</h2>

        <div>
          {isLoading ? (
            <div className="rounded-2xl bg-white/90 px-3 py-8 text-center text-sm text-amber-700/80 shadow-sm">
              멤버 목록을 불러오는 중이에요.
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-white/90 px-3 py-8 text-center text-sm text-red-500 shadow-sm">
              {error}
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-2xl bg-white/90 px-3 py-8 text-center text-sm text-amber-700/80 shadow-sm">
              현재 표시할 멤버가 없어요.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedMemberId(member.id)}
                  className="flex min-w-0 flex-col items-center rounded-2xl bg-white/90 px-3 py-4 text-center shadow-sm transition-colors hover:bg-amber-50"
                >
                  <Avatar
                    size="sm"
                    avatarUrl={member.avatarUrl}
                    name={member.username}
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
                    <p className="mt-2 text-sm font-semibold text-amber-950">
                      {member.duprRating?.total?.toFixed(2) ?? "-"}
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
