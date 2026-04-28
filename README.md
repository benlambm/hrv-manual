# HRV Recovery Manual

A practical, evidence-backed quick-reference for raising heart rate variability through vagal tone, breathwork, sleep, cold, and movement protocols. Built for stress and burnout recovery.

**Live site:** https://benlambm.github.io/hrv-manual/

## What's inside

- **Personalized starter protocol** — five-question self-assessment that scores your answers against seven evidence-backed protocols and surfaces your top three. All scoring runs client-side; no data leaves the browser.
- **6-bpm breath pacer** — animated resonance-frequency breathing trainer with five pattern presets (4/6 default, 4/7, 5/5 coherent, 4/4/4/4 box, 6/6 slow), session timer, breath counter, and optional WebAudio cues.
- **Seven protocols ranked by leverage** — resonance breathing, sleep architecture, alcohol, zone 2 cardio, cold, sauna, biofeedback.
- **Week-by-week timeline** — what to expect Day 1 through Week 12.
- **Minimum-viable weekly plan** + suppressors to remove + interpretation rules for reading your wearable data.

## Stack

Pure HTML, CSS, and vanilla JavaScript. No build step, no framework, no dependencies. Three files:

```
index.html   # Structure
styles.css   # Design system + components
app.js       # Assessment logic + breath pacer
```

## Local dev

Open `index.html` in any browser. That's it.

```bash
# Or serve it for live reload
python3 -m http.server 8000
```

## Sources

- [Giorgi & Tedeschi 2025 — slow breathing scoping review](https://healthcarediscovery.ai/slow-breathing-vagal-tone-hrv-clinical-research-2025/)
- [Frontiers in Neuroscience — resonance frequency assessment](https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2020.570400/full)
- [PMC — Resonance breathing & HRV](https://pmc.ncbi.nlm.nih.gov/articles/PMC8924557/)
- [Grosicki et al. 2026 — HRV trend interpretation](https://www.ikigaihealthinstitute.com/blog/how-to-read-hrv-trends-grosicki-study)
- [Kubios — HRV metrics primer (RMSSD, SDNN)](https://www.kubios.com/blog/about-heart-rate-variability/)

## License

MIT — use freely. Not medical advice.
