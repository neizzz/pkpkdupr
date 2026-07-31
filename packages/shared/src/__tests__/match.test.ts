import { describe, expect, it } from "vitest";
import {
  computeMatchStartsAt,
  getAutoApprovalDueAt,
  getMatchSessionStatus,
} from "../match";

describe("getMatchSessionStatus", () => {
  it("모든 매치가 완료일 때만 완료 상태를 반환한다", () => {
    expect(getMatchSessionStatus(["completed", "completed"])).toBe(
      "completed",
    );
    expect(getMatchSessionStatus(["completed", "created"])).toBe("created");
    expect(getMatchSessionStatus(["pending-approval"])).toBe("created");
    expect(getMatchSessionStatus(["cancelled"])).toBe("created");
  });
});

describe("computeMatchStartsAt", () => {
  it("keeps the time if already on a 30-minute boundary", () => {
    const input = new Date("2026-07-13T14:00:00.000Z");
    const result = computeMatchStartsAt(input);
    expect(result).toEqual(new Date("2026-07-13T14:00:00.000Z"));
  });

  it("keeps the time at :30", () => {
    const input = new Date("2026-07-13T14:30:00.000Z");
    const result = computeMatchStartsAt(input);
    expect(result).toEqual(new Date("2026-07-13T14:30:00.000Z"));
  });

  it("rounds up 1 minute past to the next 30-minute slot", () => {
    const input = new Date("2026-07-13T14:01:00.000Z");
    const result = computeMatchStartsAt(input);
    expect(result).toEqual(new Date("2026-07-13T14:30:00.000Z"));
  });

  it("rounds up 14:31 to 15:00", () => {
    const input = new Date("2026-07-13T14:31:00.000Z");
    const result = computeMatchStartsAt(input);
    expect(result).toEqual(new Date("2026-07-13T15:00:00.000Z"));
  });

  it("rounds up 14:59 to 15:00", () => {
    const input = new Date("2026-07-13T14:59:59.000Z");
    const result = computeMatchStartsAt(input);
    expect(result).toEqual(new Date("2026-07-13T15:00:00.000Z"));
  });

  it("rounds up to the next hour when 1 minute past :30", () => {
    const input = new Date("2026-07-13T14:30:01.000Z");
    const result = computeMatchStartsAt(input);
    expect(result).toEqual(new Date("2026-07-13T15:00:00.000Z"));
  });

  it("handles midnight boundary", () => {
    const input = new Date("2026-07-13T23:45:00.000Z");
    const result = computeMatchStartsAt(input);
    expect(result).toEqual(new Date("2026-07-14T00:00:00.000Z"));
  });

  it("defaults to current time when no argument is given", () => {
    const before = Date.now();
    const result = computeMatchStartsAt();
    const after = Date.now();

    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThan(after + 30 * 60 * 1000);

    const remainder = result.getTime() % (30 * 60 * 1000);
    expect(remainder).toBe(0);
  });
});

describe("getAutoApprovalDueAt", () => {
  const startsAt = new Date("2026-07-31T10:00:00.000Z");

  it("경기 시작 전 또는 시작 후 1시간 이내 입력은 2시간을 적용한다", () => {
    expect(
      getAutoApprovalDueAt(
        startsAt,
        new Date("2026-07-31T09:50:00.000Z"),
      ),
    ).toEqual(new Date("2026-07-31T11:50:00.000Z"));
    expect(
      getAutoApprovalDueAt(
        startsAt,
        new Date("2026-07-31T11:00:00.000Z"),
      ),
    ).toEqual(new Date("2026-07-31T13:00:00.000Z"));
  });

  it("시작 후 1시간 초과~4시간 이내 입력은 8시간을 적용한다", () => {
    expect(
      getAutoApprovalDueAt(
        startsAt,
        new Date("2026-07-31T11:00:00.001Z"),
      ),
    ).toEqual(new Date("2026-07-31T19:00:00.001Z"));
    expect(
      getAutoApprovalDueAt(
        startsAt,
        new Date("2026-07-31T14:00:00.000Z"),
      ),
    ).toEqual(new Date("2026-07-31T22:00:00.000Z"));
  });

  it("시작 후 4시간 초과 입력은 24시간을 적용한다", () => {
    expect(
      getAutoApprovalDueAt(
        startsAt,
        new Date("2026-07-31T14:00:00.001Z"),
      ),
    ).toEqual(new Date("2026-08-01T14:00:00.001Z"));
  });
});
