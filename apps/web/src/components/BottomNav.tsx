import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Drawer,
  Dropdown,
  Label,
  Tabs,
  useOverlayState,
} from "@heroui/react";
import {
  IoAdd,
  IoAddCircleOutline,
  IoPeopleOutline,
  IoPersonCircleOutline,
  IoQrCodeSharp,
  IoTennisballOutline,
} from "react-icons/io5";
import type { PlayerQrTokenResponse } from "@pkpkdupr/shared/qr";
import QrCode from "react-qr-code";
import CreateMatchDrawerBody from "@/components/CreateMatchDrawerBody";
import { useAuth } from "@/context/AuthContext";
import Matches from "@/pages/Matches";
import Members from "@/pages/Members";
import Me from "@/pages/Me";

type TabKey = "match" | "members" | "me";

const formatRemainingTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const BottomNav: React.FC = () => {
  const { token } = useAuth();
  const [selectedTab, setSelectedTab] = useState<TabKey>("me");
  const [isGlobalMenuOpen, setIsGlobalMenuOpen] = useState(false);
  const [qrToken, setQrToken] = useState<PlayerQrTokenResponse | null>(null);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrRemainingSeconds, setQrRemainingSeconds] = useState(0);
  const qrState = useOverlayState({ defaultOpen: false });
  const createMatchState = useOverlayState({ defaultOpen: false });

  const loadPlayerQrToken = useCallback(async () => {
    if (!token) {
      setQrToken(null);
      setQrError("로그인이 필요합니다.");
      setQrRemainingSeconds(0);
      return;
    }

    try {
      setIsQrLoading(true);
      setQrError(null);

      const res = await fetch("/api/player-qr-token", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "QR 코드를 생성하지 못했습니다.");
      }

      const data = (await res.json()) as PlayerQrTokenResponse;
      setQrToken(data);
      setQrRemainingSeconds(data.ttlSeconds);
    } catch (err) {
      setQrError(
        err instanceof Error ? err.message : "QR 코드를 생성하지 못했습니다.",
      );
    } finally {
      setIsQrLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (qrState.isOpen) {
      void loadPlayerQrToken();
    }
  }, [loadPlayerQrToken, qrState.isOpen]);

  useEffect(() => {
    if (!qrState.isOpen || !qrToken) {
      return;
    }

    const updateRemainingTime = () => {
      const expiresAtMs = new Date(qrToken.expiresAt).getTime();
      setQrRemainingSeconds(
        Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000)),
      );
    };

    updateRemainingTime();
    const intervalId = window.setInterval(updateRemainingTime, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [qrState.isOpen, qrToken]);

  const handleGlobalAction = (key: React.Key) => {
    switch (String(key)) {
      case "qr":
        qrState.open();
        break;
      case "create-match":
        createMatchState.open();
        break;
      default:
        break;
    }

    setIsGlobalMenuOpen(false);
  };

  const handleCreateMatch = () => {
    createMatchState.close();
    setSelectedTab("match");
  };

  return (
    <Tabs
      selectedKey={selectedTab}
      onSelectionChange={(key) => setSelectedTab(String(key) as TabKey)}
      className="relative flex h-screen min-h-screen flex-col overflow-hidden bg-white"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Tabs.Panel id="match" className="min-h-full bg-gray-50">
          <Matches />
        </Tabs.Panel>
        <Tabs.Panel id="members" className="min-h-full bg-gray-50">
          <Members />
        </Tabs.Panel>
        <Tabs.Panel id="me" className="min-h-full bg-white">
          <Me />
        </Tabs.Panel>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-22 bg-gradient-to-t from-white/95 via-white/75 to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-end gap-3 px-4 pb-3 pt-2">
        <Tabs.ListContainer className="min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none backdrop-blur-0">
          <Tabs.List
            aria-label="Bottom navigation"
            className="grid grid-cols-3 gap-1 *:min-w-0"
          >
            <Tabs.Tab
              id="match"
              className="w-full text-default-500 data-[selected=true]:text-[#409eff]"
            >
              <div className="flex flex-col items-center gap-0.5 py-1">
                <IoTennisballOutline className="text-base" />
                <span className="text-[11px] leading-none">Matches</span>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab
              id="members"
              className="w-full text-default-500 data-[selected=true]:text-[#409eff]"
            >
              <div className="flex flex-col items-center gap-0.5 py-1">
                <IoPeopleOutline className="text-base" />
                <span className="text-[11px] leading-none">Members</span>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab
              id="me"
              className="w-full text-default-500 data-[selected=true]:text-[#409eff]"
            >
              <div className="flex flex-col items-center gap-0.5 py-1">
                <IoPersonCircleOutline className="text-base" />
                <span className="text-[11px] leading-none">Me</span>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Dropdown isOpen={isGlobalMenuOpen} onOpenChange={setIsGlobalMenuOpen}>
          <Dropdown.Trigger>
            <Button
              isIconOnly
              aria-label="Global plus menu"
              className={`shrink-0 rounded-full text-white shadow-lg transition-colors ${
                isGlobalMenuOpen
                  ? "bg-[#f8626c] hover:bg-[#f8626c]/90"
                  : "bg-[#409eff] hover:bg-[#409eff]/90"
              }`}
            >
              <IoAdd
                size={20}
                className={`transition-transform duration-200 ${
                  isGlobalMenuOpen ? "rotate-45" : "rotate-0"
                }`}
              />
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Popover
            className="relative min-w-[180px] overflow-hidden border border-amber-200 bg-white"
            offset={12}
            placement="top end"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[rgba(255,205,0,0.15)]"
            />
            <Dropdown.Menu
              onAction={handleGlobalAction}
              className="relative z-10 bg-transparent"
            >
              <Dropdown.Item id="qr" textValue="QR code">
                <IoQrCodeSharp className="size-4 shrink-0 text-amber-700" />
                <Label>QR 코드</Label>
              </Dropdown.Item>
              <Dropdown.Item id="create-match" textValue="Create match">
                <IoAddCircleOutline className="size-4 shrink-0 text-amber-700" />
                <Label>매치 생성</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>

      <Drawer.Backdrop
        isOpen={qrState.isOpen}
        onOpenChange={qrState.setOpen}
        variant="blur"
      >
        <Drawer.Content
          placement="bottom"
          className="mx-auto w-full max-w-[430px]"
        >
          <Drawer.Dialog
            aria-label="Player QR code"
            className="rounded-t-3xl bg-white"
          >
            <Drawer.Handle />
            <Drawer.CloseTrigger />
            <Drawer.Body className="flex flex-col items-center justify-center gap-4 pb-6 pt-6 text-center">
              {qrToken ? (
                <>
                  <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-amber-100">
                    <QrCode
                      value={qrToken.payload}
                      size={180}
                      bgColor="#ffffff"
                      fgColor="#a16207"
                    />
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      qrRemainingSeconds > 0
                        ? "text-amber-800"
                        : "text-red-500"
                    }`}
                  >
                    {qrRemainingSeconds > 0
                      ? `남은 시간 ${formatRemainingTime(qrRemainingSeconds)}`
                      : "QR 코드가 만료되었습니다."}
                  </p>
                </>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center">
                  <p className="text-sm text-amber-700/70">
                    {isQrLoading ? "QR 코드를 생성 중입니다..." : qrError}
                  </p>
                </div>
              )}

              {qrError && qrToken ? (
                <p className="text-xs text-red-500">{qrError}</p>
              ) : null}

              <Button
                size="sm"
                onPress={() => void loadPlayerQrToken()}
                isDisabled={isQrLoading}
                className="rounded-full bg-[#409eff] px-4 text-white disabled:bg-slate-200 disabled:text-slate-400"
              >
                {isQrLoading ? "갱신 중..." : "새로고침"}
              </Button>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      <Drawer.Backdrop
        isOpen={createMatchState.isOpen}
        onOpenChange={createMatchState.setOpen}
        variant="blur"
      >
        <Drawer.Content
          placement="bottom"
          className="mx-auto w-full max-w-[430px]"
        >
          <Drawer.Dialog
            aria-label="Create match"
            className="rounded-t-3xl bg-white"
          >
            <Drawer.CloseTrigger />
            <CreateMatchDrawerBody onCreateMatch={handleCreateMatch} />
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Tabs>
  );
};

export default BottomNav;
