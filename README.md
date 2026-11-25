# Car Jam — 6×6 Sliding Traffic Puzzle & Printable Card Generator

Live site: **https://carjam.asherwesterveld.com**

A static web app for playing 6×6 sliding traffic puzzles and live-generating exact-scale **56 × 87 mm** printable challenge cards with custom move counts (1–51 optimal slides), physical 16-vehicle board constraints, interactive hints, animated solutions, and scannable QR codes.

## Features

- **Playable Companion Mode:** Mobile-first drag-to-slide board with live optimal hints from any board state, animated solution viewer, and built-in QR scanner / Share modal.
- **Exact or Ranged Optimal Moves:** Fast in-browser BFS slide solver + Web Worker live generator (with Component Reverse-BFS for 40–51 move Grand Master boards and stratified range distribution).
- **Bulk Print & Duplex Solutions:** Prints 9 cards per sheet (3×3) at exact **56 × 87 mm** dimensions on US Letter or A4, with scannable QR codes, Back Y printer alignment calibration, and mirrored double-sided (long-edge / short-edge) solution backs.
- **System Dark Mode:** Automatically follows light/dark OS preferences while keeping printed cards crisp white.

## Local Development

```bash
npm install
npm run dev        # localhost:5173
npm run dev:lan    # expose on local Wi-Fi / Tailscale
npm test           # Vitest engine suite
npm run build      # TypeScript + Vite production build
```

## Deploying to GitHub Pages (`carjam.asherwesterveld.com`)

1. Push this repo to GitHub (`main` branch).
2. In **Cloudflare DNS** for `asherwesterveld.com`, add a `CNAME` record:
   - **Name:** `carjam`
   - **Target:** `asherwesterveld.github.io`
   - **Proxy status:** DNS only (gray cloud) while GitHub issues the HTTPS certificate.
3. In GitHub **Settings → Pages**:
   - **Source:** **GitHub Actions** (`.github/workflows/deploy.yml`).
   - **Custom domain:** `carjam.asherwesterveld.com` (already included in `public/CNAME`).
   - Enable **Enforce HTTPS**.

## Credits & Disclaimer

- **Nob Yoshigahara** — inventor of the original sliding-block traffic puzzle.
- **Michael Fogleman** — exhaustive 6×6 sliding-block analysis and discovery of the 51-move hardest configuration.
- Open-source libraries: React, Vite, TypeScript, `qrcode`, and `jsqr`.

*Unofficial companion and puzzle generator compatible with standard 6×6 physical traffic puzzle boards (such as ThinkFun's Rush Hour®). Not affiliated with or endorsed by ThinkFun or Ravensburger.*
