import React from "react";
import { IoCopyOutline } from "react-icons/io5";

interface CopyableIdProps {
  label: string;
  value: string;
  showLabel?: boolean;
}

const CopyableId: React.FC<CopyableIdProps> = ({
  label,
  value,
  showLabel = true,
}) => {
  const handleCopy = () => {
    void navigator.clipboard?.writeText(value);
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs text-pkpk-sub-font">
      {showLabel ? (
        <span className="shrink-0 text-sm font-medium">{label}</span>
      ) : null}
      <button
        type="button"
        aria-label={`${label} 복사`}
        onClick={handleCopy}
        className="flex min-w-0 items-center gap-1 rounded-full bg-pkpk-primary-bg/5 px-2.5 py-1 font-medium transition-colors hover:bg-pkpk-primary-bg/10"
      >
        <IoCopyOutline aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate font-mono">{value}</span>
      </button>
    </div>
  );
};

export default CopyableId;
