import React, { useEffect, useState } from "react";
import { Button, Modal } from "@heroui/react";
import { IoCheckmarkCircle } from "react-icons/io5";
import type { PlayerFontSizePreference } from "@pkpkdupr/shared/player";

interface FontSizePreferenceModalProps {
  isOpen: boolean;
  isInitialSetup?: boolean;
  savedPreference: PlayerFontSizePreference | null;
  onPreview: (preference: PlayerFontSizePreference) => void;
  onResetPreview: () => void;
  onSave: (preference: PlayerFontSizePreference) => Promise<unknown>;
  onClose?: () => void;
}

const options: Array<{
  value: PlayerFontSizePreference;
  label: string;
  description: string;
  scale: number;
}> = [
  {
    value: "default",
    label: "기본",
    description: "기본 글자 크기",
    scale: 1.1,
  },
  {
    value: "large",
    label: "크게",
    description: "기본보다 30% 크게",
    scale: 1.43,
  },
];

const FontSizePreferenceModal: React.FC<FontSizePreferenceModalProps> = ({
  isOpen,
  isInitialSetup = false,
  savedPreference,
  onPreview,
  onResetPreview,
  onSave,
  onClose,
}) => {
  const [selected, setSelected] =
    useState<PlayerFontSizePreference | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(isInitialSetup ? null : (savedPreference ?? "default"));
    setError(null);
    setIsSaving(false);
  }, [isInitialSetup, isOpen, savedPreference]);

  const close = () => {
    if (isInitialSetup || isSaving) return;
    onResetPreview();
    onClose?.();
  };

  const select = (preference: PlayerFontSizePreference) => {
    setSelected(preference);
    setError(null);
    onPreview(preference);
  };

  const save = async () => {
    if (!selected || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(selected);
      onClose?.();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "글자 크기 설정을 저장하지 못했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
      }}
      variant="blur"
    >
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog aria-label="글자 크기 설정">
          {!isInitialSetup ? (
            <Modal.CloseTrigger
              aria-label="글자 크기 설정 닫기"
              className="!top-[1.375rem] !size-8 !rounded-full !bg-slate-100 !text-pkpk-dark hover:!bg-slate-200"
            />
          ) : null}
          <Modal.Header>
            <Modal.Heading className="!text-2xl !font-bold !leading-7 !text-pkpk-dark">
              {isInitialSetup
                ? "글자 크기를 설정해주세요"
                : "글자 크기"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="text-left">
            <p className="text-base leading-6 text-pkpk-sub-font">
              앱에서 사용할 글자 크기를 선택하세요. 설정에서 언제든 변경할 수
              있어요.
            </p>
            <fieldset className="mt-5 grid grid-cols-2 gap-3">
              <legend className="sr-only">글자 크기 선택</legend>
              {options.map((option) => {
                const isSelected = selected === option.value;
                return (
                  <label
                    key={option.value}
                    className={`relative flex min-h-36 cursor-pointer flex-col justify-between rounded-2xl border-2 p-4 transition-colors ${
                      isSelected
                        ? "border-pkpk-primary-bg bg-pkpk-primary-bg/5"
                        : "border-border bg-white hover:bg-pkpk-hover-surface/50"
                    }`}
                    style={{
                      fontSize: `calc(1rem * ${option.scale})`,
                      lineHeight: `calc(1.5rem * ${option.scale})`,
                    }}
                  >
                    <input
                      type="radio"
                      name="font-size-preference"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => select(option.value)}
                      className="sr-only"
                    />
                    <span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-bold text-pkpk-dark">
                          {option.label}
                        </span>
                        {isSelected ? (
                          <IoCheckmarkCircle
                            aria-hidden="true"
                            className="size-5 shrink-0 text-pkpk-primary-bg"
                          />
                        ) : null}
                      </span>
                      <span
                        className="mt-1 block text-pkpk-sub-font"
                        style={{
                          fontSize: `calc(0.875rem * ${option.scale})`,
                          lineHeight: `calc(1.25rem * ${option.scale})`,
                        }}
                      >
                        {option.description}
                      </span>
                    </span>
                    <span
                      className="mt-4 block font-semibold text-pkpk-main-font"
                      style={{
                        fontSize: `calc(1rem * ${option.scale})`,
                        lineHeight: `calc(1.5rem * ${option.scale})`,
                      }}
                    >
                      가나다
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {error ? (
              <p
                className="mt-4 rounded-xl bg-error/10 px-3 py-2 text-sm leading-5 text-error"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="button"
              isDisabled={!selected || isSaving}
              className="mt-2 min-h-14 w-full whitespace-nowrap bg-pkpk-primary-bg text-base font-bold text-white hover:bg-pkpk-primary-hover"
              onPress={() => void save()}
            >
              {isSaving ? "저장 중..." : "적용하기"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};

export default FontSizePreferenceModal;
