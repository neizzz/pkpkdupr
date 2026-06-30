import React from "react";
import DefaultProfileAvatar from "@/components/DefaultProfileAvatar";
import type { PlayerInfo } from "@/context/AuthContext";

interface MemberProfileProps {
  player: PlayerInfo | null;
  memberName?: string;
  isMe: boolean;
  onBack?: () => void;
}

const getGenderLabel = (gender?: PlayerInfo["gender"]) => {
  if (gender === "M") return "Male";
  if (gender === "F") return "Female";
  return "-";
};

const getGenderClassName = (gender?: PlayerInfo["gender"]) => {
  if (gender === "M") return "text-[#409eff]";
  if (gender === "F") return "text-[#f8626c]";
  return "text-amber-950";
};

const MemberProfile: React.FC<MemberProfileProps> = ({
  player,
  memberName,
  isMe,
  onBack,
}) => {
  const displayName =
    memberName || player?.username || player?.id || "Unknown Member";

  return (
    <div className="min-h-full p-4">
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-fit text-sm font-medium text-amber-700"
          >
            ← Members
          </button>
        )}

        <div className="rounded-2xl border border-amber-100 bg-white/90 p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <DefaultProfileAvatar size="md" />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-400">
                    {isMe ? "My Profile" : "Member Profile"}
                  </p>
                  <h2 className="mt-1 truncate text-2xl font-bold text-amber-950">
                    {displayName}
                  </h2>
                </div>
                {isMe && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    ME
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm text-amber-700/80">
                멤버의 기본 프로필과 DUPR 정보를 확인할 수 있어요.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white/90 p-5 shadow-sm">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-amber-700/80">ID</span>
              <span className="font-medium text-amber-950">
                {player?.id || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-700/80">Username</span>
              <span className="font-medium text-amber-950">
                {player?.username || "-"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-700/80">Gender</span>
              <span className={`font-medium ${getGenderClassName(player?.gender)}`}>
                {getGenderLabel(player?.gender)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white/90 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-amber-950">DUPR Rating</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs text-amber-700/80">Total</p>
              <p className="mt-1 text-lg font-semibold text-amber-950">
                {player?.duprRating?.total?.toFixed(2) ?? "-"}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs text-amber-700/80">Singles</p>
              <p className="mt-1 text-lg font-semibold text-amber-950">
                {player?.duprRating?.singles?.toFixed(2) ?? "-"}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs text-amber-700/80">Mixed Doubles</p>
              <p className="mt-1 text-lg font-semibold text-amber-950">
                {player?.duprRating?.doubles.mixed?.toFixed(2) ?? "-"}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs text-amber-700/80">Men / Women</p>
              <p className="mt-1 text-sm font-semibold text-amber-950">
                {player?.duprRating
                  ? `${player.duprRating.doubles.men.toFixed(2)} / ${player.duprRating.doubles.women.toFixed(2)}`
                  : "-"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberProfile;
