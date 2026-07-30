import React from "react";
import { IoCopyOutline } from "react-icons/io5";

interface CopyableIdProps {
  label: string;
  value: string;
  showLabel?: boolean;
  truncate?: boolean;
}

const CopyableId: React.FC<CopyableIdProps> = ({
  label,
  value,
  showLabel = true,
  truncate = true,
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
        className="flex min-w-0 items-center gap-0.5 font-medium transition-opacity hover:opacity-70"
      >
        <IoCopyOutline aria-hidden="true" className="size-3.5 shrink-0" />
        <span className={truncate ? "truncate font-mono" : "break-all font-mono"}>
          {value}
        </span>
      </button>
    </div>
  );
};

export default CopyableId;
