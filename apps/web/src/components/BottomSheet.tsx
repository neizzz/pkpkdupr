import React from "react";
import { Drawer } from "@heroui/react";

interface BottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  ariaLabel: string;
  children: React.ReactElement | React.ReactElement[];
  className?: string;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onOpenChange,
  ariaLabel,
  children,
  className,
}) => (
  <Drawer.Backdrop
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    variant="blur"
  >
    <Drawer.Content
      placement="bottom"
      className="mx-auto w-full max-w-[430px]"
    >
      <Drawer.Dialog
        aria-label={ariaLabel}
        className={["rounded-t-3xl bg-white", className]
          .filter(Boolean)
          .join(" ")}
      >
        <Drawer.CloseTrigger />
        {children as any}
      </Drawer.Dialog>
    </Drawer.Content>
  </Drawer.Backdrop>
);

export default BottomSheet;
