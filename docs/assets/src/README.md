# Asset sources

Every image and GIF in the root `README.md` is generated from the scenes in this folder — nothing is
hand-drawn, so when a number changes you regenerate rather than redraw.

Each scene is a self-contained HTML file exposing two globals:

- `window.TOTAL_FRAMES` — how many frames the scene has (`1` for stills)
- `window.setFrame(i)` — renders frame `i` deterministically

`capture.mjs` drives Chromium over that interface and writes one PNG per frame; `mkgif.py` quantises the
frames against a shared palette and assembles an optimised GIF.

## Scenes

| File | Produces | Notes |
|------|----------|-------|
| `app.html` | `app-tour.gif`, `playground.png` | The playground + devtools panel; 190 frames |
| `terminal.html` | `terminal.gif` | Install and `estimateCost()` output; 150 frames |
| `cache.html` | `cache-alignment.gif` | Unaligned vs aligned prompt; 132 frames |
| `hero.html` | `hero.png` | Banner |
| `features.html` | `features.png` | Feature grid |
| `architecture.html` | `architecture.png` | Package layers |
| `themes.html` | `devtools-themes.png` | Panel in dark and light |

## Regenerating

Requires `playwright` (for its Chromium), Python with `Pillow`, and the fonts Inter and JetBrains Mono
installed system-wide.

```bash
npm i --no-save playwright
pip install pillow

# animation → GIF
node docs/assets/src/capture.mjs docs/assets/src/app.html /tmp/frames 1160 748 1
python3 docs/assets/src/mkgif.py /tmp/frames docs/assets/app-tour.gif 12 96 980 1400
#                                 frames      output                  fps colors width hold-last-ms

# still → PNG (2× device scale, single frame)
node docs/assets/src/capture.mjs docs/assets/src/hero.html /tmp/hero 1280 420 2 "0"
```

`capture.mjs` hardcodes a Chromium path — point `executablePath` at your own install if it differs.

## Keeping the numbers honest

The figures baked into these scenes come from the library itself, not from marketing:

| Claim | Where it comes from |
|-------|---------------------|
| `$0.055430 → $0.028155`, 49.2% | `estimateCost('gpt-4o', 21916, 64, 21820)` |
| Per-model monthly costs in the Compare tab | `estimateCost(model, 1000, 500) × 3000` |
| 292 tests | `pnpm test` |
| 28.5 / 18.3 / 4.3 kB | `cat dist/index.js dist/chunk-*.js \| gzip -c \| wc -c` |
| 0.8 kB tree-shaken | `esbuild --bundle --minify --format=esm` on a one-symbol re-export, gzipped |

If you change pricing in `packages/core/src/cost/pricing.ts`, re-derive these before regenerating.
