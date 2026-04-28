/* =================================================================
   HRV MANUAL v2 — assessment + pacer
   ================================================================= */


/* ============ STORAGE ============ */
const Storage = {
  get(key, defaultValue) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? defaultValue : JSON.parse(raw);
    } catch (err) {
      return defaultValue;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  },
  push(key, item, cap) {
    try {
      const current = Storage.get(key, []);
      const list = Array.isArray(current) ? current : [];
      list.push(item);
      const capped = cap ? list.slice(-cap) : list;
      Storage.set(key, capped);
      return capped;
    } catch (err) {
      return Array.isArray(Storage.get(key, [])) ? Storage.get(key, []) : [];
    }
  },
};

const STORAGE_KEYS = {
  breathSessions: "hrv:breathSessions",
  assessments: "hrv:assessments",
  readings: "hrv:readings",
};

function isoToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function dateToISO(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addDaysISO(iso, delta) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return dateToISO(date);
}

function formatDate(isoOrTs) {
  const date = typeof isoOrTs === "number" ? new Date(isoOrTs) : new Date(`${isoOrTs}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[ch]));
}

/* ============ ASSESSMENT ============ */
// 5 questions. Each option carries weights for the 7 protocols.
// Protocols: breath, sleep, alcohol, zone2, cold, sauna, biofeedback
// Plus a "tone" key for which message to lead with.

const QUESTIONS = [
  {
    id: "stress",
    q: "How loud is your nervous system most days?",
    sub: "Be honest. The starter plan flexes intensity to where you actually are.",
    options: [
      { label: "Burned out — wired and tired, can't downshift", w: { breath: 5, sleep: 4, alcohol: 3, zone2: 2, cold: -2, sauna: 1, biofeedback: 0 }, tone: "burnout" },
      { label: "Chronically tense but functional",                w: { breath: 4, sleep: 3, alcohol: 2, zone2: 3, cold: 1, sauna: 2, biofeedback: 1 }, tone: "tense" },
      { label: "Mostly okay, want to build resilience",          w: { breath: 3, sleep: 2, alcohol: 1, zone2: 4, cold: 3, sauna: 3, biofeedback: 2 }, tone: "resilience" },
    ],
  },
  {
    id: "sleep",
    q: "How is your sleep, really?",
    sub: "Duration and consistency both count.",
    options: [
      { label: "Fragmented or under 6 hours most nights",         w: { breath: 2, sleep: 5, alcohol: 2, zone2: 1, cold: 0, sauna: 1, biofeedback: 0 } },
      { label: "7+ hours but inconsistent timing",                 w: { breath: 2, sleep: 4, alcohol: 1, zone2: 2, cold: 1, sauna: 1, biofeedback: 1 } },
      { label: "Solid — 7–9 hrs, consistent wake time",            w: { breath: 3, sleep: 1, alcohol: 1, zone2: 3, cold: 2, sauna: 2, biofeedback: 2 } },
    ],
  },
  {
    id: "alcohol",
    q: "Evening alcohol in a typical week?",
    sub: "The most common HRV suppressor for adults.",
    options: [
      { label: "4+ drinks/week, usually with dinner",              w: { breath: 2, sleep: 2, alcohol: 5, zone2: 1, cold: 0, sauna: 0, biofeedback: 0 } },
      { label: "1–3 drinks/week, situational",                    w: { breath: 2, sleep: 2, alcohol: 3, zone2: 2, cold: 1, sauna: 1, biofeedback: 1 } },
      { label: "Rarely or never",                                  w: { breath: 3, sleep: 2, alcohol: 0, zone2: 3, cold: 2, sauna: 2, biofeedback: 2 } },
    ],
  },
  {
    id: "training",
    q: "Current exercise pattern?",
    sub: "What you do, not what you wish you did.",
    options: [
      { label: "Sedentary — desk job, little movement",           w: { breath: 3, sleep: 2, alcohol: 2, zone2: 5, cold: 1, sauna: 1, biofeedback: 0 } },
      { label: "Mixed — some walking, occasional workouts",       w: { breath: 3, sleep: 2, alcohol: 2, zone2: 4, cold: 2, sauna: 2, biofeedback: 1 } },
      { label: "High volume — daily intense training",            w: { breath: 4, sleep: 3, alcohol: 2, zone2: 2, cold: 3, sauna: 3, biofeedback: 3 }, tone: "athlete" },
    ],
  },
  {
    id: "tools",
    q: "Do you track HRV with a wearable?",
    sub: "Affects how fast you'll see feedback.",
    options: [
      { label: "Yes — Oura, Whoop, Apple Watch, Garmin, etc.",   w: { breath: 2, sleep: 1, alcohol: 1, zone2: 1, cold: 1, sauna: 1, biofeedback: 4 } },
      { label: "No, but open to it",                              w: { breath: 2, sleep: 1, alcohol: 1, zone2: 1, cold: 1, sauna: 1, biofeedback: 2 } },
      { label: "No, and not interested in adding one",            w: { breath: 3, sleep: 2, alcohol: 1, zone2: 2, cold: 1, sauna: 1, biofeedback: 0 } },
    ],
  },
];

const PROTOCOL_META = {
  breath:      { name: "Resonance breathing",      detail: "5–10 min/day at 4-in / 6-out. Use the pacer below — morning + pre-sleep ideal." },
  sleep:       { name: "Sleep architecture",        detail: "Anchor a fixed wake time. Bedroom 15–19°C, no food 3 hrs before bed, magnesium glycinate 200–400 mg." },
  alcohol:     { name: "Cut evening alcohol",       detail: "Two-week dry test. Watch the morning HRV trend. This is often the single largest lever." },
  zone2:       { name: "Zone 2 cardio",             detail: "30–45 min, 3–4×/week, conversational pace. Brisk walk, cycling, or swim." },
  cold:        { name: "Brief cold exposure",       detail: "Start with 30–60s cold finish to shower. Progress to 2–3 min at 10–15°C, 2–3×/week." },
  sauna:       { name: "Sauna + cool-down",         detail: "15–20 min at 70–90°C, 2–4×/week, finish with a cool shower for parasympathetic rebound." },
  biofeedback: { name: "HRV biofeedback",           detail: "Use your wearable's HRV trend (30-day window, not single days). Find your personal resonance rate between 4.5–6.5 bpm." },
};

const TONE_TITLES = {
  burnout:   "Recovery first — protocols are gentle on purpose",
  tense:     "Re-train the brake pedal — daily, low-friction",
  resilience: "Build the cushion — broaden the stimulus",
  athlete:   "Overtraining-aware — autonomic recovery emphasis",
  default:   "A balanced starter plan",
};

const TONE_SUBS = {
  burnout:   "Your top three are vagal-direct and suppressor-removal. No cold, no intensity until baseline lifts.",
  tense:     "Layer breathwork onto whatever you already do. The other levers compound from there.",
  resilience: "You have headroom — diversify the stimulus and let cold/sauna do real work.",
  athlete:   "Watch volatility. If morning HRV drops 20% for 3+ days, deload — don't push through.",
  default:   "Top three protocols below cover most of the leverage. Start with breath, layer the others over 2 weeks.",
};

let state = { idx: 0, answers: [] };

const stage = document.getElementById("stage");
const progBar = document.getElementById("progBar");
const progNum = document.getElementById("progNum");
const backBtn = document.getElementById("backBtn");
const nextBtn = document.getElementById("nextBtn");
const resultPanel = document.getElementById("resultPanel");
const assessCard = document.getElementById("assessCard");

function renderQuestion() {
  const q = QUESTIONS[state.idx];
  const selected = state.answers[state.idx];
  const opts = q.options.map((o, i) => `
    <button class="opt-btn ${selected === i ? "is-selected" : ""}" data-i="${i}">
      <span class="opt-marker"><span></span></span>
      <span class="opt-label">${o.label}</span>
    </button>
  `).join("");

  stage.innerHTML = `
    <div class="q-block">
      <p class="q-num">Question ${state.idx + 1}</p>
      <h3 class="q-text">${q.q}</h3>
      <p class="q-sub">${q.sub}</p>
      <div class="q-options">${opts}</div>
    </div>
  `;

  stage.querySelectorAll(".opt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = +btn.dataset.i;
      state.answers[state.idx] = i;
      renderQuestion();
      nextBtn.disabled = false;
    });
  });

  progBar.style.width = `${((state.idx + 1) / QUESTIONS.length) * 100}%`;
  progNum.textContent = state.idx + 1;
  backBtn.disabled = state.idx === 0;
  nextBtn.disabled = selected === undefined;
  nextBtn.textContent = state.idx === QUESTIONS.length - 1 ? "See my plan →" : "Next →";
}

function computeAssessmentResult(answers) {
  const totals = { breath: 0, sleep: 0, alcohol: 0, zone2: 0, cold: 0, sauna: 0, biofeedback: 0 };
  let tone = "default";
  answers.forEach((ai, qi) => {
    const opt = QUESTIONS[qi]?.options?.[ai];
    if (!opt) return;
    Object.entries(opt.w).forEach(([k, v]) => totals[k] += v);
    if (opt.tone) tone = opt.tone;
  });

  const ranked = Object.entries(totals).sort((a,b) => b[1] - a[1]);
  const topProtocols = ranked.slice(0, 3).map(([k]) => k);
  return { totals, ranked, topProtocols, tone };
}

function renderAssessmentResult(result, options = {}) {
  const { persist = false, scroll = true } = options;
  const tone = result.tone || "default";
  const topProtocols = Array.isArray(result.topProtocols) && result.topProtocols.length
    ? result.topProtocols.slice(0, 3)
    : computeAssessmentResult(result.answers || []).topProtocols;

  document.getElementById("resultTitle").textContent = TONE_TITLES[tone] || TONE_TITLES.default;
  document.getElementById("resultSub").textContent = TONE_SUBS[tone] || TONE_SUBS.default;

  document.getElementById("resultGrid").innerHTML = topProtocols.map((k, i) => {
    const meta = PROTOCOL_META[k];
    if (!meta) return "";
    return `
      <div class="result-card">
        <span class="result-rank">${String(i + 1).padStart(2, "0")}</span>
        <h4>${meta.name}</h4>
        <p>${meta.detail}</p>
      </div>
    `;
  }).join("");

  if (persist) {
    Storage.push(STORAGE_KEYS.assessments, {
      ts: Date.now(),
      answers: state.answers.slice(),
      topProtocols,
      tone,
    });
    renderLastAssessmentBanner();
  }

  assessCard.hidden = true;
  resultPanel.hidden = false;
  if (scroll) resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showResult() {
  const result = computeAssessmentResult(state.answers);
  renderAssessmentResult(result, { persist: true });
}

function relativeAssessmentAge(ts) {
  const then = new Date(ts);
  if (Number.isNaN(then.getTime())) return "recently";
  const today = new Date(`${isoToday()}T00:00:00`);
  const thenDay = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const diff = Math.max(0, Math.floor((today - thenDay) / 86400000));
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  return `${diff} days ago`;
}

function getLastAssessment() {
  const saved = Storage.get(STORAGE_KEYS.assessments, []);
  return Array.isArray(saved) && saved.length ? saved[saved.length - 1] : null;
}

function renderLastAssessmentBanner() {
  const banner = document.getElementById("lastAssessmentBanner");
  const text = document.getElementById("lastAssessmentText");
  if (!banner || !text) return;
  const last = getLastAssessment();
  if (!last) {
    banner.hidden = true;
    return;
  }
  text.textContent = `Last assessment: ${relativeAssessmentAge(last.ts)} — see results`;
  banner.hidden = false;
}

backBtn.addEventListener("click", () => {
  if (state.idx > 0) { state.idx--; renderQuestion(); }
});
nextBtn.addEventListener("click", () => {
  if (state.idx < QUESTIONS.length - 1) { state.idx++; renderQuestion(); }
  else showResult();
});
function retakeAssessment() {
  state = { idx: 0, answers: [] };
  resultPanel.hidden = true;
  assessCard.hidden = false;
  renderQuestion();
  assessCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("restartBtn").addEventListener("click", retakeAssessment);

const viewLastAssessmentBtn = document.getElementById("viewLastAssessmentBtn");
const retakeAssessmentBannerBtn = document.getElementById("retakeAssessmentBannerBtn");

if (viewLastAssessmentBtn) {
  viewLastAssessmentBtn.addEventListener("click", () => {
    const last = getLastAssessment();
    if (!last) return;
    renderAssessmentResult(last, { persist: false });
  });
}

if (retakeAssessmentBannerBtn) {
  retakeAssessmentBannerBtn.addEventListener("click", retakeAssessment);
}

renderQuestion();
renderLastAssessmentBanner();

/* ============ PACER ============ */
const circle = document.getElementById("pacerCircle");
const phaseEl = document.getElementById("pacerPhase");
const countEl = document.getElementById("pacerCount");
const sessionTimeEl = document.getElementById("sessionTime");
const breathCountEl = document.getElementById("breathCount");
const patternLabelEl = document.getElementById("patternLabel");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const patternSelect = document.getElementById("patternSelect");
const durationSelect = document.getElementById("durationSelect");
const audioToggle = document.getElementById("audioToggle");

let pacer = {
  running: false,
  phases: [],          // [{name, duration, scale}]
  phaseIdx: 0,
  phaseStart: 0,       // ms
  sessionStart: 0,
  elapsedSec: 0,
  breaths: 0,
  totalDuration: 300,  // seconds, 0 = open
  rafId: null,
  audioCtx: null,
  sessionSaved: false,
};

const PATTERNS = {
  "4-6":     [{ name: "Inhale", d: 4, scale: 1.0 }, { name: "Exhale", d: 6, scale: 0.55 }],
  "4-7":     [{ name: "Inhale", d: 4, scale: 1.0 }, { name: "Exhale", d: 7, scale: 0.55 }],
  "5-5":     [{ name: "Inhale", d: 5, scale: 1.0 }, { name: "Exhale", d: 5, scale: 0.55 }],
  "4-4-4-4": [{ name: "Inhale", d: 4, scale: 1.0 }, { name: "Hold", d: 4, scale: 1.0 }, { name: "Exhale", d: 4, scale: 0.55 }, { name: "Hold", d: 4, scale: 0.55 }],
  "6-6":     [{ name: "Inhale", d: 6, scale: 1.0 }, { name: "Exhale", d: 6, scale: 0.55 }],
};

function loadPattern() {
  const key = patternSelect.value;
  pacer.phases = PATTERNS[key];
  patternLabelEl.textContent = key.replace(/-/g, " / ");
  pacer.totalDuration = +durationSelect.value;
}

function easeInOutQuad(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2; }

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

function playCue(phaseName) {
  if (!audioToggle.checked) return;
  if (!pacer.audioCtx) pacer.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const ctx = pacer.audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain).connect(ctx.destination);
  // Soft sine: lower for exhale
  const freq = phaseName === "Inhale" ? 528 : phaseName === "Exhale" ? 396 : 440;
  osc.frequency.value = freq;
  osc.type = "sine";
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
  osc.start();
  osc.stop(ctx.currentTime + 0.45);
}

function tick() {
  if (!pacer.running) return;
  const now = performance.now();
  const sessionMs = now - pacer.sessionStart;
  const sessionSec = sessionMs / 1000;
  pacer.elapsedSec = sessionSec;

  // Stop on duration
  if (pacer.totalDuration > 0 && sessionSec >= pacer.totalDuration) {
    pacer.elapsedSec = pacer.totalDuration;
    stopPacer(true);
    return;
  }

  const phase = pacer.phases[pacer.phaseIdx];
  const elapsed = (now - pacer.phaseStart) / 1000;
  const t = Math.min(elapsed / phase.d, 1);

  // Determine animation: from previous scale → current scale
  const prevPhase = pacer.phases[(pacer.phaseIdx - 1 + pacer.phases.length) % pacer.phases.length];
  const fromScale = prevPhase.scale;
  const toScale = phase.scale;
  const eased = easeInOutQuad(t);
  const scale = fromScale + (toScale - fromScale) * eased;
  circle.style.setProperty("--scale", scale.toFixed(3));

  phaseEl.textContent = phase.name;
  const remaining = Math.max(0, Math.ceil(phase.d - elapsed));
  countEl.textContent = remaining;

  sessionTimeEl.textContent = fmtTime(sessionSec);
  breathCountEl.textContent = pacer.breaths;

  if (t >= 1) {
    pacer.phaseIdx = (pacer.phaseIdx + 1) % pacer.phases.length;
    pacer.phaseStart = now;
    if (pacer.phases[pacer.phaseIdx].name === "Inhale") pacer.breaths++;
    playCue(pacer.phases[pacer.phaseIdx].name);
  }

  pacer.rafId = requestAnimationFrame(tick);
}

function startPacer() {
  loadPattern();
  pacer.running = true;
  pacer.phaseIdx = 0;
  pacer.phaseStart = performance.now();
  pacer.sessionStart = performance.now();
  pacer.elapsedSec = 0;
  pacer.breaths = 0;
  pacer.sessionSaved = false;
  startBtn.textContent = "Pause";
  circle.classList.add("is-running");
  playCue(pacer.phases[0].name);
  pacer.rafId = requestAnimationFrame(tick);
}

function pausePacer() {
  pacer.running = false;
  cancelAnimationFrame(pacer.rafId);
  startBtn.textContent = "Resume";
  circle.classList.remove("is-running");
}

function currentPacerDurationSec() {
  if (pacer.running && pacer.sessionStart) {
    return (performance.now() - pacer.sessionStart) / 1000;
  }
  return pacer.elapsedSec || 0;
}

function cycleSecondsForPattern(patternKey) {
  const phases = PATTERNS[patternKey] || [];
  return phases.reduce((sum, phase) => sum + phase.d, 0);
}

function savePacerSession(complete) {
  if (pacer.sessionSaved) return;
  const pattern = patternSelect.value;
  const rawSeconds = complete && pacer.totalDuration > 0 ? pacer.totalDuration : currentPacerDurationSec();
  const actualSeconds = Math.max(0, Math.round(rawSeconds));
  if (actualSeconds < 1) return;
  const cycleSec = cycleSecondsForPattern(pattern);
  const computedBreaths = cycleSec ? Math.floor(actualSeconds / cycleSec) : pacer.breaths;
  const breathCount = Math.max(pacer.breaths, computedBreaths);
  Storage.push(STORAGE_KEYS.breathSessions, {
    ts: Date.now(),
    pattern,
    durationSec: actualSeconds,
    breathCount,
    completed: Boolean(complete),
  }, 100);
  pacer.sessionSaved = true;
  renderBreathLog();
}

function stopPacer(complete = false) {
  pacer.elapsedSec = complete && pacer.totalDuration > 0 ? pacer.totalDuration : currentPacerDurationSec();
  if (complete && pacer.totalDuration > 0) {
    const cycleSec = cycleSecondsForPattern(patternSelect.value);
    if (cycleSec) pacer.breaths = Math.max(pacer.breaths, Math.floor(pacer.elapsedSec / cycleSec));
    breathCountEl.textContent = pacer.breaths;
    sessionTimeEl.textContent = fmtTime(pacer.elapsedSec);
  }
  savePacerSession(complete);
  pacer.running = false;
  cancelAnimationFrame(pacer.rafId);
  circle.style.setProperty("--scale", 0.55);
  circle.classList.remove("is-running");
  startBtn.textContent = "Start";
  phaseEl.textContent = complete ? "Complete" : "Ready";
  countEl.textContent = complete ? "✓" : "—";
}

startBtn.addEventListener("click", () => {
  if (!pacer.running && startBtn.textContent === "Start") startPacer();
  else if (pacer.running) pausePacer();
  else { // Resume
    pacer.running = true;
    pacer.phaseStart = performance.now();
    pacer.sessionStart = performance.now() - (pacer.elapsedSec || 0) * 1000;
    startBtn.textContent = "Pause";
    circle.classList.add("is-running");
    pacer.rafId = requestAnimationFrame(tick);
  }
});

resetBtn.addEventListener("click", () => {
  stopPacer(false);
  pacer.elapsedSec = 0;
  pacer.breaths = 0;
  sessionTimeEl.textContent = "0:00";
  breathCountEl.textContent = "0";
});

patternSelect.addEventListener("change", () => {
  loadPattern();
  if (!pacer.running) {
    patternLabelEl.textContent = patternSelect.value.replace(/-/g, " / ");
  }
});
durationSelect.addEventListener("change", () => { pacer.totalDuration = +durationSelect.value; });

loadPattern();
circle.style.setProperty("--scale", 0.55);

/* ============ BREATH SESSION LOG ============ */
function getBreathSessions() {
  const sessions = Storage.get(STORAGE_KEYS.breathSessions, []);
  return Array.isArray(sessions) ? sessions.filter(s => s && typeof s.ts === "number") : [];
}

function minutesLabel(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins ? `${hours} hr ${mins} min` : `${hours} hr`;
}

function getCurrentBreathStreak(sessions) {
  const sessionDates = new Set(sessions.map(s => dateToISO(new Date(s.ts))));
  let cursor = isoToday();
  let streak = 0;
  if (!sessionDates.has(cursor)) {
    const yesterday = addDaysISO(cursor, -1);
    if (!sessionDates.has(yesterday)) return 0;
    cursor = yesterday;
  }
  while (sessionDates.has(cursor)) {
    streak++;
    cursor = addDaysISO(cursor, -1);
  }
  return streak;
}

function renderBreathLog() {
  const totalMinutesEl = document.getElementById("breathTotalMinutes");
  const streakEl = document.getElementById("breathCurrentStreak");
  const countEl = document.getElementById("breathSessionTotal");
  const dailyList = document.getElementById("breathDailyList");
  const recentList = document.getElementById("breathRecentList");
  if (!totalMinutesEl || !streakEl || !countEl || !dailyList || !recentList) return;

  const sessions = getBreathSessions();
  const totalMinutes = sessions.reduce((sum, s) => sum + (Number(s.durationSec) || 0), 0) / 60;
  totalMinutesEl.textContent = minutesLabel(totalMinutes);
  const streak = getCurrentBreathStreak(sessions);
  streakEl.textContent = `${streak} ${streak === 1 ? "day" : "days"}`;
  countEl.textContent = String(sessions.length);

  const today = isoToday();
  const days = Array.from({ length: 14 }, (_, i) => addDaysISO(today, i - 13));
  const minutesByDay = new Map(days.map(day => [day, 0]));
  sessions.forEach(session => {
    const day = dateToISO(new Date(session.ts));
    if (minutesByDay.has(day)) {
      minutesByDay.set(day, minutesByDay.get(day) + (Number(session.durationSec) || 0) / 60);
    }
  });
  const maxMinutes = Math.max(1, ...Array.from(minutesByDay.values()));
  dailyList.innerHTML = days.map(day => {
    const minutes = minutesByDay.get(day) || 0;
    const width = Math.max(3, Math.round((minutes / maxMinutes) * 100));
    return `
      <li class="breath-day-row">
        <span>${formatDate(day)}</span>
        <span class="breath-day-bar" aria-hidden="true"><span style="width:${width}%"></span></span>
        <span>${minutes ? minutesLabel(minutes) : "0 min"}</span>
      </li>
    `;
  }).join("");

  const recent = sessions.slice().sort((a, b) => b.ts - a.ts).slice(0, 5);
  recentList.innerHTML = recent.length ? recent.map(session => `
    <li>
      <span>${formatDate(session.ts)}</span>
      <span>${escapeHtml(session.pattern || "—")}</span>
      <span>${fmtTime(Number(session.durationSec) || 0)}</span>
    </li>
  `).join("") : `<li>No sessions yet.</li>`;
}

renderBreathLog();

/* ============ MANUAL HRV TRACKER ============ */
const trackForm = document.getElementById("trackForm");
const hrvDateInput = document.getElementById("hrvDate");
const hrvValueInput = document.getElementById("hrvValue");
const hrvNoteInput = document.getElementById("hrvNote");
const hrvChartEl = document.getElementById("hrvChart");
const hrvAvg7El = document.getElementById("hrvAvg7");
const hrvAvg30El = document.getElementById("hrvAvg30");
const hrvTrendEl = document.getElementById("hrvTrend");
const readingsTableEl = document.getElementById("readingsTable");
const hrvExportBtn = document.getElementById("hrvExportBtn");
const hrvImportBtn = document.getElementById("hrvImportBtn");
const hrvImportFile = document.getElementById("hrvImportFile");

function getReadings() {
  const readings = Storage.get(STORAGE_KEYS.readings, []);
  if (!Array.isArray(readings)) return [];
  return readings
    .filter(r => r && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(Number(r.hrv)))
    .map(r => ({ date: r.date, hrv: Number(r.hrv), note: String(r.note || "") }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function saveReadings(readings) {
  const clean = readings
    .filter(r => r && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(Number(r.hrv)) && Number(r.hrv) > 0)
    .map(r => ({ date: r.date, hrv: Number(r.hrv), note: String(r.note || "") }))
    .sort((a, b) => a.date.localeCompare(b.date));
  Storage.set(STORAGE_KEYS.readings, clean);
  return clean;
}

function average(values) {
  const nums = values.filter(v => Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function readingsInRange(readings, startISO, endISO) {
  return readings.filter(r => r.date >= startISO && r.date <= endISO).map(r => r.hrv);
}

function formatMs(value) {
  return Number.isFinite(value) ? `${Math.round(value)} ms` : "—";
}

function renderHrvChart(readings) {
  if (!hrvChartEl) return;
  const width = 720;
  const height = 280;
  const pad = { top: 24, right: 24, bottom: 34, left: 46 };
  const today = isoToday();
  const days = Array.from({ length: 30 }, (_, i) => addDaysISO(today, i - 29));
  const byDate = new Map(readings.map(r => [r.date, r]));
  const points = days.map((day, i) => ({ date: day, hrv: byDate.get(day)?.hrv ?? null, i }));
  const values = points.map(p => p.hrv).filter(v => Number.isFinite(v));

  if (!values.length) {
    hrvChartEl.innerHTML = `<p class="track-empty">No HRV readings yet. Save your first reading to draw the chart.</p>`;
    return;
  }

  const baselineBands = points.map((p, i) => {
    const trailingStart = days[Math.max(0, i - 6)];
    const avg = average(readingsInRange(readings, trailingStart, p.date));
    return avg ? { low: avg * 0.9, high: avg * 1.1 } : null;
  });
  const bandValues = baselineBands.flatMap(b => b ? [b.low, b.high] : []);
  const minVal = Math.min(...values, ...bandValues);
  const maxVal = Math.max(...values, ...bandValues);
  const padding = Math.max(5, (maxVal - minVal) * 0.12);
  const yMin = Math.max(0, minVal - padding);
  const yMax = maxVal + padding;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xFor = i => pad.left + (days.length === 1 ? 0 : (i / (days.length - 1)) * innerW);
  const yFor = value => pad.top + (1 - ((value - yMin) / (yMax - yMin || 1))) * innerH;

  const plotted = points.filter(p => Number.isFinite(p.hrv)).map(p => ({ ...p, x: xFor(p.i), y: yFor(p.hrv) }));
  const linePoints = plotted.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const upper = baselineBands.map((b, i) => b ? `${xFor(i).toFixed(1)},${yFor(b.high).toFixed(1)}` : null).filter(Boolean);
  const lower = baselineBands.map((b, i) => b ? `${xFor(i).toFixed(1)},${yFor(b.low).toFixed(1)}` : null).filter(Boolean).reverse();
  const bandPath = upper.length && lower.length ? `M ${upper.join(" L ")} L ${lower.join(" L ")} Z` : "";
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  hrvChartEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" aria-hidden="true" focusable="false">
      <rect x="${pad.left}" y="${pad.top}" width="${innerW}" height="${innerH}" fill="none" stroke="currentColor" opacity="0.18" />
      ${bandPath ? `<path d="${bandPath}" fill="currentColor" opacity="0.08"></path>` : ""}
      ${yTicks.map(t => `
        <line x1="${pad.left}" x2="${width - pad.right}" y1="${yFor(t).toFixed(1)}" y2="${yFor(t).toFixed(1)}" stroke="currentColor" opacity="0.12" />
        <text x="${pad.left - 8}" y="${(yFor(t) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="currentColor">${Math.round(t)}</text>
      `).join("")}
      ${linePoints ? `<polyline points="${linePoints}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ""}
      ${plotted.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="currentColor"><title>${formatDate(p.date)}: ${p.hrv} ms</title></circle>`).join("")}
      <text x="${pad.left}" y="${height - 10}" font-size="11" fill="currentColor">${formatDate(days[0])}</text>
      <text x="${width - pad.right}" y="${height - 10}" text-anchor="end" font-size="11" fill="currentColor">${formatDate(days[days.length - 1])}</text>
    </svg>
    <p class="track-chart-note">Shaded band is ±10% of the trailing 7-day average.</p>
  `;
}

function renderHrvStats(readings) {
  const today = isoToday();
  const avg7 = average(readingsInRange(readings, addDaysISO(today, -6), today));
  const avg30 = average(readingsInRange(readings, addDaysISO(today, -29), today));
  const prior7 = average(readingsInRange(readings, addDaysISO(today, -13), addDaysISO(today, -7)));
  if (hrvAvg7El) hrvAvg7El.textContent = formatMs(avg7);
  if (hrvAvg30El) hrvAvg30El.textContent = formatMs(avg30);
  if (hrvTrendEl) {
    if (avg7 && prior7) {
      const pct = ((avg7 - prior7) / prior7) * 100;
      const arrow = pct >= 0 ? "↑" : "↓";
      hrvTrendEl.textContent = `${arrow} ${Math.abs(pct).toFixed(1)}%`;
    } else {
      hrvTrendEl.textContent = "—";
    }
  }
}

function renderReadingsTable(readings) {
  if (!readingsTableEl) return;
  const recent = readings.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  readingsTableEl.innerHTML = recent.length ? recent.map(reading => `
    <tr>
      <td>${formatDate(reading.date)}</td>
      <td>${reading.hrv} ms</td>
      <td>${escapeHtml(reading.note || "")}</td>
      <td><button class="btn-ghost btn-sm" type="button" data-delete-reading="${reading.date}">Delete</button></td>
    </tr>
  `).join("") : `<tr><td colspan="4">No readings yet.</td></tr>`;
}

function renderTracker() {
  const readings = getReadings();
  renderHrvChart(readings);
  renderHrvStats(readings);
  renderReadingsTable(readings);
}

function upsertReading(date, hrv, note) {
  const readings = getReadings().filter(r => r.date !== date);
  readings.push({ date, hrv: Number(hrv), note: String(note || "") });
  saveReadings(readings);
  renderTracker();
}

function csvEscape(value) {
  const str = String(value ?? "");
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function exportReadingsCSV() {
  const readings = getReadings();
  const csv = ["date,hrv,note", ...readings.map(r => [r.date, r.hrv, r.note].map(csvEscape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hrv-readings-${isoToday()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some(v => v.trim() !== "")) rows.push(row);
  return rows;
}

function importReadingsCSV(text) {
  const rows = parseCSV(text);
  if (!rows.length) return;
  const header = rows[0].map(h => h.trim().toLowerCase());
  const hasHeader = header.includes("date") && header.includes("hrv");
  const dateIdx = hasHeader ? header.indexOf("date") : 0;
  const hrvIdx = hasHeader ? header.indexOf("hrv") : 1;
  const noteIdx = hasHeader ? header.indexOf("note") : 2;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const existing = getReadings().filter(r => !dataRows.some(row => row[dateIdx] === r.date));
  const imported = [];
  dataRows.forEach(row => {
    const date = (row[dateIdx] || "").trim();
    const hrv = Number(row[hrvIdx]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(hrv) || hrv <= 0) return;
    imported.push({ date, hrv, note: String(row[noteIdx] || "") });
  });
  const byDate = new Map([...existing, ...imported].map(r => [r.date, r]));
  saveReadings(Array.from(byDate.values()));
  renderTracker();
}

if (hrvDateInput) hrvDateInput.value = isoToday();

if (trackForm) {
  trackForm.addEventListener("submit", event => {
    event.preventDefault();
    const date = hrvDateInput.value;
    const hrv = Number(hrvValueInput.value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(hrv) || hrv <= 0) return;
    upsertReading(date, hrv, hrvNoteInput.value.trim());
    hrvNoteInput.value = "";
  });
}

if (readingsTableEl) {
  readingsTableEl.addEventListener("click", event => {
    const btn = event.target.closest("[data-delete-reading]");
    if (!btn) return;
    const date = btn.getAttribute("data-delete-reading");
    saveReadings(getReadings().filter(r => r.date !== date));
    renderTracker();
  });
}

if (hrvExportBtn) hrvExportBtn.addEventListener("click", exportReadingsCSV);
if (hrvImportBtn && hrvImportFile) hrvImportBtn.addEventListener("click", () => hrvImportFile.click());
if (hrvImportFile) {
  hrvImportFile.addEventListener("change", () => {
    const file = hrvImportFile.files && hrvImportFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => importReadingsCSV(String(reader.result || "")));
    reader.readAsText(file);
    hrvImportFile.value = "";
  });
}

renderTracker();
