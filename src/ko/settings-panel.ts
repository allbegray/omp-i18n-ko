/**
 * Korean settings panel — official-API-only overlay for omp.
 *
 * The panel reuses the host's own pi-tui `SettingsSelectorComponent` and feeds
 * it a `SettingsHost` rebuilt from the public settings registry
 * (`@oh-my-pi/pi-coding-agent/config/registry`, documented subpath). Korean
 * text enters in two places:
 *
 *   1. data text — entry labels, descriptions and enum option labels are
 *      translated through the per-setting table before they reach the
 *      component (so the built-in fuzzy search works in Korean too);
 *   2. chrome text — the component's own strings (title, tab strip, section
 *      sidebar, footer hints, search banner) are translated at the render
 *      boundary by `./line-translate`.
 *
 * Every omp module is imported dynamically and its absence is tolerated: when
 * anything cannot be loaded, the panel reports "unavailable" and the native
 * English `/settings` keeps working untouched.
 */

import { translateStyledLine, type ChromeRule, type Span } from "./line-translate";

type AnyRecord = Record<string, any>;

// ---------------------------------------------------------------------------
// Data shape (loaded from src/ko-data/*.json by index.ts)
// ---------------------------------------------------------------------------

/** Korean override for one option: a bare label, or label + description. */
export type OptionTranslation = string | { label?: string; description?: string };

export interface SettingsKoData {
  chrome?: {
    /** Title-line pairs ("Settings" -> "설정"). */
    title?: Array<[string, string]>;
    /** Tab-strip pairs ("Appearance" -> "모양"). */
    tabs?: Array<[string, string]>;
    /** Sidebar section names ("Theme" -> "테마"). */
    groups?: Array<[string, string]>;
    /** Free pairs applied on every line (submenu strings, option values). */
    pairs?: Array<[string, string]>;
    /** Pairs applied only on footer/hint rows (key glyph lines). */
    hintPairs?: Array<[string, string]>;
    /** Free regex patterns applied on every line, `$1`..`$9` supported. */
    patterns?: Array<[string, string]>;
  };
  settings?: Record<
    string,
    { label?: string; description?: string; options?: Record<string, OptionTranslation> }
  >;
}

// ---------------------------------------------------------------------------
// Module loading (dynamic, cached, never fatal)
// ---------------------------------------------------------------------------

interface SettingsModules {
  selector: AnyRecord;
  defs: AnyRecord;
  registry: AnyRecord;
  allSettings: AnyRecord;
  terminal: AnyRecord | null;
  nativeState: AnyRecord | null;
  pluginHost: AnyRecord | null;
}

let modules: SettingsModules | null = null;
let moduleError = "";

/** Import the omp modules the panel needs. Safe to call repeatedly. */
export async function loadSettingsModules(): Promise<{ ok: boolean; error: string }> {
  if (modules) return { ok: true, error: "" };
  try {
    const [selector, defs, registry, allSettings] = await Promise.all([
      import("@oh-my-pi/pi-tui/overlays/settings-selector"),
      import("@oh-my-pi/pi-tui/overlays/settings-defs"),
      import("@oh-my-pi/pi-coding-agent/config/registry"),
      import("@oh-my-pi/pi-coding-agent/config/all-settings"),
    ]);
    const optional = async (load: () => Promise<AnyRecord>): Promise<AnyRecord | null> => {
      try {
        return await load();
      } catch {
        return null;
      }
    };
    const terminal = await optional(() => import("@oh-my-pi/pi-tui") as Promise<AnyRecord>);
    const nativeState = await optional(() => import("@oh-my-pi/pi-tui/native/state") as Promise<AnyRecord>);
    const pluginHost = await optional(
      () => import("@oh-my-pi/pi-coding-agent/extensibility/plugins/settings-host") as Promise<AnyRecord>,
    );
    modules = {
      selector: selector as AnyRecord,
      defs: defs as AnyRecord,
      registry: registry as AnyRecord,
      allSettings: allSettings as AnyRecord,
      terminal,
      nativeState,
      pluginHost,
    };
    return { ok: true, error: "" };
  } catch (error) {
    moduleError = error instanceof Error ? error.message : String(error);
    return { ok: false, error: moduleError };
  }
}

export function settingsPanelStatus(): { ready: boolean; error: string } {
  return { ready: modules !== null, error: moduleError };
}

// ---------------------------------------------------------------------------
// Chrome rules
// ---------------------------------------------------------------------------

/** Title lines start with a frame corner. */
function isTitleLine(plain: string): boolean {
  const first = plain.trimStart()[0];
  return (first === "╭" || first === "┌" || first === "╔" || first === "+") && plain.includes("Settings");
}

/** The tab strip shows several tab labels on one line. */
const TAB_MARKERS = ["Appearance", "Model", "Interaction", "Context", "Memory", "Files"];
function isTabRow(plain: string): boolean {
  let seen = 0;
  for (const marker of TAB_MARKERS) {
    if (plain.includes(marker) && ++seen >= 4) return true;
  }
  return false;
}

/** Footer/hint rows carry key glyphs; free text never does. */
const HINT_GLYPHS = ["⏎", "␣", "⇥", "⎋", "⌃", "⇧", "Tab"];
const HINT_PHRASES = / to (?:change|cancel|select|close|go back|edit search|settings|configure|toggle|jump sections|switch tabs)/;
function isHintRow(plain: string): boolean {
  for (const glyph of HINT_GLYPHS) {
    if (plain.includes(glyph)) return true;
  }
  return plain.includes(" · ") && HINT_PHRASES.test(plain);
}

/**
 * Section names surface in two places, both times as the *only* text of a
 * `│`-delimited cell: the sidebar row (`│   Theme    │ ...`) and the list's
 * own group header (`... │   Theme    ... █ │`). A cell whose trailing
 * scrollbar/padding is stripped and that then equals a section name exactly
 * gets the Korean name — setting rows can never match, because their cell
 * also holds the value column.
 */
function groupNameCandidates(plain: string, groups: ReadonlyMap<string, string>): Span[] {
  const out: Span[] = [];
  let from = 0;
  while (from < plain.length) {
    const bar = plain.indexOf("│", from);
    const to = bar === -1 ? plain.length : bar;
    const segment = plain.slice(from, to);
    // Strip the scrollbar/trailing padding, then any leading cursor or icon
    // marker (`❯ Input`, `⌨ Interaction`) — section names never start with
    // punctuation, so only the bare name survives.
    const name = segment
      .replace(/[█\s]+$/u, "")
      .trim()
      .replace(/^[^\p{L}\p{N}]+/u, "");
    if (name) {
      const korean = groups.get(name);
      if (korean) {
        const start = from + segment.indexOf(name);
        out.push({ start, end: start + name.length, text: korean });
      }
    }
    if (bar === -1) break;
    from = bar + 1;
  }
  return out;
}

export function buildChromeRules(data: SettingsKoData): ChromeRule[] {
  const chrome = data?.chrome ?? {};
  const rules: ChromeRule[] = [];
  if (Array.isArray(chrome.title) && chrome.title.length > 0) {
    rules.push({ detect: isTitleLine, pairs: chrome.title });
  }
  if (Array.isArray(chrome.tabs) && chrome.tabs.length > 0) {
    rules.push({ detect: isTabRow, pairs: chrome.tabs });
  }
  if (Array.isArray(chrome.groups) && chrome.groups.length > 0) {
    // Cell-embedded names: section names (sidebar rows + group headers) and,
    // in search mode, the per-tab result headers (`⌨ Interaction`). Section
    // names win when a string exists in both tables.
    const names = new Map<string, string>();
    for (const entry of Array.isArray(chrome.tabs) ? chrome.tabs : []) {
      if (Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string") {
        names.set(entry[0], entry[1]);
      }
    }
    for (const entry of chrome.groups) {
      if (Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string") {
        names.set(entry[0], entry[1]);
      }
    }
    rules.push({ candidates: plain => groupNameCandidates(plain, names) });
  }
  if (Array.isArray(chrome.hintPairs) && chrome.hintPairs.length > 0) {
    rules.push({ detect: isHintRow, pairs: chrome.hintPairs });
  }
  if ((Array.isArray(chrome.pairs) && chrome.pairs.length > 0) || (Array.isArray(chrome.patterns) && chrome.patterns.length > 0)) {
    rules.push({ pairs: chrome.pairs, patterns: chrome.patterns });
  }
  return rules;
}

// ---------------------------------------------------------------------------
// Settings host (registry → SettingsHost)
// ---------------------------------------------------------------------------

function isLimitRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveLimit(limit: unknown): limit is number {
  return typeof limit === "number" && Number.isFinite(limit) && limit > 0;
}

/** Mirror of the host's `normalizeProviderMaxInFlightRequests`. */
function normalizeProviderLimits(value: unknown): Record<string, number> {
  const normalized: Record<string, number> = {};
  if (!isLimitRecord(value)) return normalized;
  for (const provider in value) {
    const limit = value[provider];
    if (isPositiveLimit(limit)) normalized[provider] = Math.max(1, Math.floor(limit));
  }
  return normalized;
}

/** Mirror of the host's `validateProviderMaxInFlightRequests`. */
function validateProviderLimits(value: unknown): Record<string, number> {
  if (isLimitRecord(value)) {
    const invalid: string[] = [];
    for (const provider in value) {
      if (!isPositiveLimit(value[provider])) invalid.push(provider);
    }
    if (invalid.length > 0) {
      throw new Error(`Provider request limits must be positive numbers: ${invalid.join(", ")}`);
    }
  }
  return normalizeProviderLimits(value);
}

/** Mirrors the host's env-note suffix, in Korean. */
function envNote(setting: AnyRecord): string {
  try {
    const name = setting?.envName;
    if (typeof name !== "string" || name.length === 0) return "";
    const value = typeof setting.envValue === "function" ? setting.envValue() : undefined;
    if (value === undefined) return "";
    return setting.envFallback
      ? ` 미설정 시 $${name}로 폴백.`
      : ` 설정 중에는 $${name}가 이 값을 덮어씀.`;
  } catch {
    return "";
  }
}

export function translateOptions(
  options: unknown,
  map: Record<string, OptionTranslation> | undefined,
): unknown {
  if (!map || !Array.isArray(options)) return options;
  return options.map((option: unknown) => {
    if (!option || typeof option !== "object") return option;
    const value = (option as AnyRecord).value;
    const entry = typeof value === "string" ? map[value] : undefined;
    if (!entry) return option;
    const patch: AnyRecord = {};
    if (typeof entry === "string") {
      patch.label = entry;
    } else {
      if (typeof entry.label === "string") patch.label = entry.label;
      // Replace literal host descriptions only; a future dynamic (function)
      // description would keep its live behavior.
      const hostDesc = (option as AnyRecord).description;
      if (typeof entry.description === "string" && (hostDesc === undefined || typeof hostDesc === "string")) {
        patch.description = entry.description;
      }
    }
    return Object.keys(patch).length > 0 ? { ...(option as AnyRecord), ...patch } : option;
  });
}

function buildConditions(
  mods: SettingsModules,
  scope: unknown,
): Record<string, () => boolean> {
  const read = (id: string): unknown => {
    try {
      return mods.registry.lookup?.(id)?.get?.(scope);
    } catch {
      return undefined;
    }
  };
  const conditions: Record<string, () => boolean> = {
    macOS: () => process.platform === "darwin",
    advisorEnabled: () => read("advisor.enabled") === true,
    vimModeEnabled: () => read("tui.vimMode") === true,
    hindsightActive: () => read("memory.backend") === "hindsight",
    mnemopiActive: () => read("memory.backend") === "mnemopi",
    autolearnActive: () => read("autolearn.enabled") === true,
    autoThinkingActive: () => read("defaultThinkingLevel") === "auto",
    usageAwareFallbackEnabled: () => read("retry.usageAwareFallback") === true,
    planModeEnabled: () => read("plan.enabled") === true,
    planAutosaveEnabled: () => read("plan.enabled") === true && read("plan.autosave") === true,
    contextFilesExtraNotProject: () => {
      try {
        return mods.registry.lookup?.("contextFiles.extra")?.provenance?.(scope) !== "project";
      } catch {
        return false;
      }
    },
  };
  const terminal = mods.terminal as AnyRecord | null;
  if (terminal?.TERMINAL) {
    conditions.hasImageProtocol = () => !!terminal.TERMINAL.imageProtocol;
  }
  const nativeState = mods.nativeState as AnyRecord | null;
  if (typeof nativeState?.isNativeRendering === "function") {
    conditions.nativeRendering = () => !!nativeState.isNativeRendering();
  }
  return conditions;
}

function buildHost(mods: SettingsModules, data: SettingsKoData, scope: unknown): AnyRecord {
  const tabs: string[] = Array.isArray(mods.defs.SETTING_TABS) ? [...mods.defs.SETTING_TABS] : [];
  const perTab = new Map<string, AnyRecord[]>();
  for (const tab of tabs) perTab.set(tab, []);
  const conditions = buildConditions(mods, scope);

  const settings = typeof mods.allSettings.orderedSettings === "function"
    ? mods.allSettings.orderedSettings()
    : mods.registry.all?.() ?? [];

  for (const setting of Array.isArray(settings) ? settings : []) {
    try {
      const ui = setting?.ui as AnyRecord | undefined;
      const tab = ui?.tab;
      if (typeof tab !== "string" || !perTab.has(tab)) continue;
      const translation = data.settings?.[setting.id];
      let description = translation?.description ?? ui?.description;
      if (typeof description === "string") description = description + envNote(setting);
      const entry: AnyRecord = {
        path: setting.id,
        type: setting.type,
        defaultValue: setting.default,
        ui: {
          ...ui,
          label: translation?.label ?? ui?.label,
          ...(typeof description === "string" ? { description } : {}),
          options: translateOptions(ui?.options, translation?.options),
        },
        enumValues: setting.enumValues,
        credential: setting.isCredential,
        condition: typeof ui?.condition === "string" ? conditions[ui.condition] : undefined,
      };
      perTab.get(tab)!.push(entry);
    } catch {
      // A single unreadable setting never blocks the panel.
    }
  }

  const entries: AnyRecord[] = [];
  for (const tab of tabs) entries.push(...(perTab.get(tab) ?? []));

  return {
    entries,
    get: (path: string) => mods.registry.lookup?.(path)?.layered?.(scope),
    set: (path: string, value: unknown) => mods.registry.lookup?.(path)?.set?.(scope, value),
    unset: (path: string) => mods.registry.lookup?.(path)?.unset?.(scope),
    normalizeProviderLimits,
    validateProviderLimits,
  };
}

// ---------------------------------------------------------------------------
// Runtime context helpers
// ---------------------------------------------------------------------------

async function loadThemes(ctx: AnyRecord, piPi: AnyRecord | null): Promise<string[]> {
  const names = new Set<string>();
  try {
    const list = await (ctx?.ui?.getAllThemes?.() ?? piPi?.getAvailableThemes?.());
    for (const item of Array.isArray(list) ? list : []) {
      const name = typeof item === "string" ? item : item?.name;
      if (typeof name === "string" && name.length > 0) names.add(name);
    }
  } catch {
    // Themes are cosmetic; an empty list just trims the options.
  }
  return [...names];
}

function loadProviders(ctx: AnyRecord): string[] {
  try {
    const models = ctx?.models?.list?.();
    const names = new Set<string>();
    for (const model of Array.isArray(models) ? models : []) {
      const provider = model?.provider;
      if (typeof provider === "string" && provider.length > 0) names.add(provider);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function loadThinkingLevels(ctx: AnyRecord, lookup: AnyRecord["lookup"]): string[] {
  try {
    const model = ctx?.model ?? ctx?.models?.current?.();
    if (model?.reasoning) {
      const efforts = model?.thinking?.efforts;
      if (Array.isArray(efforts) && efforts.length > 0) return [...efforts];
    }
  } catch {
    // fall through to the declared options
  }
  try {
    const options = lookup?.("defaultThinkingLevel")?.ui?.options;
    if (Array.isArray(options)) {
      return options
        .map((option: AnyRecord) => option?.value)
        .filter((value: unknown): value is string => typeof value === "string" && value !== "auto");
    }
  } catch {
    // fall through to empty
  }
  return [];
}

function stubPluginHost(): AnyRecord {
  const manager = {
    list: async () => [],
    getPlugin: async () => undefined,
    getPluginSettings: async () => ({}),
    setEnabled: async () => {},
    getEnabledFeatures: async () => null,
    setEnabledFeatures: async () => {},
    setPluginSetting: async () => {},
  };
  return {
    manager,
    createMarketplaceManager: async () => ({ listInstalledPlugins: async () => [], setPluginEnabled: async () => {} }),
    parsePluginId: () => null,
  };
}

function buildPluginHost(mods: SettingsModules, cwd: string): AnyRecord {
  try {
    const factory = mods.pluginHost?.createPluginSettingsHost;
    if (typeof factory === "function") {
      const host = factory(cwd || process.cwd());
      if (host?.manager) return host;
    }
  } catch {
    // fall through to the stub
  }
  return stubPluginHost();
}

/** Mirror of the host's settings-change side effects (thinking level only). */
function onChangeEffect(pi: AnyRecord, path: string, value: unknown): void {
  if (path !== "defaultThinkingLevel") return;
  if (typeof value !== "string" || value === "auto" || value.length === 0) return;
  try {
    pi.setThinkingLevel?.(value);
  } catch {
    // Setting the session thinking level is best-effort.
  }
}

// ---------------------------------------------------------------------------
// Render wrapper
// ---------------------------------------------------------------------------

/**
 * Wrap the real component with a Proxy: `render` output passes through the
 * line translator, native-description hooks are hidden so the ANSI path is
 * always used (the one we can translate), and every other member is forwarded
 * with `this` bound to the instance (private fields keep working).
 */
function wrapTranslated(inner: AnyRecord, translate: (line: string) => string): AnyRecord {
  const overrides: Record<string, unknown> = {
    render: (width: number): string[] => {
      const lines = inner.render(width);
      return Array.isArray(lines) ? lines.map(line => translate(line)) : lines;
    },
    describe: undefined,
    describeScreen: undefined,
    describeSurface: undefined,
    dispose: () => {
      try {
        inner.dispose?.();
      } catch {
        // Disposal is best-effort.
      }
    },
  };
  return new Proxy(inner, {
    get(target, prop) {
      if (prop in overrides) return overrides[prop as string];
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(target, prop) {
      if (prop in overrides && overrides[prop as string] === undefined) return false;
      if (prop in overrides) return true;
      return Reflect.has(target, prop);
    },
  });
}

// ---------------------------------------------------------------------------
// Panel entry point
// ---------------------------------------------------------------------------

export interface OpenSettingsOptions {
  /** The extension API surface (the `pi` object handed to the extension). */
  pi: unknown;
  /** Handler/command context: needs `ui`, `mode`, and optionally `models`, `cwd`. */
  ctx: unknown;
  /** Loaded Korean data (chrome + per-setting translations). */
  data: SettingsKoData;
  /** Notification sink (never throws). */
  notify?: (message: string, type?: "info" | "warning" | "error") => void;
}

let panelOpen = false;

/**
 * Open the Korean settings overlay. Returns true when the overlay was shown
 * and closed by the user; false when it could not be opened.
 */
export async function openSettingsPanel(options: OpenSettingsOptions): Promise<boolean> {
  const pi = options.pi as AnyRecord;
  const ctx = options.ctx as AnyRecord;
  const data = options.data;
  const notify = (message: string, type?: "info" | "warning" | "error"): void => {
    try {
      options.notify?.(message, type);
    } catch {
      // Best-effort.
    }
  };

  if (panelOpen) return false;
  if (ctx?.mode !== "tui" || typeof ctx?.ui?.custom !== "function") {
    notify("한국어 설정 패널은 대화형(TUI) 모드 전용", "warning");
    return false;
  }

  const loaded = await loadSettingsModules();
  if (!loaded.ok) {
    notify(`한국어 설정 패널 로드 실패 → /settings(영문) 사용 (${loaded.error})`, "warning");
    return false;
  }
  const mods = modules!;

  const scope = pi?.pi?.settings;
  if (!scope) {
    notify("설정 저장소(pi.pi.settings) 없음 → /settings(영문) 사용", "warning");
    return false;
  }

  try {
    const rules = buildChromeRules(data);
    const translate = (line: string): string => translateStyledLine(line, rules);
    const host = buildHost(mods, data, scope);
    const plugins = buildPluginHost(mods, typeof ctx.cwd === "string" ? ctx.cwd : process.cwd());
    const availableThemes = await loadThemes(ctx, pi.pi ?? null);
    const providers = loadProviders(ctx);
    const availableThinkingLevels = loadThinkingLevels(ctx, mods.registry.lookup);
    let thinkingLevel: string | undefined;
    try {
      const level = pi.getThinkingLevel?.();
      if (typeof level === "string" && level.length > 0) thinkingLevel = level;
    } catch {
      // Reported as undefined; the panel still works.
    }

    const renderRef: { request?: () => void } = {};

    panelOpen = true;
    try {
      await ctx.ui.custom(
        (tui: AnyRecord, _theme: unknown, _keybindings: unknown, done: (result: unknown) => void) => {
          renderRef.request = () => {
            try {
              tui?.requestRender?.();
            } catch {
              // Repaint is best-effort.
            }
          };
          const inner = new mods.selector.SettingsSelectorComponent(
            {
              availableThinkingLevels,
              thinkingLevel,
              availableThemes,
              providers,
              settings: host,
              plugins,
              requestRender: () => renderRef.request?.(),
            },
            {
              onChange: (path: string, value: unknown) => onChangeEffect(pi, path, value),
              onCancel: () => {
                try {
                  done(undefined);
                } catch {
                  // Already closed.
                }
              },
            },
          );
          return wrapTranslated(inner, translate);
        },
        {
          overlay: true,
          overlayOptions: {
            anchor: "bottom-center",
            width: "100%",
            maxHeight: "100%",
            margin: 0,
            fullscreen: true,
          },
        },
      );
    } finally {
      panelOpen = false;
    }
    return true;
  } catch (error) {
    panelOpen = false;
    const message = error instanceof Error ? error.message : String(error);
    notify(`한국어 설정 패널 오류: ${message} → /settings(영문) 사용`, "error");
    return false;
  }
}
