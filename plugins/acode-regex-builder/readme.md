# Regex Builder (edify) — Acode plugin

Fluent regex builder and live tester for [Acode](https://acode.app), ported from the
[`edify`](https://github.com/regex-tools/regex-builder) Python library. The builder engine
(`src/edify/`) is a faithful TypeScript port: `to_regex_string()` output is byte-identical to
the Python implementation, verified by a parity runner (`tools/parity.ts` vs `tools/parity.py`).

## Features
- Fluent builder palette in a sidebar page: classes, literals, ranges, groups, captures,
  named groups, back-references, quantifiers (greedy/lazy/possessive), lookaround, atomic groups.
- Preset patterns baked from all 80+ `edify.atoms` (email, ipv4, uuid, semver, ...).
- Live tester: matches the built pattern against sample text using the WebView `RegExp`
  (Python-isms `(?P<name>)` / `(?P=name)` are translated for JS).
- Copy pattern / insert at cursor in the active editor.
- JS flags `i`, `m`, `s` toggleable.

## Build (Bun, on Termux)
```sh
bun build src/main.ts --target browser --minify --outfile dist/main.js
sh tools/pack.sh          # builds + zips dist.zip (plugin.json, main.js, readme, changelogs)
```
Do not edit `dist/` — it is generated.

## Install
- **Local**: Acode → Plugin manager → Local → pick `dist.zip`.
- **Remote**: serve this folder (`http://<ip>:3000/dist.zip`) and use the REMOTE option.

## Regenerating presets
`../..$ .venv/bin/python plugins/acode-regex-builder/tools/gen_presets.py` bakes `src/presets.ts`
from the current `edify.atoms`.

## Parity
```sh
.venv/bin/python plugins/acode-regex-builder/tools/parity.py > /tmp/py.json
bun plugins/acode-regex-builder/tools/parity.ts > /tmp/ts.json
diff /tmp/py.json /tmp/ts.json
```
Any behavioral change to `edify/` Python source must be mirrored here and parity re-run.
