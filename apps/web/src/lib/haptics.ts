export const triggerHapticFeedback = (duration: number) => {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.vibrate !== "function"
  ) {
    return;
  }

  navigator.vibrate(duration);
};
