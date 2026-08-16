# HabitGrid

A minimal, professional daily habit tracker with **LeetCode-style activity grids**.

## Features

- 🟩 **LeetCode-style heatmap grids** — a full-year contribution grid per habit, plus a combined activity overview with intensity levels
- ✅ **Today checklist** — one-tap check-off with a live progress bar
- 🔥 **Streaks** — current streak, longest streak, and weekly-goal tracking per habit
- 📊 **Stats dashboard** — completed today, best active streak, 30-day consistency, total check-ins
- 🖱️ **Editable history** — click any past cell in a habit's grid to toggle that day
- 🗓️ **Year tabs** — browse any year that has data
- 🎨 **Customization** — emoji icon, color, and weekly goal per habit
- ↕️ **Sorting** — by created date, name, current streak, or 30-day rate
- 🌗 **Dark / light theme** with persistence
- 💾 **Local-first** — all data lives in `localStorage`; JSON export/import for backup and migration

## Running

It's a fully static site — no build step, no dependencies.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Or just open `index.html` in a browser.

## Notes

- On first visit the app seeds three demo habits with ~6 months of history so the grids aren't empty. Delete them (Edit → Delete) to start fresh.
- Data never leaves the browser. Use **Export** to download a JSON backup and **Import** to restore it.

## Stack

Vanilla HTML, CSS, and JavaScript. No frameworks, no build tooling.
