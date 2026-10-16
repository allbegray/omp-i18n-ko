/**
 * omp-i18n-ko — Korean UI language pack for omp (oh-my-pi).
 *
 * Built strictly on the official extension API. Design constraint from
 * DECISIONS.md: this extension must NEVER break the host. Every failure path
 * degrades silently to the original English string, and removing the
 * extension leaves no trace behind.
 *
 * What it does:
 * - wraps the editor autocomplete provider (official `addAutocompleteProvider`
 *   factory contract) and translates each item's `description`,
 *   `nativeDetail`, and `state` fields;
 * - sets the working message to "생각 중…";
 * - registers `/ko` (toggle / on / off / status / reload / settings; default ON);
 * - opens a Korean settings panel (`/ko settings`, or just type `/settings`)
 *   by reusing the host's own pi-tui settings component with translated data
 *   and chrome — every omp module is imported dynamically and any failure
 *   quietly falls back to the built-in English `/settings`.
 *
 * Command names, model ids, MCP/SSH/LSP and other executable identifiers are
 * never touched. Translated text annotates command/feature keywords as
 * `한국어(english)` (e.g. "설정(settings) 메뉴 열기") so the original command
 * stays recognizable for typing.
 */
import { readFile, readdir, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSettingsModules, openSettingsPanel, settingsPanelStatus, type SettingsKoData } from "./ko/settings-panel";
import { createTranslator, type TranslationTable, type Translator } from "./translate";

// ---------------------------------------------------------------------------
// Minimal structural types.
//
// We intentionally do not import from `@oh-my-pi/*`: omp injects the real
// ExtensionAPI at runtime, and keeping the pack dependency-free means it can
// load from any extensions directory. Types below only describe the slice of
// the official API this pack touches (verified against omp v18.11.1).
// ---------------------------------------------------------------------------

interface AutocompleteItemLike {
  description?: string;
  nativeDetail?: string;
  state?: string;
  [key: string]: unknown;
}

interface AutocompleteResultLike {
  items: AutocompleteItemLike[];
  prefix: string;
}

interface AutocompleteProviderLike {
  getSuggestions?: (...args: unknown[]) => Promise<AutocompleteResultLike | null>;
  trySyncSlashCompletion?: (...args: unknown[]) => AutocompleteResultLike | null;
  [key: string]: unknown;
}

interface UIContextLike {
  addAutocompleteProvider?(factory: (current: AutocompleteProviderLike) => AutocompleteProviderLike): void;
  setWorkingMessage?(message?: string): void;
  notify?(message: string, type?: "info" | "warning" | "error"): void;
  custom?: unknown;
}

interface HandlerContextLike {
  ui?: UIContextLike;
  mode?: string;
  cwd?: string;
  models?: { list?(): unknown; current?(): unknown };
  model?: unknown;
}

interface ExtensionPiLike {
  on(event: string, handler: (event: unknown, ctx: HandlerContextLike) => unknown): void;
  registerCommand(
    name: string,
    options: { description?: string; handler: (args: string, ctx: HandlerContextLike) => unknown },
  ): void;
  /** Merged package namespace of the host (`pi.pi`), used by the settings panel. */
  pi?: { settings?: unknown } & Record<string, unknown>;
  getThinkingLevel?(): unknown;
  setThinkingLevel?(level: string): void;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const WORKING_MESSAGE = "생각 중…";
const USAGE = "사용법: /ko [toggle|on|off|status|reload|settings] (기본: toggle)";

let translator: Translator | null = null;
let enabled = true; // D3: language pack defaults to ON.

/** UI contexts we already hooked, so repeated session_start stays idempotent. */
const registeredUis = new WeakSet<object>();

function activeTranslator(): Translator | null {
  return enabled ? translator : null;
}

// ---------------------------------------------------------------------------
// Translation table loading
// ---------------------------------------------------------------------------

async function readTranslationsRaw(): Promise<string> {
  const selfPath = fileURLToPath(import.meta.url);
  const candidates = [fileURLToPath(new URL("./translations.json", import.meta.url))];

  // When index.ts is loaded through a symlink (the recommended install), the
  // module URL may point at the extensions directory instead of the repo, so
  // also try next to the resolved real location of this file.
  try {
    const realSelf = await realpath(selfPath);
    if (realSelf !== selfPath) candidates.push(join(dirname(realSelf), "translations.json"));
  } catch {
    // realpath unavailable — keep the direct candidate only.
  }

  let lastError: unknown;
  for (const path of candidates) {
    try {
      return await readFile(path, "utf8");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("translations.json not found");
}

async function loadTranslator(): Promise<Translator | null> {
  try {
    const parsed = JSON.parse(await readTranslationsRaw()) as TranslationTable;
    const next = createTranslator(parsed);
    return next.size > 0 ? next : null;
  } catch {
    return null;
  }
}

/** Load or reload the table; keeps the previous table when loading fails. */
async function reloadTranslator(): Promise<Translator | null> {
  const next = await loadTranslator();
  if (next) translator = next;
  return next;
}

// ---------------------------------------------------------------------------
// Settings translation data (src/ko-data/*.json)
// ---------------------------------------------------------------------------

let settingsData: SettingsKoData | null = null;

/**
 * Load every `ko-data/*.json` file next to translations.json: `chrome.json`
 * holds the panel chrome table, all other files hold per-tab per-setting
 * translations. Missing or broken files are skipped — every setting then
 * falls back to its original English text. (Exported for the boot probe.)
 */
export async function loadSettingsData(): Promise<SettingsKoData | null> {
  const selfPath = fileURLToPath(import.meta.url);
  const dirs = [dirname(fileURLToPath(new URL("./translations.json", import.meta.url)))];
  try {
    const realSelf = await realpath(selfPath);
    if (realSelf !== selfPath) dirs.push(dirname(realSelf));
  } catch {
    // realpath unavailable — keep the direct candidate only.
  }

  for (const dir of dirs) {
    try {
      const dataDir = join(dir, "ko-data");
      const files = await readdir(dataDir);
      const settings: Record<string, unknown> = {};
      const data: SettingsKoData = { settings: settings as SettingsKoData["settings"] };
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const parsed = JSON.parse(await readFile(join(dataDir, file), "utf8")) as Record<string, unknown>;
          if (file === "chrome.json") {
            data.chrome = parsed as SettingsKoData["chrome"];
            continue;
          }
          for (const [key, value] of Object.entries(parsed)) {
            if (key.startsWith("_") || !value || typeof value !== "object") continue;
            settings[key] = value;
          }
        } catch {
          // A broken file never blocks the others.
        }
      }
      if (data.chrome || Object.keys(settings).length > 0) return data;
    } catch {
      // Try the next candidate directory.
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// UI helpers (all no-throw)
// ---------------------------------------------------------------------------

function notifyOn(ctx: { ui?: UIContextLike } | undefined, message: string, type?: "info" | "warning" | "error"): void {
  try {
    ctx?.ui?.notify?.(message, type);
  } catch {
    // Notifications are best-effort.
  }
}

function applyWorkingMessage(ctx: { ui?: UIContextLike } | undefined, on: boolean): void {
  try {
    const ui = ctx?.ui;
    if (!ui?.setWorkingMessage) return;
    if (on) ui.setWorkingMessage(WORKING_MESSAGE);
    else ui.setWorkingMessage(); // no argument restores the built-in default
  } catch {
    // Ignore — the default message stays.
  }
}

// ---------------------------------------------------------------------------
// Autocomplete provider wrapping
// ---------------------------------------------------------------------------

function translateResult(result: AutocompleteResultLike | null, t: Translator): AutocompleteResultLike | null {
  if (!result || !Array.isArray(result.items)) return result;
  try {
    return {
      ...result,
      items: result.items.map(item => {
        try {
          return t.translateItem(item);
        } catch {
          return item;
        }
      }),
    };
  } catch {
    return result;
  }
}

/**
 * Wrap the provider with a Proxy so every other method (applyCompletion,
 * getInlineHint, future additions) keeps working untouched — the pack can
 * only translate items that pass through the suggestion feed.
 */
function makeProvider(current: AutocompleteProviderLike): AutocompleteProviderLike {
  return new Proxy(current, {
    get(target, prop) {
      const orig = Reflect.get(target, prop, target) as unknown;
      if (typeof orig !== "function") return orig;

      if (prop === "getSuggestions") {
        return (...args: unknown[]) => {
          const t = activeTranslator();
          if (t) {
            // Translate interim results too, if the caller listens for them.
            const maybePartial = args[4];
            if (typeof maybePartial === "function") {
              const userPartial = maybePartial as (result: AutocompleteResultLike) => void;
              args[4] = (result: AutocompleteResultLike) => {
                try {
                  userPartial(translateResult(result, t) ?? result);
                } catch {
                  try {
                    userPartial(result);
                  } catch {
                    /* caller's own error */
                  }
                }
              };
            }
          }
          const out = (orig as (...a: unknown[]) => Promise<AutocompleteResultLike | null>).apply(target, args);
          if (!t) return out;
          return out.then(result => translateResult(result, t));
        };
      }

      if (prop === "trySyncSlashCompletion") {
        return (...args: unknown[]) => {
          const result = (orig as (...a: unknown[]) => AutocompleteResultLike | null).apply(target, args);
          const t = activeTranslator();
          return t ? translateResult(result, t) : result;
        };
      }

      return (orig as (...a: unknown[]) => unknown).bind(target);
    },
  });
}

function registerProvider(ctx: { ui?: UIContextLike } | undefined): void {
  const ui = ctx?.ui;
  if (!ui || typeof ui.addAutocompleteProvider !== "function") return;
  if (registeredUis.has(ui)) return;
  try {
    ui.addAutocompleteProvider(current => {
      try {
        return makeProvider(current);
      } catch {
        return current;
      }
    });
    registeredUis.add(ui);
  } catch {
    // Older/newer hosts without this hook: silently skip.
  }
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function ompI18nKo(pi: ExtensionPiLike): void {
  pi.on("session_start", async (_event, ctx) => {
    try {
      if (!translator) await reloadTranslator();
      if (!settingsData) settingsData = await loadSettingsData();
      registerProvider(ctx);
      if (enabled) applyWorkingMessage(ctx, true);
    } catch {
      // Never break session start.
    }
    try {
      // Probe the settings modules once in interactive mode, so `/settings`
      // redirection and `/ko status` are accurate without a first-use delay.
      if (enabled && ctx.mode === "tui") await loadSettingsModules();
    } catch {
      // Reported through settingsPanelStatus().
    }
  });

  // Official `input` event: rewrite the built-in /settings to the Korean panel.
  // Gated on translation being on, the panel modules having loaded, and an
  // interactive terminal — otherwise the built-in English /settings runs.
  pi.on("input", (event, ctx) => {
    try {
      if (!enabled || !settingsData) return;
      if (ctx.mode !== "tui" || !settingsPanelStatus().ready) return;
      const text = (event as { text?: unknown } | undefined)?.text;
      if (typeof text !== "string" || text.trim() !== "/settings") return;
      return { text: "/ko settings" };
    } catch {
      return;
    }
  });

  pi.registerCommand("ko", {
    description: "한국어 UI — on/off/status/reload/settings",
    handler: async (args, ctx) => {
      try {
        const arg = (args ?? "").trim().toLowerCase();

        if (arg === "on") {
          enabled = true;
          applyWorkingMessage(ctx, true);
          notifyOn(ctx, "한국어 UI: 켜짐 — 다음 메뉴 렌더부터 적용");
          return;
        }
        if (arg === "off") {
          enabled = false;
          applyWorkingMessage(ctx, false);
          notifyOn(ctx, "한국어 UI: 꺼짐 — 영어 원문 표시");
          return;
        }
        if (arg === "status") {
          const size = translator?.size ?? 0;
          const panel = settingsPanelStatus();
          const panelText = panel.ready ? "준비" : "사용 불가";
          notifyOn(
            ctx,
            size > 0
              ? `한국어 UI: ${enabled ? "켜짐" : "꺼짐"} · 번역 ${size}개 · 설정 패널 ${panelText} · 기준 omp v18.11.1`
              : "한국어 UI: 번역 테이블 없음 (translations.json 로드 실패)",
          );
          return;
        }
        if (arg === "reload") {
          const loaded = await reloadTranslator();
          settingsData = (await loadSettingsData()) ?? settingsData;
          const settingsCount = Object.keys(settingsData?.settings ?? {}).length;
          if (!loaded) notifyOn(ctx, "번역 테이블 다시 로드 실패 — 이전 번역 유지", "warning");
          else notifyOn(ctx, `번역 테이블 다시 로드됨 (${loaded.size}개) · 설정 번역 ${settingsCount}개`);
          return;
        }
        if (arg === "settings") {
          if (!settingsData) settingsData = await loadSettingsData();
          if (!settingsData) {
            notifyOn(ctx, "설정 번역 데이터(ko-data)를 찾을 수 없습니다 — /settings(영문) 사용", "warning");
            return;
          }
          await openSettingsPanel({
            pi,
            ctx,
            data: settingsData,
            notify: (message, type) => notifyOn(ctx, message, type),
          });
          return;
        }
        if (arg && arg !== "toggle") {
          notifyOn(ctx, USAGE, "warning");
          return;
        }

        enabled = !enabled;
        applyWorkingMessage(ctx, enabled);
        notifyOn(ctx, `한국어 UI: ${enabled ? "켜짐" : "꺼짐"}`);
      } catch (error) {
        notifyOn(ctx, `omp-i18n-ko 오류: ${String(error)}`, "error");
      }
    },
  });
}
