import React, { useCallback, useState } from "react";
import { Button } from "@heroui/react";
import { IoSettingsOutline } from "react-icons/io5";
import BottomSheet from "@/components/BottomSheet";
import MemberProfile from "@/components/MemberProfile";
import ProfileSettingsSheetBody from "@/components/ProfileSettingsSheetBody";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";

const Me: React.FC = () => {
  const { player } = useAuth();
  const { closeDepth, pushDepth } = useTabNavigation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const openSettings = () => {
    pushDepth("me", {
      id: "me-settings",
      kind: "bottom-sheet",
      onClose: closeSettings,
    });
    setIsSettingsOpen(true);
  };

  const handleSettingsOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      openSettings();
      return;
    }

    if (!closeDepth("me", "me-settings")) {
      setIsSettingsOpen(false);
    }
  };

  const settingsButton = (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="rounded-full px-3 text-amber-700"
      onPress={openSettings}
    >
      <IoSettingsOutline className="size-4" />
      설정
    </Button>
  );

  return (
    <>
      <MemberProfile player={player} isMe headerAction={settingsButton} />

      <BottomSheet
        isOpen={isSettingsOpen}
        onOpenChange={handleSettingsOpenChange}
        ariaLabel="프로필 설정"
        className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6"
      >
        <ProfileSettingsSheetBody />
      </BottomSheet>
    </>
  );
};

export default Me;
