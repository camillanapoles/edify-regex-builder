# Changelogs

## 0.1.1
- Undo: history stack of the last 50 applies with an Undo button; Reset clears history.
- "sel ⇐" loads the current editor selection as the tested pattern (falls back to a "no selection" notice).
- Session persistence: pattern, test text and JS flags saved to localStorage (debounced, best-effort) and restored on open.
- Tester results now lead with a match-count line ("N matches" / "no matches").

## 0.1.0
- Initial release: fluent regex-builder palette ported from edify (byte-parity engine).
- Presets baked from edify.atoms; live JS tester with Python-to-JS pattern translation.
- Copy to clipboard / insert at cursor; flags i, m, s.
