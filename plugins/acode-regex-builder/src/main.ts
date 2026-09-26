/**
 * Regex Builder (edify) — Acode plugin entry.
 * Builds a fluent-builder palette on a plugin page, renders the pattern with the
 * TS port of edify (byte-parity with Python), and tests it with the WebView RegExp
 * (translating Python-isms (?P<name>) / (?P=name) to JS (?<name>) / \k<name>).
 */
import plugin from "../plugin.json";
import { EdifyError, RegexBuilder } from "./edify/index";
import { PRESETS } from "./presets";

const CSS = `
.rb-panel{font-family:monospace;font-size:13px;background:var(--rb-bg,#15151e);color:#e8e8f0;
  display:flex;flex-direction:column;gap:8px;padding:10px;height:100%;box-sizing:border-box;overflow-y:auto}
.rb-title{font-weight:bold;color:#12bef0;font-size:14px}
.rb-sec{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.rb-btn{background:#252533;color:#e8e8f0;border:1px solid #3a3a4f;border-radius:4px;padding:4px 7px;
  font-family:monospace;font-size:12px;cursor:pointer}
.rb-btn:active{background:#12bef0;color:#111}
.rb-pattern{background:#0d0d14;border:1px solid #3a3a4f;border-radius:4px;padding:8px;word-break:break-all;
  white-space:pre-wrap;min-height:2.4em}
.rb-err{color:#ff6b6b;white-space:pre-wrap}
.rb-tag{font-size:10px;color:#8a8aa0}
.rb-input,textarea.rb-input,select.rb-input{background:#0d0d14;color:#e8e8f0;border:1px solid #3a3a4f;
  border-radius:4px;padding:4px 6px;font-family:monospace;font-size:12px;width:auto}
textarea.rb-test{width:100%;min-height:90px;box-sizing:border-box}
.rb-match{background:rgba(18,190,240,.35);border-radius:2px}
.rb-list{white-space:pre-wrap;color:#b8b8cc;max-height:180px;overflow-y:auto}
.rb-label{color:#8a8aa0}
.rb-flag{display:inline-flex;align-items:center;gap:3px}
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of children) node.append(child);
  return node;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Python named-group syntax -> JS, for the test panel only. */
function toJsCompatible(source: string): string {
  return source
    .replace(/\(\?P<([A-Za-z_][A-Za-z0-9_]*)>/g, "(?<$1>")
    .replace(/\(\?P=([A-Za-z_][A-Za-z0-9_]*)\)/g, "\\k<$1>");
}

const STATE_KEY = "edify-rb-state";

class RegexBuilderPlugin {
  private builder = new RegexBuilder();
  private history: RegexBuilder[] = [];
  private lastGood = "";
  private presetOverride: string | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private ui!: HTMLElement;
  private style!: HTMLStyleElement;
  private patternEl!: HTMLElement;
  private errEl!: HTMLElement;
  private testInput!: HTMLTextAreaElement;
  private resultsEl!: HTMLElement;
  private flagI!: HTMLInputElement;
  private flagM!: HTMLInputElement;
  private flagS!: HTMLInputElement;
  private literalInput!: HTMLInputElement;
  private baseUrl = "";

  async init($page: HTMLElement | null, baseUrl = ""): Promise<void> {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    this.style = el("style", { id: "rb-plugin-style" });
    this.style.textContent = CSS;
    document.head.append(this.style);
    this.ui = this.buildUi();
    if ($page) {
      $page.append(this.ui);
    } else {
      this.ui.style.position = "fixed";
      this.ui.style.inset = "0";
      this.ui.style.zIndex = "9999";
      document.body.append(this.ui);
    }
    this.restoreState();
    this.render();
  }

  destroy(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.ui?.remove();
    this.style?.remove();
  }

  private buildUi(): HTMLElement {
    const patternCard = el(
      "div",
      {},
      el("div", { class: "rb-sec" },
        el("span", { class: "rb-title" }, "Regex Builder"),
        el("span", { class: "rb-tag" }, `v${plugin.version} · edify port`),
      ),
      (this.patternEl = el("div", { class: "rb-pattern" })),
      (this.errEl = el("div", { class: "rb-err" })),
      el("div", { class: "rb-sec" },
        this.button("Copy", () => this.copy(this.currentPattern())),
        this.button("Insert", () => this.insert(this.currentPattern())),
        this.button("sel ⇐", () => this.loadSelection()),
        this.button("Reset", () => {
          this.builder = new RegexBuilder();
          this.presetOverride = null;
          this.history = [];
          this.render();
        }),
        this.button("Undo", () => this.undo()),
      ),
    );

    const presetSel = el("select", { class: "rb-input" }, el("option", { value: "" }, "presets…"));
    for (const preset of PRESETS) {
      presetSel.append(el("option", { value: preset.pattern }, preset.name));
    }
    presetSel.addEventListener("change", () => {
      if (presetSel.value) {
        this.presetOverride = presetSel.value;
        this.render();
      }
    });

    this.literalInput = el("input", { class: "rb-input", placeholder: "literal text" });
    const literalCard = el("div", { class: "rb-sec" },
      this.literalInput,
      this.button("string()", () => this.apply("string", this.literalInput.value || " ")),
      this.button("char()", () => this.apply("char", [...(this.literalInput.value || " ")][0] ?? " ")),
      el("span", { class: "rb-label" }, "presets:"),
      presetSel,
    );

    const btn = (label: string, method: string, ...args: unknown[]) =>
      this.button(label, () => this.apply(method, ...args));
    const classesCard = el("div", { class: "rb-sec" },
      btn("digit", "digit"), btn("non-digit", "non_digit"), btn("word", "word"), btn("non-word", "non_word"),
      btn("space", "whitespace_char"), btn("non-space", "non_whitespace_char"), btn("any .", "any_char"),
      btn("letter", "letter"), btn("upper", "uppercase"), btn("lower", "lowercase"), btn("alnum", "alphanumeric"),
      btn("tab", "tab"), btn("nl", "new_line"), btn("cr", "carriage_return"), btn("nul", "null_byte"),
    );
    const groupsCard = el("div", { class: "rb-sec" },
      btn("(?:)", "group"), btn("( )", "capture"),
      this.button("(?P<name>)", () => {
        const name = prompt("group name:") ?? "";
        if (name) this.apply("named_capture", name);
      }),
      this.button("\\1", () => {
        const index = Number(prompt("back-reference index:", "1") ?? "0");
        if (index >= 1) this.apply("back_reference", index);
      }),
      this.button("\\k<name>", () => {
        const name = prompt("named back-reference:") ?? "";
        if (name) this.apply("named_back_reference", name);
      }),
      btn("(?:a|b)", "any_of"), btn("[^…]", "anything_but_any_of"), btn("(?>)", "atomic"),
      btn("(?=)", "assert_ahead"), btn("(?!)", "assert_not_ahead"),
      btn("(?<=)", "assert_behind"), btn("(?<!)", "assert_not_behind"),
      btn("end ⏎", "end"),
    );
    const quantCard = el("div", { class: "rb-sec" },
      btn("?", "optional"), btn("*", "zero_or_more"), btn("+", "one_or_more"),
      btn("*?", "zero_or_more_lazy"), btn("+?", "one_or_more_lazy"),
      this.button("{n}", () => this.apply("exactly", Number(prompt("exactly n:", "3") ?? "0"))),
      this.button("{n,}", () => this.apply("at_least", Number(prompt("at least n:", "1") ?? "0"))),
      this.button("{0,n}", () => this.apply("at_most", Number(prompt("at most n:", "2") ?? "0"))),
      this.button("{l,u}", () => {
        const lower = Number(prompt("lower:", "1") ?? "0");
        const upper = Number(prompt("upper:", "3") ?? "0");
        this.apply("between", lower, upper);
      }),
    );
    const anchorsCard = el("div", { class: "rb-sec" },
      btn("^", "start_of_input"), btn("$", "end_of_input"),
      btn("\\b", "word_boundary"), btn("\\B", "non_word_boundary"),
      this.button("range", () => {
        const start = prompt("range start:", "a") ?? "";
        const end = prompt("range end:", "z") ?? "";
        this.apply("range", start, end);
      }),
      this.button("any_of chars", () => this.apply("any_of_chars", prompt("chars:", "abc") ?? "")),
      this.button("not chars", () => this.apply("anything_but_chars", prompt("chars:", "abc") ?? "")),
    );

    this.flagI = el("input", { type: "checkbox" }) as HTMLInputElement;
    this.flagM = el("input", { type: "checkbox" }) as HTMLInputElement;
    this.flagS = el("input", { type: "checkbox" }) as HTMLInputElement;
    for (const [box, label] of [[this.flagI, "i"], [this.flagM, "m"], [this.flagS, "s"]] as const) {
      box.addEventListener("change", () => this.runTester());
      box.parentElement?.replaceWith(el("label", { class: "rb-flag" }, box, label));
    }
    const flagsCard = el("div", { class: "rb-sec" },
      el("span", { class: "rb-label" }, "JS flags:"), this.flagI, this.flagM, this.flagS,
    );

    this.testInput = el("textarea", { class: "rb-input rb-test", placeholder: "test text…" });
    this.testInput.addEventListener("input", () => this.runTester());
    this.resultsEl = el("div", { class: "rb-list" });
    const testCard = el("div", {},
      el("span", { class: "rb-label" }, "tester"),
      this.testInput,
      this.resultsEl,
    );

    return el("div", { class: "rb-panel" },
      patternCard, literalCard, classesCard, groupsCard, quantCard, anchorsCard, flagsCard, testCard,
    );
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const node = el("button", { class: "rb-btn" }, label);
    node.addEventListener("click", onClick);
    return node;
  }

  private apply(method: string, ...args: unknown[]): void {
    this.presetOverride = null;
    const prev = this.builder;
    const surface = this.builder as unknown as Record<string, (...a: unknown[]) => RegexBuilder>;
    try {
      this.builder = surface[method](...args);
    } catch (err) {
      if (err instanceof EdifyError) {
        this.errEl.textContent = `${err.name}: ${err.message}`;
        return;
      }
      throw err;
    }
    this.history.push(prev);
    if (this.history.length > 50) this.history.shift();
    this.render();
  }

  private undo(): void {
    const prev = this.history.pop();
    if (prev === undefined) return;
    this.builder = prev;
    this.presetOverride = null;
    this.render();
  }

  private loadSelection(): void {
    const ed = (window as unknown as {
      editorManager?: {
        editor?: { getSelection?: () => string; getSelectedText?: () => string };
      };
    }).editorManager?.editor;
    const sel = ed?.getSelection?.() ?? ed?.getSelectedText?.();
    if (typeof sel === "string" && sel.trim()) {
      this.presetOverride = sel.trim();
      this.render();
    } else {
      this.errEl.textContent = "no selection";
    }
  }

  private restoreState(): void {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return;
      const state: unknown = JSON.parse(raw);
      if (typeof state !== "object" || state === null) return;
      const s = state as Record<string, unknown>;
      if (typeof s.lastGood === "string" && s.lastGood) this.presetOverride = s.lastGood;
      if (typeof s.test === "string") this.testInput.value = s.test;
      if (typeof s.i === "boolean") this.flagI.checked = s.i;
      if (typeof s.m === "boolean") this.flagM.checked = s.m;
      if (typeof s.s === "boolean") this.flagS.checked = s.s;
    } catch {
      /* WebView may deny localStorage — ignore */
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify({
          lastGood: this.currentPattern(),
          test: this.testInput.value,
          i: this.flagI.checked,
          m: this.flagM.checked,
          s: this.flagS.checked,
        }));
      } catch {
        /* WebView may deny localStorage — ignore */
      }
    }, 300);
  }

  private currentPattern(): string {
    return this.presetOverride ?? this.lastGood;
  }

  private render(): void {
    if (!this.presetOverride) {
      try {
        this.lastGood = this.builder.to_regex_string();
        this.errEl.textContent = "";
      } catch (err) {
        if (err instanceof EdifyError) {
          const stillOpen = !/Dangling|Subexpression/.test(err.name);
          this.errEl.textContent = stillOpen ? `…building (${err.name})` : `${err.name}: ${err.message}`;
        } else {
          this.errEl.textContent = String(err);
        }
      }
    } else {
      this.errEl.textContent = "";
    }
    this.patternEl.textContent = this.currentPattern() || "(empty pattern)";
    this.runTester();
  }

  private compileJs(): RegExp | null {
    const translated = toJsCompatible(this.currentPattern());
    let flags = "g";
    if (this.flagI.checked) flags += "i";
    if (this.flagM.checked) flags += "m";
    if (this.flagS.checked) flags += "s";
    const candidates = /\\p\{/.test(translated) ? [flags + "u", flags] : [flags];
    for (const candidate of candidates) {
      try {
        return new RegExp(translated, candidate);
      } catch {
        /* try next flag combination */
      }
    }
    return null;
  }

  private runTester(): void {
    this.scheduleSave();
    const text = this.testInput.value;
    if (!text || !this.currentPattern()) {
      this.resultsEl.textContent = "";
      return;
    }
    const regex = this.compileJs();
    if (!regex) {
      this.resultsEl.textContent = "invalid pattern for JS RegExp";
      return;
    }
    let highlighted = "";
    let cursor = 0;
    const lines: string[] = [];
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = regex.exec(text)) !== null && count < 200) {
      highlighted += escapeHtml(text.slice(cursor, match.index));
      highlighted += `<span class="rb-match">${escapeHtml(match[0])}</span>`;
      cursor = match.index + Math.max(match[0].length, 1);
      const named = Object.entries(match.groups ?? {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      lines.push(`#${count} @${match.index}: "${match[0]}"${named ? `  (${named})` : ""}`);
      if (match[0].length === 0) regex.lastIndex++;
      count++;
    }
    highlighted += escapeHtml(text.slice(cursor));
    const summary = count === 0 ? "no matches" : `${count} match${count === 1 ? "" : "es"}`;
    this.resultsEl.innerHTML = `${escapeHtml(summary)}\n${highlighted}\n${escapeHtml(lines.join("\n"))}`;
  }

  private async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const scratch = el("textarea", { style: "position:fixed;opacity:0" }, text);
      document.body.append(scratch);
      scratch.select();
      document.execCommand("copy");
      scratch.remove();
    }
  }

  private insert(text: string): void {
    const manager = (window as unknown as { editorManager?: { editor?: { insertSnippet?: (s: string) => void } } })
      .editorManager;
    if (manager?.editor?.insertSnippet) {
      manager.editor.insertSnippet(text);
    } else {
      void this.copy(text);
    }
  }
}

if (typeof window !== "undefined" && (window as unknown as { acode?: object }).acode) {
  const acodePlugin = new RegexBuilderPlugin();
  acode.setPluginInit(plugin.id, (baseUrl: string, $page: HTMLElement | null) => {
    void acodePlugin.init($page, baseUrl);
  });
  acode.setPluginUnmount(plugin.id, () => acodePlugin.destroy());
}
