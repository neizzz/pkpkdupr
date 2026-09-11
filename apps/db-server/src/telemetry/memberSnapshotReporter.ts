export const MEMBER_SNAPSHOT_EVENT_TYPE = "PkeloMemberSnapshot";
export const MEMBER_SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000;

export type MemberSnapshotAttributes = {
  activeMemberCount: number;
  source: "db-server";
};

export type MemberSnapshotRecorder = (
  eventType: typeof MEMBER_SNAPSHOT_EVENT_TYPE,
  attributes: MemberSnapshotAttributes,
) => void;

type MemberSnapshotReporterOptions = {
  isEnabled: () => boolean;
  getActiveMemberCount: () => Promise<number>;
  recordCustomEvent: MemberSnapshotRecorder;
  onError?: (error: unknown) => void;
  intervalMs?: number;
};

export type MemberSnapshotReporter = {
  start: () => void;
  stop: () => void;
};

export const isNewRelicEnabled = () =>
  process.env.NEW_RELIC_ENABLED?.trim().toLowerCase() === "true";

export const createMemberSnapshotReporter = ({
  isEnabled,
  getActiveMemberCount,
  recordCustomEvent,
  onError = () => undefined,
  intervalMs = MEMBER_SNAPSHOT_INTERVAL_MS,
}: MemberSnapshotReporterOptions): MemberSnapshotReporter => {
  let interval: ReturnType<typeof setInterval> | undefined;

  const report = async () => {
    if (!isEnabled()) {
      return;
    }

    try {
      const activeMemberCount = await getActiveMemberCount();
      recordCustomEvent(MEMBER_SNAPSHOT_EVENT_TYPE, {
        activeMemberCount,
        source: "db-server",
      });
    } catch (error) {
      onError(error);
    }
  };

  return {
    start: () => {
      if (interval) {
        return;
      }

      void report();
      interval = setInterval(() => {
        void report();
      }, intervalMs);
      interval.unref?.();
    },
    stop: () => {
      if (!interval) {
        return;
      }

      clearInterval(interval);
      interval = undefined;
    },
  };
};
