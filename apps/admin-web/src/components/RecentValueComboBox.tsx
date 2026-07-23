import React, { useState } from "react";
import { ComboBox, Input, ListBox } from "@heroui/react";
import { readRecentInputValues } from "@pkpkdupr/shared/recentInputHistory";

interface RecentValueComboBoxProps {
  fieldKey: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  disabled?: boolean;
}

const RecentValueComboBox: React.FC<RecentValueComboBoxProps> = ({
  fieldKey,
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  required = false,
  disabled = false,
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
          placeholder={placeholder}
          required={required}
          onFocus={openWithRecentValues}
          className={inputClassName}
        />
      </ComboBox.InputGroup>
      <ComboBox.Popover className="z-50 max-h-52 overflow-auto rounded-lg border bg-white p-1 shadow-lg">
        <ListBox aria-label="최근 입력값" className="outline-none">
          {filteredValues.map((recentValue) => (
            <ListBox.Item
              key={recentValue}
              id={recentValue}
              textValue={recentValue}
              className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none data-[focused]:bg-slate-100"
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
