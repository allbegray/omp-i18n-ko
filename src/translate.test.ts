import { describe, expect, test } from "bun:test";
import { createTranslator } from "./translate";
import table from "./translations.json";

const t = createTranslator(table as Parameters<typeof createTranslator>[0]);

describe("exact tier", () => {
  test("translates a static description", () => {
    expect(t.translateText("Open settings menu")).toBe("설정(settings) 메뉴 열기");
  });

  test("translates another static description", () => {
    expect(t.translateText("Manually compact the session context")).toBe("세션 컨텍스트 수동 압축(compact)");
  });

  test("keeps unknown strings untouched", () => {
    const unknown = "Some brand new English string omp added after v18.11.1";
    expect(t.translateText(unknown)).toBe(unknown);
  });

  test("table has a meaningful number of entries", () => {
    expect(t.size).toBeGreaterThanOrEqual(200);
  });
});

describe("label + state tier", () => {
  test("labels with off/on states", () => {
    expect(t.translateText("Plan: off")).toBe("계획(plan): 꺼짐");
    expect(t.translateText("Vibe: on")).toBe("바이브(vibe): 켜짐");
  });

  test("longer labels", () => {
    expect(t.translateText("Current model: openai/gpt-5.2")).toBe("현재 모델(model): openai/gpt-5.2");
    expect(t.translateText("Plan review: available")).toBe("계획 검토(plan-review): 사용 가능");
  });

  test("unknown state stays after a translated label", () => {
    expect(t.translateText("Goal: something new (objective)")).toBe("목표(goal): something new (objective)");
  });

  test("model ids in states are never mangled", () => {
    expect(t.translateState("demo/demo")).toBe("demo/demo");
    expect(t.translateText("Model: openai/gpt-5.2")).toBe("모델(model): openai/gpt-5.2");
  });

  test("word (inner) states translate both parts", () => {
    expect(t.translateState("on (repeating prompt)")).toBe("켜짐 (프롬프트 반복 중)");
    expect(t.translateState("hosting (2 guests)")).toBe("호스팅 중 (게스트 2명)");
    expect(t.translateState("active (fix the bug)")).toBe("진행 중 (fix the bug)");
  });
});

describe("composed hint text", () => {
  test("hint - static detail", () => {
    expect(t.translateText("[prompt] - Toggle plan mode (agent plans before executing)")).toBe(
      "[prompt] - 계획(plan) 모드 토글 (실행 전에 에이전트가 계획)",
    );
  });

  test("hint - dynamic state", () => {
    expect(t.translateText("[prompt] - Plan: off")).toBe("[prompt] - 계획(plan): 꺼짐");
  });

  test("usage syntax stays intact", () => {
    expect(t.translateText("<name> --host <host> [--user <user>]")).toBe("<name> --host <host> [--user <user>]");
  });
});

describe("state patterns", () => {
  test("counts", () => {
    expect(t.translateState("3 active tools")).toBe("3개 활성 도구");
    expect(t.translateState("12 active / 20 available")).toBe("12개 활성 / 20개 사용 가능");
    expect(t.translateState("4 saved")).toBe("4개 저장됨");
    expect(t.translateState("2 running, 3 recent")).toBe("실행 중 2개, 최근 3개");
    expect(t.translateState("5 open (2 in progress, 1 done)")).toBe("5개 열림 (진행 중 2개, 완료 1개)");
    expect(t.translateState("42% used")).toBe("42% 사용됨");
  });

  test("waiting for callback", () => {
    expect(t.translateState("waiting for OAuth callback")).toBe("OAuth 콜백 대기 중");
  });
});

describe("suffixes", () => {
  test("(current) suffix", () => {
    expect(t.translateText("Balanced reasoning (current)")).toBe("Balanced reasoning (현재)");
  });

  test("(current) suffix translates the base too", () => {
    expect(t.translateText("Moderate reasoning (~8k tokens) (current)")).toBe("보통 추론 (~8k 토큰) (현재)");
  });
});

describe("item translation", () => {
  test("translates the three visible fields and preserves the rest", () => {
    const item = {
      value: "/plan",
      label: "/plan",
      hint: "[prompt]",
      description: "[prompt] - Plan: off",
      nativeDetail: "[prompt] - Toggle plan mode (agent plans before executing)",
      state: "off",
    };
    const out = t.translateItem(item);
    expect(out.value).toBe("/plan");
    expect(out.label).toBe("/plan");
    expect(out.hint).toBe("[prompt]");
    expect(out.description).toBe("[prompt] - 계획(plan): 꺼짐");
    expect(out.nativeDetail).toBe("[prompt] - 계획(plan) 모드 토글 (실행 전에 에이전트가 계획)");
    expect(out.state).toBe("꺼짐");
    // The original item is not mutated.
    expect(item.state).toBe("off");
  });

  test("items without translatable fields pass through", () => {
    const item = { value: "src/index.ts", label: "index.ts" };
    expect(t.translateItem(item)).toEqual(item);
  });
});

describe("text patterns (key-hint bearing descriptions)", () => {
  test("switch", () => {
    expect(
      t.translateText("[model] - Switch model for this session (same as ⌥P); accepts fuzzy ids, provider/id, @role, :level"),
    ).toBe("[model] - 이 세션의 모델(model) 전환 (단축키 ⌥P); 퍼지 id, provider/id, @role, :level 허용");
  });

  test("effort", () => {
    expect(
      t.translateText("[level] - Set reasoning effort (thinking level, intelligence) for this session; ⇧⇥ cycles levels"),
    ).toBe("[level] - 이 세션의 추론(effort) 강도 설정 (thinking level, intelligence); ⇧⇥로 수준 순환");
  });

  test("loop", () => {
    const en =
      "[count|duration] [--while|--until '<cmd>'] [prompt] - Toggle loop mode. While enabled, the next prompt you send re-submits after every yield. Bound it with a count/duration, or gate it with `--until '<cmd>'` / `--while '<cmd>'` — the command's exit status decides whether the next iteration runs. esc suspends the ongoing loop; /loop again to disable.";
    expect(t.translateText(en)).toBe(
      "[count|duration] [--while|--until '<cmd>'] [prompt] - 루프(loop) 모드 토글. 켜져 있으면 다음 프롬프트가 매 양보 후 다시 제출됨. count/duration으로 제한하거나 `--until '<cmd>'` / `--while '<cmd>'`로 게이트; 명령 종료 상태가 다음 반복 여부를 결정. esc를 누르면 진행 중 루프 일시정지; /loop 재입력 시 끄기.",
    );
  });
});

describe("effort level descriptions", () => {
  test("levels and auto", () => {
    expect(t.translateText("Deep reasoning (~16k tokens)")).toBe("깊은 추론 (~16k 토큰)");
    expect(t.translateText("Auto-detect per prompt")).toBe("프롬프트별 자동 감지");
  });
});

describe("robustness", () => {
  test("empty table is a no-op translator", () => {
    const empty = createTranslator({});
    expect(empty.size).toBe(0);
    expect(empty.translateText("Plan: off")).toBe("Plan: off");
    expect(empty.translateState("off")).toBe("off");
  });

  test("invalid regex patterns are skipped, not thrown", () => {
    const broken = createTranslator({ statePatterns: [{ pattern: "(", replacement: "x" }] });
    expect(broken.translateState("anything")).toBe("anything");
  });

  test("malformed suffix tuples are ignored", () => {
    // biome-ignore lint/suspicious/noExplicitAny: exercising defensive parsing
    const weird = createTranslator({ suffixes: [null, ["", "x"], [" (current)", " (현재)"]] as any });
    expect(weird.translateText("x (current)")).toBe("x (현재)");
  });

  test("exact match wins over label pattern", () => {
    expect(t.translateText("Write todos as Markdown to a file (default: TODO.md)")).toBe(
      "할 일(todo)을 Markdown 파일로 쓰기 (기본: TODO.md)",
    );
  });

  test("label pattern does not fire mid-string", () => {
    const s = "Flex tier, or Anthropic low priority at the session limit (auto)";
    expect(t.translateText(s)).toBe("Flex 티어, 또는 세션 한도에서 Anthropic low priority (자동)");
  });
});
