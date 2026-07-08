import React from "react";

interface BottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  ariaLabel: string;
  children: React.ReactElement | React.ReactElement[];
  className?: string;
  isDismissable?: boolean;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onOpenChange,
  ariaLabel,
  children,
  className,
  isDismissable = true,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (isDismissable && event.target === event.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div className="relative mx-auto w-full">
        <button
          type="button"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
          className="absolute -top-10 right-4 z-10 flex size-6 items-center justify-center text-2xl leading-none text-white transition-opacity opacity-60 hover:opacity-50"
        >
          ×
        </button>
        <section
          role="dialog"
          aria-label={ariaLabel}
          className={[
            "relative w-full rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {children}
        </section>
      </div>
    </div>
  );
};

export default BottomSheet;
