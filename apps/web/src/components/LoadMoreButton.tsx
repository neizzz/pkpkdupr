import React from "react";
import { Button, Spinner } from "@heroui/react";

interface LoadMoreButtonProps {
  isLoading?: boolean;
  onPress?: () => void;
}

const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({
  isLoading = false,
  onPress,
}) => (
  <div className="flex justify-center pt-3 pb-2">
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="app-pill h-[45px] min-w-0 rounded-full px-5 font-semibold"
      isDisabled={isLoading || !onPress}
      onPress={onPress}
    >
      {isLoading ? (
        <Spinner aria-label="추가 매치 로딩 중" size="sm" />
      ) : (
        <span className="text-base">더 보기</span>
      )}
    </Button>
  </div>
);

export default LoadMoreButton;
