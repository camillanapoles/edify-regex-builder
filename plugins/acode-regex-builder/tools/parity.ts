/**
 * Parity runner: executes parity_spec.json against the TS port and prints the
 * same JSON shape as tools/parity.py (the Python oracle). Outputs must match.
 *
 * Run from repo root: bun plugins/acode-regex-builder/tools/parity.ts
 */
import spec from "./parity_spec.json";
import { RegexBuilder } from "../src/edify/index";

type Step = [string, ...unknown[]];
interface Case {
  name: string;
  calls: Step[];
  defs?: Record<string, Step[]>;
}

function resolve(value: unknown, defs: Record<string, unknown>): unknown {
  if (typeof value === "string" && value.startsWith("$")) {
    return defs[value.slice(1)];
  }
  return value;
}

function runChain(calls: Step[], defs: Record<string, unknown>): InstanceType<typeof RegexBuilder> {
  let builder = new RegexBuilder();
  for (const [method, ...args] of calls) {
    const surface = builder as unknown as Record<string, (...a: unknown[]) => InstanceType<typeof RegexBuilder>>;
    builder = surface[method](...args.map((a) => resolve(a, defs)));
  }
  return builder;
}

const out: Record<string, string> = {};
for (const specCase of spec as unknown as Case[]) {
  const defs: Record<string, unknown> = {};
  try {
    for (const [alias, calls] of Object.entries(specCase.defs ?? {})) {
      defs[alias] = runChain(calls, defs);
    }
    out[specCase.name] = runChain(specCase.calls, defs).to_regex_string();
  } catch (err) {
    out[specCase.name] = "ERR:" + (err as Error).name;
  }
}
// Python oracle prints json.dumps(sort_keys=True, indent=1); mirror byte-for-byte.
const sorted: Record<string, string> = {};
for (const key of Object.keys(out).sort()) sorted[key] = out[key];
console.log(JSON.stringify(sorted, null, 1));
