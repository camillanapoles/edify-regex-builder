/** Fluent RegexBuilder — TypeScript port of edify.builder (RegexBuilder/Pattern surface). */

import { escapeForCharClass, escapeRangeBound, escapeSpecial } from "./escape";
import {
  CannotCallSubexpressionError,
  CannotCreateDuplicateNamedGroupError,
  CannotDefineStartAfterEndError,
  CannotEndWhileBuildingRootExpressionError,
  DanglingQuantifierError,
  EndInputAlreadyDefinedError,
  InvalidTotalCaptureGroupsIndexError,
  MustBeAtLeastOneLiteralError,
  MustBeIntegerGreaterThanZeroError,
  MustBeLessThanError,
  MustBeOneCharacterError,
  MustBePositiveIntegerError,
  MustBeSingleCharacterError,
  MustHaveASmallerValueError,
  NameNotValidError,
  NamedGroupDoesNotExistError,
  StackedQuantifierError,
  StartInputAlreadyDefinedError,
  UnsupportedFlagError,
} from "./errors";
import { mergeChildren } from "./merge";
import { renderElement } from "./render";
import {
  cloneState,
  initialState,
  withElementAddedToTop,
  withFramePushed,
  withTopFramePopped,
  type BuilderState,
  type PendingQuantifier,
  type StackFrame,
} from "./state";
import type { Element, LeafKind, QuantifierElement } from "./types";

const VALID_GROUP_NAME = /^[a-z]+\w*$/i;
const ESCAPED_SPACE = "\\ ";
const RAW_SPACE = " ";

function codepoints(value: string): number {
  return Array.from(value).length;
}

function ensureNonEmpty(label: string, value: string): void {
  if (codepoints(value) === 0) throw new MustBeOneCharacterError(`${label} must not be empty`);
}

function ensureSingleCharacter(label: string, value: string): void {
  if (codepoints(value) !== 1) throw new MustBeSingleCharacterError(`${label} must be a single character`);
}

function ensureAscending(first: string, second: string): void {
  const left = first.codePointAt(0) ?? 0;
  const right = second.codePointAt(0) ?? 0;
  if (left >= right) throw new MustHaveASmallerValueError("range bounds must be in ascending codepoint order");
}

function ensurePositiveInteger(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) throw new MustBePositiveIntegerError(`${label} must be a positive integer`);
}

function ensureNonNegativeInteger(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new MustBeIntegerGreaterThanZeroError(`${label} must be a non-negative integer`);
  }
}

function ensureStrictlyAscending(lower: number, upper: number): void {
  if (lower >= upper) throw new MustBeLessThanError("lower must be strictly less than upper");
}

function literalToElement(literal: string): Element {
  ensureNonEmpty("literal", literal);
  const escaped = escapeSpecial(literal);
  return codepoints(literal) === 1 ? { kind: "char", value: escaped } : { kind: "string", value: escaped };
}

export interface CompiledRegex {
  source: string;
  flags: string;
}

export interface ToRegexOptions {
  ignoreCase?: boolean;
  multiline?: boolean;
  dotAll?: boolean;
}

export class RegexBuilder {
  private readonly state: BuilderState;

  constructor(state: BuilderState = initialState()) {
    this.state = state;
  }

  private withState(newState: BuilderState): RegexBuilder {
    return new RegexBuilder(newState);
  }

  private addElement(element: Element): RegexBuilder {
    return this.withState(withElementAddedToTop(this.state, element));
  }

  private addLeaf(kind: LeafKind): RegexBuilder {
    return this.addElement({ kind });
  }

  private openFrame(typeNode: Element): RegexBuilder {
    const frame: StackFrame = { typeNode, pending: null, children: [] };
    return this.withState(withFramePushed(this.state, frame));
  }

  private setPending(factory: (child: Element) => Element, name: string): RegexBuilder {
    const next = cloneState(this.state);
    const top = next.stack[next.stack.length - 1];
    if (top.pending) throw new StackedQuantifierError(`quantifier already pending before ${name}`);
    const pending: PendingQuantifier = { factory, name };
    next.stack[next.stack.length - 1] = { ...top, pending };
    return this.withState(next);
  }

  private addLiteralAlternation(literals: string[]): RegexBuilder {
    return this.addElement({ kind: "any_of", children: literals.map(literalToElement) });
  }

  // ---- chars ----
  string(value: string): RegexBuilder {
    ensureNonEmpty("value", value);
    const escaped = escapeSpecial(value);
    return this.addElement(codepoints(value) === 1 ? { kind: "char", value: escaped } : { kind: "string", value: escaped });
  }

  char(value: string): RegexBuilder {
    ensureSingleCharacter("value", value);
    return this.addElement({ kind: "char", value: escapeSpecial(value) });
  }

  range(startCharacter: string, endCharacter: string): RegexBuilder {
    ensureSingleCharacter("start_character", startCharacter);
    ensureSingleCharacter("end_character", endCharacter);
    ensureAscending(startCharacter, endCharacter);
    return this.addElement({
      kind: "range",
      start: escapeRangeBound(startCharacter),
      end: escapeRangeBound(endCharacter),
    });
  }

  any_of_chars(characters: string): RegexBuilder {
    return this.addElement({ kind: "any_of_chars", value: escapeForCharClass(characters) });
  }

  anything_but_string(value: string): RegexBuilder {
    ensureNonEmpty("value", value);
    return this.addElement({ kind: "anything_but_string", value: escapeSpecial(value) });
  }

  anything_but_chars(characters: string): RegexBuilder {
    ensureNonEmpty("characters", characters);
    return this.addElement({ kind: "anything_but_chars", value: escapeForCharClass(characters) });
  }

  anything_but_range(startCharacter: string, endCharacter: string): RegexBuilder {
    ensureSingleCharacter("start_character", startCharacter);
    ensureSingleCharacter("end_character", endCharacter);
    ensureAscending(startCharacter, endCharacter);
    return this.addElement({
      kind: "anything_but_range",
      start: escapeRangeBound(startCharacter),
      end: escapeRangeBound(endCharacter),
    });
  }

  // ---- classes (leaf one-liners) ----
  any_char(): RegexBuilder { return this.addLeaf("any_char"); }
  whitespace_char(): RegexBuilder { return this.addLeaf("whitespace_char"); }
  non_whitespace_char(): RegexBuilder { return this.addLeaf("non_whitespace_char"); }
  digit(): RegexBuilder { return this.addLeaf("digit"); }
  non_digit(): RegexBuilder { return this.addLeaf("non_digit"); }
  word(): RegexBuilder { return this.addLeaf("word"); }
  non_word(): RegexBuilder { return this.addLeaf("non_word"); }
  word_boundary(): RegexBuilder { return this.addLeaf("word_boundary"); }
  non_word_boundary(): RegexBuilder { return this.addLeaf("non_word_boundary"); }
  new_line(): RegexBuilder { return this.addLeaf("new_line"); }
  carriage_return(): RegexBuilder { return this.addLeaf("carriage_return"); }
  tab(): RegexBuilder { return this.addLeaf("tab"); }
  null_byte(): RegexBuilder { return this.addLeaf("null_byte"); }
  letter(): RegexBuilder { return this.addLeaf("letter"); }
  unicode_letter(): RegexBuilder { return this.addLeaf("unicode_letter"); }
  unicode_uppercase(): RegexBuilder { return this.addLeaf("unicode_uppercase"); }
  unicode_lowercase(): RegexBuilder { return this.addLeaf("unicode_lowercase"); }
  unicode_alphanumeric(): RegexBuilder { return this.addLeaf("unicode_alphanumeric"); }
  uppercase(): RegexBuilder { return this.addLeaf("uppercase"); }
  lowercase(): RegexBuilder { return this.addLeaf("lowercase"); }
  alphanumeric(): RegexBuilder { return this.addLeaf("alphanumeric"); }

  // ---- anchors ----
  start_of_input(): RegexBuilder {
    if (this.state.hasStart) throw new StartInputAlreadyDefinedError();
    if (this.state.hasEnd) throw new CannotDefineStartAfterEndError();
    const next = cloneState(this.state);
    next.hasStart = true;
    return this.withState(withElementAddedToTop(next, { kind: "start_of_input" }));
  }

  end_of_input(): RegexBuilder {
    if (this.state.hasEnd) throw new EndInputAlreadyDefinedError();
    const next = cloneState(this.state);
    next.hasEnd = true;
    return this.withState(withElementAddedToTop(next, { kind: "end_of_input" }));
  }

  // ---- quantifiers (set the pending quantifier) ----
  optional(): RegexBuilder {
    return this.setPending((child) => ({ kind: "optional", child }), "optional()");
  }
  zero_or_more(): RegexBuilder {
    return this.setPending((child) => ({ kind: "zero_or_more", child }), "zero_or_more()");
  }
  zero_or_more_lazy(): RegexBuilder {
    return this.setPending((child) => ({ kind: "zero_or_more_lazy", child }), "zero_or_more_lazy()");
  }
  one_or_more(): RegexBuilder {
    return this.setPending((child) => ({ kind: "one_or_more", child }), "one_or_more()");
  }
  one_or_more_lazy(): RegexBuilder {
    return this.setPending((child) => ({ kind: "one_or_more_lazy", child }), "one_or_more_lazy()");
  }
  exactly(count: number): RegexBuilder {
    ensurePositiveInteger("count", count);
    return this.setPending((child) => ({ kind: "exactly", child, n: count }), `exactly(${count})`);
  }
  at_least(count: number): RegexBuilder {
    ensurePositiveInteger("count", count);
    return this.setPending((child) => ({ kind: "at_least", child, n: count }), `at_least(${count})`);
  }
  at_most(count: number): RegexBuilder {
    ensurePositiveInteger("count", count);
    return this.setPending((child) => ({ kind: "at_most", child, n: count }), `at_most(${count})`);
  }
  between(lower: number, upper: number): RegexBuilder {
    ensureNonNegativeInteger("lower", lower);
    ensurePositiveInteger("upper", upper);
    ensureStrictlyAscending(lower, upper);
    return this.setPending(
      (child) => ({ kind: "between", child, lower, upper }),
      `between(${lower}, ${upper})`,
    );
  }
  between_lazy(lower: number, upper: number): RegexBuilder {
    ensureNonNegativeInteger("lower", lower);
    ensurePositiveInteger("upper", upper);
    ensureStrictlyAscending(lower, upper);
    return this.setPending(
      (child) => ({ kind: "between_lazy", child, lower, upper }),
      `between_lazy(${lower}, ${upper})`,
    );
  }
  optional_possessive(): RegexBuilder {
    return this.setPending((child) => ({ kind: "optional_possessive", child }), "optional_possessive()");
  }
  zero_or_more_possessive(): RegexBuilder {
    return this.setPending((child) => ({ kind: "zero_or_more_possessive", child }), "zero_or_more_possessive()");
  }
  one_or_more_possessive(): RegexBuilder {
    return this.setPending((child) => ({ kind: "one_or_more_possessive", child }), "one_or_more_possessive()");
  }
  at_least_possessive(count: number): RegexBuilder {
    ensurePositiveInteger("count", count);
    return this.setPending((child) => ({ kind: "at_least_possessive", child, n: count }), `at_least_possessive(${count})`);
  }
  at_most_possessive(count: number): RegexBuilder {
    ensurePositiveInteger("count", count);
    return this.setPending((child) => ({ kind: "at_most_possessive", child, n: count }), `at_most_possessive(${count})`);
  }
  between_possessive(lower: number, upper: number): RegexBuilder {
    ensureNonNegativeInteger("lower", lower);
    ensurePositiveInteger("upper", upper);
    ensureStrictlyAscending(lower, upper);
    return this.setPending(
      (child) => ({ kind: "between_possessive", child, lower, upper }),
      `between_possessive(${lower}, ${upper})`,
    );
  }

  // ---- groups / assertions ----
  any_of(...literals: string[]): RegexBuilder {
    if (literals.length === 0) return this.openFrame({ kind: "any_of" });
    return this.addLiteralAlternation(literals);
  }

  one_of(...literals: string[]): RegexBuilder {
    if (literals.length === 0) throw new MustBeAtLeastOneLiteralError("one_of requires at least one literal");
    return this.addLiteralAlternation(literals);
  }

  anything_but_any_of(): RegexBuilder {
    return this.openFrame({ kind: "anything_but_any_of" });
  }

  group(): RegexBuilder {
    return this.openFrame({ kind: "group" });
  }

  atomic(): RegexBuilder {
    return this.openFrame({ kind: "atomic" });
  }

  assert_ahead(): RegexBuilder { return this.openFrame({ kind: "assert_ahead" }); }
  assert_not_ahead(): RegexBuilder { return this.openFrame({ kind: "assert_not_ahead" }); }
  assert_behind(): RegexBuilder { return this.openFrame({ kind: "assert_behind" }); }
  assert_not_behind(): RegexBuilder { return this.openFrame({ kind: "assert_not_behind" }); }

  // ---- captures ----
  capture(): RegexBuilder {
    const next = cloneState(this.state);
    next.totalCaptureGroups += 1;
    return this.withState(withFramePushed(next, { typeNode: { kind: "capture" }, pending: null, children: [] }));
  }

  named_capture(name: string): RegexBuilder {
    if (!VALID_GROUP_NAME.test(name)) throw new NameNotValidError(`invalid group name: ${name}`);
    if (this.state.namedGroups.includes(name)) throw new CannotCreateDuplicateNamedGroupError(`duplicate group name: ${name}`);
    const next = cloneState(this.state);
    next.namedGroups = [...next.namedGroups, name];
    next.totalCaptureGroups += 1;
    return this.withState(withFramePushed(next, { typeNode: { kind: "named_capture", name, children: [] }, pending: null, children: [] }));
  }

  back_reference(index: number): RegexBuilder {
    if (!Number.isInteger(index) || index < 1 || index > this.state.totalCaptureGroups) {
      throw new InvalidTotalCaptureGroupsIndexError(`back-reference ${index} out of range`);
    }
    return this.addElement({ kind: "back_reference", index });
  }

  named_back_reference(name: string): RegexBuilder {
    if (!this.state.namedGroups.includes(name)) {
      throw new NamedGroupDoesNotExistError(`unknown group name: ${name}`);
    }
    return this.addElement({ kind: "named_back_reference", name });
  }

  // ---- chain ----
  end(): RegexBuilder {
    if (this.state.stack.length <= 1) throw new CannotEndWhileBuildingRootExpressionError("no open frame to end");
    const { state, popped } = withTopFramePopped(this.state);
    const children = popped.children;
    let closed: Element;
    switch (popped.typeNode.kind) {
      case "named_capture":
        closed = { kind: "named_capture", name: popped.typeNode.name, children };
        break;
      default:
        closed = { kind: popped.typeNode.kind, children } as Element;
    }
    return this.withState(withElementAddedToTop(state, closed));
  }

  // ---- flags ----
  private toggleFlag(field: keyof BuilderState["flags"]): RegexBuilder {
    const next = cloneState(this.state);
    next.flags[field] = true;
    return this.withState(next);
  }

  ascii_only(): RegexBuilder { return this.toggleFlag("asciiOnly"); }
  debug(): RegexBuilder { return this.toggleFlag("debug"); }
  ignore_case(): RegexBuilder { return this.toggleFlag("ignoreCase"); }
  multi_line(): RegexBuilder { return this.toggleFlag("multiLine"); }
  dot_all(): RegexBuilder { return this.toggleFlag("dotAll"); }
  verbose(): RegexBuilder { return this.toggleFlag("verbose"); }

  // ---- subexpression / composition ----
  use(pattern: RegexBuilder): RegexBuilder {
    return this.subexpression(pattern);
  }

  subexpression(
    expression: RegexBuilder,
    namespace = "",
    ignoreFlags = true,
    ignoreStartAndEnd = true,
  ): RegexBuilder {
    if (expression.state.stack.length !== 1) {
      throw new CannotCallSubexpressionError("expression still has open frames");
    }
    const context = {
      captureIndexOffset: this.state.totalCaptureGroups,
      namespace,
      ignoreStartAndEnd,
      parentHasStart: this.state.hasStart,
      parentHasEnd: this.state.hasEnd,
    };
    const merged = mergeChildren(expression.state.stack[0].children, context);
    const next = withElementAddedToTop(this.state, { kind: "subexpression", children: merged.children });
    next.totalCaptureGroups += merged.capturesAdded;
    if (!ignoreFlags) {
      const other = expression.state.flags;
      next.flags = {
        asciiOnly: next.flags.asciiOnly || other.asciiOnly,
        debug: next.flags.debug || other.debug,
        ignoreCase: next.flags.ignoreCase || other.ignoreCase,
        multiLine: next.flags.multiLine || other.multiLine,
        dotAll: next.flags.dotAll || other.dotAll,
        verbose: next.flags.verbose || other.verbose,
      };
    }
    return this.withState(next);
  }

  /** Python `__add__` — embed `other` at the end, preserving its anchors and flags. */
  concat(other: RegexBuilder): RegexBuilder {
    return this.subexpression(other, "", false, false);
  }

  /** Python `__or__` — fresh builder whose sole element alternates self and other. */
  alternate(other: RegexBuilder): RegexBuilder {
    return new RegexBuilder()
      .any_of()
      .subexpression(this, "", false, false)
      .subexpression(other, "", false, false)
      .end();
  }

  fork(): RegexBuilder {
    return this.withState(cloneState(this.state));
  }

  copy(): RegexBuilder {
    return this.fork();
  }

  // ---- terminals ----
  to_regex_string(): string {
    if (this.state.stack.length !== 1) {
      throw new CannotCallSubexpressionError(`${this.state.stack.length - 1} frame(s) still open`);
    }
    const top = this.state.stack[this.state.stack.length - 1];
    if (top.pending) throw new DanglingQuantifierError(`dangling quantifier ${top.pending.name}`);
    const rendered = renderElement({ kind: "root", children: top.children });
    const unescaped = rendered.split(ESCAPED_SPACE).join(RAW_SPACE);
    return unescaped === "" ? "(?:)" : unescaped;
  }

  to_regex(options: ToRegexOptions = {}): CompiledRegex {
    let state = this.state;
    if (options.ignoreCase || options.multiline || options.dotAll) {
      state = cloneState(state);
      if (options.ignoreCase) state.flags.ignoreCase = true;
      if (options.multiline) state.flags.multiLine = true;
      if (options.dotAll) state.flags.dotAll = true;
    }
    if (state.flags.asciiOnly || state.flags.debug || state.flags.verbose) {
      throw new UnsupportedFlagError("ascii_only/debug/verbose have no JavaScript equivalent");
    }
    let flags = "";
    if (state.flags.ignoreCase) flags += "i";
    if (state.flags.multiLine) flags += "m";
    if (state.flags.dotAll) flags += "s";
    const top = state.stack[state.stack.length - 1];
    if (state.stack.length !== 1 || top.pending) {
      throw new CannotCallSubexpressionError("builder is not fully specified");
    }
    return { source: this.to_regex_string(), flags };
  }
}

export type Pattern = RegexBuilder;
export type { Element, QuantifierElement };
