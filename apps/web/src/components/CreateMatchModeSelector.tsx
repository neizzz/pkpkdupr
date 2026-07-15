import React from "react";
import { Radio, RadioGroup } from "@heroui/react";
import type { MatchMode } from "@pkpkdupr/shared/match";
import { matchModeLabels } from "@pkpkdupr/shared/match";

interface CreateMatchModeSelectorProps {
  selectedMatchMode: MatchMode;
  onChange: (value: MatchMode) => void;
}

const CreateMatchModeSelector: React.FC<CreateMatchModeSelectorProps> = ({
  selectedMatchMode,
  onChange,
}) => (
  <section className="flex flex-col gap-2">
    <p className="bs-text-title text-pkpk-sub-font">경기 모드</p>
    <RadioGroup
      aria-label="경기 모드"
      value={selectedMatchMode}
      onChange={(value) => onChange(value as MatchMode)}
      orientation="horizontal"
      className="flex items-start gap-5 p-0"
    >
      {(["single-game", "best-of-3"] as const).map((mode) => (
        <Radio key={mode} value={mode}>
          <div onClick={() => onChange(mode)} className="cursor-pointer">
            <Radio.Content className="flex select-none items-center gap-2 py-1">
              <Radio.Control className="flex size-5 items-center justify-center rounded-full border border-slate-300 bg-white">
                <Radio.Indicator className="flex size-full items-center justify-center">
                  {({ isSelected }) => (
                    <span
                      className={`block size-2.5 rounded-full bg-[#409eff] transition-all duration-200 ease-out ${
                        isSelected
                          ? "scale-100 opacity-100"
                          : "scale-0 opacity-0"
                      }`}
                    />
                  )}
                </Radio.Indicator>
              </Radio.Control>
              <span
                className={`bs-text-title text-pkpk-sub-font transition-all duration-200 ease-out ${
                  selectedMatchMode === mode ? "opacity-100" : "opacity-45"
                }`}
              >
                {matchModeLabels[mode]}
              </span>
            </Radio.Content>
          </div>
        </Radio>
      ))}
    </RadioGroup>
  </section>
);

export default CreateMatchModeSelector;
