import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  TooltipArrow,
  TooltipContent,
  TooltipRoot,
  TooltipTrigger,
} from "@heroui/react";
import type { PlayerAffiliation } from "@pkpkdupr/shared/player";
import { MdEdit } from "react-icons/md";
import { getStatusMessageColors } from "@/utils/statusMessage";

interface PlayerProfileMetaProps {
  affiliations?: PlayerAffiliation[];
  statusMessage?: string;
  statusMessageBackgroundColor?: string;
  align?: "start" | "center";
  isMe?: boolean;
  showEmptyAffiliation?: boolean;
  isUpdatingPrimary?: boolean;
  onEditStatus?: () => void;
  onSetPrimary?: (name: string) => void;
}

const PlayerProfileMeta: React.FC<PlayerProfileMetaProps> = ({
  affiliations = [],
  statusMessage,
  statusMessageBackgroundColor,
  align = "start",
  isMe = false,
  showEmptyAffiliation = false,
  isUpdatingPrimary = false,
  onEditStatus,
  onSetPrimary,
}) => {
  const [isAffiliationPopupOpen, setIsAffiliationPopupOpen] = useState(false);
  const contextMenuTriggeredRef = useRef(false);
  const primaryAffiliation = useMemo(
    () => affiliations.find((affiliation) => affiliation.isPrimary),
    [affiliations],
  );
  const extraCount = Math.max(0, affiliations.length - 1);
  const statusMessageColors = getStatusMessageColors(
    statusMessageBackgroundColor || "#64748B",
  );

  useEffect(() => {
    if (!isAffiliationPopupOpen) return undefined;

    const closeTooltip = () => setIsAffiliationPopupOpen(false);
    const handleTouchMove = () => closeTooltip();
    const handleTouchEnd = (event: TouchEvent) => {
      if (contextMenuTriggeredRef.current) {
        contextMenuTriggeredRef.current = false;
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest("[data-affiliation-tooltip-trigger]") ||
          target.closest("[data-affiliation-tooltip-action]"))
      ) {
        return;
      }
      closeTooltip();
    };
    const handleContextMenu = () => {
      contextMenuTriggeredRef.current = true;
      window.setTimeout(() => {
        contextMenuTriggeredRef.current = false;
      }, 1000);
    };

    window.addEventListener("scroll", closeTooltip, true);
    document.addEventListener("touchmove", handleTouchMove, true);
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("scroll", closeTooltip, true);
      document.removeEventListener("touchmove", handleTouchMove, true);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [isAffiliationPopupOpen]);

  if (
    !statusMessage &&
    !primaryAffiliation &&
    !showEmptyAffiliation &&
    !(isMe && onEditStatus)
  ) {
    return null;
  }

  return (
    <div
      className={`flex min-w-0 flex-col ${statusMessage ? "gap-1" : "gap-0"} ${
        align === "center" ? "items-center text-center" : "items-start text-left"
      }`}
    >
      {statusMessage ? (
        <div
          className="flex max-w-full min-w-0 items-center gap-1"
        >
          <p
            className="min-w-0 max-w-full truncate rounded-lg px-1.5 py-1 text-[clamp(0.73125rem,3.15cqw,0.945rem)] leading-tight"
            style={statusMessageColors}
          >
            {statusMessage}
          </p>
          {isMe && onEditStatus ? (
            <button
              type="button"
              onClick={onEditStatus}
              className="flex shrink-0 items-center justify-center text-pkpk-main-font"
              aria-label="상태메시지 수정"
            >
              <MdEdit className="size-4" />
            </button>
          ) : null}
        </div>
      ) : isMe && onEditStatus ? (
        <button
          type="button"
          onClick={onEditStatus}
          className="flex items-center gap-1 text-[clamp(0.8125rem,3.5cqw,1.05rem)] text-pkpk-detail-font"
          aria-label="상태메시지 추가"
        >
          상태메시지 추가
          <MdEdit className="size-3.5 shrink-0" />
        </button>
      ) : null}

      {primaryAffiliation ? (
        <div className="relative flex items-center gap-1 text-[clamp(0.6875rem,3cqw,0.9rem)] text-pkpk-detail-font">
          <span className="truncate">{primaryAffiliation.name}</span>
          {extraCount > 0 ? (
            <TooltipRoot
              isOpen={isAffiliationPopupOpen}
              onOpenChange={setIsAffiliationPopupOpen}
              delay={0}
              closeDelay={0}
            >
              <TooltipTrigger
                className="shrink-0 text-[90%] font-normal underline underline-offset-2"
                aria-expanded={isAffiliationPopupOpen}
                aria-label={`소속 ${extraCount}개 더 보기`}
                data-affiliation-tooltip-trigger
                onClick={(event) => {
                  event.stopPropagation();
                  setIsAffiliationPopupOpen((isOpen) => !isOpen);
                }}
              >
                +{extraCount}
              </TooltipTrigger>
              <TooltipContent
                placement="bottom"
                shouldFlip
                containerPadding={8}
                showArrow
                className="w-56 rounded-2xl bg-white p-3 text-left text-pkpk-main-font shadow-xl ring-1 ring-black/10"
                style={{ "--overlay": "#fff" } as React.CSSProperties}
                onClick={(event) => event.stopPropagation()}
              >
                <TooltipArrow />
                <p className="mb-2 text-xs font-semibold text-pkpk-sub-font">
                  소속
                </p>
                <ul className="space-y-2">
                  {affiliations.map((affiliation) => (
                    <li
                      key={affiliation.name}
                      className="flex min-w-0 items-center justify-between gap-2"
                    >
                      <span className="min-w-0 truncate text-sm text-pkpk-main-font">
                        {affiliation.name}
                      </span>
                      {affiliation.isPrimary ? (
                        <span
                          className="size-2 shrink-0 rounded-full bg-pkpk-primary-bg"
                          aria-label="대표"
                        />
                      ) : isMe && onSetPrimary ? (
                        <button
                          type="button"
                          data-affiliation-tooltip-action
                          disabled={isUpdatingPrimary}
                          onClick={(event) => {
                            event.stopPropagation();
                            setIsAffiliationPopupOpen(false);
                            onSetPrimary(affiliation.name);
                          }}
                          className="shrink-0 rounded-full bg-pkpk-primary-bg px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          대표로 지정
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </TooltipRoot>
          ) : null}
        </div>
      ) : showEmptyAffiliation ? (
        <p className="text-[clamp(0.6875rem,3cqw,0.9rem)] text-pkpk-detail-font">
          소속 없음
        </p>
      ) : null}
    </div>
  );
};

export default PlayerProfileMeta;
