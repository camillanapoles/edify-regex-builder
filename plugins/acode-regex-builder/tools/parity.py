#!/usr/bin/env python3
"""Parity oracle: run the parity_spec.json chains against the real edify (Python).

Prints a JSON map name -> emitted pattern (or "ERR:<ExceptionName>"). The TS runner
(plugins/acode-regex-builder/tools/parity.ts) prints the same shape for the port;
the two outputs must be byte-identical.

Run from repo root: .venv/bin/python plugins/acode-regex-builder/tools/parity.py
"""

from __future__ import annotations

import json
import pathlib
import sys
from collections.abc import Callable, Sequence
from typing import cast

from edify import RegexBuilder

SPEC = pathlib.Path(__file__).resolve().parent / "parity_spec.json"

# Spec uses the TS surface names; Python exposes these as operator dunders.
METHOD_ALIASES = {"concat": "__add__", "alternate": "__or__"}


def resolve(value: object, defs: dict[str, object]) -> object:
    if isinstance(value, str) and value.startswith("$"):
        return defs[value[1:]]
    return value


def run_chain(calls: Sequence[Sequence[object]], defs: dict[str, object]) -> RegexBuilder:
    builder = RegexBuilder()
    for step in calls:
        method = METHOD_ALIASES.get(str(step[0]), str(step[0]))
        args = [resolve(a, defs) for a in step[1:]]
        fn = cast("Callable[..., RegexBuilder]", getattr(builder, method))
        builder = fn(*args)
    return builder


def main() -> int:
    spec: list[dict[str, object]] = json.loads(SPEC.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for case in spec:
        defs: dict[str, object] = {}
        try:
            case_defs = cast("dict[str, Sequence[Sequence[object]]]", case.get("defs") or {})
            for alias, calls in case_defs.items():
                defs[str(alias)] = run_chain(calls, defs)
            builder = run_chain(cast("Sequence[Sequence[object]]", case["calls"]), defs)
            out[str(case["name"])] = builder.to_regex_string()
        except Exception as exc:
            out[str(case["name"])] = "ERR:" + type(exc).__name__
    print(json.dumps(out, sort_keys=True, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
