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
        <div className="pointer-events-none absolute inset-x-0 -top-10 z-20 flex justify-end px-4">
          <button
            type="button"
            aria-label="Close"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={() => onOpenChange(false)}
            className="pointer-events-auto flex size-6 items-center justify-center text-2xl leading-none text-white transition-opacity opacity-60 hover:opacity-50"
          >
            ×
          </button>
        </div>
        <section
          role="dialog"
          aria-label={ariaLabel}
          className={[
            "app-bottom-sheet-surface app-bottom-sheet-padding relative w-full rounded-t-3xl bg-white shadow-2xl",
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
