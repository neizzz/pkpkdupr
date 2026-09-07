import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Tabs, useOverlayState } from "@heroui/react";
import {
  CLUB_ANNOUNCEMENT_BODY_MAX_LENGTH,
  CLUB_ANNOUNCEMENT_MAX_COUNT,
  CLUB_DESCRIPTION_MAX_LENGTH,
  getUnicodeCodePointLength,
  truncateToUnicodeCodePoints,
  type Club,
  type ClubAnnouncement,
  ClubDashboard,
  ClubMembership,
  ClubRankingEntry,
} from "@pkpkdupr/shared/club";
import type { ManagedMatchSession } from "@pkpkdupr/shared/match";
import { AiOutlineNotification } from "react-icons/ai";
import { PiRankingLight } from "react-icons/pi";
import { TbAffiliate } from "react-icons/tb";
import {
  IoCalendarOutline,
  IoChevronForward,
  IoPeopleOutline,
  IoPeople,
  IoMenuOutline,
  IoPerson,
  IoPersonAddOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import BottomSheet from "@/components/BottomSheet";
import PlayerQrScannerModal from "@/components/PlayerQrScannerModal";
import ActionChipButton from "@/components/ActionChipButton";
import AppModal from "@/components/AppModal";
import Avatar from "@/components/Avatar";
import DetailPageHeader from "@/components/DetailPageHeader";
import DraftRestoreModal from "@/components/DraftRestoreModal";
import HeaderFilterTabs from "@/components/HeaderFilterTabs";
import HoldToConfirmButton from "@/components/HoldToConfirmButton";
import MatchCard, {
  type MatchInfo,
  type MatchListResponse,
  type MatchSessionSummaryInfo,
} from "@/components/Match";
import ProfileMatchDetailDrawer from "@/components/ProfileMatchDetailDrawer";
import RightDrawer from "@/components/RightDrawer";
import SessionCard from "@/components/SessionCard";
import SessionDetail from "@/components/SessionDetail";
import TabPanelHeader from "@/components/TabPanelHeader";
import TabPanelEmptyState from "@/components/TabPanelEmptyState";
import TabPanelStatus from "@/components/TabPanelStatus";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { buildApiUrl } from "@/lib/api";
import {
  getFormDraftKey,
  readFormDraft,
  removeFormDraft,
  writeFormDraft,
} from "@/lib/formDraft";

type ClubListItem = { club: Club; membership: ClubMembership };
type ScannerTarget = "player" | null;
type RankingCategory = "singles" | "doubles";
type ClubDraft = { name: string; description: string };
type AnnouncementDraft = { title: string; body: string };

const noop = () => {};
const CLUB_MATCH_HISTORY_PAGE_SIZE = 20;

const isTextDraft = <T extends Record<string, string>>(
  value: unknown,
  keys: (keyof T)[],
): value is T =>
  !!value &&
  typeof value === "object" &&
  keys.every((key) => typeof (value as T)[key] === "string");

const announcementUrlPattern = /https?:\/\/[^\s<]+/g;
const trailingUrlPunctuationPattern = /[),.!;]+$/;

const AnnouncementBody: React.FC<{ body: string }> = ({ body }) => {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of body.matchAll(announcementUrlPattern)) {
    const rawUrl = match[0];
    const start = match.index ?? 0;
    const url = rawUrl.replace(trailingUrlPunctuationPattern, "");
    const trailingText = rawUrl.slice(url.length);

    nodes.push(body.slice(cursor, start));
    if (url) {
      nodes.push(
        <a
          key={`${start}-${url}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="break-all text-pkpk-primary-bg underline underline-offset-2"
        >
          {url}
        </a>,
      );
    } else {
      nodes.push(rawUrl);
    }
    nodes.push(trailingText);
    cursor = start + rawUrl.length;
  }
  nodes.push(body.slice(cursor));

  return (
    <p className="whitespace-pre-wrap break-words text-[calc(1.1rem*var(--app-font-scale))] leading-7 text-pkpk-sub-font">
      {nodes}
    </p>
  );
};

const SectionTitle: React.FC<{
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}> = ({ icon, title, action }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex min-w-0 items-center gap-2">
      {icon ? <span className="text-pkpk-primary-bg">{icon}</span> : null}
      <h3 className="text-base font-bold text-pkpk-main-font">{title}</h3>
    </div>
    {action}
  </div>
);

const Affiliations: React.FC = () => {
  const { token, player } = useAuth();
  const isOnline = useOnlineStatus();
  const {
    depthStacks,
    closeDepth,
    pushDepth,
    registerPullToRefresh,
    registerScrollContainer,
    restoreScrollTop,
    saveScrollPosition,
    scrollToTop,
    selectedTab,
  } = useTabNavigation();
  const [clubs, setClubs] = useState<ClubListItem[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<ClubDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clubName, setClubName] = useState("");
  const [clubDescription, setClubDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingClubDraft, setPendingClubDraft] = useState<ClubDraft | null>(null);
  const [isClubDraftResolved, setIsClubDraftResolved] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<ScannerTarget>(null);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [rankingCategory, setRankingCategory] =
    useState<RankingCategory>("doubles");
  const [managementError, setManagementError] = useState<string | null>(null);
  const [isAnnouncementCreateOpen, setIsAnnouncementCreateOpen] = useState(false);
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] =
    useState<ClubAnnouncement | null>(null);
  const [isDeletingAnnouncement, setIsDeletingAnnouncement] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<ClubAnnouncement | null>(null);
  const [isAnnouncementActionMenuOpen, setIsAnnouncementActionMenuOpen] =
    useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [pendingAnnouncementDraft, setPendingAnnouncementDraft] =
    useState<AnnouncementDraft | null>(null);
  const [isAnnouncementDraftResolved, setIsAnnouncementDraftResolved] =
    useState(false);
  const [selectedSession, setSelectedSession] =
    useState<MatchSessionSummaryInfo | null>(null);
  const [selectedSessionMatches, setSelectedSessionMatches] = useState<
    MatchInfo[]
  >([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchInfo | null>(null);
  const [clubMatchHistoryClub, setClubMatchHistoryClub] = useState<
    Pick<Club, "id" | "name"> | null
  >(null);
  const [clubMatchHistoryMatches, setClubMatchHistoryMatches] = useState<
    MatchInfo[]
  >([]);
  const [isClubMatchHistoryLoading, setIsClubMatchHistoryLoading] =
    useState(false);
  const [clubMatchHistoryError, setClubMatchHistoryError] = useState<
    string | null
  >(null);
  const [clubMatchHistoryPage, setClubMatchHistoryPage] = useState(0);
  const [clubMatchHistoryTotal, setClubMatchHistoryTotal] = useState(0);
  const announcementDeleteConfirmation = useOverlayState();
  const checkedClubDraftKeyRef = useRef<string | null>(null);
  const checkedAnnouncementDraftKeyRef = useRef<string | null>(null);

  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      if (!token) throw new Error("로그인이 필요합니다.");
      if (!isOnline) throw new Error("온라인 연결이 필요합니다.");
      const res = await fetch(buildApiUrl(path), {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers ?? {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "요청을 처리하지 못했어요.");
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    },
    [isOnline, token],
  );

  const loadClubs = useCallback(
    async (preferredClubId?: string) => {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        const nextClubs = await request<ClubListItem[]>("/api/clubs");
        setClubs(nextClubs);
        const activeClubs = nextClubs.filter(
          (item) => item.membership.status === "active",
        );
        setSelectedClubId((current) => {
          if (preferredClubId && activeClubs.some((item) => item.club.id === preferredClubId)) {
            return preferredClubId;
          }
          if (current && activeClubs.some((item) => item.club.id === current)) {
            return current;
          }
          return activeClubs[0]?.club.id ?? null;
        });
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "클럽을 불러오지 못했어요.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [request, token],
  );

  const loadDashboard = useCallback(async () => {
    if (!selectedClubId || !token) {
      setDashboard(null);
      return;
    }
    setIsDashboardLoading(true);
    setError(null);
    try {
      setDashboard(
        await request<ClubDashboard>(
          `/api/clubs/${encodeURIComponent(selectedClubId)}/dashboard`,
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "클럽 정보를 불러오지 못했어요.",
      );
    } finally {
      setIsDashboardLoading(false);
    }
  }, [request, selectedClubId, token]);

  useEffect(() => {
    void loadClubs();
  }, [loadClubs]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(
    () =>
      registerPullToRefresh("affiliations", async () => {
        await loadClubs(selectedClubId ?? undefined);
        await loadDashboard();
      }),
    [loadClubs, loadDashboard, registerPullToRefresh, selectedClubId],
  );

  const activeClubs = useMemo(
    () => clubs.filter((item) => item.membership.status === "active"),
    [clubs],
  );
  const isManager =
    dashboard?.membership.role === "owner" ||
    dashboard?.membership.role === "manager";
  const isOwner = dashboard?.membership.role === "owner";
  const clubDraftKey = useMemo(
    () => (player?.id ? getFormDraftKey("club-create", player.id) : null),
    [player?.id],
  );
  const announcementDraftKey = useMemo(
    () =>
      player?.id && selectedClubId
        ? getFormDraftKey("club-announcement-create", player.id, selectedClubId)
        : null,
    [player?.id, selectedClubId],
  );

  useEffect(() => {
    if (!isCreateOpen) {
      checkedClubDraftKeyRef.current = null;
      setIsClubDraftResolved(false);
      return;
    }
    if (!clubDraftKey || checkedClubDraftKeyRef.current === clubDraftKey) return;
    checkedClubDraftKeyRef.current = clubDraftKey;
    const draft = readFormDraft<unknown>(clubDraftKey);
    if (isTextDraft<ClubDraft>(draft, ["name", "description"])) {
      setPendingClubDraft(draft);
      return;
    }
    setIsClubDraftResolved(true);
  }, [clubDraftKey, isCreateOpen]);

  useEffect(() => {
    if (!isCreateOpen || !isClubDraftResolved || !clubDraftKey) return;
    if (!clubName && !clubDescription) {
      removeFormDraft(clubDraftKey);
      return;
    }
    writeFormDraft(clubDraftKey, { name: clubName, description: clubDescription });
  }, [clubDescription, clubDraftKey, clubName, isClubDraftResolved, isCreateOpen]);

  useEffect(() => {
    if (!isAnnouncementCreateOpen) {
      checkedAnnouncementDraftKeyRef.current = null;
      setIsAnnouncementDraftResolved(false);
      return;
    }
    if (
      !announcementDraftKey ||
      checkedAnnouncementDraftKeyRef.current === announcementDraftKey
    ) {
      return;
    }
    checkedAnnouncementDraftKeyRef.current = announcementDraftKey;
    const draft = readFormDraft<unknown>(announcementDraftKey);
    if (isTextDraft<AnnouncementDraft>(draft, ["title", "body"])) {
      setPendingAnnouncementDraft(draft);
      return;
    }
    setIsAnnouncementDraftResolved(true);
  }, [announcementDraftKey, isAnnouncementCreateOpen]);

  useEffect(() => {
    if (
      !isAnnouncementCreateOpen ||
      !isAnnouncementDraftResolved ||
      !announcementDraftKey
    ) {
      return;
    }
    if (!announcementTitle && !announcementBody) {
      removeFormDraft(announcementDraftKey);
      return;
    }
    writeFormDraft(announcementDraftKey, {
      title: announcementTitle,
      body: announcementBody,
    });
  }, [
    announcementBody,
    announcementDraftKey,
    announcementTitle,
    isAnnouncementCreateOpen,
    isAnnouncementDraftResolved,
  ]);

  const closeClubCreateSheet = () => {
    if (isCreating) return;
    setIsCreateOpen(false);
    setClubName("");
    setClubDescription("");
    setPendingClubDraft(null);
  };

  const closeManagement = () => {
    setIsManagementOpen(false);
  };

  const createClub = async () => {
    const name = clubName.trim();
    const description = clubDescription.trim();
    if (!name) return;
    setIsCreating(true);
    setError(null);
    try {
      const created = await request<Club>("/api/clubs", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
      setClubName("");
      setClubDescription("");
      if (clubDraftKey) removeFormDraft(clubDraftKey);
      setIsCreateOpen(false);
      await loadClubs(created.id);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "클럽을 만들지 못했어요.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handlePlayerScan = useCallback(
    async (payload: string) => {
      if (!selectedClubId) throw new Error("클럽을 선택해주세요.");
      await request(
        `/api/clubs/${encodeURIComponent(selectedClubId)}/player-qr-members`,
        { method: "POST", body: JSON.stringify({ payload }) },
      );
      await loadDashboard();
    },
    [loadDashboard, request, selectedClubId],
  );

  const reloadManagement = async () => {
    setManagementError(null);
    await Promise.all([loadDashboard(), loadClubs(selectedClubId ?? undefined)]);
  };

  const runManagementAction = async (action: () => Promise<void>) => {
    try {
      setManagementError(null);
      await action();
      await reloadManagement();
      return true;
    } catch (actionError) {
      setManagementError(
        actionError instanceof Error
          ? actionError.message
          : "관리 작업을 처리하지 못했어요.",
      );
      return false;
    }
  };

  const closeAnnouncementCreateSheet = (force = false) => {
    if (isCreatingAnnouncement && !force) return;
    setIsAnnouncementCreateOpen(false);
    setAnnouncementTitle("");
    setAnnouncementBody("");
    setPendingAnnouncementDraft(null);
    setAnnouncementError(null);
  };

  const runAnnouncementAction = async (action: () => Promise<void>) => {
    try {
      setAnnouncementError(null);
      await action();
      await reloadManagement();
      return true;
    } catch (actionError) {
      setAnnouncementError(
        actionError instanceof Error
          ? actionError.message
          : "공지 작업을 처리하지 못했어요.",
      );
      return false;
    }
  };

  const createAnnouncement = async () => {
    if (
      !isManager ||
      !selectedClubId ||
      !announcementTitle.trim() ||
      !announcementBody.trim() ||
      getUnicodeCodePointLength(announcementBody) >
        CLUB_ANNOUNCEMENT_BODY_MAX_LENGTH ||
      (dashboard?.announcements.length ?? 0) >= CLUB_ANNOUNCEMENT_MAX_COUNT
    ) {
      return;
    }
    setIsCreatingAnnouncement(true);
    try {
      const isCreated = await runAnnouncementAction(async () => {
        await request(`/api/clubs/${encodeURIComponent(selectedClubId)}/announcements`, {
          method: "POST",
          body: JSON.stringify({ title: announcementTitle, body: announcementBody }),
        });
      });
      if (isCreated) {
        if (announcementDraftKey) removeFormDraft(announcementDraftKey);
        closeAnnouncementCreateSheet(true);
      }
    } finally {
      setIsCreatingAnnouncement(false);
    }
  };

  const removeAnnouncement = async () => {
    if (!isManager || !announcementToDelete) return;
    setIsDeletingAnnouncement(true);
    try {
      const isRemoved = await runAnnouncementAction(() =>
        request(
          `/api/club-announcements/${encodeURIComponent(announcementToDelete.id)}`,
          { method: "DELETE" },
        ),
      );
      if (isRemoved) {
        announcementDeleteConfirmation.close();
        setAnnouncementToDelete(null);
        setIsAnnouncementActionMenuOpen(false);
        closeDepth(
          "affiliations",
          `club-announcement-detail:${announcementToDelete.id}`,
        );
      }
    } finally {
      setIsDeletingAnnouncement(false);
    }
  };

  const selectClub = (clubId: string) => {
    if (clubId === selectedClubId) return;
    setDashboard(null);
    setSelectedClubId(clubId);
  };

  const loadSessionMatches = useCallback(
    async (session: MatchSessionSummaryInfo) => {
      setIsLoadingSession(true);
      setSessionError(null);
      try {
        setSelectedSessionMatches(
          await request<MatchInfo[]>(
            `/api/match-sessions/${encodeURIComponent(session.id)}/matches`,
          ),
        );
      } catch (loadError) {
        setSessionError(
          loadError instanceof Error
            ? loadError.message
            : "세션 매치를 불러오지 못했어요.",
        );
      } finally {
        setIsLoadingSession(false);
      }
    },
    [request],
  );

  const loadClubMatchHistory = useCallback(
    async (clubId: string, page: number, append = false) => {
      setIsClubMatchHistoryLoading(true);
      setClubMatchHistoryError(null);
      try {
        const searchParams = new URLSearchParams({
          page: String(page),
          limit: String(CLUB_MATCH_HISTORY_PAGE_SIZE),
        });
        const data = await request<MatchListResponse>(
          `/api/clubs/${encodeURIComponent(clubId)}/matches?${searchParams.toString()}`,
        );
        setClubMatchHistoryMatches((current) => {
          if (!append) return data.matches;
          const currentIds = new Set(current.map((match) => match.id));
          return [
            ...current,
            ...data.matches.filter((match) => !currentIds.has(match.id)),
          ];
        });
        setClubMatchHistoryPage(page + 1);
        setClubMatchHistoryTotal(data.total);
      } catch (loadError) {
        setClubMatchHistoryError(
          loadError instanceof Error
            ? loadError.message
            : "소속 매치를 불러오지 못했어요.",
        );
      } finally {
        setIsClubMatchHistoryLoading(false);
      }
    },
    [request],
  );

  const openMatchDetail = useCallback(
    (match: MatchInfo) => {
      saveScrollPosition("affiliations");
      pushDepth("affiliations", {
        id: `club-match-detail:${match.id}`,
        kind: "match-detail",
        onClose: noop,
      });
      setSelectedMatch(match);
      window.requestAnimationFrame(() => scrollToTop("auto"));
    },
    [pushDepth, saveScrollPosition, scrollToTop],
  );

  const openAnnouncementDetail = useCallback(
    (announcement: ClubAnnouncement) => {
      saveScrollPosition("affiliations");
      pushDepth("affiliations", {
        id: `club-announcement-detail:${announcement.id}`,
        kind: "announcement-detail",
        onClose: noop,
      });
      setSelectedAnnouncement(announcement);
      setIsAnnouncementActionMenuOpen(false);
      window.requestAnimationFrame(() => scrollToTop("auto"));
    },
    [pushDepth, saveScrollPosition, scrollToTop],
  );

  const openClubMatchHistory = useCallback(() => {
    if (!dashboard) return;

    const historyClub = {
      id: dashboard.club.id,
      name: dashboard.club.name,
    };
    saveScrollPosition("affiliations");
    pushDepth("affiliations", {
      id: `club-match-history:${historyClub.id}`,
      kind: "match-history",
      onClose: noop,
    });
    setClubMatchHistoryClub(historyClub);
    setClubMatchHistoryMatches([]);
    setClubMatchHistoryError(null);
    setClubMatchHistoryPage(0);
    setClubMatchHistoryTotal(0);
    window.requestAnimationFrame(() => scrollToTop("auto"));
    void loadClubMatchHistory(historyClub.id, 0);
  }, [dashboard, loadClubMatchHistory, pushDepth, saveScrollPosition, scrollToTop]);

  const openSessionDetail = useCallback(
    (session: ManagedMatchSession) => {
      if (!dashboard) return;

      const sessionDetail: MatchSessionSummaryInfo = {
        id: session.id,
        name: session.name,
        date: new Date(session.date).toISOString(),
        location: session.location,
        clubId: session.clubId,
        affiliationNames: session.affiliationNames,
        status: "created",
        matchCount: session.matchCount,
        participants: dashboard.members
          .filter((member) => session.participantIds.includes(member.id))
          .map((member) => ({
            id: member.id,
            username: member.username,
            avatarUrl: member.avatarUrl,
          })),
        latestCreatedAt: new Date(session.updatedAt).toISOString(),
      };

      saveScrollPosition("affiliations");
      pushDepth("affiliations", {
        id: `club-session-detail:${session.id}`,
        kind: "session-detail",
        onClose: noop,
      });
      setSelectedSession(sessionDetail);
      setSelectedSessionMatches([]);
      setSessionError(null);
      window.requestAnimationFrame(() => scrollToTop("auto"));
      void loadSessionMatches(sessionDetail);
    },
    [dashboard, loadSessionMatches, pushDepth, saveScrollPosition, scrollToTop],
  );

  const completeSessionDetailClose = useCallback(() => {
    setSelectedSession(null);
    setSelectedSessionMatches([]);
    setSessionError(null);
    restoreScrollTop("affiliations");
  }, [restoreScrollTop]);

  const completeMatchDetailClose = useCallback(() => {
    setSelectedMatch(null);
    restoreScrollTop("affiliations");
  }, [restoreScrollTop]);

  const completeClubMatchHistoryClose = useCallback(() => {
    setClubMatchHistoryClub(null);
    setClubMatchHistoryMatches([]);
    setClubMatchHistoryError(null);
    setClubMatchHistoryPage(0);
    setClubMatchHistoryTotal(0);
    restoreScrollTop("affiliations");
  }, [restoreScrollTop]);

  const completeAnnouncementDetailClose = useCallback(() => {
    setSelectedAnnouncement(null);
    setIsAnnouncementActionMenuOpen(false);
    restoreScrollTop("affiliations");
  }, [restoreScrollTop]);

  const sessionDepthId = selectedSession
    ? `club-session-detail:${selectedSession.id}`
    : null;
  const matchDepthId = selectedMatch
    ? `club-match-detail:${selectedMatch.id}`
    : null;
  const clubMatchHistoryDepthId = clubMatchHistoryClub
    ? `club-match-history:${clubMatchHistoryClub.id}`
    : null;
  const announcementDetailDepthId = selectedAnnouncement
    ? `club-announcement-detail:${selectedAnnouncement.id}`
    : null;
  const isSessionDrawerOpen =
    !!sessionDepthId && depthStacks.affiliations.includes(sessionDepthId);
  const isMatchDrawerOpen =
    !!matchDepthId && depthStacks.affiliations.includes(matchDepthId);
  const isClubMatchHistoryDrawerOpen =
    !!clubMatchHistoryDepthId &&
    depthStacks.affiliations.includes(clubMatchHistoryDepthId);
  const isAnnouncementDetailDrawerOpen =
    !!announcementDetailDepthId &&
    depthStacks.affiliations.includes(announcementDetailDepthId);

  const registerSessionScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      if (!sessionDepthId) return;
      registerScrollContainer("affiliations", sessionDepthId, element);
    },
    [registerScrollContainer, sessionDepthId],
  );

  const registerMatchScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      if (!matchDepthId) return;
      registerScrollContainer("affiliations", matchDepthId, element);
    },
    [matchDepthId, registerScrollContainer],
  );

  const registerClubMatchHistoryScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      if (!clubMatchHistoryDepthId) return;
      registerScrollContainer("affiliations", clubMatchHistoryDepthId, element);
    },
    [clubMatchHistoryDepthId, registerScrollContainer],
  );

  const registerAnnouncementDetailScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      if (!announcementDetailDepthId) return;
      registerScrollContainer(
        "affiliations",
        announcementDetailDepthId,
        element,
      );
    },
    [announcementDetailDepthId, registerScrollContainer],
  );

  const renderSchedule = () => {
    if (!dashboard) return null;
    const sessions = dashboard.upcomingSessions.slice(0, 2);
    return (
      <div className="space-y-2">
        {sessions.map((session: ManagedMatchSession) => {
          const sessionSummary: MatchSessionSummaryInfo = {
            id: session.id,
            name: session.name,
            date: new Date(session.date).toISOString(),
            location: session.location,
            clubId: session.clubId,
            affiliationNames: session.affiliationNames,
            status: "created",
            matchCount: session.matchCount,
            participants: dashboard.members
              .filter((member) => session.participantIds.includes(member.id))
              .map((member) => ({
                id: member.id,
                username: member.username,
                avatarUrl: member.avatarUrl,
              })),
            latestCreatedAt: new Date(session.updatedAt).toISOString(),
          };

          return (
            <SessionCard
              key={session.id}
              session={sessionSummary}
              onPress={() => openSessionDetail(session)}
            />
          );
        })}
      </div>
    );
  };

  const renderRecentCompletedMatches = () => {
    if (!dashboard) return null;
    if (!dashboard.recentCompletedMatches.length) {
      return (
        <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-5 text-center text-sm text-pkpk-sub-font">
          최근에 끝난 매치가 없어요.
        </p>
      );
    }
    return (
      <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {dashboard.recentCompletedMatches.slice(0, 5).map((match) => (
          <div
            key={match.id}
            data-testid="club-recent-match-card"
            className="w-[calc(100cqw-2rem)] shrink-0 snap-center"
          >
            <MatchCard
              match={match as unknown as MatchInfo}
              currentPlayerId={player?.id}
              onPress={openMatchDetail}
              className="min-h-[13.5rem]"
            />
          </div>
        ))}
      </div>
    );
  };

  const renderRankings = (entries: ClubRankingEntry[]) => {
    if (!entries.length) {
      return (
        <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-5 text-center text-sm text-pkpk-sub-font">
          랭킹을 표시할 멤버가 없어요.
        </p>
      );
    }
    return (
      <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
        {entries.slice(0, 5).map((entry) => (
          <li key={entry.playerId} className="flex items-center gap-3 px-4 py-3">
            <span
              className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                entry.rank === 1
                  ? "bg-pkpk-accent-bg text-pkpk-dark"
                  : "bg-pkpk-session-bg text-pkpk-sub-font"
              }`}
            >
              {entry.rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-pkpk-main-font">
              {entry.username}
            </span>
            <span className="text-sm font-bold text-pkpk-primary-bg">
              {entry.rating.toFixed(3)}
            </span>
          </li>
        ))}
      </ol>
    );
  };

  return (
    <div className="flex h-full min-h-full flex-col">
      <TabPanelHeader
        title="Clubs"
        footer={
          activeClubs.length ? (
            <HeaderFilterTabs
              ariaLabel="클럽 범위"
              selectedId={selectedClubId}
              onSelect={selectClub}
              tabs={activeClubs.map((item) => ({
                id: item.club.id,
                label: item.club.name,
                icon: <TbAffiliate aria-hidden="true" className="size-3.5" />,
                labelClassName: "max-w-24 truncate",
              }))}
            />
          ) : null
        }
      >
        <button
          type="button"
          className="h-9 px-1 text-sm font-semibold text-pkpk-primary-font transition-colors hover:text-pkpk-accent-font disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!isOnline}
          onClick={() => setIsCreateOpen(true)}
        >
          + 클럽 만들기
        </button>
      </TabPanelHeader>

      <div className="tab-panel-header-content flex min-h-0 flex-1 flex-col bg-white">
        {isLoading ? (
          <TabPanelStatus isLoading ariaLabel="클럽을 불러오는 중" message="클럽을 불러오는 중이에요." />
        ) : error && !activeClubs.length ? (
          <TabPanelStatus tone="error" message={error} />
        ) : !activeClubs.length ? (
          <TabPanelEmptyState message="클럽을 만들거나 클럽 구성원에게 초대받아보세요." />
        ) : (
          <div className="relative z-30 mx-auto w-full min-h-full shrink-0">
            <div className="relative z-10">
              <div className="divide-y-[6px] divide-pkpk-section-border">
                {error ? (
                  <section className="px-4 py-4">
                    <div className="rounded-2xl border border-error/20 bg-white px-4 py-3 text-sm font-medium text-error">
                      {error}
                    </div>
                  </section>
                ) : null}

                {isDashboardLoading || !dashboard ? (
                  <TabPanelStatus isLoading ariaLabel="클럽 정보를 불러오는 중" message="클럽 정보를 불러오는 중이에요." />
                ) : (
                  <>
                    <section className="space-y-5 px-4 pt-4 pb-2">
                      {dashboard.upcomingSessions.length ? (
                        <div className="space-y-3">
                          <SectionTitle
                            icon={<IoCalendarOutline className="size-5" />}
                            title="다가오는 세션"
                          />
                          {renderSchedule()}
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <div className="space-y-3">
                          <SectionTitle
                            icon={<IoCalendarOutline className="size-5" />}
                            title="최근에 끝난 매치"
                          />
                          {renderRecentCompletedMatches()}
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={openClubMatchHistory}
                            className="flex items-center gap-0.5 px-1 py-1 text-sm text-pkpk-primary-bg transition-colors hover:bg-pkpk-hover-surface active:bg-pkpk-pressed-surface"
                          >
                            {dashboard.club.name}의 매치 전체 보기
                            <IoChevronForward className="size-4" />
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3 px-4 py-4">
                      <SectionTitle
                        icon={<AiOutlineNotification className="size-5" />}
                        title="공지"
                        action={
                          isManager ? (
                            <ActionChipButton
                              disabled={
                                !isOnline ||
                                dashboard.announcements.length >=
                                  CLUB_ANNOUNCEMENT_MAX_COUNT
                              }
                              onClick={() => {
                                setAnnouncementError(null);
                                setIsAnnouncementCreateOpen(true);
                              }}
                            >
                              + 공지 추가
                            </ActionChipButton>
                          ) : undefined
                        }
                      />
                      {dashboard.announcements.length ? (
                        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
                          {dashboard.announcements
                            .slice(0, CLUB_ANNOUNCEMENT_MAX_COUNT)
                            .map((announcement) => (
                              <button
                                key={announcement.id}
                                type="button"
                                aria-label={`${announcement.title} 공지 상세 보기`}
                                onClick={() => openAnnouncementDetail(announcement)}
                                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-pkpk-hover-surface active:bg-pkpk-pressed-surface"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-pkpk-main-font">
                                    {announcement.title}
                                  </span>
                                  <span className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-5 text-pkpk-sub-font">
                                    {announcement.body}
                                  </span>
                                </span>
                                <IoChevronForward className="mt-0.5 size-4 shrink-0 text-pkpk-sub-font" />
                              </button>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-5 text-center text-sm text-pkpk-sub-font">
                          등록된 공지가 없어요.
                        </p>
                      )}
                    </section>

                    <section className="space-y-3 px-4 py-4">
                      <SectionTitle
                        icon={<PiRankingLight className="size-5" />}
                        title="랭킹"
                      />
                      <Tabs
                        selectedKey={rankingCategory}
                        onSelectionChange={(key) =>
                          setRankingCategory(String(key) as RankingCategory)
                        }
                      >
                        <Tabs.List
                          aria-label="랭킹 타입"
                          className="grid grid-cols-2 gap-1 !rounded-xl !bg-pkpk-session-bg !p-1"
                        >
                          {(["doubles", "singles"] as RankingCategory[]).map(
                            (category) => {
                              const Icon =
                                category === "doubles" ? IoPeople : IoPerson;
                              return (
                                <Tabs.Tab
                                  key={category}
                                  id={category}
                                  className={`relative !h-auto !min-w-0 !w-full !justify-center !rounded-lg py-2 text-sm font-bold transition-colors ${
                                    rankingCategory === category
                                      ? "text-pkpk-primary-bg"
                                      : "bg-transparent text-pkpk-sub-font"
                                  }`}
                                >
                                  <span className="relative z-10 flex items-center justify-center gap-1">
                                    <Icon
                                      aria-hidden="true"
                                      className={
                                        category === "singles"
                                          ? "size-3"
                                          : "size-3.5"
                                      }
                                    />
                                    {category === "singles"
                                      ? "Singles"
                                      : "Doubles"}
                                  </span>
                                  <Tabs.Indicator className="pointer-events-none !z-0 !rounded-lg !bg-white !shadow-sm" />
                                </Tabs.Tab>
                              );
                            },
                          )}
                        </Tabs.List>
                      </Tabs>
                      {renderRankings(dashboard.rankings[rankingCategory])}
                    </section>

                    <button
                      type="button"
                      disabled={!isOnline}
                      onClick={() => setScannerTarget("player")}
                      className="flex w-full items-center gap-3 border-b-[6px] border-pkpk-section-border bg-white px-4 py-4 text-left transition-colors hover:bg-pkpk-hover-surface disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-pkpk-primary-bg shadow-sm">
                        <IoPersonAddOutline className="size-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-pkpk-main-font">멤버 초대</span>
                        <span className="mt-0.5 block text-xs text-pkpk-sub-font">
                          초대할 사람의 QR을 스캔하면 바로 멤버로 추가돼요.
                        </span>
                      </span>
                      <IoChevronForward className="size-5 shrink-0 text-pkpk-sub-font" />
                    </button>

                    {isManager ? (
                      <button
                        type="button"
                        onClick={() => setIsManagementOpen(true)}
                        className="flex w-full items-center gap-3 border-b-[6px] border-pkpk-section-border bg-white px-4 py-4 text-left"
                      >
                        <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-pkpk-primary-bg shadow-sm">
                          <IoShieldCheckmarkOutline className="size-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-pkpk-main-font">운영진 관리</span>
                          <span className="mt-0.5 block text-xs text-pkpk-sub-font">
                            공지, 세션, 멤버 권한을 관리해요.
                          </span>
                        </span>
                        <IoChevronForward className="size-5 shrink-0 text-pkpk-sub-font" />
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomSheet
        isOpen={isCreateOpen}
        isActive={selectedTab === "affiliations"}
        onOpenChange={(open) =>
          open ? setIsCreateOpen(true) : closeClubCreateSheet()
        }
        ariaLabel="클럽 만들기"
      >
        <BottomSheet.Body>
          <div>
            <h2 className="bs-text-head text-pkpk-main-font">클럽 만들기</h2>
            <p className="mt-1 text-sm text-pkpk-sub-font">
              만든 분은 바로 클럽장이 됩니다.
            </p>
          </div>
          <input
            value={clubName}
            maxLength={120}
            onChange={(event) => setClubName(event.target.value)}
            placeholder="클럽 이름"
            className="app-mobile-input w-full rounded-2xl border border-border bg-white px-4 text-pkpk-main-font outline-none focus:border-pkpk-primary-bg"
          />
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="club-description"
                className="text-sm font-semibold text-pkpk-main-font"
              >
                클럽 소개 <span className="font-normal text-pkpk-sub-font">(선택)</span>
              </label>
              <span className="text-xs text-pkpk-sub-font">
                {getUnicodeCodePointLength(clubDescription)}/
                {CLUB_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
            <textarea
              id="club-description"
              value={clubDescription}
              onChange={(event) =>
                setClubDescription(
                  truncateToUnicodeCodePoints(
                    event.target.value,
                    CLUB_DESCRIPTION_MAX_LENGTH,
                  ),
                )
              }
              placeholder="클럽을 소개해 주세요"
              className="club-description-input min-h-48 w-full resize-none rounded-2xl border border-border bg-white px-4 py-3 text-sm text-pkpk-main-font outline-none focus:border-pkpk-primary-bg"
            />
          </div>
          <BottomSheet.Actions>
            <Button
              className="app-action-button app-bottom-sheet-action-primary rounded-2xl font-bold"
              isDisabled={!clubName.trim() || isCreating || !isOnline}
              onPress={() => void createClub()}
            >
              {isCreating ? "만드는 중..." : "클럽 만들기"}
            </Button>
          </BottomSheet.Actions>
        </BottomSheet.Body>
      </BottomSheet>

      <PlayerQrScannerModal
        isOpen={scannerTarget !== null}
        onOpenChange={(open) => !open && setScannerTarget(null)}
        ariaLabel="멤버 QR 스캔"
        successMessage="클럽 멤버로 추가했어요."
        onScanned={handlePlayerScan}
      />

      <RightDrawer
        isOpen={isManagementOpen}
        isActive={selectedTab === "affiliations"}
        ariaLabel="클럽 운영진 관리"
        layer={40}
        onExited={() => setManagementError(null)}
        onPullToRefresh={async () => {
          await loadDashboard();
        }}
      >
        <div className="min-h-full">
          <DetailPageHeader
            title=""
            tabKey="affiliations"
            onBack={closeManagement}
            rightContent={
              <div className="min-w-0 translate-y-2 text-right">
                <p className="whitespace-nowrap text-lg font-bold text-pkpk-primary-bg">
                  운영진 관리
                </p>
                <p className="truncate text-xs text-pkpk-sub-font">
                  {dashboard?.club.name}
                </p>
              </div>
            }
          />

          <div className="pt-6">
            {managementError ? (
              <div className="px-4 py-4">
                <p className="rounded-xl border border-error/20 bg-white px-3 py-2 text-sm text-error">
                  {managementError}
                </p>
              </div>
            ) : null}

            {dashboard ? (
              <div className="divide-y-[6px] divide-pkpk-section-border">
              <section className="space-y-3 px-4 py-4">
                <SectionTitle icon={<IoPeopleOutline className="size-5" />} title="멤버 및 권한" />
                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
                  {dashboard.members.map((member) => (
                    <div key={member.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          size="session"
                          avatarUrl={member.avatarUrl}
                          name={member.username}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-pkpk-main-font">{member.username}</p>
                          <p className="text-xs text-pkpk-sub-font">{member.role === "owner" ? "클럽장" : member.role === "manager" ? "운영진" : "멤버"}</p>
                        </div>
                      </div>
                      {isOwner && member.id !== player?.id ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {member.role !== "owner" ? (
                            <Button
                              variant="secondary"
                              className={`rounded-xl text-xs font-semibold ${
                                member.role === "manager"
                                  ? "!bg-orange-50 !text-orange-600 hover:!bg-orange-100"
                                  : "!bg-pkpk-primary-bg !text-white hover:!bg-pkpk-primary-hover"
                              }`}
                              onPress={() =>
                                void runManagementAction(() =>
                                  request(
                                    `/api/clubs/${encodeURIComponent(dashboard.club.id)}/members/${encodeURIComponent(member.id)}/role`,
                                    {
                                      method: "PATCH",
                                      body: JSON.stringify({ role: member.role === "manager" ? "member" : "manager" }),
                                    },
                                  ),
                                )
                              }
                            >
                              {member.role === "manager" ? "운영진 해제" : "운영진 지정"}
                            </Button>
                          ) : null}
                          {member.role !== "owner" ? (
                            <Button
                              variant="secondary"
                              className="rounded-xl text-xs font-semibold text-pkpk-sub-font"
                              onPress={() => {
                                if (!window.confirm(`${member.username}님에게 클럽장 권한을 위임할까요?`)) return;
                                void runManagementAction(() =>
                                  request(
                                    `/api/clubs/${encodeURIComponent(dashboard.club.id)}/ownership-transfer`,
                                    { method: "POST", body: JSON.stringify({ playerId: member.id }) },
                                  ),
                                );
                              }}
                            >
                              클럽장 위임
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
          </div>
        </div>
      </RightDrawer>

      <BottomSheet
        isOpen={isAnnouncementCreateOpen}
        isActive={selectedTab === "affiliations" && isManager}
        onOpenChange={(open) =>
          open && isManager
            ? setIsAnnouncementCreateOpen(true)
            : closeAnnouncementCreateSheet()
        }
        ariaLabel="공지 추가"
      >
        <BottomSheet.Header>
          <h2 className="bs-text-head text-pkpk-main-font">공지 추가</h2>
          <p className="mt-1 text-sm text-pkpk-sub-font">
            클럽 공지는 최대 {CLUB_ANNOUNCEMENT_MAX_COUNT}개까지 등록할 수 있어요.
          </p>
        </BottomSheet.Header>
        <BottomSheet.Body>
          {announcementError ? (
            <p className="text-sm text-error" role="alert">
              {announcementError}
            </p>
          ) : null}
          <input
            value={announcementTitle}
            maxLength={160}
            onChange={(event) => setAnnouncementTitle(event.target.value)}
            placeholder="공지 제목"
            className="app-mobile-input w-full rounded-2xl border border-border px-4 outline-none focus:border-pkpk-primary-bg"
          />
          <textarea
            value={announcementBody}
            onChange={(event) =>
              setAnnouncementBody(
                truncateToUnicodeCodePoints(
                  event.target.value,
                  CLUB_ANNOUNCEMENT_BODY_MAX_LENGTH,
                ),
              )
            }
            placeholder="공지 내용"
            className="min-h-64 w-full resize-none rounded-2xl border border-border p-4 text-sm outline-none focus:border-pkpk-primary-bg"
          />
          <p className="text-right text-xs text-pkpk-sub-font">
            {getUnicodeCodePointLength(announcementBody)}/
            {CLUB_ANNOUNCEMENT_BODY_MAX_LENGTH}
          </p>
          <BottomSheet.Actions>
            <Button
              type="button"
              className="app-action-button app-bottom-sheet-action-secondary rounded-2xl font-semibold"
              isDisabled={isCreatingAnnouncement}
              onPress={() => closeAnnouncementCreateSheet()}
            >
              취소
            </Button>
            <Button
              type="button"
              className="app-action-button app-bottom-sheet-action-primary rounded-2xl font-semibold"
              isDisabled={
                !isOnline ||
                !isManager ||
                isCreatingAnnouncement ||
                !announcementTitle.trim() ||
                !announcementBody.trim()
              }
              onPress={() => void createAnnouncement()}
            >
              {isCreatingAnnouncement ? "등록 중..." : "공지 등록"}
            </Button>
          </BottomSheet.Actions>
        </BottomSheet.Body>
      </BottomSheet>

      <AppModal
        state={announcementDeleteConfirmation}
        ariaLabel="공지 제거 확인"
        title="공지를 제거할까요?"
        footer={
          <HoldToConfirmButton
            holdDurationMs={1000}
            ariaLabel="길게 눌러 공지 제거"
            className="w-full justify-center whitespace-nowrap bg-error font-semibold text-white hover:bg-[#e9545e]"
            progressClassName="bg-white/20"
            isDisabled={isDeletingAnnouncement}
            onComplete={() => void removeAnnouncement()}
          >
            {isDeletingAnnouncement ? "제거 중..." : "길게 눌러 제거"}
          </HoldToConfirmButton>
        }
      >
        <p className="text-sm leading-6 text-pkpk-sub-font">
          <span className="font-semibold text-pkpk-main-font">
            {announcementToDelete?.title}
          </span>
          을(를) 제거하면 되돌릴 수 없어요.
        </p>
        {announcementError ? (
          <p className="mt-2 text-sm text-error" role="alert">
            {announcementError}
          </p>
        ) : null}
      </AppModal>

      {clubMatchHistoryClub && clubMatchHistoryDepthId ? (
        <RightDrawer
          isOpen={isClubMatchHistoryDrawerOpen}
          isActive={selectedTab === "affiliations"}
          ariaLabel={`${clubMatchHistoryClub.name}의 매치 전체`}
          onExited={completeClubMatchHistoryClose}
          onScrollContainerChange={registerClubMatchHistoryScrollContainer}
          onPullToRefresh={() =>
            loadClubMatchHistory(clubMatchHistoryClub.id, 0)
          }
          layer={60}
          className="!bg-white"
        >
          <div className="min-h-full bg-white">
            <DetailPageHeader
              title="매치 전체"
              tabKey="affiliations"
              backgroundClassName="bg-white"
              rightContent={
                <div className="min-w-0 translate-y-2 text-right">
                  <p className="whitespace-nowrap text-lg font-bold text-pkpk-primary-bg">
                    매치 전체
                  </p>
                  <p className="truncate text-xs text-pkpk-sub-font">
                    {clubMatchHistoryClub.name}
                  </p>
                </div>
              }
            />
            <div className="space-y-3 p-3">
              {isClubMatchHistoryLoading && !clubMatchHistoryMatches.length ? (
                <TabPanelStatus
                  isLoading
                  ariaLabel="소속 매치를 불러오는 중"
                  message="소속 매치를 불러오는 중이에요."
                />
              ) : clubMatchHistoryError ? (
                <div className="space-y-3">
                  <TabPanelStatus tone="error" message={clubMatchHistoryError} />
                  <Button
                    type="button"
                    className="app-action-button w-full rounded-2xl bg-pkpk-primary-bg font-semibold text-white"
                    onPress={() =>
                      void loadClubMatchHistory(clubMatchHistoryClub.id, 0)
                    }
                  >
                    다시 시도
                  </Button>
                </div>
              ) : !clubMatchHistoryMatches.length ? (
                <TabPanelStatus message="표시할 소속 매치가 없어요." />
              ) : (
                <>
                  <div className="space-y-3">
                    {clubMatchHistoryMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        currentPlayerId={player?.id}
                        onPress={openMatchDetail}
                      />
                    ))}
                  </div>
                  {clubMatchHistoryMatches.length < clubMatchHistoryTotal ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="app-action-button w-full rounded-2xl font-semibold"
                      isDisabled={isClubMatchHistoryLoading}
                      onPress={() =>
                        void loadClubMatchHistory(
                          clubMatchHistoryClub.id,
                          clubMatchHistoryPage,
                          true,
                        )
                      }
                    >
                      {isClubMatchHistoryLoading ? "불러오는 중..." : "더 보기"}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </RightDrawer>
      ) : null}

      {selectedAnnouncement && announcementDetailDepthId ? (
        <RightDrawer
          isOpen={isAnnouncementDetailDrawerOpen}
          isActive={selectedTab === "affiliations"}
          ariaLabel="공지 상세"
          onExited={completeAnnouncementDetailClose}
          onScrollContainerChange={registerAnnouncementDetailScrollContainer}
          layer={50}
          className="!bg-white"
        >
          <div className="min-h-full bg-white">
            <DetailPageHeader
              title="공지 상세"
              tabKey="affiliations"
              backgroundClassName="bg-white"
              rightContent={
                <p className="text-lg font-bold text-pkpk-primary-bg">
                  공지 상세
                </p>
              }
            />
            <article className="space-y-4 px-4 py-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 flex-1 break-words text-[calc(1.5rem*var(--app-font-scale))] font-bold text-pkpk-main-font">
                  {selectedAnnouncement.title}
                </h2>
                {isManager ? (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      aria-label="공지 메뉴"
                      aria-haspopup="menu"
                      aria-expanded={isAnnouncementActionMenuOpen}
                      onClick={() =>
                        setIsAnnouncementActionMenuOpen((isOpen) => !isOpen)
                      }
                      className="flex size-9 items-center justify-center rounded-full text-pkpk-sub-font transition-colors hover:bg-pkpk-hover-surface active:bg-pkpk-pressed-surface"
                    >
                      <IoMenuOutline aria-hidden="true" className="size-5" />
                    </button>
                    {isAnnouncementActionMenuOpen ? (
                      <div
                        role="menu"
                        aria-label="공지 메뉴"
                        className="absolute right-0 top-10 z-10 w-24 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          disabled={!isOnline || isDeletingAnnouncement}
                          onClick={() => {
                            setAnnouncementError(null);
                            setAnnouncementToDelete(selectedAnnouncement);
                            setIsAnnouncementActionMenuOpen(false);
                            announcementDeleteConfirmation.open();
                          }}
                          className="w-full px-3 py-2 text-left text-sm font-semibold text-error transition-colors hover:bg-pkpk-error-hover disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          제거
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <AnnouncementBody body={selectedAnnouncement.body} />
            </article>
          </div>
        </RightDrawer>
      ) : null}

      {selectedSession && sessionDepthId ? (
        <RightDrawer
          isOpen={isSessionDrawerOpen}
          isActive={selectedTab === "affiliations"}
          ariaLabel="세션 상세"
          onExited={completeSessionDetailClose}
          onScrollContainerChange={registerSessionScrollContainer}
          onPullToRefresh={() => loadSessionMatches(selectedSession)}
          layer={60}
        >
          <SessionDetail
            session={selectedSession}
            matches={selectedSessionMatches}
            currentPlayerId={player?.id}
            isLoading={isLoadingSession}
            error={sessionError}
            onRetry={() => void loadSessionMatches(selectedSession)}
            onPressMatch={openMatchDetail}
            tabKey="affiliations"
          />
        </RightDrawer>
      ) : null}

      {selectedMatch && matchDepthId ? (
        <ProfileMatchDetailDrawer
          isOpen={isMatchDrawerOpen}
          isActive={selectedTab === "affiliations"}
          tabKey="affiliations"
          match={selectedMatch}
          currentPlayerId={player?.id}
          onExited={completeMatchDetailClose}
          onScrollContainerChange={registerMatchScrollContainer}
          layer={70}
        />
      ) : null}
      <DraftRestoreModal
        isOpen={pendingClubDraft !== null}
        onRestore={() => {
          if (!pendingClubDraft) return;
          setClubName(pendingClubDraft.name);
          setClubDescription(pendingClubDraft.description);
          setPendingClubDraft(null);
          setIsClubDraftResolved(true);
        }}
        onDiscard={() => {
          if (clubDraftKey) removeFormDraft(clubDraftKey);
          setClubName("");
          setClubDescription("");
          setPendingClubDraft(null);
          setIsClubDraftResolved(true);
        }}
      />
      <DraftRestoreModal
        isOpen={pendingAnnouncementDraft !== null}
        onRestore={() => {
          if (!pendingAnnouncementDraft) return;
          setAnnouncementTitle(pendingAnnouncementDraft.title);
          setAnnouncementBody(pendingAnnouncementDraft.body);
          setPendingAnnouncementDraft(null);
          setIsAnnouncementDraftResolved(true);
        }}
        onDiscard={() => {
          if (announcementDraftKey) removeFormDraft(announcementDraftKey);
          setAnnouncementTitle("");
          setAnnouncementBody("");
          setPendingAnnouncementDraft(null);
          setIsAnnouncementDraftResolved(true);
        }}
      />
    </div>
  );
};

export default Affiliations;
