/** Subexpression merge transform mirroring edify/builder/merge.py. */

import {
  CannotDefineStartAfterEndError,
  EndInputAlreadyDefinedError,
  StartInputAlreadyDefinedError,
} from "./errors";
import type { Element } from "./types";

export interface MergeContext {
  captureIndexOffset: number;
  namespace: string;
  ignoreStartAndEnd: boolean;
  parentHasStart: boolean;
  parentHasEnd: boolean;
}

export interface MergeResult {
  element: Element;
  capturesAdded: number;
}

const CONTAINER_KINDS = new Set([
  "group", "any_of", "anything_but_any_of", "atomic", "subexpression",
  "assert_ahead", "assert_not_ahead", "assert_behind", "assert_not_behind",
]);

const REWRAPPABLE_QUANTIFIERS = new Set([
  "optional", "zero_or_more", "zero_or_more_lazy", "one_or_more", "one_or_more_lazy",
]);

export function mergeChildren(children: Element[], context: MergeContext): { children: Element[]; capturesAdded: number } {
  const merged: Element[] = [];
  let total = 0;
  for (const child of children) {
    const result = mergeElement(child, context);
    merged.push(result.element);
    total += result.capturesAdded;
  }
  return { children: merged, capturesAdded: total };
}

export function mergeElement(element: Element, context: MergeContext): MergeResult {
  switch (element.kind) {
    case "back_reference":
      return { element: { ...element, index: element.index + context.captureIndexOffset }, capturesAdded: 0 };
    case "named_back_reference":
      return { element: { ...element, name: context.namespace + element.name }, capturesAdded: 0 };
    case "named_capture": {
      const inner = mergeChildren(element.children, context);
      return {
        element: { ...element, name: context.namespace + element.name, children: inner.children },
        capturesAdded: inner.capturesAdded + 1,
      };
    }
    case "capture": {
      const inner = mergeChildren(element.children, context);
      return { element: { ...element, children: inner.children }, capturesAdded: inner.capturesAdded + 1 };
    }
    case "start_of_input":
      if (context.ignoreStartAndEnd) return { element: { kind: "noop" }, capturesAdded: 0 };
      if (context.parentHasStart) throw new StartInputAlreadyDefinedError();
      return { element, capturesAdded: 0 };
    case "end_of_input":
      if (context.ignoreStartAndEnd) return { element: { kind: "noop" }, capturesAdded: 0 };
      if (context.parentHasEnd) throw new EndInputAlreadyDefinedError();
      return { element, capturesAdded: 0 };
    default:
      break;
  }
  if (CONTAINER_KINDS.has(element.kind)) {
    const inner = mergeChildren((element as { children: Element[] }).children, context);
    return { element: { ...element, children: inner.children } as Element, capturesAdded: inner.capturesAdded };
  }
  if (REWRAPPABLE_QUANTIFIERS.has(element.kind)) {
    const child = mergeElement((element as { child: Element }).child, context);
    return { element: { ...element, child: child.element } as Element, capturesAdded: child.capturesAdded };
  }
  // Python merge.py handles exactly/at_least/between/between_lazy only for these
  // four numbered quantifiers; possessives fall through unchanged (default arm).
  if (element.kind === "exactly" || element.kind === "at_least" || element.kind === "between" || element.kind === "between_lazy") {
    const child = mergeElement((element as { child: Element }).child, context);
    return { element: { ...element, child: child.element } as Element, capturesAdded: child.capturesAdded };
  }
  return { element, capturesAdded: 0 };
}
