import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MEMBER_SNAPSHOT_EVENT_TYPE,
  createMemberSnapshotReporter,
} from "./memberSnapshotReporter";

describe("member snapshot reporter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends an immediate snapshot and repeats every hour", async () => {
    vi.useFakeTimers();
    const getActiveMemberCount = vi.fn().mockResolvedValue(12);
    const recordCustomEvent = vi.fn();
    const reporter = createMemberSnapshotReporter({
      isEnabled: () => true,
      getActiveMemberCount,
      recordCustomEvent,
    });

    reporter.start();
    await vi.runAllTicks();

    expect(recordCustomEvent).toHaveBeenCalledWith(MEMBER_SNAPSHOT_EVENT_TYPE, {
      activeMemberCount: 12,
      source: "db-server",
    });

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(recordCustomEvent).toHaveBeenCalledTimes(2);
    reporter.stop();
  });

  it("does not query or send while New Relic is disabled", async () => {
    vi.useFakeTimers();
    const getActiveMemberCount = vi.fn().mockResolvedValue(12);
    const recordCustomEvent = vi.fn();
    const reporter = createMemberSnapshotReporter({
      isEnabled: () => false,
      getActiveMemberCount,
      recordCustomEvent,
    });

    reporter.start();
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(getActiveMemberCount).not.toHaveBeenCalled();
    expect(recordCustomEvent).not.toHaveBeenCalled();
    reporter.stop();
  });

  it("reports a failure without stopping later snapshots", async () => {
    vi.useFakeTimers();
    const getActiveMemberCount = vi
      .fn()
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce(13);
    const recordCustomEvent = vi.fn();
    const onError = vi.fn();
    const reporter = createMemberSnapshotReporter({
      isEnabled: () => true,
      getActiveMemberCount,
      recordCustomEvent,
      onError,
    });

    reporter.start();
    await vi.runAllTicks();
    expect(onError).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(recordCustomEvent).toHaveBeenCalledWith(MEMBER_SNAPSHOT_EVENT_TYPE, {
      activeMemberCount: 13,
      source: "db-server",
    });
    reporter.stop();
  });
});
