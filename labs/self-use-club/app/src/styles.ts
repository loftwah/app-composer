export const styles = String.raw`
:root {
  color-scheme: light dark;
  --paper: #f6f2e8;
  --paper-deep: #eee8da;
  --card: #fffdf7;
  --ink: #1d2724;
  --muted: #5b665f;
  --line: #d7d0bf;
  --river: #17463f;
  --river-soft: #d9e8df;
  --accent: #c9511c;
  --accent-ink: #8a3410;
  --accent-soft: #f7e1d3;
  --focus: #1c6f78;
  --danger: #9d2f24;
  --radius: 10px;
  --shadow: 0 1px 2px rgba(29, 39, 36, 0.06), 0 14px 34px rgba(29, 39, 36, 0.07);
  font-synthesis: none;
}

@media (prefers-color-scheme: dark) {
  :root {
    --paper: #101715;
    --paper-deep: #0b1210;
    --card: #17211e;
    --ink: #edf3ee;
    --muted: #a8b7ae;
    --line: #2c3a34;
    --river: #9fd2c1;
    --river-soft: #1d302a;
    --accent: #ff9a62;
    --accent-ink: #ffc5a5;
    --accent-soft: #33211a;
    --focus: #83d5dd;
    --danger: #ff9b8e;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 18px 40px rgba(0, 0, 0, 0.28);
  }
}

*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3 { font-family: ui-serif, Georgia, "Times New Roman", serif; font-weight: 600; letter-spacing: -0.015em; line-height: 1.12; margin: 0; }
p { margin: 0 0 1em; }
a { color: inherit; text-decoration: none; }
a:hover { color: var(--accent-ink); }
a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, summary:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
  border-radius: 4px;
}
img, svg { max-width: 100%; height: auto; }
hr { border: 0; border-top: 1px solid var(--line); margin: 32px 0; }

.shell { width: 100%; max-width: 1120px; margin: 0 auto; padding: 0 24px; }
.skip-link { position: absolute; left: -999px; top: 12px; z-index: 10; background: var(--card); padding: 12px 16px; border: 1px solid var(--line); }
.skip-link:focus { left: 24px; }

.site-header { border-bottom: 1px solid var(--line); background: var(--paper); }
.site-header .shell { min-height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.wordmark { display: inline-flex; align-items: center; gap: 12px; min-height: 44px; }
.wordmark svg { flex: 0 0 auto; }
.wordmark span { display: block; line-height: 1.15; }
.wordmark strong { display: block; font-family: ui-serif, Georgia, serif; font-size: 1.12rem; letter-spacing: -0.01em; }
.wordmark small { display: block; color: var(--muted); font-size: 0.72rem; letter-spacing: 0.09em; text-transform: uppercase; margin-top: 3px; }
.site-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 22px; }
.site-nav a { display: inline-flex; align-items: center; min-height: 44px; font-size: 0.92rem; color: var(--muted); }
.site-nav a:hover, .site-nav a[aria-current="page"] { color: var(--ink); }
.site-nav a[aria-current="page"] { box-shadow: inset 0 -2px var(--accent); }

.eyebrow { display: inline-block; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent-ink); font-weight: 650; margin: 0 0 14px; }
.lede { font-size: 1.12rem; color: var(--muted); max-width: 58ch; }

.button {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  min-height: 46px; padding: 11px 18px; border: 1px solid var(--river); border-radius: 7px;
  background: var(--river); color: var(--paper); font: inherit; font-weight: 650; line-height: 1.2;
  cursor: pointer; text-align: center;
}
.button:hover { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.button.secondary { background: transparent; color: var(--ink); border-color: var(--line); font-weight: 600; }
.button.secondary:hover { background: var(--paper-deep); border-color: var(--muted); color: var(--ink); }
.button.small { min-height: 40px; padding: 8px 13px; font-size: 0.86rem; }
.button.danger { background: transparent; border-color: var(--danger); color: var(--danger); }
.button.danger:hover { background: var(--danger); color: var(--card); }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }

.hero { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.85fr); gap: 48px; align-items: center; padding: 58px 0 54px; }
.hero h1 { font-size: clamp(2.65rem, 6vw, 4.5rem); margin: 0 0 20px; max-width: 15ch; }
.hero .lede { margin-bottom: 26px; }
.hero-art { justify-self: end; width: min(100%, 360px); }
.hero-art figcaption { margin-top: 10px; font-size: 0.78rem; color: var(--muted); text-align: right; }

.river-scene { display: block; border: 1px solid var(--line); border-radius: 50% 50% 12px 12px; background: var(--river-soft); }
.river-line { fill: none; stroke: var(--river); stroke-width: 3; stroke-linecap: round; opacity: 0.85; }
.river-line.thin { stroke-width: 1.4; opacity: 0.5; }
.oar { fill: var(--card); stroke: var(--river); stroke-width: 2.5; }
.oar-blade { fill: var(--accent); stroke: var(--river); stroke-width: 2.5; }

.next-event { border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); box-shadow: var(--shadow); padding: 22px; }
.next-event-head { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 14px; }
.next-event-head h2 { margin-bottom: 0; }
.next-event .label.tight { margin-bottom: 6px; }
.next-event .label { margin: 0 0 16px; font-size: 0.72rem; letter-spacing: 0.13em; text-transform: uppercase; color: var(--accent-ink); font-weight: 700; }
.next-event h2 { font-size: 1.55rem; margin-bottom: 8px; }
.next-event p { color: var(--muted); font-size: 0.94rem; }
.next-event .meta { color: var(--ink); font-size: 0.87rem; margin: 14px 0 18px; }
.next-event .meta span { display: block; }

.date-tile { display: grid; place-items: center; width: 58px; height: 64px; border: 1px solid var(--line); border-radius: 7px; background: var(--paper); flex: 0 0 auto; }
.date-tile b { display: block; font: 650 1.45rem/1 ui-serif, Georgia, serif; }
.date-tile span { display: block; font-size: 0.66rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent-ink); margin-top: 3px; }
.meta.top { margin-top: 8px !important; }

.notice-strip { border-block: 1px solid var(--line); background: var(--paper-deep); }
.notice-strip .shell { display: flex; gap: 16px; align-items: baseline; padding-block: 12px; }
.notice-strip strong { font-size: 0.72rem; letter-spacing: 0.13em; text-transform: uppercase; color: var(--accent-ink); flex: 0 0 auto; }
.notice-strip p { margin: 0; font-size: 0.9rem; color: var(--muted); }
.notice-strip a { font-weight: 650; color: var(--ink); }

.section { padding: 52px 0 8px; }
.section-head { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 24px; border-bottom: 1px solid var(--line); padding-bottom: 16px; }
.section-head h2 { font-size: clamp(1.65rem, 3.2vw, 2.15rem); }
.section-head p { margin: 6px 0 0; color: var(--muted); font-size: 0.92rem; max-width: 62ch; }
.section-head > a { font-size: 0.88rem; font-weight: 650; color: var(--accent-ink); flex: 0 0 auto; }

.event-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.event-card { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 16px; padding: 20px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); }
.event-card h3 { font-size: 1.2rem; margin-bottom: 6px; }
.event-card h3 a:hover { color: var(--accent-ink); }
.event-card p { color: var(--muted); font-size: 0.9rem; margin-bottom: 10px; }
.event-card .meta { color: var(--ink); font-size: 0.8rem; margin: 0; }
.event-card .meta span { display: block; }
.tag { display: inline-block; font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent-ink); background: var(--accent-soft); border-radius: 999px; padding: 3px 8px; margin-bottom: 8px; font-weight: 700; }

.split { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.65fr); gap: 44px; align-items: start; }
.notice-list { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--line); }
.notice-list li { padding: 18px 0; border-bottom: 1px solid var(--line); }
.notice-list h3 { font-size: 1.08rem; margin-bottom: 5px; }
.notice-list p { font-size: 0.9rem; color: var(--muted); margin: 0 0 7px; }
.notice-list time { font-size: 0.76rem; color: var(--accent-ink); letter-spacing: 0.04em; }

.join-panel { border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); padding: 24px; box-shadow: var(--shadow); }
.join-panel h2 { font-size: 1.5rem; margin-bottom: 8px; }
.join-panel p { color: var(--muted); font-size: 0.91rem; }
.join-panel .button { width: 100%; margin-top: 6px; }

.volunteer-list { display: grid; gap: 14px; }
.volunteer-card { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); padding: 18px 20px; }
.volunteer-card h3 { font-size: 1.1rem; }
.volunteer-card p { margin: 4px 0 0; color: var(--muted); font-size: 0.88rem; }
.volunteer-card .role-summary { max-width: 72ch; }
.places { font-size: 0.82rem; font-weight: 650; color: var(--accent-ink); white-space: nowrap; }
.places.full { color: var(--muted); }

.page-head { padding: 46px 0 28px; border-bottom: 1px solid var(--line); }
.page-head h1 { font-size: clamp(2.3rem, 5vw, 3.6rem); margin-bottom: 14px; max-width: 22ch; }
.page-head .lede { margin: 0; }
.prose { max-width: 70ch; }
.prose h2 { font-size: 1.5rem; margin: 34px 0 10px; }
.prose h3 { font-size: 1.15rem; margin: 26px 0 8px; }
.prose ul { padding-left: 20px; }
.prose li { margin-bottom: 6px; }
.detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 0.45fr); gap: 42px; padding: 38px 0 60px; align-items: start; }
.detail-facts { border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); padding: 20px; }
.detail-facts dl { margin: 0; }
.detail-facts div { padding: 12px 0; border-bottom: 1px solid var(--line); }
.detail-facts div:last-child { border-bottom: 0; padding-bottom: 0; }
.detail-facts dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
.detail-facts dd { margin: 4px 0 0; font-size: 0.94rem; overflow-wrap: anywhere; }

.form-card { border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); padding: 26px; box-shadow: var(--shadow); }
.form-card h2 { font-size: 1.55rem; margin-bottom: 6px; }
.form-card > p { color: var(--muted); font-size: 0.92rem; }
.field { margin: 0 0 18px; }
.field label, .field-label { display: block; font-weight: 650; font-size: 0.9rem; margin-bottom: 6px; }
.field .hint { display: block; color: var(--muted); font-size: 0.8rem; font-weight: 400; margin-top: 4px; }
input, textarea, select {
  width: 100%; max-width: 100%; min-height: 46px; padding: 10px 12px;
  border: 1px solid var(--muted); border-radius: 6px;
  background: var(--paper); color: var(--ink); font: inherit; font-size: 1rem;
}
textarea { min-height: 120px; resize: vertical; }
input[aria-invalid="true"], textarea[aria-invalid="true"], select[aria-invalid="true"] { border-color: var(--danger); border-width: 2px; }
.error-text { color: var(--danger); font-size: 0.84rem; margin: 5px 0 0; font-weight: 600; }
.form-errors { border: 2px solid var(--danger); border-radius: 7px; padding: 14px 16px; margin: 0 0 22px; background: var(--paper); }
.form-errors h2 { font: 650 1rem/1.35 ui-sans-serif, system-ui, sans-serif; margin-bottom: 6px; color: var(--danger); }
.form-errors ul { margin: 0; padding-left: 18px; font-size: 0.88rem; }
.form-errors li { margin-bottom: 3px; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.form-note { font-size: 0.82rem; color: var(--muted); border-top: 1px solid var(--line); padding-top: 14px; margin-top: 20px; }

.empty { border: 1px dashed var(--line); border-radius: var(--radius); padding: 22px; color: var(--muted); background: var(--card); }
.empty strong { display: block; color: var(--ink); margin-bottom: 4px; }
.success-panel { border: 1px solid var(--river); border-radius: var(--radius); background: var(--card); padding: 26px; max-width: 720px; }
.success-panel h1 { font-size: clamp(2rem, 4vw, 2.8rem); margin-bottom: 12px; }
.reference { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 1rem; background: var(--paper-deep); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; display: inline-block; margin: 8px 0 16px; overflow-wrap: anywhere; }
.status { display: inline-block; font-size: 0.72rem; font-weight: 750; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 999px; padding: 4px 9px; }
.status.pending { background: var(--accent-soft); color: var(--accent-ink); }
.status.reviewed { background: var(--river-soft); color: var(--river); }
.status.draft { background: var(--paper-deep); color: var(--muted); border: 1px solid var(--line); }
.status.published { background: var(--river-soft); color: var(--river); }

.site-footer { border-top: 1px solid var(--line); margin-top: 64px; padding: 28px 0 40px; color: var(--muted); font-size: 0.83rem; }
.site-footer .shell { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 14px; }
.site-footer p { margin: 0; max-width: 70ch; }
.site-footer a { color: var(--ink); font-weight: 600; }

/* Owner area */
.admin-header { border-bottom: 1px solid var(--line); background: var(--paper-deep); }
.admin-header .shell { min-height: 64px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.admin-header strong { font-family: ui-serif, Georgia, serif; font-size: 1.1rem; }
.admin-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 18px; font-size: 0.86rem; }
.admin-nav a, .admin-nav button { color: var(--muted); }
.admin-nav a:hover { color: var(--ink); }
.admin-nav form { margin: 0; }
.admin-nav button { background: none; border: 0; padding: 10px 0; min-height: 44px; font: inherit; cursor: pointer; }
.admin-main { padding: 34px 0 60px; }
.admin-title { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 16px; margin-bottom: 24px; }
.admin-title h1 { font-size: clamp(2rem, 4vw, 2.8rem); }
.admin-title p { margin: 6px 0 0; color: var(--muted); font-size: 0.9rem; }
.stat-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 32px; }
.stat { border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); padding: 16px; }
.stat b { display: block; font: 650 1.9rem/1 ui-serif, Georgia, serif; }
.stat span { display: block; color: var(--muted); font-size: 0.8rem; margin-top: 5px; }
.admin-section { margin-bottom: 40px; }
.admin-section > h2 { font-size: 1.45rem; border-bottom: 1px solid var(--line); padding-bottom: 10px; margin-bottom: 18px; }
.admin-record { border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); padding: 18px; margin-bottom: 14px; }
.admin-record header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; align-items: baseline; }
.admin-record h3 { font-size: 1.08rem; }
.admin-record .when { font-size: 0.78rem; color: var(--muted); }
.admin-record .body { font-size: 0.9rem; margin: 10px 0; white-space: pre-line; overflow-wrap: anywhere; }
.admin-record .contact { font-size: 0.83rem; color: var(--muted); overflow-wrap: anywhere; }
.admin-record .actions { margin-top: 12px; }
.admin-record form.inline { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin-top: 12px; }
.admin-record form.inline .field { margin: 0; flex: 1 1 220px; }
.admin-empty { padding: 16px; border: 1px dashed var(--line); border-radius: 8px; color: var(--muted); font-size: 0.9rem; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.admin-table th, .admin-table td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
.admin-table th { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.admin-table a { font-weight: 650; color: var(--accent-ink); }
.admin-form { border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); padding: 22px; max-width: 760px; }
.admin-form h2 { font-size: 1.4rem; margin-bottom: 16px; }
.admin-followup { margin-top: 32px; }
.flash { border: 1px solid var(--river); background: var(--river-soft); color: var(--river); border-radius: 7px; padding: 10px 14px; margin-bottom: 20px; font-size: 0.9rem; }
.login-card { max-width: 460px; margin: 56px auto; }
.login-card .form-card { padding: 28px; }
.login-title { font-size: 2rem; margin-bottom: 10px; }
.admin-lede { font-weight: 400; color: var(--muted); }
.success-page { margin-top: 48px; }
.login-note { font-size: 0.83rem; color: var(--muted); border-top: 1px solid var(--line); margin-top: 20px; padding-top: 14px; }

@media (max-width: 900px) {
  .hero { grid-template-columns: 1fr; gap: 28px; padding-top: 38px; }
  .hero h1 { max-width: 18ch; }
  .hero-art { justify-self: start; width: min(100%, 320px); }
  .next-event { max-width: 520px; }
  .split, .detail-grid { grid-template-columns: 1fr; gap: 30px; }
  .event-grid { grid-template-columns: 1fr; }
  .site-header .shell { align-items: flex-start; flex-direction: column; padding-block: 12px; gap: 4px; }
  .site-nav { width: 100%; justify-content: flex-start; gap: 2px 18px; }
  .section-head { align-items: flex-start; flex-direction: column; gap: 8px; }
}

@media (max-width: 600px) {
  .shell { padding: 0 18px; }
  .hero { padding: 30px 0 34px; }
  .hero h1 { font-size: clamp(2.2rem, 11vw, 3rem); }
  .lede { font-size: 1rem; }
  .hero .actions .button { width: 100%; }
  .section { padding-top: 38px; }
  .field-row { grid-template-columns: 1fr; }
  .stat-row { grid-template-columns: 1fr; }
  .admin-table thead { display: none; }
  .admin-table, .admin-table tbody, .admin-table tr, .admin-table td { display: block; width: 100%; }
  .admin-table tr { border-bottom: 1px solid var(--line); padding: 10px 0; }
  .admin-table td { border: 0; padding: 4px 0; }
  .admin-record .actions .button { width: 100%; }
  .form-card, .admin-form { padding: 18px; }
  .notice-strip .shell { display: block; }
  .notice-strip strong { display: block; margin-bottom: 4px; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;
