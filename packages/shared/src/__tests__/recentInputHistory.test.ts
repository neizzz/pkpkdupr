import { beforeEach, describe, expect, it } from "vitest";
import {
  RECENT_INPUT_HISTORY_STORAGE_KEY,
  readRecentInputValues,
  rememberRecentInputValue,
  type StorageLike,
} from "../recentInputHistory";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("recent input history", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("저장 성공 후 최신값을 앞에 두고 필드별 최대 5개를 유지한다", () => {
    ["A", "B", "C", "D", "E", "F"].forEach((value) => {
      rememberRecentInputValue("match.name", value, storage);
    });

    expect(readRecentInputValues("match.name", storage)).toEqual([
      "F",
      "E",
      "D",
      "C",
      "B",
    ]);
  });

  it("공백값은 제외하고 중복값은 최신 위치로 이동한다", () => {
    rememberRecentInputValue("match.location", "  Court A  ", storage);
    rememberRecentInputValue("match.location", "Court B", storage);
    rememberRecentInputValue("match.location", " Court A ", storage);
    rememberRecentInputValue("match.location", "   ", storage);

    expect(readRecentInputValues("match.location", storage)).toEqual([
      "Court A",
      "Court B",
    ]);
  });

  it("손상된 저장값은 무시하고 새 기록을 저장한다", () => {
    storage.setItem(RECENT_INPUT_HISTORY_STORAGE_KEY, "not-json");

    rememberRecentInputValue("session.name", "주말 세션", storage);

    expect(readRecentInputValues("session.name", storage)).toEqual([
      "주말 세션",
    ]);
  });

  it("저장소 접근 실패가 입력 흐름을 방해하지 않는다", () => {
    const failingStorage: StorageLike = {
      getItem: () => {
        throw new Error("read blocked");
      },
      setItem: () => {
        throw new Error("write blocked");
      },
    };

    expect(() =>
      rememberRecentInputValue("match.name", "저장 실패", failingStorage),
    ).not.toThrow();
    expect(readRecentInputValues("match.name", failingStorage)).toEqual([]);
  });
});
