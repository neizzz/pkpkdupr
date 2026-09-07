import React from "react";

export interface HeaderFilterTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  labelClassName?: string;
}

interface HeaderFilterTabsProps {
  ariaLabel: string;
  tabs: HeaderFilterTab[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const HeaderFilterTabs: React.FC<HeaderFilterTabsProps> = ({
  ariaLabel,
  tabs,
  selectedId,
  onSelect,
}) => (
  <div className="-mx-4 overflow-x-auto overscroll-x-contain touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <div role="tablist" aria-label={ariaLabel} className="flex w-max gap-1 pl-4">
      {tabs.map((tab) => {
        const isSelected = tab.id === selectedId;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(tab.id)}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pkpk-accent-bg ${
              isSelected
                ? "border-pkpk-accent-bg bg-pkpk-accent-bg text-pkpk-primary-bg shadow-[0_3px_9px_rgba(13,11,26,0.18)]"
                : "border-white/50 bg-white/10 text-pkpk-primary-font shadow-[inset_0_1px_0_rgb(255_255_255_/_0.2),0_2px_8px_rgb(13_11_26_/_0.12)] backdrop-blur-sm hover:bg-pkpk-hover-inverse active:bg-pkpk-pressed-inverse"
            }`}
          >
            {tab.icon}
            <span className={tab.labelClassName}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);

export default HeaderFilterTabs;
