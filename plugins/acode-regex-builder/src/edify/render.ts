/** Renderers mirroring edify/compile/{dispatch,chars,groups,captures,leaves,root,fuse}.py. */

import { CannotNegateNonCharacterMemberError } from "./errors";
import type {
  AnyOfElement,
  AnythingButAnyOfElement,
  CharElement,
  Element,
  LeafKind,
  QuantifierElement,
  RangeElement,
  SubexpressionElement,
  StringElement,
} from "./types";

const LEAF_STRINGS: Record<LeafKind, string> = {
  start_of_input: "^",
  end_of_input: "$",
  any_char: ".",
  whitespace_char: "\\s",
  non_whitespace_char: "\\S",
  digit: "\\d",
  non_digit: "\\D",
  word: "\\w",
  non_word: "\\W",
  word_boundary: "\\b",
  non_word_boundary: "\\B",
  new_line: "\\n",
  carriage_return: "\\r",
  tab: "\\t",
  null_byte: "\\0",
  letter: "[a-zA-Z]",
  uppercase: "[A-Z]",
  lowercase: "[a-z]",
  alphanumeric: "[a-zA-Z0-9]",
  unicode_letter: "\\p{L}",
  unicode_uppercase: "\\p{Lu}",
  unicode_lowercase: "\\p{Ll}",
  unicode_alphanumeric: "[\\p{L}\\p{N}]",
  noop: "",
};

const QUANTIFIER_SUFFIXES = new Set([
  "optional", "zero_or_more", "zero_or_more_lazy", "one_or_more", "one_or_more_lazy",
  "exactly", "at_least", "at_most", "between", "between_lazy",
  "optional_possessive", "zero_or_more_possessive", "one_or_more_possessive",
  "at_least_possessive", "at_most_possessive", "between_possessive",
]);

function isFusable(member: Element): member is CharElement | RangeElement | { kind: "any_of_chars"; value: string } {
  return member.kind === "char" || member.kind === "any_of_chars" || member.kind === "range";
}

function fragmentFor(member: CharElement | RangeElement | { kind: "any_of_chars"; value: string }): string {
  if (member.kind === "range") return `${member.start}-${member.end}`;
  return member.value;
}

function concatChildren(children: Element[]): string {
  return children.map(renderElement).join("");
}

function renderAlternation(children: Element[]): string {
  const fused = children.filter(isFusable).map(fragmentFor).join("");
  const remainder = children.filter((child) => !isFusable(child));
  if (remainder.length === 0) return `[${fused}]`;
  const joined = remainder.map(renderElement).join("|");
  if (!fused) return `(?:${joined})`;
  return `(?:${joined}|[${fused}])`;
}

function renderNegatedClass(children: Element[]): string {
  const members = children.filter(isFusable);
  if (members.length !== children.length) {
    throw new CannotNegateNonCharacterMemberError("negated class members must be single characters or ranges");
  }
  return `[^${members.map(fragmentFor).join("")}]`;
}

function quantifierSuffix(quantifier: QuantifierElement): string {
  switch (quantifier.kind) {
    case "optional": return "?";
    case "zero_or_more": return "*";
    case "zero_or_more_lazy": return "*?";
    case "one_or_more": return "+";
    case "one_or_more_lazy": return "+?";
    case "exactly": return `{${quantifier.n}}`;
    case "at_least": return `{${quantifier.n},}`;
    case "at_most": return `{0,${quantifier.n}}`;
    case "between": return `{${quantifier.lower},${quantifier.upper}}`;
    case "between_lazy": return `{${quantifier.lower},${quantifier.upper}}?`;
    case "optional_possessive": return "?+";
    case "zero_or_more_possessive": return "*+";
    case "one_or_more_possessive": return "++";
    case "at_least_possessive": return `{${quantifier.n},}+`;
    case "at_most_possessive": return `{0,${quantifier.n}}+`;
    case "between_possessive": return `{${quantifier.lower},${quantifier.upper}}+`;
  }
}

function renderQuantifier(quantifier: QuantifierElement): string {
  const rendered = renderElement(quantifier.child);
  const grouped =
    quantifier.child.kind === "string" || quantifier.child.kind === "subexpression"
      ? `(?:${rendered})`
      : rendered;
  return `${grouped}${quantifierSuffix(quantifier)}`;
}

export function renderElement(element: Element): string {
  if (QUANTIFIER_SUFFIXES.has(element.kind)) return renderQuantifier(element as QuantifierElement);
  switch (element.kind) {
    case "char":
    case "string":
      return element.value;
    case "range":
      return `[${element.start}-${element.end}]`;
    case "any_of_chars":
      return `[${element.value}]`;
    case "anything_but_chars":
      return `[^${element.value}]`;
    case "anything_but_range":
      return `[^${element.start}-${element.end}]`;
    case "anything_but_string":
      return `(?:${Array.from(element.value).map((c) => `[^${c}]`).join("")})`;
    case "capture":
      return `(${concatChildren(element.children)})`;
    case "named_capture":
      return `(?P<${element.name}>${concatChildren(element.children)})`;
    case "back_reference":
      return `\\${element.index}`;
    case "named_back_reference":
      return `(?P=${element.name})`;
    case "group":
      return `(?:${concatChildren(element.children)})`;
    case "subexpression":
      return concatChildren(element.children);
    case "any_of":
      return renderAlternation(element.children);
    case "anything_but_any_of":
      return renderNegatedClass(element.children);
    case "atomic":
      return `(?>${concatChildren(element.children)})`;
    case "assert_ahead":
      return `(?=${concatChildren(element.children)})`;
    case "assert_not_ahead":
      return `(?!${concatChildren(element.children)})`;
    case "assert_behind":
      return `(?<=${concatChildren(element.children)})`;
    case "assert_not_behind":
      return `(?<!${concatChildren(element.children)})`;
    case "root":
      return concatChildren(element.children);
    default:
      return LEAF_STRINGS[(element as { kind: LeafKind }).kind];
  }
}
