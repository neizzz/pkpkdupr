import React, { useState } from "react";
import {
  Button,
  Dropdown,
  Label,
  Modal,
  Tabs,
  useOverlayState,
} from "@heroui/react";
import {
  IoAdd,
  IoPeopleOutline,
  IoPersonCircleOutline,
  IoQrCodeSharp,
  IoTennisballOutline,
} from "react-icons/io5";
import QrCode from "react-qr-code";
import Match from "@/pages/Match";
import Members from "@/pages/Members";
import Me from "@/pages/Me";

type TabKey = "match" | "members" | "me";

const BottomNav: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<TabKey>("me");
  const [isGlobalMenuOpen, setIsGlobalMenuOpen] = useState(false);
  const qrState = useOverlayState({ defaultOpen: false });

  const handleGlobalAction = (key: React.Key) => {
    switch (String(key)) {
      case "qr":
        qrState.open();
        break;
      case "match":
        setSelectedTab("match");
        break;
      case "members":
        setSelectedTab("members");
        break;
      default:
        break;
    }

    setIsGlobalMenuOpen(false);
  };

  return (
    <Tabs
      selectedKey={selectedTab}
      onSelectionChange={(key) => setSelectedTab(String(key) as TabKey)}
      className="relative flex h-screen min-h-screen flex-col overflow-hidden bg-white"
    >
      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50">
        <Tabs.Panel id="match" className="min-h-full">
          <Match />
        </Tabs.Panel>
        <Tabs.Panel id="members" className="min-h-full">
          <Members />
        </Tabs.Panel>
        <Tabs.Panel id="me" className="min-h-full">
          <Me />
        </Tabs.Panel>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-white/95 via-white/75 to-transparent"
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
                <span className="text-[11px] leading-none">Match</span>
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
            className="min-w-[180px] border border-amber-200 bg-[rgba(255,205,0,0.93)]"
            offset={12}
            placement="top end"
          >
            <Dropdown.Menu onAction={handleGlobalAction}>
              <Dropdown.Item id="qr" textValue="QR code">
                <IoQrCodeSharp className="size-4 shrink-0 text-amber-700" />
                <Label>QR 코드</Label>
              </Dropdown.Item>
              <Dropdown.Item id="match" textValue="Go to Match">
                <Label>Match로 이동</Label>
              </Dropdown.Item>
              <Dropdown.Item id="members" textValue="Go to Members">
                <Label>Members로 이동</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>

      <Modal>
        <Modal.Backdrop isOpen={qrState.isOpen} onOpenChange={qrState.setOpen}>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog
              aria-label="My Player ID QR code"
              className="mx-4 w-full max-w-sm rounded-2xl"
            >
              <Modal.CloseTrigger />
              <Modal.Header className="items-center pb-2 text-center">
                <Modal.Heading>My Player ID</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex items-center justify-center pb-6 pt-2">
                <QrCode
                  value="player-001"
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#a16207"
                />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Tabs>
  );
};

export default BottomNav;
