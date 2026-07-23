import React, { useState } from "react";
import { ComboBox, Input, ListBox } from "@heroui/react";
import { readRecentInputValues } from "@pkpkdupr/shared/recentInputHistory";

interface RecentValueComboBoxProps {
  fieldKey: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  disabled?: boolean;
  onFocus?: () => void;
}

const RecentValueComboBox: React.FC<RecentValueComboBoxProps> = ({
  fieldKey,
  value,
  onChange,
  id,
  placeholder,
  className,
  inputClassName,
  required = false,
  disabled = false,
  onFocus,
}) => {
  const [recentValues, setRecentValues] = useState(() =>
    readRecentInputValues(fieldKey),
  );

  const getFilteredValues = (inputValue: string, values = recentValues) => {
    const normalizedInput = inputValue.trim().toLocaleLowerCase();

    return normalizedInput
      ? values.filter((recentValue) =>
          recentValue.toLocaleLowerCase().includes(normalizedInput),
        )
      : values;
  };

  const openWithRecentValues = () => {
    const nextRecentValues = readRecentInputValues(fieldKey);
    setRecentValues(nextRecentValues);
  };

  const filteredValues = getFilteredValues(value);

  return (
    <ComboBox
      allowsCustomValue
      inputValue={value}
      isDisabled={disabled}
      menuTrigger="focus"
      onInputChange={(nextValue) => {
        onChange(nextValue);
        const nextRecentValues = readRecentInputValues(fieldKey);
        setRecentValues(nextRecentValues);
      }}
      onSelectionChange={(key) => {
        if (key === null) {
          return;
        }

        onChange(String(key));
      }}
      className={className}
    >
      <ComboBox.InputGroup>
        <Input
          id={id}
          placeholder={placeholder}
          required={required}
          onFocus={() => {
            onFocus?.();
            openWithRecentValues();
          }}
          className={inputClassName}
        />
      </ComboBox.InputGroup>
      <ComboBox.Popover className="z-50 max-h-52 overflow-auto rounded-xl border border-border bg-white p-1 shadow-lg">
        <ListBox aria-label="최근 입력값" className="outline-none">
          {filteredValues.map((recentValue) => (
            <ListBox.Item
              key={recentValue}
              id={recentValue}
              textValue={recentValue}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-pkpk-sub-font outline-none data-[focused]:bg-primary/10"
            >
              {recentValue}
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
};

export default RecentValueComboBox;
