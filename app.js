/* ============ HabitGrid — app logic ============ */
"use strict";

/* ---------- Constants ---------- */
const STORAGE_KEY = "habitgrid:data:v1";
const THEME_KEY = "habitgrid:theme";

const EMOJIS = ["💪", "📖", "🧘", "🏃", "💧", "😴", "🥗", "✍️", "💻", "🎸", "🧹", "🌱", "🚭", "💰", "🗣️", "🎯"];
const COLORS = ["#2ea043", "#3fb950", "#58a6ff", "#bc8cff", "#f778ba", "#f0883e", "#e3b341", "#39c5cf", "#ff7b72", "#7ee787"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

/* ---------- State ---------- */
let state = loadState();
let selectedYear = new Date().getFullYear();
let sortMode = "created";
let editingHabitId = null;
let formEmoji = EMOJIS[0];
let formColor = COLORS[0];

/* ---------- Date helpers (all local time) ---------- */
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayKey() { return fmtDate(new Date()); }
function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
function prettyDate(key) {
  return parseKey(key).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

/* ---------- Persistence ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.habits)) return parsed;
    }
  } catch (_) { /* corrupted -> fresh */ }
  return { habits: [] };
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- Habit metrics ---------- */
function isDone(habit, key) { return habit.log[key] === 1; }

function currentStreak(habit) {
  let streak = 0;
  let d = new Date();
  // Today doesn't break the streak if not yet completed.
  if (!isDone(habit, fmtDate(d))) d = addDays(d, -1);
  while (isDone(habit, fmtDate(d))) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

function longestStreak(habit) {
  const keys = Object.keys(habit.log).filter((k) => habit.log[k] === 1).sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    if (prev !== null && fmtDate(addDays(parseKey(prev), 1)) === k) run++;
    else run = 1;
    if (run > best) best = run;
    prev = k;
  }
  return best;
}

function rateLastNDays(habit, n) {
  let done = 0;
  const today = new Date();
  for (let i = 0; i < n; i++) {
    if (isDone(habit, fmtDate(addDays(today, -i)))) done++;
  }
  return done / n;
}

function totalCheckins(habit) {
  return Object.values(habit.log).filter((v) => v === 1).length;
}

function completionsThisWeek(habit) {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sunday
  let done = 0;
  for (let i = 0; i <= dow; i++) {
    if (isDone(habit, fmtDate(addDays(today, -i)))) done++;
  }
  return done;
}

/* ---------- Heatmap rendering (LeetCode/GitHub style) ---------- */
/**
 * Builds a heatmap grid for a full year: columns = weeks, rows = Sun..Sat.
 * getLevel(dateKey) -> { level: 0..4 } or { color } for habit-colored cells.
 */
function buildHeatmap(container, year, getCellInfo, onCellClick) {
  container.innerHTML = "";

  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const start = addDays(jan1, -jan1.getDay()); // back up to Sunday
  const totalDays = Math.round((dec31 - start) / 86400000) + 1;
  const weeks = Math.ceil(totalDays / 7);

  const todayK = todayKey();

  // Day labels
  const daysCol = document.createElement("div");
  daysCol.className = "hm-days";
  for (const label of DAY_LABELS) {
    const el = document.createElement("div");
    el.className = "hm-day";
    el.textContent = label;
    daysCol.appendChild(el);
  }

  // Cells
  const cellsEl = document.createElement("div");
  cellsEl.className = "hm-cells";
  const monthStartWeek = {}; // month index -> first week column

  for (let w = 0; w < weeks; w++) {
    for (let r = 0; r < 7; r++) {
      const date = addDays(start, w * 7 + r);
      const cell = document.createElement("div");
      cell.className = "cell";

      if (date.getFullYear() !== year) {
        cell.classList.add("hidden-cell");
      } else {
        const key = fmtDate(date);
        if (date.getDate() === 1 || (w === 0 && monthStartWeek[date.getMonth()] === undefined)) {
          if (monthStartWeek[date.getMonth()] === undefined) monthStartWeek[date.getMonth()] = w;
        }
        const info = getCellInfo(key);
        if (info.color) {
          cell.classList.add("hc");
          cell.style.setProperty("--hc", info.color);
        } else if (info.level > 0) {
          cell.classList.add(`l${Math.min(info.level, 4)}`);
        }
        if (key === todayK) cell.classList.add("today-cell");
        if (key > todayK) cell.classList.add("future");

        cell.dataset.date = key;
        if (info.tooltip) cell.dataset.tooltip = info.tooltip;

        if (onCellClick && key <= todayK) {
          cell.classList.add("clickable");
          cell.addEventListener("click", () => onCellClick(key));
        }
      }
      cellsEl.appendChild(cell);
    }
  }

  // Month labels aligned to week columns
  const monthsEl = document.createElement("div");
  monthsEl.className = "hm-months";
  monthsEl.style.gridTemplateColumns = `repeat(${weeks}, calc(var(--cell) + var(--cell-gap)))`;
  let lastLabeledWeek = -2;
  for (let m = 0; m < 12; m++) {
    const w = monthStartWeek[m];
    if (w === undefined || w - lastLabeledWeek < 2) continue;
    const label = document.createElement("div");
    label.className = "hm-month";
    label.textContent = MONTHS[m];
    label.style.gridColumnStart = w + 1;
    monthsEl.appendChild(label);
    lastLabeledWeek = w;
  }

  const blank = document.createElement("div");
  blank.style.gridArea = "blank";

  container.appendChild(blank);
  container.appendChild(monthsEl);
  container.appendChild(daysCol);
  container.appendChild(cellsEl);
}

/* ---------- Tooltip ---------- */
const tooltip = document.getElementById("cell-tooltip");
document.addEventListener("mouseover", (e) => {
  const cell = e.target.closest(".cell[data-tooltip]");
  if (!cell) { tooltip.hidden = true; return; }
  tooltip.textContent = cell.dataset.tooltip;
  tooltip.hidden = false;
  const rect = cell.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.top}px`;
});
document.addEventListener("scroll", () => { tooltip.hidden = true; }, true);

/* ---------- Rendering ---------- */
function availableYears() {
  const years = new Set([new Date().getFullYear()]);
  for (const h of state.habits) {
    years.add(new Date(h.createdAt).getFullYear());
    for (const k of Object.keys(h.log)) years.add(Number(k.slice(0, 4)));
  }
  return [...years].sort((a, b) => b - a);
}

function renderYearTabs() {
  const el = document.getElementById("year-tabs");
  el.innerHTML = "";
  for (const y of availableYears()) {
    const btn = document.createElement("button");
    btn.className = "year-tab" + (y === selectedYear ? " active" : "");
    btn.textContent = y;
    btn.addEventListener("click", () => {
      selectedYear = y;
      render();
    });
    el.appendChild(btn);
  }
}

function renderStats() {
  const habits = state.habits;
  const tk = todayKey();
  const doneToday = habits.filter((h) => isDone(h, tk)).length;
  document.getElementById("stat-today").textContent = `${doneToday}/${habits.length}`;

  const bestStreak = habits.length ? Math.max(...habits.map(currentStreak)) : 0;
  document.getElementById("stat-streak").textContent = bestStreak === 1 ? "1 day" : `${bestStreak} days`;

  let rate = 0;
  if (habits.length) {
    rate = habits.reduce((acc, h) => acc + rateLastNDays(h, 30), 0) / habits.length;
  }
  document.getElementById("stat-month").textContent = `${Math.round(rate * 100)}%`;

  const total = habits.reduce((acc, h) => acc + totalCheckins(h), 0);
  document.getElementById("stat-total").textContent = total.toLocaleString();
}

function renderOverview() {
  const habits = state.habits;
  const container = document.getElementById("overview-heatmap");

  // Total check-ins in the selected year
  let yearTotal = 0;
  for (const h of habits) {
    for (const k of Object.keys(h.log)) {
      if (h.log[k] === 1 && Number(k.slice(0, 4)) === selectedYear) yearTotal++;
    }
  }
  document.getElementById("overview-summary").textContent =
    `${yearTotal.toLocaleString()} check-in${yearTotal === 1 ? "" : "s"} in ${selectedYear}`;

  buildHeatmap(container, selectedYear, (key) => {
    const n = habits.length;
    const done = habits.filter((h) => isDone(h, key)).length;
    let level = 0;
    if (n > 0 && done > 0) {
      const frac = done / n;
      level = frac >= 1 ? 4 : frac >= 0.75 ? 3 : frac >= 0.4 ? 2 : 1;
    }
    const tooltipText = done === 0
      ? `No check-ins on ${prettyDate(key)}`
      : `${done} of ${n} habit${n === 1 ? "" : "s"} on ${prettyDate(key)}`;
    return { level, tooltip: tooltipText };
  });
}

function renderToday() {
  const tk = todayKey();
  document.getElementById("today-date").textContent = prettyDate(tk);

  const list = document.getElementById("today-list");
  list.innerHTML = "";

  const habits = state.habits;
  const done = habits.filter((h) => isDone(h, tk)).length;
  const pct = habits.length ? Math.round((done / habits.length) * 100) : 0;
  document.getElementById("today-progress-fill").style.width = `${pct}%`;
  document.getElementById("today-progress-label").textContent = `${pct}%`;

  document.getElementById("today-panel").style.display = habits.length ? "" : "none";

  for (const habit of habits) {
    const li = document.createElement("li");
    li.className = "today-item" + (isDone(habit, tk) ? " done" : "");
    li.style.setProperty("--check-color", habit.color);

    const streak = currentStreak(habit);
    const week = completionsThisWeek(habit);

    li.innerHTML = `
      <span class="check">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8.5 6.5 12 13 4.5"/></svg>
      </span>
      <span class="habit-emoji">${habit.emoji}</span>
      <span class="habit-name"></span>
      <span class="streak-chip${streak >= 7 ? " hot" : ""}">🔥 ${streak}</span>
      <span class="streak-chip">${week}/${habit.goal} this week</span>
    `;
    li.querySelector(".habit-name").textContent = habit.name;
    li.addEventListener("click", () => toggleDay(habit.id, tk));
    list.appendChild(li);
  }
}

function sortedHabits() {
  const habits = [...state.habits];
  switch (sortMode) {
    case "name": return habits.sort((a, b) => a.name.localeCompare(b.name));
    case "streak": return habits.sort((a, b) => currentStreak(b) - currentStreak(a));
    case "rate": return habits.sort((a, b) => rateLastNDays(b, 30) - rateLastNDays(a, 30));
    default: return habits.sort((a, b) => a.createdAt - b.createdAt);
  }
}

function renderHabitCards() {
  const container = document.getElementById("habit-cards");
  container.innerHTML = "";

  const empty = document.getElementById("empty-state");
  empty.hidden = state.habits.length > 0;
  document.querySelector(".section-heading").style.display = state.habits.length ? "" : "none";

  for (const habit of sortedHabits()) {
    const card = document.createElement("div");
    card.className = "habit-card";

    const streak = currentStreak(habit);
    const best = longestStreak(habit);
    const rate = Math.round(rateLastNDays(habit, 30) * 100);
    const total = totalCheckins(habit);

    card.innerHTML = `
      <div class="habit-card-header">
        <div class="habit-title">
          <span class="habit-emoji">${habit.emoji}</span>
          <h3></h3>
        </div>
        <div class="habit-meta">
          <span class="meta-chip">🔥 <b>${streak}</b> streak</span>
          <span class="meta-chip">🏆 <b>${best}</b> best</span>
          <span class="meta-chip"><b>${rate}%</b> · 30d</span>
          <span class="meta-chip"><b>${total}</b> total</span>
          <button class="habit-edit-btn" title="Edit habit">Edit</button>
        </div>
      </div>
      <div class="heatmap-scroll"><div class="heatmap"></div></div>
    `;
    card.querySelector("h3").textContent = habit.name;
    card.querySelector(".habit-edit-btn").addEventListener("click", () => openModal(habit.id));

    buildHeatmap(
      card.querySelector(".heatmap"),
      selectedYear,
      (key) => {
        const done = isDone(habit, key);
        return {
          color: done ? habit.color : null,
          level: 0,
          tooltip: done ? `✓ ${habit.name} — ${prettyDate(key)}` : `${prettyDate(key)}`,
        };
      },
      (key) => toggleDay(habit.id, key)
    );

    container.appendChild(card);
  }
}

function render() {
  renderYearTabs();
  renderStats();
  renderOverview();
  renderToday();
  renderHabitCards();
}

/* ---------- Actions ---------- */
function toggleDay(habitId, key) {
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit) return;
  if (key > todayKey()) return; // no future check-ins
  if (habit.log[key] === 1) delete habit.log[key];
  else habit.log[key] = 1;
  saveState();
  render();
}

/* ---------- Modal ---------- */
const backdrop = document.getElementById("modal-backdrop");
const form = document.getElementById("habit-form");

function buildPickers() {
  const emojiGrid = document.getElementById("emoji-grid");
  emojiGrid.innerHTML = "";
  for (const e of EMOJIS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emoji-option" + (e === formEmoji ? " selected" : "");
    btn.textContent = e;
    btn.addEventListener("click", () => { formEmoji = e; buildPickers(); });
    emojiGrid.appendChild(btn);
  }
  const colorGrid = document.getElementById("color-grid");
  colorGrid.innerHTML = "";
  for (const c of COLORS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "color-option" + (c === formColor ? " selected" : "");
    btn.style.background = c;
    btn.title = c;
    btn.addEventListener("click", () => { formColor = c; buildPickers(); });
    colorGrid.appendChild(btn);
  }
}

function openModal(habitId = null) {
  editingHabitId = habitId;
  const habit = habitId ? state.habits.find((h) => h.id === habitId) : null;

  document.getElementById("modal-title").textContent = habit ? "Edit Habit" : "New Habit";
  document.getElementById("save-btn").textContent = habit ? "Save" : "Create";
  document.getElementById("delete-habit-btn").hidden = !habit;

  document.getElementById("habit-name").value = habit ? habit.name : "";
  formEmoji = habit ? habit.emoji : EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  formColor = habit ? habit.color : COLORS[state.habits.length % COLORS.length];
  const goal = habit ? habit.goal : 7;
  document.getElementById("habit-goal").value = goal;
  document.getElementById("goal-value").textContent = `${goal}×`;

  buildPickers();
  backdrop.hidden = false;
  setTimeout(() => document.getElementById("habit-name").focus(), 50);
}

function closeModal() {
  backdrop.hidden = true;
  editingHabitId = null;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("habit-name").value.trim();
  if (!name) return;
  const goal = Number(document.getElementById("habit-goal").value);

  if (editingHabitId) {
    const habit = state.habits.find((h) => h.id === editingHabitId);
    Object.assign(habit, { name, emoji: formEmoji, color: formColor, goal });
    showToast("Habit updated");
  } else {
    state.habits.push({
      id: uid(),
      name,
      emoji: formEmoji,
      color: formColor,
      goal,
      createdAt: Date.now(),
      log: {},
    });
    showToast(`"${name}" created — go fill that grid!`);
  }
  saveState();
  closeModal();
  render();
});

document.getElementById("delete-habit-btn").addEventListener("click", () => {
  const habit = state.habits.find((h) => h.id === editingHabitId);
  if (!habit) return;
  if (!confirm(`Delete "${habit.name}" and all its history? This cannot be undone.`)) return;
  state.habits = state.habits.filter((h) => h.id !== editingHabitId);
  saveState();
  closeModal();
  render();
  showToast("Habit deleted");
});

document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("cancel-btn").addEventListener("click", closeModal);
backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !backdrop.hidden) closeModal();
});

document.getElementById("habit-goal").addEventListener("input", (e) => {
  document.getElementById("goal-value").textContent = `${e.target.value}×`;
});

/* ---------- Toolbar ---------- */
document.getElementById("add-habit-btn").addEventListener("click", () => openModal());
document.getElementById("empty-add-btn").addEventListener("click", () => openModal());

document.getElementById("sort-select").addEventListener("change", (e) => {
  sortMode = e.target.value;
  renderHabitCards();
});

/* Theme */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.getElementById("icon-moon").style.display = theme === "dark" ? "" : "none";
  document.getElementById("icon-sun").style.display = theme === "dark" ? "none" : "";
  localStorage.setItem(THEME_KEY, theme);
}
document.getElementById("theme-toggle").addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
applyTheme(localStorage.getItem(THEME_KEY) || "dark");

/* Export / Import */
document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `habitgrid-export-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Data exported");
});

document.getElementById("import-btn").addEventListener("click", () => {
  document.getElementById("import-input").click();
});
document.getElementById("import-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.habits)) throw new Error("bad format");
      for (const h of parsed.habits) {
        if (typeof h.name !== "string" || typeof h.log !== "object") throw new Error("bad habit");
      }
      state = parsed;
      saveState();
      render();
      showToast(`Imported ${parsed.habits.length} habit${parsed.habits.length === 1 ? "" : "s"}`);
    } catch (_) {
      showToast("Import failed — invalid file");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---------- Demo data (first visit only) ---------- */
function seedDemoIfEmpty() {
  if (state.habits.length > 0) return;
  if (localStorage.getItem(STORAGE_KEY)) return; // user intentionally has no habits

  const demos = [
    { name: "Solve a coding problem", emoji: "💻", color: "#2ea043", goal: 7, bias: 0.85 },
    { name: "Read 20 minutes", emoji: "📖", color: "#58a6ff", goal: 5, bias: 0.7 },
    { name: "Workout", emoji: "💪", color: "#f0883e", goal: 4, bias: 0.55 },
  ];
  const today = new Date();
  state.habits = demos.map((d, i) => {
    const log = {};
    let momentum = Math.random() < d.bias;
    for (let back = 180; back >= 0; back--) {
      // streaky pattern: stay in current mode with high probability
      if (Math.random() < 0.18) momentum = Math.random() < d.bias;
      if (momentum && Math.random() < 0.92) log[fmtDate(addDays(today, -back))] = 1;
    }
    return {
      id: uid() + i,
      name: d.name,
      emoji: d.emoji,
      color: d.color,
      goal: d.goal,
      createdAt: addDays(today, -180).getTime(),
      log,
    };
  });
  saveState();
}

/* ---------- Init ---------- */
seedDemoIfEmpty();
render();

// Refresh at midnight so "today" rolls over correctly.
(function scheduleMidnightRefresh() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  setTimeout(() => { render(); scheduleMidnightRefresh(); }, next - now);
})();
