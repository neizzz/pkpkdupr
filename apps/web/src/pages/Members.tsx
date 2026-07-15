import React, { useCallback, useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import type { MatchInfo } from "@/components/Match";
import MemberProfile from "@/components/MemberProfile";
import TabPanelHeader from "@/components/TabPanelHeader";
import TabPanelStatus from "@/components/TabPanelStatus";
import type { PlayerInfo } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { buildApiUrl } from "@/lib/api";
import { isTabRefreshDue } from "@/lib/tabRefresh";
import {
  formatRating,
  getCompositeDoublesRating,
  getCompositeSinglesRating,
} from "@/utils/dupr";
import { buildMatchStats, createEmptyMatchStats } from "@/utils/matchStats";

const CACHED_MEMBERS_KEY = "pkpkdupr:members";
const OFFLINE_FALLBACK_MESSAGE =
  "최신 정보를 불러오지 못해 저장된 멤버 목록을 표시합니다.";

const readCachedMembers = (): PlayerInfo[] | null => {
  try {
    const cachedMembers = localStorage.getItem(CACHED_MEMBERS_KEY);
    return cachedMembers ? (JSON.parse(cachedMembers) as PlayerInfo[]) : null;
  } catch {
    return null;
  }
};

const Members: React.FC = () => {
  const { player, token } = useAuth();
  const isOnline = useOnlineStatus();
  const {
    pushDepth,
    restoreScrollTop,
    saveScrollPosition,
    selectedTab,
    scrollToTop,
    registerPullToRefresh,
  } = useTabNavigation();
  const [members, setMembers] = useState<PlayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberMatchStats, setSelectedMemberMatchStats] = useState(
    createEmptyMatchStats,
  );
  const lastSuccessfulLoadAtRef = useRef<number | null>(null);
  const wasTabActiveRef = useRef(false);

  const loadMembers = useCallback(
    async (preserveVisibleData = false, throwOnError = false) => {
      if (!token) {
        setMembers([]);
        setIsLoading(false);
        lastSuccessfulLoadAtRef.current = null;
        return;
      }

      try {
        if (!preserveVisibleData) {
          setIsLoading(true);
          setError(null);
          setNotice(null);
        }

        const res = await fetch(buildApiUrl("/api/players"), {
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
        localStorage.setItem(CACHED_MEMBERS_KEY, JSON.stringify(data));
        lastSuccessfulLoadAtRef.current = Date.now();
        setError(null);
        setNotice(null);
      } catch (err) {
        if (!isOnline) {
          const cachedMembers = readCachedMembers();
          if (cachedMembers) {
            setMembers(cachedMembers);
            if (!preserveVisibleData) {
              setNotice(OFFLINE_FALLBACK_MESSAGE);
              setError(null);
            }
            return;
          }
        }

        if (!preserveVisibleData) {
          setError(
            err instanceof Error
              ? err.message
              : "멤버 목록을 불러오지 못했습니다.",
          );
        }

        if (throwOnError) {
          throw err;
        }
      } finally {
        if (!preserveVisibleData) {
          setIsLoading(false);
        }
      }
    },
    [isOnline, token],
  );

  const loadSelectedMemberMatchStats = useCallback(
    async (
      memberId: string,
      preserveVisibleData = false,
      throwOnError = false,
    ) => {
      if (!token) {
        setSelectedMemberMatchStats(createEmptyMatchStats());
        return;
      }

      if (!preserveVisibleData) {
        setSelectedMemberMatchStats(createEmptyMatchStats());
      }

      try {
        const searchParams = new URLSearchParams({
          playerId: memberId,
          limit: "1000",
        });
        const res = await fetch(
          buildApiUrl(`/api/matches?${searchParams.toString()}`),
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!res.ok) {
          throw new Error("매치 목록을 불러오지 못했습니다.");
        }

        const data = (await res.json()) as {
          matches: MatchInfo[];
          total: number;
        };
        setSelectedMemberMatchStats(buildMatchStats(data.matches, memberId));
      } catch (err) {
        if (!preserveVisibleData) {
          setSelectedMemberMatchStats(createEmptyMatchStats());
        }
        if (throwOnError) {
          throw err;
        }
      }
    },
    [token],
  );

  useEffect(() => {
    const isTabActive = selectedTab === "members";
    if (!isTabActive) {
      wasTabActiveRef.current = false;
      return;
    }

    if (wasTabActiveRef.current) return;

    wasTabActiveRef.current = true;
    if (!isTabRefreshDue(lastSuccessfulLoadAtRef.current)) return;

    void loadMembers(members.length > 0);
  }, [loadMembers, members.length, selectedTab]);

  useEffect(() => {
    if (!token || !selectedMemberId) {
      setSelectedMemberMatchStats(createEmptyMatchStats());
      return;
    }

    void loadSelectedMemberMatchStats(selectedMemberId);
  }, [loadSelectedMemberMatchStats, selectedMemberId, token]);

  useEffect(
    () =>
      registerPullToRefresh("members", async () => {
        await loadMembers(true, true);
        if (selectedMemberId) {
          await loadSelectedMemberMatchStats(selectedMemberId, true, true);
        }
      }),
    [
      loadMembers,
      loadSelectedMemberMatchStats,
      registerPullToRefresh,
      selectedMemberId,
    ],
  );

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
        matchStats={selectedMemberMatchStats}
      />
    );
  }

  return (
    <>
      <TabPanelHeader title="Members" />
      <div className="flex min-h-full p-2">
        <div className="mx-auto flex min-h-full w-full flex-1 flex-col">
          <div>
            {notice ? (
              <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-pkpk-sub-font">
                {notice}
              </p>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col">
            {isLoading ? (
              <TabPanelStatus ariaLabel="멤버 목록 로딩 중" isLoading />
            ) : error ? (
              <TabPanelStatus message={error} tone="error" />
            ) : members.length === 0 ? (
              <TabPanelStatus message="현재 표시할 멤버가 없어요." />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {members.map((member) => {
                  const rating = member.duprRating;
                  const singlesRating = getCompositeSinglesRating(rating);
                  const doublesRating = getCompositeDoublesRating(rating);

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => openMemberProfile(member.id)}
                      className="flex min-w-0 items-start gap-2.5 rounded-2xl bg-white/90 px-3 py-3 text-left shadow-sm transition-colors hover:bg-amber-50"
                    >
                      <Avatar
                        size="sm"
                        avatarUrl={member.avatarUrl}
                        name={member.username}
                        isMe={member.id === player?.id}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-pkpk-sub-font">
                            {member.username}
                          </p>
                        </div>

                        <div className="mt-2 grid grid-cols-[0.75rem_auto] gap-x-1.5 gap-y-1 text-sm font-normal text-[#888]">
                          <span className="font-bold">S</span>
                          <span className="tabular-nums">
                            {formatRating(singlesRating)}
                          </span>
                          <span className="font-bold">D</span>
                          <span className="tabular-nums">
                            {formatRating(doublesRating)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Members;
