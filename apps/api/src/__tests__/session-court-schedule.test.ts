import { describe, expect, it } from "vitest";
import {
  buildCourtSchedule,
  findCourtScheduleConflicts,
  normalizeCourtNames,
} from "../services/SessionCourtSchedule";

const sessionStartsAt = new Date("2026-07-25T09:00:00.000Z");

describe("session court schedule", () => {
  it("입력 순서대로 같은 이름의 코트를 중복 등록할 수 없다", () => {
    expect(() => normalizeCourtNames(["코트 A", "코트 a"])).toThrow(
      "같은 코트명을 중복 입력할 수 없습니다.",
    );
  });

  it("기존 코트 점유와 경기 모드별 소요 시간을 고려해 가장 빠른 코트에 배정한다", () => {
    const schedule = buildCourtSchedule({
      courts: ["코트 A", "코트 B"],
      sessionStartsAt,
      existingMatches: [
        {
          id: "existing-a",
          mode: "single-game",
          status: "created",
          courtName: "코트 A",
          matchStartsAt: sessionStartsAt,
        },
      ],
      modes: ["best-of-3", "single-game"],
    });

    expect(schedule).toEqual([
      {
        courtName: "코트 B",
        matchStartsAt: new Date("2026-07-25T09:00:00.000Z"),
      },
      {
        courtName: "코트 A",
        matchStartsAt: new Date("2026-07-25T09:15:00.000Z"),
      },
    ]);
  });

  it("코트가 지정되지 않은 기존 예정 경기가 있으면 자동 배정을 막는다", () => {
    expect(() =>
      buildCourtSchedule({
        courts: ["코트 A"],
        sessionStartsAt,
        existingMatches: [
          {
            id: "existing-without-court",
            mode: "single-game",
            status: "created",
            matchStartsAt: sessionStartsAt,
          },
        ],
        modes: ["single-game"],
      }),
    ).toThrow("existing-without-court의 코트명을 먼저 지정해주세요.");
  });

  it("같은 코트의 겹침만 충돌로 보고 다른 코트 동시 경기는 허용한다", () => {
    const conflicts = findCourtScheduleConflicts({
      courts: ["코트 A", "코트 B"],
      existingMatches: [
        {
          id: "existing-a",
          mode: "best-of-3",
          status: "created",
          courtName: "코트 A",
          matchStartsAt: sessionStartsAt,
        },
      ],
      scheduledMatches: [
        {
          id: "same-court",
          mode: "single-game",
          courtName: "코트 A",
          matchStartsAt: new Date("2026-07-25T09:15:00.000Z"),
        },
        {
          id: "other-court",
          mode: "single-game",
          courtName: "코트 B",
          matchStartsAt: sessionStartsAt,
        },
      ],
    });

    expect(conflicts).toEqual([
      "코트 A: existing-a와 same-court의 시간이 겹칩니다.",
    ]);
  });
});
