export const TAB_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export const isTabRefreshDue = (lastSuccessfulLoadAt: number | null) =>
  lastSuccessfulLoadAt === null ||
  Date.now() - lastSuccessfulLoadAt >= TAB_REFRESH_INTERVAL_MS;
