export const STATUS_MESSAGE_BACKGROUND_ALPHA = 0.15;
export const STATUS_MESSAGE_TEXT_COLOR = "#757A82";

export const getStatusMessageColors = (
  baseColor: string,
  backgroundAlpha = STATUS_MESSAGE_BACKGROUND_ALPHA,
) => {
  const red = Number.parseInt(baseColor.slice(1, 3), 16);
  const green = Number.parseInt(baseColor.slice(3, 5), 16);
  const blue = Number.parseInt(baseColor.slice(5, 7), 16);

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return {
      backgroundColor: `rgba(100, 116, 139, ${backgroundAlpha})`,
      color: STATUS_MESSAGE_TEXT_COLOR,
    };
  }

  return {
    backgroundColor: `rgba(${red}, ${green}, ${blue}, ${backgroundAlpha})`,
    color: STATUS_MESSAGE_TEXT_COLOR,
  };
};
