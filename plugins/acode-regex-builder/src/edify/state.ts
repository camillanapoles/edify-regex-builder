/** Immutable builder state mirroring edify/builder/types/{state,frame}.py. */

import type { Element } from "./types";

export interface PendingQuantifier {
  factory: (child: Element) => Element;
  name: string;
}

export interface StackFrame {
  typeNode: Element;
  pending: PendingQuantifier | null;
  children: Element[];
}

export interface Flags {
  asciiOnly: boolean;
  debug: boolean;
  ignoreCase: boolean;
  multiLine: boolean;
  dotAll: boolean;
  verbose: boolean;
}

export interface BuilderState {
  hasStart: boolean;
  hasEnd: boolean;
  flags: Flags;
  stack: StackFrame[];
  namedGroups: string[];
  totalCaptureGroups: number;
}

export function initialState(): BuilderState {
  return {
    hasStart: false,
    hasEnd: false,
    flags: {
      asciiOnly: false,
      debug: false,
      ignoreCase: false,
      multiLine: false,
      dotAll: false,
      verbose: false,
    },
    stack: [{ typeNode: { kind: "root" }, pending: null, children: [] }],
    namedGroups: [],
    totalCaptureGroups: 0,
  };
}

export function cloneState(state: BuilderState): BuilderState {
  return {
    ...state,
    flags: { ...state.flags },
    namedGroups: [...state.namedGroups],
    stack: state.stack.map((frame) => ({
      ...frame,
      children: [...frame.children],
      pending: frame.pending ? { ...frame.pending } : null,
    })),
  };
}

export function withElementAddedToTop(state: BuilderState, element: Element): BuilderState {
  const next = cloneState(state);
  const top = next.stack[next.stack.length - 1];
  const effective = top.pending ? top.pending.factory(element) : element;
  top.pending = null;
  top.children.push(effective);
  return next;
}

export function withFramePushed(state: BuilderState, frame: StackFrame): BuilderState {
  const next = cloneState(state);
  next.stack.push(frame);
  return next;
}

export function withTopFramePopped(state: BuilderState): { state: BuilderState; popped: StackFrame } {
  const next = cloneState(state);
  const popped = next.stack.pop();
  if (!popped) throw new Error("stack underflow");
  return { state: next, popped };
}
