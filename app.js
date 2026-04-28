/* =================================================================
   HRV MANUAL v2 — assessment + pacer
   ================================================================= */

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

function showResult() {
  const totals = { breath: 0, sleep: 0, alcohol: 0, zone2: 0, cold: 0, sauna: 0, biofeedback: 0 };
  let tone = "default";
  state.answers.forEach((ai, qi) => {
    const opt = QUESTIONS[qi].options[ai];
    Object.entries(opt.w).forEach(([k, v]) => totals[k] += v);
    if (opt.tone) tone = opt.tone;
  });

  const ranked = Object.entries(totals).sort((a,b) => b[1] - a[1]);
  const top3 = ranked.slice(0, 3);

  document.getElementById("resultTitle").textContent = TONE_TITLES[tone] || TONE_TITLES.default;
  document.getElementById("resultSub").textContent = TONE_SUBS[tone] || TONE_SUBS.default;

  document.getElementById("resultGrid").innerHTML = top3.map(([k], i) => {
    const meta = PROTOCOL_META[k];
    return `
      <div class="result-card">
        <span class="result-rank">${String(i + 1).padStart(2, "0")}</span>
        <h4>${meta.name}</h4>
        <p>${meta.detail}</p>
      </div>
    `;
  }).join("");

  assessCard.hidden = true;
  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

backBtn.addEventListener("click", () => {
  if (state.idx > 0) { state.idx--; renderQuestion(); }
});
nextBtn.addEventListener("click", () => {
  if (state.idx < QUESTIONS.length - 1) { state.idx++; renderQuestion(); }
  else showResult();
});
document.getElementById("restartBtn").addEventListener("click", () => {
  state = { idx: 0, answers: [] };
  resultPanel.hidden = true;
  assessCard.hidden = false;
  renderQuestion();
  assessCard.scrollIntoView({ behavior: "smooth", block: "start" });
});

renderQuestion();

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
  breaths: 0,
  totalDuration: 300,  // seconds, 0 = open
  rafId: null,
  audioCtx: null,
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

  // Stop on duration
  if (pacer.totalDuration > 0 && sessionSec >= pacer.totalDuration) {
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
  pacer.breaths = 0;
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

function stopPacer(complete = false) {
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
    startBtn.textContent = "Pause";
    circle.classList.add("is-running");
    pacer.rafId = requestAnimationFrame(tick);
  }
});

resetBtn.addEventListener("click", () => {
  stopPacer(false);
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
