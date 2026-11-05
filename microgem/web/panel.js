// <microgem-panel>: a MicroGEM60 controller, its hand-held MicroGEM
// Programmer, a live ladder diagram, the program text and a data-table monitor.
// The hardware is drawn from photos of a real MicroGEM60 and programmer.
// Used by the standalone page (WebSocket transport) and by Home Assistant as a
// custom panel (transport over Home Assistant's own connection).

// The maker's badge on the drawing. The real units carried the GEC Industrial
// Controls mark; this emulator is not theirs, so it shows a fictional maker in
// the same style.
const MAKER = { mark: "CEG", line1: "Industrial", line2: "Controls Ltd.", place: ["KIDSGROVE", "ENGLAND"] };

const STYLE = `
:host {
  --bg: #e9e6df; --text: #23211d; --muted: #6b665c; --panel: #f7f5f0; --border: #cfc9bd;
  --accent: #2f5d8a; --error: #b3261e;
  --crt: #07130d; --live: #3dff7a; --dead: #4d6b5a; --crt-text: #9fe8b6; --amber: #ffbf3d;
  --mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  display: block; min-height: 100%; background: var(--bg); color: var(--text);
  font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :host { --bg: #1b1a18; --text: #ece8df; --muted: #a39d90; --panel: #252320; --border: #3c3934; --accent: #86b4e3; --error: #ff8a80; }
}
* { box-sizing: border-box; }
main { max-width: 1240px; margin: 0 auto; padding: 24px 16px 48px; }
header h1 { margin: 0; font-size: 1.4rem; }
header p { margin: 4px 0 18px; color: var(--muted); }
.conn { font-size: .8rem; }
h2 { margin: 0 0 8px; font-size: 1rem; }
.hint { margin: 0 0 8px; color: var(--muted); font-size: .85rem; }

/* ---------- hardware row ---------- */
.hw { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 28px; align-items: start; }
.unit svg { width: 100%; height: auto; display: block; filter: drop-shadow(0 10px 16px rgba(0,0,0,.35)); }
.unit svg + svg { margin-top: 14px; }
.unit svg { color: var(--text); overflow: visible; }
.term { fill: transparent; }
.unit.wirable .term { cursor: pointer; }
.unit.wirable .term:hover, .term.sel { fill: rgba(255, 216, 58, .14); stroke: #ffd83a; stroke-width: 1.5; }
.cable { fill: none; stroke-width: 4; stroke-linecap: round; }
.cable.in { stroke: #8a5a2b; }
.cable.out { stroke: #2f6db3; }
.cable.on { stroke: #ff6a3d; filter: url(#glow); }
.sheath { fill: #3b3b3b; }
.wl { font: 600 15px system-ui, sans-serif; fill: currentColor; }
.wl tspan { fill: var(--muted); font-weight: 400; }
.toggle:disabled { cursor: not-allowed; opacity: .45; }
.wire-ed { margin-top: 14px; background: var(--panel); border: 2px solid #ffd83a; border-radius: 8px; padding: 12px 14px; }
.wire-ed h3 { margin: 0 0 4px; font-size: .95rem; }
.wire-ed label { display: flex; flex-direction: column; gap: 3px; font-size: .78rem; color: var(--muted); font-weight: 600; flex: 1 1 160px; min-width: 0; }
.wire-ed input { font: 13px var(--mono); padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); width: 100%; }
.wire-ed [hidden] { display: none !important; }
.unit.wirable .wl { cursor: pointer; }
.unit.wirable .wl:hover { fill: var(--accent); text-decoration: underline; }
.we-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.we-filters button { font: 600 12px/1 system-ui, sans-serif; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg); color: var(--text); cursor: pointer; }
.we-filters button.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.we-filters button small { font-weight: 400; opacity: .75; margin-left: 3px; }
.we-results { margin-top: 8px; max-height: 260px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); }
.we-results button { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1px 10px; width: 100%; text-align: left; padding: 6px 10px; border: 0; border-bottom: 1px solid var(--border); background: none; color: var(--text); cursor: pointer; font: inherit; }
.we-results button:last-child { border-bottom: 0; }
.we-results button:hover, .we-results button.hl { background: rgba(127, 127, 127, .12); }
.we-results button.chosen { background: color-mix(in srgb, var(--accent) 18%, transparent); }
.we-results b { font-weight: 600; font-size: .85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.we-results code { grid-column: 1; font-size: .72rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.we-results .st { grid-row: 1 / span 2; grid-column: 2; align-self: center; font: 12px var(--mono); color: var(--muted); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.we-results .none { padding: 10px; font-size: .85rem; color: var(--muted); }
.wire-ed label.check { flex-direction: row; align-items: center; gap: 8px; flex-basis: 100%; color: var(--text); font-weight: 400; font-size: .85rem; }
.wire-ed label.check input { width: auto; }
.wire-ed .fields { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.led { fill: #3a1414; transition: fill .04s; }
.led.g { fill: #15301a; }
.led.on { fill: #ff3b2f; filter: url(#glow); }
.led.g.on { fill: #4dff6a; }

.g80-ctl { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; font: 600 .8rem system-ui, sans-serif; color: var(--muted); }
.g80-ctl[hidden] { display: none; }
.g80-ctl .seg button { font-weight: 700; }
.hw.g80 { grid-template-columns: minmax(0, 1fr); }
.g80-only { display: none; }
:host(.g80) .g80-only { display: block; }
.sim { margin-top: 16px; background: #2b2926; border-radius: 8px; padding: 10px 12px 12px; color: #e8e1d2;
  box-shadow: inset 0 2px 0 rgba(255,255,255,.06), 0 3px 8px rgba(0,0,0,.25); }
.sim-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; font: 600 .72rem/1 Arial, sans-serif; letter-spacing: .12em; }
.group-label { margin-top: 10px; font: 600 .62rem/1 Arial, sans-serif; letter-spacing: .1em; color: #b8ad95; }
.analogue { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 2px 14px; margin-top: 8px; }
.an-row { display: grid; grid-template-columns: 46px 1fr 58px; align-items: center; gap: 6px; font: 12px var(--mono); }
.an-row input { width: 100%; accent-color: #5d7f46; }
.an-row .an-val { text-align: right; color: var(--muted); }
.toggles { display: grid; grid-template-columns: repeat(var(--n, 12), minmax(0, 1fr)); gap: 4px; margin-top: 10px; }
.toggle { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: 0; padding: 0; cursor: pointer; color: inherit; touch-action: manipulation; }
.toggle .plate { width: 22px; height: 34px; border-radius: 4px; background: linear-gradient(#5a554d, #2b2824); position: relative; box-shadow: inset 0 1px 2px rgba(0,0,0,.6); }
.toggle .lever { position: absolute; left: 7px; width: 8px; height: 18px; border-radius: 4px; background: linear-gradient(90deg, #d8d4cc, #fff, #a8a39a); top: 14px; transition: top .06s; box-shadow: 0 2px 2px rgba(0,0,0,.5); }
.toggle.on .lever { top: 2px; }
.toggle small { font: 600 .62rem/1 var(--mono); color: #cfc3a8; }
.seg { display: inline-flex; border: 1px solid #77705f; border-radius: 4px; overflow: hidden; }
.seg button { border: 0; background: #4a453d; color: #e8e1d2; padding: 4px 9px; font: 600 .7rem/1.2 Arial, sans-serif; letter-spacing: .06em; cursor: pointer; min-width: 30px; }
.seg button.active { background: #e8e1d2; color: #2a241c; }

/* ---------- 8920 Portable Programmer (GEM 80) ---------- */
.p8920 { margin-top: 22px; }
.p8920[hidden] { display: none; }
.p89 { outline: none; max-width: 1000px; margin: 0 auto; padding: 18px; border-radius: 14px; color: #2a2721;
  background: linear-gradient(#e4dece, #cec6b0); box-shadow: 0 12px 22px rgba(0,0,0,.35); }
.p89:focus-visible { box-shadow: 0 0 0 3px var(--accent), 0 12px 22px rgba(0,0,0,.35); }
.p89.alarm { animation: p89-alarm .35s; }
@keyframes p89-alarm { 30% { box-shadow: 0 0 0 4px #d33, 0 12px 22px rgba(0,0,0,.35); } }
.p89-hood { display: grid; grid-template-columns: minmax(0, 1fr) 140px; gap: 16px; align-items: center; }
.p89-bezel { background: #2c2b28; border-radius: 22px; padding: 16px; box-shadow: inset 0 4px 10px rgba(0,0,0,.6); }
.p89-screen { container-type: inline-size; border-radius: 18px / 26px; padding: 2.4% 2.8%;
  background: radial-gradient(ellipse at center, #0c2617, #030b06 85%); box-shadow: inset 0 0 30px rgba(0,0,0,.85); }
.p89-screen pre { margin: 0; font: 400 calc(100cqw / 49)/1.2 var(--mono); color: #8dffb0; white-space: pre; overflow: hidden;
  text-shadow: 0 0 4px rgba(90,255,150,.55); font-variant-numeric: slashed-zero; }
.p89-side { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
.p89-badge { display: flex; align-items: center; gap: 6px; background: #1d1d1d; color: #eee; padding: 6px 9px; border-radius: 3px; }
.p89-badge b { font: 900 20px/1 "Arial Black", Arial, sans-serif; }
.p89-badge span { font: 700 8px/1.2 Arial, sans-serif; text-align: left; }
.p89-model { font: 900 24px/1 Arial, sans-serif; letter-spacing: .02em; }
.p89-model small { display: block; font: 800 8.5px/1.4 Arial, sans-serif; letter-spacing: .06em; }
.p89-key { width: 46px; height: 46px; border-radius: 50%; padding: 0; cursor: pointer; display: grid; place-items: center;
  background: radial-gradient(circle at 40% 35%, #f0f0f0, #9a9a9a); border: 2px solid #6d6a62; }
.p89-key .barrel { width: 6px; height: 28px; border-radius: 3px; background: linear-gradient(90deg, #555, #222, #555); transform: rotate(-45deg); transition: transform .15s; }
.p89-key.mon .barrel { transform: rotate(45deg); }
.p89-keypos { display: flex; justify-content: space-between; width: 130px; font: 700 8px/1.2 Arial, sans-serif; color: #77705f; letter-spacing: .04em; }
.p89-keypos .on { color: #1d1b17; }
.p89-tray { margin-top: 16px; padding: 12px; border-radius: 10px; background: linear-gradient(#cfc7b1, #bdb49c); box-shadow: inset 0 2px 5px rgba(0,0,0,.25); }
.p89 button { font: 700 11px/1 Arial, sans-serif; color: #2a2721; min-width: 30px; height: 30px; padding: 0 5px; border-radius: 4px; cursor: pointer;
  border: 1px solid #8c8676; background: linear-gradient(#f6f3ea, #d9d3c3); box-shadow: 0 2px 0 #7d7768; }
.p89 button:active { transform: translateY(2px); box-shadow: none; }
.p89 button.p89-key { box-shadow: none; }
.p89-fkeys { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; margin-bottom: 12px; }
.p89 .fk { min-width: 52px; height: 40px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2px;
  color: #f4f1e8; background: linear-gradient(#5b5851, #3a3833); border-color: #2a2824; font-size: 10px; }
.p89 .fk small { font: 700 10px/1 var(--mono); }
.p89-main { display: flex; gap: 18px; justify-content: center; align-items: flex-start; flex-wrap: wrap; }
.p89 .kr { display: flex; gap: 4px; margin-bottom: 4px; }
.p89 .wide { min-width: 58px; }
.p89 .space { flex: 1; min-width: 160px; }
.p89-pad button { min-width: 36px; }
.p89-help { max-width: 1000px; margin: 8px auto 0; }
@media (max-width: 700px) {
  .p89 { padding: 10px; }
  .p89-hood { grid-template-columns: 1fr; }
  .p89-side { flex-direction: row; flex-wrap: wrap; justify-content: center; }
  .p89-bezel { padding: 8px; border-radius: 12px; }
  .p89 button { min-width: 24px; height: 28px; font-size: 10px; }
  .p89 .fk { min-width: 44px; }
}

/* ---------- MicroGEM Programmer ---------- */
.progwrap { display: flex; flex-direction: column; align-items: center; }
.lead { width: 6px; height: 26px; background: #111; border-radius: 3px; margin-left: 150px; }
.prog { position: relative; width: 100%; max-width: 340px; padding: 18px 0 26px; outline: none; color: #f2f0ea;
  background: linear-gradient(170deg, #2a2a2a, #121212 60%, #0c0c0c);
  border-radius: 8px 8px 14px 14px; box-shadow: 0 10px 18px rgba(0,0,0,.35); }
/* The case is the same width all the way down: the display end only looks
   narrower in the photo because of the camera angle. The face folds where
   the keypad starts, so it is drawn with a crease there. */
.fold { height: 2px; margin: 22px 0 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.1) 6%, rgba(255,255,255,.1) 94%, transparent); box-shadow: 0 1px 0 #000; }
.prog:focus-visible { filter: drop-shadow(0 0 4px var(--accent)); }
.prog-head { position: relative; height: 54px; margin: 0 9%; }
.brand { position: absolute; right: 0; top: 4px; text-align: center; font: 900 .78rem/1 Arial, sans-serif; letter-spacing: .02em; }
.brand small { display: block; font: 800 .55rem/1.1 Arial, sans-serif; letter-spacing: .03em; }
.keyswitch { position: absolute; left: 0; top: -6px; width: 44px; height: 44px; border-radius: 6px; background: #1d1d1d; border: 2px solid #333;
  cursor: pointer; display: grid; place-items: center; padding: 0; }
.keyswitch .barrel { width: 26px; height: 26px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #555, #1a1a1a); position: relative; transition: transform .15s; }
.keyswitch .barrel::after { content: ""; position: absolute; left: 11px; top: -6px; width: 5px; height: 26px; border-radius: 2px; background: linear-gradient(90deg, #888, #ddd, #777); }
.keyswitch.halt .barrel { transform: rotate(-60deg); }
.keypos { position: absolute; left: 50px; top: 2px; font: 700 .52rem/1.5 Arial, sans-serif; color: #9a9a9a; letter-spacing: .06em; }
.keypos b { color: #f2f0ea; }
.lcdbox { margin: 6px 10% 0; }
.lcd { background: linear-gradient(#c9cdbb, #b7bca6); border: 4px solid #3a3a3a; border-radius: 3px; padding: 6px 6px; box-shadow: inset 0 2px 6px rgba(0,0,0,.45); }
.lcd div { font: 700 17px/1.25 "Courier New", var(--mono); color: #1c2117; white-space: pre; overflow: hidden; letter-spacing: .02em; text-align: center; }
.lcd-labels { display: flex; justify-content: space-between; padding: 5px 8px 0; font: 800 .62rem/1 Arial, sans-serif; letter-spacing: .03em; }
.keys { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px 10px; margin: 22px 8% 0; }
.k { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: 0; padding: 0; cursor: pointer; color: #f2f0ea; touch-action: manipulation; min-width: 0; }
.k .leg { font: 800 .6rem/1 Arial, sans-serif; white-space: nowrap; letter-spacing: .01em; min-height: .6rem; }
.k .leg i { font-style: normal; opacity: .95; }
.k .cap { width: 42px; height: 28px; border-radius: 3px; box-shadow: 0 3px 0 rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.45); transition: transform .05s; }
.k:active .cap, .k.down .cap { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,.65); }
.k.y .cap { background: linear-gradient(#ffd83a, #e9b916); }
.k.o .cap { background: linear-gradient(#ff7a3d, #e3531d); }
.k.g .cap { background: linear-gradient(#9fa39c, #7d817a); }
.k.lit .cap { outline: 2px solid #fff; outline-offset: 1px; }
.prog-help { font-size: .78rem; color: var(--muted); margin: 10px 0 0; max-width: 340px; }

/* ---------- Home Assistant entities ---------- */
.ha-links a { color: var(--accent); }
.chips-label { margin: 10px 0 4px; font-size: .75rem; color: var(--muted); font-weight: 600; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 6px; font: 12px/1 var(--mono); padding: 5px 9px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--bg); color: var(--text); cursor: pointer; }
.chip:hover { border-color: var(--accent); }
.chip .dot { width: 8px; height: 8px; border-radius: 50%; background: #8a8478; }
.chip.on .dot { background: #e53b2f; box-shadow: 0 0 5px #ff5b4f; }
.chip.run.on .dot { background: #2fbf4a; box-shadow: 0 0 5px #4dff6a; }

/* ---------- ladder ---------- */
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 14px; min-width: 0; margin-top: 20px; }
.crt { background: var(--crt); border-radius: 8px; padding: 10px 6px; overflow-x: auto; box-shadow: inset 0 0 30px rgba(0,0,0,.8); }
.rung { cursor: pointer; border-radius: 4px; display: block; }
.rung:hover { background: rgba(120,255,160,.04); }
.rung.sel { background: rgba(120,255,160,.09); outline: 1px dashed #3d6b4e; }
.rung.draft { outline: 1px dashed var(--amber); }
.rung.skipped { opacity: .45; }
.rung svg { display: block; }
.ladder-empty { color: var(--crt-text); font: 13px var(--mono); padding: 12px; }

/* ---------- text + tables ---------- */
.grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; }
.grid .panel { margin-top: 16px; }
textarea { width: 100%; min-height: 320px; resize: vertical; font: 13px/1.5 var(--mono); color: var(--text); background: var(--bg);
  border: 1px solid var(--border); border-radius: 6px; padding: 10px; tab-size: 4; }
.row { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
.btn { font: inherit; padding: 7px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--panel); color: var(--text); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.message { font-size: .85rem; color: var(--muted); }
.demo-row { margin: 0 0 8px; }
.files { margin-top: 6px; }
.vp-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.vp-head h2 { margin: 0; }
.vp-tools { margin-left: auto; display: flex; gap: 6px; }
.vp-tools .btn { padding: 5px 10px; font-size: .85rem; }
.vp-lamp { width: 10px; height: 10px; border-radius: 50%; background: #3a3a3a; box-shadow: inset 0 0 2px #000; }
.vp-port { font: 12px var(--mono); margin: 2px 0 8px; }
.vp-port.bad { color: #ffb347; }
.vp-keys { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: .85rem; }
.vp-keys[hidden], .vp-port .btn[hidden] { display: none; }
.vp-port .btn { padding: 2px 8px; font-size: .8rem; margin-left: 6px; }
.vp-keys input { flex: 1; font: 13px var(--mono); }
.vp-lamp.on { background: #4cff6a; box-shadow: 0 0 6px #4cff6a; }
.vp-paper { position: relative; max-height: 340px; overflow: auto; border-radius: 3px; padding: 6px 34px;
  background:
    radial-gradient(circle at 12px 9px, var(--panel) 4px, transparent 5px) left top / 24px 18px repeat-y,
    radial-gradient(circle at 12px 9px, var(--panel) 4px, transparent 5px) right top / 24px 18px repeat-y,
    repeating-linear-gradient(#fbfbf4 0 54px, #dff0dc 54px 108px);
  background-attachment: local; border: 1px solid #c9c9bd; }
.vp-paper pre { margin: 0; font: 13px/18px "Courier New", var(--mono); color: #232323; white-space: pre; min-height: 108px; }
.vp-paper .head::after { content: "\\2588"; animation: vp-blink 1s steps(1) infinite; color: #555; }
@keyframes vp-blink { 50% { opacity: 0; } }
.files .btn { padding: 5px 10px; font-size: .85rem; }
textarea.drop { outline: 2px dashed var(--accent); }
.printout { margin-top: 10px; border: 1px solid var(--border); border-radius: 6px; padding: 0 10px 10px; background: var(--bg); }
.printout pre { margin: 8px 0 0; max-height: 420px; overflow: auto; font: 12px/1.35 var(--mono); white-space: pre; }
select { font: inherit; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--panel); color: var(--text); max-width: 100%; }
.message.error { color: var(--error); }
table { width: 100%; border-collapse: collapse; font: 12px/1.4 var(--mono); }
th, td { text-align: left; padding: 3px 4px; border-bottom: 1px solid var(--border); white-space: nowrap; }
th { color: var(--muted); font-weight: 600; }
.table-scroll { overflow-x: auto; }
.picker { display: inline-flex; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; margin-bottom: 8px; flex-wrap: wrap; }
.picker button { border: 0; background: var(--panel); color: var(--text); padding: 4px 10px; font: inherit; cursor: pointer; min-width: 30px; }
.picker button.active { background: var(--text); color: var(--panel); }
details { margin-top: 12px; font-size: .85rem; }
code { font-family: var(--mono); }
kbd { font: 700 .75rem var(--mono); border: 1px solid var(--border); border-radius: 3px; padding: 0 3px; }

@media (max-width: 960px) {
  .hw, .grid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .toggles { grid-template-columns: repeat(6, minmax(0, 1fr)); row-gap: 10px; }
  .k .cap { width: 36px; height: 25px; }
  .k .leg { font-size: .52rem; }
  .keys { gap: 9px 6px; }
}
`;

const MARKUP = `
<main>
  <header>
    <h1 id="title">Virtual MicroGEM</h1>
    <p><span id="about">A MicroGEM60 controller running in software. Flip the inputs, watch the relay outputs and the ladder, and program it from the MicroGEM Programmer or the text editor.</span> <span class="conn" id="conn">Connecting…</span></p>
  </header>

  <div class="hw">
    <section aria-label="MicroGEM60 controller and expansion units">
      <div class="unit" id="unit"></div>
      <div class="wire-ed" id="wire-ed" hidden>
        <h3 id="we-title"></h3>
        <p class="hint" id="we-hint"></p>
        <div class="fields">
          <label style="flex-basis:100%">Find an entity<input id="we-search" type="search" placeholder="Type part of a name or id, * for anything: kitchen*light" autocomplete="off" spellcheck="false"></label>
        </div>
        <div class="we-filters" id="we-filters" role="tablist" aria-label="Kinds of entity"></div>
        <div class="we-results" id="we-results" role="listbox" aria-label="Entities"></div>
        <div class="fields">
          <label id="we-attr-box">Read<select id="we-attr"></select></label>
          <label id="we-above-box">Contact closes above<input id="we-above" type="number" step="any" placeholder="leave empty for on/off"></label>
          <label id="we-low-box">Value at 0 V<input id="we-low" type="number" step="any" value="0"></label>
          <label id="we-high-box">Value at 10 V<input id="we-high" type="number" step="any" value="100"></label>
          <label class="check" id="we-invert-box"><input type="checkbox" id="we-invert"> Invert: the contact is closed while the entity is <i>off</i> (like a normally closed switch)</label>
        </div>
        <p class="message" id="we-now"></p>
        <div class="row"><button class="btn primary" id="we-save">Connect</button><button class="btn" id="we-remove">Disconnect</button><button class="btn" id="we-cancel">Cancel</button></div>
      </div>
      <div class="g80-ctl" id="g80-ctl" hidden>
        <span class="seg" id="g80-mode"><button data-run="1">RUN</button><button data-run="0">HALT</button></span>
        <span class="g80-info" id="g80-info"></span>
      </div>
      <div class="sim">
        <div class="sim-head">
          <span>INPUT SIMULATOR · switches wired to the input terminals</span>
          <span class="seg" id="mode"><button data-mode="toggle" class="active">LATCH</button><button data-mode="momentary">PUSH</button></span>
        </div>
        <div id="toggles"></div>
      </div>
    </section>

    <section class="progwrap" id="progwrap" aria-label="MicroGEM Programmer">
      <div class="lead"></div>
      <div class="prog" id="prog" tabindex="0">
        <div class="prog-head">
          <button class="keyswitch" id="keyswitch" title="Key switch: RUN / HALT"><span class="barrel"></span></button>
          <div class="keypos"><span id="kp-run">RUN</span><br><span id="kp-halt">HALT</span></div>
          <div class="brand">MICROGEM<small>PROGRAMMER</small></div>
        </div>
        <div class="lcdbox">
          <div class="lcd"><div id="lcd1"></div><div id="lcd2"></div></div>
          <div class="lcd-labels"><span>ADDR</span><span>VALUE</span><span>LOC'N</span></div>
        </div>
        <div class="fold"></div>
        <div class="keys" id="keys"></div>
      </div>
      <p class="prog-help" id="prog-help"></p>
    </section>
  </div>

  <section class="p8920" id="p8920" aria-label="8920 Portable Programmer" hidden></section>

  <section class="panel vprinter" id="printer" aria-label="Printer on the printer port" hidden>
    <div class="vp-head">
      <h2>Printer</h2>
      <span class="vp-lamp" id="vp-lamp" title="On line"></span><span class="message" id="vp-status"></span>
      <span class="vp-tools"><button class="btn" id="vp-line">Off line</button><button class="btn" id="vp-tear">Tear off</button><button class="btn" id="vp-save">Download</button></span>
    </div>
    <p class="hint">What the program prints on port 1 with <code>SPEC WRITEXT</code> (S22, message <i>n</i> of the list at VALUE, <i>n</i> the rung input) and <code>SPEC WRINUM</code> (S23, the rung word in the format at VALUE: width, characters from the point, power of ten). Port 1 is a printer port when <code>P5</code> is negative, with <code>P2</code> NULs after each line, <code>P3</code> characters a line and <code>P4</code> bit/s: <code>PRESET P2 = 0 80 1200 -1</code>; the port reads them when the controller goes to Run. <code>E0.8</code> is on while the 255-character buffer is more than 2/3 full. A 20 mA loop has no handshake: what is sent while the printer is off line is lost.</p>
    <div class="vp-port" id="vp-port"><span id="vp-port-text"></span> <button class="btn" id="vp-power" hidden>Switch off and on</button></div>
    <div class="vp-paper" id="vp-paper"><pre id="vp-lines"></pre></div>
    <label class="vp-keys" id="vp-keys-row" hidden>Keyboard <input id="vp-keys" autocomplete="off" spellcheck="false" placeholder="type here: each key goes to J0"></label>
  </section>

  <section class="panel ha-links" id="ha-links" hidden>
    <h2>In Home Assistant</h2>
    <p class="hint">Every input is a switch and every output is a binary sensor, so automations can use them. Open one below, or see them all on the <a id="device-link" href="#">device page</a>.</p>
    <p class="hint"><b>Field wiring:</b> click a terminal on the controller to wire it to a Home Assistant entity, with no automation. An input follows the entity (or one of its attributes); a relay output switches the entity on and off.</p>
    <div id="chips"></div>
  </section>

  <section class="panel">
    <h2>Ladder diagram</h2>
    <p class="hint">Live: green wires carry power, lit contacts are closed. Click a rung to select it on the programmer and in the text.</p>
    <div class="crt" id="ladder"></div>
  </section>

  <div class="grid">
    <section class="panel">
      <h2>Program text</h2>
      <p class="hint">One rung per line: contacts on the left of <code>-&gt;</code>, coils and function blocks on the right. Comment lines above a rung become its title.</p>
      <div class="row demo-row"><select id="demo" aria-label="Demo programme"><option>Demo programmes…</option></select><button class="btn" id="demo-load" disabled>Load demo</button><span class="message" id="demo-about"></span></div>
      <textarea id="program" spellcheck="false" aria-label="Ladder program"></textarea>
      <div class="row"><button class="btn primary" id="load">Load program</button><span class="message" id="message"></span></div>
      <div class="row files">
        <button class="btn" id="open-file" title="Program text, a ladder print-out, or a CSV of names or data">Open file…</button>
        <button class="btn" id="convert" title="Turn a print-out or CSV pasted into the box into program text">Convert pasted text</button>
        <button class="btn" id="save-file">Save as file</button>
        <button class="btn" id="printout">Print-out</button>
        <input type="file" id="file-input" accept=".txt,.lst,.prn,.csv,.tsv,.lad,.gem,text/plain,text/csv" hidden>
      </div>
      <p class="hint">Bring in an old programme: open or drop a ladder print-out (as text, from a programmer or a PC package), program text, or a CSV of mnemonics (<code>A0.0,START,Start button</code>) or data (<code>G10,250</code>). It is converted into the box for you to check, then Load program.</p>
      <div class="printout" id="printout-box" hidden>
        <div class="row"><b>Print-out</b><button class="btn" id="printout-save">Download</button><button class="btn" id="printout-print">Print</button><button class="btn" id="printout-close">Close</button></div>
        <pre id="printout-text"></pre>
      </div>
      <details>
        <summary>Language reference</summary>
        <p><b>Addresses:</b> <code>A0.3</code> is bit 3 of word 0 in table A. Inputs are A (terminals 00–11 are <code>A0.0</code>–<code>A0.11</code>), relay outputs are B (<code>B0.0</code>–<code>B0.7</code>). Expansion unit 1 uses <code>A1</code> and <code>B1</code>, unit 2 <code>A2</code> and <code>B2</code>, and so on. Workspace is G H L N O S U, retained workspace is R W.</p>
        <p><b>Signal flow:</b> as on the GEM 80, a 16-bit word flows along each rung. The left rail gives -1 (@FFFF); a contact passes the word on or gives 0; the rung is ON when its word is not 0.</p>
        <p><b>Contacts:</b> <code>A0.0</code> (N/O), <code>NOT A0.0</code> (N/C), <code>TRUE</code>. <code>AND</code> between contacts wires them in series, <code>OR</code> in parallel; use brackets for branches.</p>
        <p><b>In the rung:</b> <code>DELAY G10 VALUE 25</code> (on-delay, VALUE in 0.1 s, G10 counts down the time left); <code>COUNT G11 VALUE 10 RESET A0.6</code> (counts OFF-to-ON changes); <code>INV</code>; <code>AND OR XOR</code> with a number or word (<code>AND @00FF</code>); <code>ADD SUB</code> and the Special Functions <code>MULT</code> (T10) and <code>DIV</code> (T11). A second input from its own branch goes in square brackets: <code>ADD [AND G4]</code>.</p>
        <p><b>Output (one per rung):</b> a bit address is a COIL; <code>OUT G2</code> writes the rung word; <code>SEQR G12 RESET A0.7</code> walks one bit left each scan; <code>BLOCK</code> obeys the rungs down to the next <code>END BLOCK</code> only while the rung is on.</p>
        <p><b>Flags (read-only):</b> <code>E0.0</code> pulses every 0.1 s, <code>E0.1</code> every second, <code>E0.6</code> after a program load, <code>E0.7</code> when ADD or SUB was limited to ±32767. <code>E1</code> to <code>E6</code> hold the time and date, <code>E7</code> the last scan time in ms. Hex numbers: <code>@00FF</code>.</p>
        <p><b>Watchdog:</b> the W/DOG O.K. light and W/DOG OUTPUT close after three clean scans in Run and open in Halt. To trip it from the program, hold a non-zero code in <code>F1</code> for 100 ms (GEM80-400 manual T1614, 2.12), for example <code>A0.5 -&gt; BLOCK</code>, <code>AND 123 -&gt; OUT F1</code>, <code>END BLOCK</code>. The controller stops; switch it back to Run to clear the trip.</p>
        <p><b>Extensions</b> (not in a real GEM 80): <code>RISE A0.0</code>/<code>FALL A0.0</code> one-scan pulses, comparisons such as <code>G1 GE 5</code>, and <code>SET</code>/<code>RESET</code> outputs. On the real controller you latch with a seal-in branch.</p>
        <p class="g80-only"><b>GEM 80 tables and I/O:</b> the compact controllers have tables A and B (32 words each, one pair of words per I/O slot: slot 1 is <code>A0</code>/<code>A1</code> or <code>B0</code>/<code>B1</code>, slot 2 is words 2 and 3, and so on), E (flags; the 130C adds the clock in <code>E1</code> to <code>E6</code>), F (diagnostics; <code>F1</code> trips the watchdog), G (workspace), R (retained), P (presets, read-only on the CE models with EPROM), J and K (serial) and M (maintainer). Sizes follow the T278 data sheet for the model chosen, and so does the program capacity.</p>
        <p class="g80-only"><b>Special Functions:</b> <code>SPEC</code> and the number or name, then for the two-input T functions the lower branch in square brackets, then <code>VALUE</code>: <code>AND G10 SPEC SQRT VALUE 100 -&gt; OUT G11</code>, <code>AND G10 SPEC LIMIT VALUE G100 -&gt; OUT G11</code> (G101 low, G102 high, flags in G100), <code>AND G10 SPEC COMPARE [AND G11] VALUE G59 -&gt; OUT G58</code>, <code>AND G20 SPEC DIV [AND 16] VALUE R120 -&gt; OUT G30</code>. Emulated: S0 DBOUNCE, S1 BCDIN, S2 BCDOUT, S3 HISTATE, S4 SWAP, S11 LINCON, S12 SQRT, S20 LOCATE, S22 WRITEXT, S23 WRINUM, S30 FGEN, S31 DEDBAND, S32 LIMIT, S33 RAMP, S34 PIDABS, S35 PIDINC, S36 INCOUT, S37 ANALAG, T0 COMPARE, T10 MULT, T11 DIV, T20 MOVE, T30 STORE, each as its GEM 80 Software Data sheet describes, where the model has it.</p>
        <p><b>Names, presets and messages</b>, kept with the program: <code>NAME A0.0 START Start push button</code> (a mnemonic the rungs can use), <code>PRESET R100 = 0 400 32000 0</code> (written into R100 to R103 at a load, and again only where it changes; use a table kept across Run, P or R), <code>MESSAGE P100 = "PUMP 1 TRIPPED\\n"</code> (text for WRITEXT; <code>\\n</code> new line, <code>\\e</code> ETX).</p>
        <p class="g80-only"><b>Analogue:</b> an 8108 puts one channel at a time on its A word: the value (±10 V is ±32752) in bits 4 to 15 and the channel in bits 0 to 3, a new channel every 70 ms. Mask with <code>@FFF0</code> and <code>15</code>, then MOVE the value to its own word, as the Room heating demo does.</p>
        <p>Elements and behaviour follow the GEM 80 Ladder Diagram Programming Manual (T391). The MicroGEM's own table letters (I and Q on the programmer) are not documented yet, so inputs and outputs use the GEM 80 A and B tables.</p>
      </details>
    </section>
    <section class="panel">
      <h2>Data tables</h2>
      <p class="hint">First eight words of a table, as a signed number and as bits 15 to 0.</p>
      <div class="picker" id="table-pick"></div>
      <div class="table-scroll"><table><thead><tr><th>Word</th><th>Value</th><th>Bits 15…0</th></tr></thead><tbody id="tables"></tbody></table></div>
    </section>
  </div>
</main>`;

// ---------------------------------------------------------------------------
// The MicroGEM60 controller front panel, drawn as SVG from a photo of the real
// unit. Each input and output has a small red LED under its terminal number.

function inputLabels(n) {
  if (n === 12) return ["00", "01", "02", "C", "03", "04", "05", "HI", "06", "07", "08", "C", "09", "10", "11", "LO"];
  const out = [];
  for (let i = 0; i < n; i++) { out.push(String(i).padStart(2, "0")); if (i % 3 === 2 && i < n - 1) out.push("C"); }
  return out.concat(["HI", "LO"]);
}

// unit 0 is the controller; 1 to 7 are expansion units on its expansion port.
// inBase / outBase number the LEDs across all units.
function unitSvg(nIn, nOut, unit = 0, inBase = 0, outBase = 0, wires = { inputs: {}, outputs: {} }) {
  const exp = unit > 0;
  const W = 1024, H = 318;
  // Field wiring: cables leave the terminals, up from the inputs and down from
  // the relay outputs, labelled with the entity at the far end.
  const label = (w, x, y, angle, end, kind, g) => `<text class="wl" data-kind="${kind}" data-index="${g}"${end ? ' text-anchor="end"' : ""} transform="translate(${x} ${y}) rotate(${angle})">${esc(w.name)}${w.detail ? `<tspan> ${esc(w.detail)}</tspan>` : ""}<title>${esc(w.title)}</title></text>`;
  let cablesIn = "", cablesOut = "", top = 0, bottom = 0;
  const screw = (x, y, r = 11) => `<g><circle cx="${x}" cy="${y}" r="${r}" fill="url(#screwg)" stroke="#111" stroke-width="1.5"/>
    <path d="M${x - r * .55} ${y}h${r * 1.1}M${x} ${y - r * .55}v${r * 1.1}" stroke="#2a2a2a" stroke-width="2.4"/></g>`;
  const block = (x, y, w, h, n, sy) => {
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#5b5f5d"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="url(#cover)"/>`;
    const st = w / n;
    for (let i = 0; i < n; i++) s += `<circle cx="${x + st * (i + .5)}" cy="${sy}" r="${Math.min(12, st / 2 - 3)}" fill="#3f4342" stroke="#2a2c2b"/>
      <circle cx="${x + st * (i + .5)}" cy="${sy}" r="${Math.min(8, st / 2 - 6)}" fill="#4f5352"/>`;
    return s;
  };

  // Inputs: one terminal per label, label strip underneath.
  const labels = inputLabels(nIn);
  let terms = "";
  const ix = 106, iw = 535, ist = iw / labels.length;
  let inputs = block(ix, 6, iw, 80, labels.length, 34);
  let k = 0;
  labels.forEach((lab, i) => {
    const cx = ix + ist * (i + .5);
    inputs += `<rect x="${ix + ist * i + 1}" y="89" width="${ist - 2}" height="27" fill="#222" stroke="#555" stroke-width=".6"/>`;
    if (/^\d+$/.test(lab)) {
      const g = inBase + k, w = wires.inputs[g];
      inputs += `<text x="${cx}" y="101" class="tl">${lab}</text>
        <circle class="led" id="in-${g}" cx="${cx}" cy="109.5" r="3"/>`;
      terms += `<rect class="term" data-kind="inputs" data-index="${g}" x="${ix + ist * i}" y="6" width="${ist}" height="110" rx="3"><title>Input terminal ${lab} (${w ? "wired to " + esc(w.title) : "click to wire it to an entity"})</title></rect>`;
      if (w) {
        top = 215;
        cablesIn += `<path class="cable in" id="cable-in-${g}" d="M${cx} 34 C${cx - 7} 14 ${cx + 7} 4 ${cx} -14"/><rect class="sheath" x="${cx - 5}" y="-26" width="10" height="16" rx="2"/>${label(w, cx + 4, -32, -50, false, "inputs", g)}`;
      }
      k++;
    } else inputs += `<text x="${cx}" y="104" class="tl">${lab}</text>`;
  });

  // Relay outputs: two terminals per output, label strip above.
  const ox = 382, ow = 538, ost = ow / nOut;
  let outputs = block(ox, 172, ow, 98, nOut * 2, 236);
  for (let i = 0; i < nOut; i++) {
    const x = ox + ost * i;
    outputs += `<rect x="${x + 1}" y="142" width="${ost - 2}" height="28" fill="#222" stroke="#555" stroke-width=".6"/>
      <text x="${x + ost / 2}" y="155" class="tl">${String(i).padStart(2, "0")}</text>
      <circle class="led" id="out-${outBase + i}" cx="${x + ost / 2}" cy="163" r="3.2"/>`;
    const g = outBase + i, w = wires.outputs[g];
    terms += `<rect class="term" data-kind="outputs" data-index="${g}" x="${x}" y="142" width="${ost}" height="130" rx="3"><title>Relay output ${String(i).padStart(2, "0")} (${w ? "wired to " + esc(w.title) : "click to wire it to an entity"})</title></rect>`;
    if (w) {
      bottom = 200;
      const a = x + ost * .25, b = x + ost * .75, m = x + ost / 2;
      cablesOut += `<path class="cable out" id="cable-out-${g}" d="M${a} 236 V${H + 4} L${m - 3} ${H + 18} V${H + 30} M${b} 236 V${H + 4} L${m + 3} ${H + 18} V${H + 30}"/>
        <rect class="sheath" x="${m - 7}" y="${H + 22}" width="14" height="18" rx="2"/>${label(w, m + 6, H + 50, -50, true, "outputs", g)}`;
    }
  }

  const what = exp ? `MicroGEM expansion unit ${unit}` : "MicroGEM60 controller";
  // The controller has the programmer socket and watchdog; an expansion unit
  // shows its number and the A and B words it occupies there instead.
  const socket = exp
    ? `<text x="871" y="88" style="font:900 26px Arial Black,Arial,sans-serif;fill:#eee;text-anchor:middle">UNIT ${unit}</text>
       <text x="871" y="106" style="font:700 11px Arial;fill:#bbb;text-anchor:middle;letter-spacing:.06em">INPUTS A${unit} · OUTPUTS B${unit}</text>`
    : `<rect x="760" y="64" width="222" height="44" rx="2" fill="#0a0a0a"/>
  <rect x="770" y="70" width="202" height="32" rx="1" fill="#d9d6cc"/>
  ${Array.from({ length: 20 }, (_, i) => `<rect x="${776 + i * 9.8}" y="76" width="6" height="7" fill="#7d796f"/><rect x="${776 + i * 9.8}" y="89" width="6" height="7" fill="#7d796f"/>`).join("")}`;
  const status = exp ? "" : `<text x="252" y="146" class="lb">BATTERY</text><text x="252" y="160" class="lb">LOW</text>
  <circle class="led" id="led-batt" cx="252" cy="176" r="5"/>
  <text x="322" y="146" class="lb">W/DOG</text><text x="322" y="160" class="lb">O.K.</text>
  <circle class="led g" id="led-wdog" cx="322" cy="176" r="5"/>
  <rect x="306" y="186" width="68" height="34" fill="none" stroke="#666"/>
  <text x="340" y="200" class="lb" style="font-size:11px">W/DOG</text><text x="340" y="214" class="lb" style="font-size:11px">OUTPUT</text>
  ${block(306, 222, 68, 56, 2, 244)}`;
  return `<svg viewBox="0 ${-top} ${W} ${H + top + bottom}" role="img" aria-label="${what} with ${nIn} inputs and ${nOut} relay outputs">
  <defs>
    <radialGradient id="screwg" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#6a6a6a"/><stop offset="1" stop-color="#1e1e1e"/></radialGradient>
    <linearGradient id="cover" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#232323"/><stop offset="1" stop-color="#101010"/></linearGradient>
    <filter id="glow" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <style>
      .tl{font:700 12px Arial,sans-serif;fill:#eee;text-anchor:middle}
      .lb{font:700 12.5px Arial,sans-serif;fill:#eee;text-anchor:middle;letter-spacing:.02em}
    </style>
  </defs>
  <rect x="2" y="${H - 26}" width="${W - 4}" height="24" rx="4" fill="#e3c25a"/>
  <rect x="0" y="0" width="${W}" height="${H - 18}" rx="10" fill="url(#body)" stroke="#000" stroke-width="2"/>
  ${screw(52, 36)}${screw(966, 36)}${screw(52, 226)}${screw(966, 220)}
  <text x="58" y="94" class="lb" style="text-anchor:middle">SINK/</text>
  <text x="58" y="110" class="lb">SOURCE</text><text x="58" y="126" class="lb">INPUTS</text>
  ${inputs}
  <rect x="676" y="40" width="44" height="34" rx="2" fill="#090909" stroke="#333"/>
  <g transform="translate(748,14)">
    <text x="24" y="21" style="font:900 26px Arial Black,Arial,sans-serif;fill:#eee">${MAKER.mark}</text>
    <text x="96" y="10" style="font:700 11px Arial;fill:#eee">${MAKER.line1}</text><text x="96" y="23" style="font:700 11px Arial;fill:#eee">${MAKER.line2}</text>
    <text x="96" y="34" style="font:600 7.5px Arial;fill:#ddd;letter-spacing:.06em">${MAKER.place[0]}</text><text x="96" y="43" style="font:600 7.5px Arial;fill:#ddd;letter-spacing:.06em">${MAKER.place[1]}</text>
    <text x="32" y="40" style="font:600 7.5px Arial;fill:#ddd">Made in U.K</text>
  </g>
  ${socket}
  <text x="372" y="138" style="font:900 21px Arial Black,Arial,sans-serif;fill:#f2f2f2;letter-spacing:.01em">${exp ? "MICROGEM" : "MICROGEM60"}</text>
  <text x="${exp ? 498 : 530}" y="138" style="font:800 16px Arial,sans-serif;fill:#f2f2f2">${exp ? "EXPANSION UNIT" : "CONTROLLER"}</text>
  <text x="182" y="146" class="lb">SUPPLY</text><text x="182" y="160" class="lb">ON</text>
  <circle class="led supply" cx="182" cy="176" r="5"/>
  <text x="152" y="196" class="lb">A.C.SUPPLY</text>
  <text x="114" y="220" style="font:700 18px Arial;fill:#eee;text-anchor:middle">~</text>
  <text x="152" y="220" style="font:700 18px Arial;fill:#eee;text-anchor:middle">~</text>
  <text x="186" y="220" style="font:700 14px Arial;fill:#eee;text-anchor:middle">⏚</text>
  ${block(98, 226, 106, 52, 3, 248)}
  ${status}
  ${outputs}
  <text x="970" y="146" class="lb">RELAY</text><text x="970" y="160" class="lb">OUTPUTS</text>
  ${cablesIn}${cablesOut}${terms}
</svg>`;
}

// ---------------------------------------------------------------------------
// A GEM 80/100C or 130C compact controller: a 19 inch subrack with eight
// Compact I/O module slots, the 9032-style power supply module and the
// processor module, laid out like the GEM 80/131 backplane (T478 Figure 1.5:
// slots 8 to 1 from the left, then the power supply, then the processor).
// The modules carry the details T278 and T438 list: a lamp per channel, the
// type number and plant connector on each I/O module; watchdog, battery and
// serial port lamps and the programming socket on the processor; power and
// output healthy lamps and the run/shutdown switch on the power supply.

const G80_MODULE_COLOURS = { input: "#4c7a9e", output: "#a4473a", relay: "#c98a2b", analogue: "#5d7f46" };

// The 8108 Compact Analogue Input Module (T443 Fig 4): its switches, the
// plant connector for the harness, and for the emulator a bar and the
// voltage of each of its 16 channels, beside the channel it is reading.
const AN_ROW0 = 118, AN_STEP = 13.4;
function analogueModuleSvg(slot, sx, top, w, MH, wires, { screw, lamp, txt }) {
  const sw = (x, y, label, a, b, up) => `${txt(x, y - 16, label, "g8 small")}
    <rect x="${x - 7}" y="${y - 10}" width="14" height="22" rx="3" fill="#0d0d0d" stroke="#555"/>
    <rect x="${x - 3}" y="${up ? y - 8 : y}" width="6" height="10" rx="2" fill="#cfcac0"/>
    ${txt(x + 18, y - 3, a, "g8 tiny")}${txt(x + 18, y + 10, b, "g8 tiny")}`;
  let out = `<rect x="${sx}" y="${top}" width="${w}" height="${MH}" rx="3" fill="url(#g80mod)" stroke="#000"/>
    <rect x="${sx + w / 2 - 18}" y="${top + 4}" width="36" height="12" rx="3" fill="#0d0d0d"/>
    <rect x="${sx + 6}" y="${top + 22}" width="${w - 12}" height="30" rx="2" fill="${G80_MODULE_COLOURS.analogue}"/>
    ${txt(sx + w / 2, top + 36, slot.module, "g8 type")}
    ${txt(sx + w / 2, top + 47, "ANALOGUE INPUT 16 CH", "g8 small")}
    ${sw(sx + 20, top + 80, "INPUT", "10V", "5V", true)}
    ${sw(sx + 64, top + 80, "WORD", "UP", "LO", false)}
    ${sw(sx + 110, top + 80, "SCAN", "SELF", "FORCED", true)}
    <circle cx="${sx + w - 22}" cy="${top + 80}" r="10" fill="#0d0d0d" stroke="#555"/>
    <path d="M${sx + w - 22} ${top + 80}l7 -5" stroke="#cfcac0" stroke-width="2.4" stroke-linecap="round"/>
    ${txt(sx + w - 22, top + 64, "No.", "g8 small")}${txt(sx + w - 22, top + 102, "8", "g8 tiny")}
    ${txt(sx + 30, top + AN_ROW0 - 8, `A${slot.words[0]}`, "g8 word")}`;
  for (let c = 0; c < 16; c++) {
    const g = slot.first + c, cy = top + AN_ROW0 + c * AN_STEP;
    out += txt(sx + 22, cy + 3.5, String(c), "g8 ch") + lamp("g", `mux-${g}`, sx + 30, cy, 3) +
      `<rect x="${sx + 40}" y="${cy - 4}" width="${w - 96}" height="8" rx="2" fill="#111" stroke="#333"/>` +
      `<line x1="${sx + 40 + (w - 96) / 2}" y1="${cy - 5}" x2="${sx + 40 + (w - 96) / 2}" y2="${cy + 5}" stroke="#555"/>` +
      `<rect class="an-bar" id="an-${g}" x="${sx + 40 + (w - 96) / 2}" y="${cy - 3}" width="0" height="6" fill="#7ad36b"/>` +
      `<text class="g8 an-v" id="anv-${g}" x="${sx + w - 10}" y="${cy + 3.5}">0.00</text>`;
    if (wires.analogue && wires.analogue[g]) {
      out += `<path class="cable in" d="M${sx + 2} ${cy} h-6"/>`;
    }
  }
  const py = top + MH - 44;
  out += `<rect x="${sx + 30}" y="${py}" width="${w - 60}" height="32" rx="5" fill="#2a2a2a" stroke="#555"/>
    <rect x="${sx + 40}" y="${py + 7}" width="${w - 80}" height="18" rx="4" fill="#0e0e0e"/>
    ${txt(sx + w / 2, py - 6, "PLANT SIGNALS", "g8 tiny")}
    ${screw(sx + w / 2, top + MH - 4, 3)}`;
  return out;
}

function analogueTerms(slot, sx, top, w, wires) {
  let out = "";
  for (let c = 0; c < 16; c++) {
    const g = slot.first + c, cy = top + AN_ROW0 + c * AN_STEP;
    const wired = wires.analogue && wires.analogue[g];
    out += `<rect class="term" data-kind="analogue" data-index="${g}" x="${sx + 10}" y="${cy - AN_STEP / 2}" width="${w - 20}" height="${AN_STEP}" rx="2"><title>Slot ${slot.slot} (${slot.module}) analogue channel ${c}, read through A${slot.words[0]} (${wired ? "wired to " + esc(wired.title) : "click to wire it to a sensor"})</title></rect>`;
  }
  return out;
}

function gem80Svg(io, model, wires = { inputs: {}, outputs: {} }) {
  const slots = io.slots || [];
  const SW = 96, H = 470, top = 40, MH = 380;
  const psuW = 128, cpuW = 150, gap = 6;
  const W = 40 + slots.length * (SW + gap) + psuW + gap + cpuW + 40;
  const screw = (x, y, r = 6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#g80screw)" stroke="#111"/><path d="M${x - r * .6} ${y}h${r * 1.2}" stroke="#222" stroke-width="1.6"/>`;
  const lamp = (cls, id, x, y, r = 4.2) => `<circle class="led${cls ? " " + cls : ""}"${id ? ` id="${id}"` : ""} cx="${x}" cy="${y}" r="${r}"/>`;
  const txt = (x, y, s, cls = "g8") => `<text x="${x}" y="${y}" class="${cls}">${esc(s)}</text>`;
  let body = "", terms = "";

  // Subrack: front frame with mounting ears.
  body += `<rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="url(#g80frame)" stroke="#111" stroke-width="2"/>
    <rect x="22" y="${top - 18}" width="${W - 44}" height="${MH + 36}" rx="3" fill="#141414" stroke="#2c2c2c"/>
    ${screw(12, 30)}${screw(12, H - 30)}${screw(W - 12, 30)}${screw(W - 12, H - 30)}`;

  // I/O slots, 8 to 1 from the left. A double-width module (the 8108)
  // starts at the slot to its left, which it covers.
  let x = 40, coverX = null;
  for (let s = slots.length; s >= 1; s--) {
    const slot = slots[s - 1];
    let sx = x;
    x += SW + gap;
    if (slot && !slot.module && slot.covered_by) { coverX = sx; continue; }
    if (slot && slot.kind === "analogue") {
      if (coverX !== null) sx = coverX;
      coverX = null;
      const w = x - gap - sx;
      body += analogueModuleSvg(slot, sx, top, w, MH, wires, { screw, lamp, txt });
      body += txt(sx + w / 2, top + MH + 30, `SLOTS ${s + 1}–${s}`, "g8 slot");
      terms += analogueTerms(slot, sx, top, w, wires);
      continue;
    }
    if (!slot || !slot.module) {
      body += `<rect x="${sx}" y="${top}" width="${SW}" height="${MH}" rx="3" fill="#232323" stroke="#333"/>
        <rect x="${sx + 8}" y="${top + 10}" width="${SW - 16}" height="${MH - 20}" rx="2" fill="#1b1b1b"/>
        ${screw(sx + SW / 2, top + 22, 4)}${screw(sx + SW / 2, top + MH - 22, 4)}
        ${txt(sx + SW / 2, top + MH / 2, "BLANK", "g8 dim")}${txt(sx + SW / 2, top + MH + 30, `SLOT ${s}`, "g8 slot")}`;
      continue;
    }
    const colour = slot.relay ? G80_MODULE_COLOURS.relay : G80_MODULE_COLOURS[slot.kind];
    const isIn = slot.kind === "input";
    const kind = isIn ? "inputs" : "outputs";
    const tbl = isIn ? "A" : "B";
    body += `<rect x="${sx}" y="${top}" width="${SW}" height="${MH}" rx="3" fill="url(#g80mod)" stroke="#000"/>
      <rect x="${sx + SW / 2 - 18}" y="${top + 4}" width="36" height="12" rx="3" fill="#0d0d0d"/>
      <rect x="${sx + 6}" y="${top + 22}" width="${SW - 12}" height="30" rx="2" fill="${colour}"/>
      ${txt(sx + SW / 2, top + 36, slot.module, "g8 type")}
      ${txt(sx + SW / 2, top + 47, `${slot.channels} CH ${isIn ? "IN" : slot.relay ? "RELAY" : "OUT"}`, "g8 small")}`;
    // Lamps: one column of up to 16 per data table word, numbered 0 to 15.
    const words = Math.ceil(slot.channels / 16), perCol = Math.min(16, slot.channels);
    const colX = words === 1 ? [sx + SW / 2 + 8] : [sx + SW / 2 - 12, sx + SW / 2 + 26];
    const ly = top + 76, step = Math.min(15, 240 / perCol);
    for (let w = 0; w < words; w++) {
      body += txt(colX[w] - 6, ly - 10, `${tbl}${slot.words[w]}`, "g8 word");
      for (let c = 0; c < perCol && w * 16 + c < slot.channels; c++) {
        const ch = w * 16 + c, g = slot.first + ch, cy = ly + c * step;
        const wired = wires[kind][g];
        body += txt(colX[w] - 14, cy + 3.5, String(c), "g8 ch") + lamp("", `${isIn ? "in" : "out"}-${g}`, colX[w], cy, 3.6);
        if (wired) body += `<path class="cable ${isIn ? "in" : "out"}" id="cable-${isIn ? "in" : "out"}-${g}" d="M${colX[w] + 6} ${cy} h${words === 1 ? 26 : 10}"/>`;
        terms += `<rect class="term" data-kind="${kind}" data-index="${g}" x="${colX[w] - 20}" y="${cy - step / 2}" width="${words === 1 ? 60 : 34}" height="${step}" rx="2"><title>Slot ${s} (${slot.module}) channel ${ch}: ${tbl}${slot.words[w]}.${c} (${wired ? "wired to " + esc(wired.title) : "click to wire it to an entity"})</title></rect>`;
      }
    }
    // Plant connector: screw terminals, or the 32-way D connector.
    const py = top + MH - 54;
    if (slot.channels === 32) {
      body += `<rect x="${sx + 22}" y="${py}" width="${SW - 44}" height="40" rx="6" fill="#2a2a2a" stroke="#555"/>
        <rect x="${sx + 30}" y="${py + 8}" width="${SW - 60}" height="24" rx="5" fill="#0e0e0e"/>`;
    } else {
      body += `<rect x="${sx + 10}" y="${py}" width="${SW - 20}" height="40" rx="2" fill="#3b3e3c" stroke="#222"/>`;
      for (let k = 0; k < 5; k++) body += `<circle cx="${sx + 20 + k * ((SW - 40) / 4)}" cy="${py + 20}" r="5" fill="#1d1f1e" stroke="#555"/>`;
    }
    body += txt(sx + SW / 2, top + MH + 30, `SLOT ${s}`, "g8 slot");
  }

  // Power supply module.
  const px = x;
  x += psuW + gap;
  body += `<rect x="${px}" y="${top}" width="${psuW}" height="${MH}" rx="3" fill="url(#g80mod)" stroke="#000"/>
    <rect x="${px + 10}" y="${top + 8}" width="${psuW - 20}" height="16" rx="8" fill="#0d0d0d"/>
    ${txt(px + psuW / 2, top + 44, "POWER SUPPLY", "g8 head")}
    ${txt(px + 30, top + 74, "INPUT", "g8 small")}${txt(px + 30, top + 84, "POWER", "g8 small")}${lamp("g supply", "", px + 30, top + 98, 5)}
    ${txt(px + psuW - 34, top + 74, "OUTPUT", "g8 small")}${txt(px + psuW - 34, top + 84, "HEALTHY", "g8 small")}${lamp("g supply", "", px + psuW - 34, top + 98, 5)}
    <rect x="${px + psuW / 2 - 16}" y="${top + 128}" width="32" height="64" rx="4" fill="#0e0e0e" stroke="#444"/>
    <rect x="${px + psuW / 2 - 9}" y="${top + 134}" width="18" height="24" rx="3" fill="#cfcac0"/>
    ${txt(px + psuW / 2, top + 122, "RUN", "g8 small")}${txt(px + psuW / 2, top + 206, "SHUTDOWN", "g8 small")}
    ${txt(px + psuW / 2, top + 238, "A.C. 220V", "g8 small")}
    <rect x="${px + 22}" y="${top + 248}" width="${psuW - 44}" height="34" rx="3" fill="#262626" stroke="#555"/>
    ${[0, 1, 2].map((k) => `<rect x="${px + 34 + k * 22}" y="${top + 258}" width="8" height="14" fill="#9c958a"/>`).join("")}
    ${txt(px + psuW / 2, top + 300, "D.C. 24V", "g8 small")}
    <circle cx="${px + psuW / 2}" cy="${top + 322}" r="13" fill="#262626" stroke="#555"/>
    ${txt(px + 36, top + 356, "FS1", "g8 small")}${txt(px + psuW - 36, top + 356, "FS2", "g8 small")}`;

  // Processor module with the maker's badge, the model, and its lamps.
  const cx = x;
  const label = model ? model.label : "GEM 80";
  body += `<rect x="${cx}" y="${top}" width="${cpuW}" height="${MH}" rx="3" fill="url(#g80mod)" stroke="#000"/>
    <rect x="${cx + 8}" y="${top + 8}" width="${cpuW - 16}" height="44" rx="2" fill="#e3c25a"/>
    <text x="${cx + 14}" y="${top + 38}" style="font:900 21px Arial Black,Arial,sans-serif;fill:#151515">${MAKER.mark}</text>
    <text x="${cx + 72}" y="${top + 23}" style="font:700 9px Arial;fill:#151515">${MAKER.line1}</text>
    <text x="${cx + 72}" y="${top + 34}" style="font:700 9px Arial;fill:#151515">${MAKER.line2}</text>
    <text x="${cx + 72}" y="${top + 45}" style="font:600 6px Arial;fill:#333;letter-spacing:.04em">${MAKER.place.join(" ")}</text>
    ${txt(cx + cpuW / 2, top + 76, label, "g8 model")}
    ${txt(cx + 42, top + 104, "W/DOG", "g8 small")}${txt(cx + 42, top + 114, "HEALTHY", "g8 small")}
    ${lamp("g", "led-wdog", cx + 30, top + 128)}${lamp("g", "led-wdog2", cx + 54, top + 128)}
    ${txt(cx + cpuW - 36, top + 104, "BATTERY", "g8 small")}${txt(cx + cpuW - 36, top + 114, "LOW", "g8 small")}
    ${lamp("", "led-batt", cx + cpuW - 36, top + 128)}
    ${txt(cx + cpuW / 2, top + 158, "SERIAL PORTS", "g8 small")}
    ${txt(cx + 40, top + 174, "1 TX", "g8 small")}${lamp("", "led-p1tx", cx + 40, top + 186, 3.6)}
    ${txt(cx + 70, top + 174, "1 RX", "g8 small")}${lamp("", "led-p1rx", cx + 70, top + 186, 3.6)}
    ${txt(cx + 100, top + 174, "2 TX", "g8 small")}${lamp("", "led-p2tx", cx + 100, top + 186, 3.6)}
    ${txt(cx + 130, top + 174, "2 RX", "g8 small")}${lamp("", "led-p2rx", cx + 130, top + 186, 3.6)}
    <rect x="${cx + 24}" y="${top + 206}" width="${cpuW - 48}" height="40" rx="4" fill="#0b0b0b" stroke="#444"/>
    ${Array.from({ length: 13 }, (_, i) => `<circle cx="${cx + 36 + i * 6.6}" cy="${top + 220}" r="1.6" fill="#8a857b"/><circle cx="${cx + 39 + i * 6.6}" cy="${top + 232}" r="1.6" fill="#8a857b"/>`).join("")}
    ${txt(cx + cpuW / 2, top + 260, "PROGRAMMING", "g8 small")}
    <rect x="${cx + 24}" y="${top + 278}" width="${cpuW - 48}" height="30" rx="4" fill="#0b0b0b" stroke="#444"/>
    ${txt(cx + cpuW / 2, top + 322, "SERIAL LINK", "g8 small")}
    ${txt(cx + cpuW / 2, top + 352, "PROCESSOR", "g8 head")}`;

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} compact controller with ${io.inputs} inputs and ${io.outputs} outputs">
  <defs>
    <radialGradient id="g80screw" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#9a9a9a"/><stop offset="1" stop-color="#3a3a3a"/></radialGradient>
    <linearGradient id="g80frame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e6163"/><stop offset="1" stop-color="#3c3e40"/></linearGradient>
    <linearGradient id="g80mod" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b2b2b"/><stop offset=".5" stop-color="#363636"/><stop offset="1" stop-color="#262626"/></linearGradient>
    <filter id="glow" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <style>
      .g8{font:700 10px Arial,sans-serif;fill:#e8e4da;text-anchor:middle;letter-spacing:.03em}
      .g8.small{font-size:8.5px}.g8.head{font-size:10.5px;letter-spacing:.08em}
      .g8.type{font:900 15px Arial Black,Arial,sans-serif;fill:#fff}.g8.model{font:900 13px Arial Black,Arial,sans-serif}
      .g8.word{font-size:9px;fill:#ffd36b}.g8.ch{font-size:8px;fill:#aaa;text-anchor:end}
      .g8.slot{font-size:11px;fill:#d8d4ca}.g8.dim{fill:#666;letter-spacing:.2em}
      .g8.tiny{font-size:7px;fill:#bbb;text-anchor:start}.g8.an-v{font:600 8.5px var(--mono,monospace);fill:#cde8c6;text-anchor:end}
    </style>
  </defs>
  ${body}${terms}
</svg>`;
}

export function websocketTransport(url) {
  let ws = null;
  return {
    connect(onMessage, onStatus) {
      const open = () => {
        ws = new WebSocket(url);
        ws.onopen = () => onStatus("Connected.");
        ws.onclose = () => { onStatus("Disconnected, retrying…"); setTimeout(open, 1500); };
        ws.onmessage = (event) => onMessage(JSON.parse(event.data));
      };
      open();
    },
    send(message) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
    },
  };
}

/** Talks to the Home Assistant integration over the hass websocket connection. */
export function homeAssistantTransport(hass, entryId) {
  let deliver = () => {};
  return {
    connect(onMessage, onStatus) {
      deliver = onMessage;
      hass.connection
        .subscribeMessage(onMessage, { type: "microgem/subscribe", entry_id: entryId })
        .then(() => onStatus("Connected to Home Assistant."))
        .catch((err) => onStatus("Could not connect: " + (err.message || err.code || err)));
    },
    send(message) {
      hass
        .callWS({ type: "microgem/command", entry_id: entryId, command: message })
        .then((reply) => { if (reply) deliver(reply); })
        .catch((err) => deliver({ type: "error", message: err.message || String(err) }));
    },
    /** Wire a terminal to an entity; point null removes the wire. Resolves to the new wiring. */
    wire(kind, index, point) {
      return hass
        .callWS({ type: "microgem/wire", entry_id: entryId, kind, index, ...(point || {}) })
        .then((reply) => reply.wiring);
    },
  };
}

// ---------------------------------------------------------------------------
// Ladder diagram rendering, in the style of the GEM 80 programmer screen.
// The controller reports the word each element passed on in the last scan
// (state.flow). A live path is drawn solid, a dead path dotted, as the
// programmer showed --] [-- against ..] [.. when monitoring.

const CW = 92, CH = 58, AW = 150;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const OPS = { EQ: "=", NE: "≠", GT: ">", LT: "<", GE: "≥", LE: "≤" };
const isAddr = (s) => typeof s === "string" && /^[A-Z]\d+$/.test(s);

function size(n) {
  if (!n) return { w: 0, h: 1 };
  switch (n.t) {
    case "series": return n.items.map(size).reduce((a, b) => ({ w: a.w + b.w, h: Math.max(a.h, b.h) }), { w: 0, h: 1 });
    case "parallel": return n.items.map(size).reduce((a, b) => ({ w: Math.max(a.w, b.w), h: a.h + b.h }), { w: 0, h: 0 });
    case "delay": return { w: 2, h: 1 };
    case "count": {
      const r = n.reset ? size(n.reset) : null;
      return r ? { w: Math.max(2, r.w + 1), h: 1 + r.h } : { w: 2, h: 1 };
    }
    case "logic": case "arith": {
      if (n.arg && typeof n.arg === "object") { const b = size(n.arg); return { w: b.w + 1, h: 1 + b.h }; }
      return { w: n.spec ? 2 : 1, h: 1 };
    }
    case "spec": {
      const base = n.value != null ? 2 : 1;
      if (n.arg) { const b = size(n.arg); return { w: b.w + base, h: 1 + b.h }; }
      return { w: base, h: 1 };
    }
    default: return { w: 1, h: 1 };
  }
}

function wire(x1, y1, x2, y2, on) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="w${on ? " on" : ""}"/>`;
}

// The mnemonic a NAME line gives an address, if any.
const mnem = (ctx, addr) => (ctx.names && ctx.names[addr] ? ctx.names[addr][0] : undefined);

const fmtNum = (v) => (v === undefined || v === null ? "" : typeof v === "boolean" ? (v ? "1" : "0") : String(v));

// Draw node n with its left edge at x and top at y.
// ctx: { live, flow, draft }. Returns [svg, powerOut].
function drawNode(n, x, y, pin, ctx) {
  const cy = y + CH / 2;
  const { live, flow } = ctx;
  const out = (fallback) => (ctx.draft ? false : n.id in flow ? flow[n.id] !== 0 : fallback);
  const cell = (inner, pout, label, sub, w = 1) => {
    const mx = x + (CW * w) / 2;
    return [
      wire(x, cy, mx - 13 * w, cy, pin) + inner(mx) + wire(mx + 13 * w, cy, x + CW * w, cy, pout) +
        (label ? `<text x="${mx}" y="${cy - 19}" class="lab">${esc(label)}</text>` : "") +
        (sub !== undefined && sub !== "" ? `<text x="${mx}" y="${cy + 27}" class="sub">${esc(sub)}</text>` : ""),
      pout,
    ];
  };
  // A box element such as <AND> with its operand underneath and, for a
  // table operand, its value above (as the programmer monitored it).
  const box = (title, under, above, pout, w = 1, bx = x) => {
    const mx = bx + (CW * w) / 2, bw = CW * w - 18;
    return wire(bx, cy, bx + 9, cy, pin) +
      `<rect x="${bx + 9}" y="${cy - 11}" width="${bw}" height="22" rx="11" class="box${pout ? " ok" : ""}"/>` +
      `<text x="${mx}" y="${cy + 4}" class="btxt">${esc(title)}</text>` +
      wire(bx + 9 + bw, cy, bx + CW * w, cy, pout) +
      (under !== undefined ? `<text x="${mx}" y="${cy + 25}" class="lab">${esc(under)}</text>` : "") +
      (above !== undefined && above !== "" ? `<text x="${mx}" y="${cy - 17}" class="val">${esc(above)}</text>` : "");
  };
  // A second branch from the left rail, drawn on the rows below and fed up
  // into the element at column ex (JOIN, RESET).
  const lower = (branch, ex, label) => lowerBranch(branch, ctx.L ?? x, y, ex + CW / 2, ctx, label);
  switch (n.t) {
    case "contact": {
      const closed = n.nc ? !live[n.addr] : !!live[n.addr];
      const pout = out(pin && closed);
      return cell((mx) =>
        `<rect x="${mx - 9}" y="${cy - 11}" width="18" height="22" class="cbody${closed && !ctx.draft ? " closed" : ""}"/>` +
        `<line x1="${mx - 9}" y1="${cy - 13}" x2="${mx - 9}" y2="${cy + 13}" class="plate${pin ? " on" : ""}"/>` +
        `<line x1="${mx + 9}" y1="${cy - 13}" x2="${mx + 9}" y2="${cy + 13}" class="plate${pout ? " on" : ""}"/>` +
        (n.nc ? `<line x1="${mx - 12}" y1="${cy + 12}" x2="${mx + 12}" y2="${cy - 12}" class="plate${pout ? " on" : ""}"/>` : ""),
        pout, n.addr, mnem(ctx, n.addr));
    }
    case "edge": {
      const pout = out(false);
      return cell((mx) =>
        `<line x1="${mx - 9}" y1="${cy - 13}" x2="${mx - 9}" y2="${cy + 13}" class="plate${pin ? " on" : ""}"/>` +
        `<line x1="${mx + 9}" y1="${cy - 13}" x2="${mx + 9}" y2="${cy + 13}" class="plate${pout ? " on" : ""}"/>` +
        `<text x="${mx}" y="${cy + 5}" class="edge">${n.rising ? "↑" : "↓"}</text>`,
        pout, n.addr, n.rising ? "RISE (ext)" : "FALL (ext)");
    }
    case "const": {
      const pout = out(pin && n.value);
      return [wire(x, cy, x + CW, cy, pout) + (n.value ? "" : `<text x="${x + CW / 2}" y="${cy - 8}" class="lab">OPEN</text>`), pout];
    }
    case "cmp": {
      const pout = out(false);
      const lv = isAddr(n.left) ? live[n.left] : undefined;
      return [box(`${n.left}${OPS[n.op]}${n.right}`, "compare (ext)", lv, pout), pout];
    }
    case "inv": {
      const pout = out(!pin);
      return [box("INV", undefined, undefined, pout), pout];
    }
    case "logic": case "arith": {
      const pout = out(pin);
      const branch = n.arg && typeof n.arg === "object";
      const w = size(n).w;
      const ex = x + (w - (n.spec ? 2 : 1)) * CW;
      let svg = branch ? wire(x, cy, ex, cy, pin) + lower(n.arg, ex, "JOIN") : "";
      const under = branch ? undefined : n.arg;
      const above = !branch && isAddr(n.arg) ? fmtNum(live[n.arg]) : undefined;
      if (n.spec) svg += box(`SPEC. ${n.spec}`, under, n.op, pout, 2, ex);
      else svg += box(n.op, under, above, pout, 1, ex);
      return [svg, pout];
    }
    case "spec": {
      // SPEC. with the mnemonic above and the number below, then its VALUE
      // with the table address below, as T391 draws it; a T function's lower
      // input joins in from its own branch.
      const pout = out(pin);
      const base = n.value != null ? 2 : 1;
      const ex = x + (size(n).w - base) * CW;
      let svg = n.arg ? wire(x, cy, ex, cy, pin) + lower(n.arg, ex, "JOIN") : "";
      svg += box("SPEC.", n.num, n.name, pout, 1, ex);
      if (n.value != null) {
        const v = isAddr(n.value) && !ctx.draft ? fmtNum(live[n.value]) : undefined;
        svg += box("VALUE", n.value, v, pout, 1, ex + CW);
      }
      return [svg, pout];
    }
    case "delay": {
      const pout = out(false);
      const left = live[n.word];
      return [
        wire(x, cy, x + 8, cy, pin) +
          `<rect x="${x + 8}" y="${cy - 12}" width="${2 * CW - 16}" height="24" rx="2" class="box${pout ? " ok" : ""}"/>` +
          `<text x="${x + CW / 2 + 2}" y="${cy + 4}" class="btxt">DELAY</text><text x="${x + CW * 1.5 - 2}" y="${cy + 4}" class="btxt">VALUE</text>` +
          `<text x="${x + CW / 2 + 2}" y="${cy + 26}" class="lab">${esc(n.word)}</text><text x="${x + CW * 1.5 - 2}" y="${cy + 26}" class="lab">${esc(n.value)}</text>` +
          (ctx.draft ? "" : `<text x="${x + CW / 2 + 2}" y="${cy - 17}" class="val">${fmtNum(left ?? 0)}</text>`) +
          wire(x + 2 * CW - 8, cy, x + 2 * CW, cy, pout),
        pout,
      ];
    }
    case "count": {
      const pout = out(false);
      const raw = live[n.word] ?? 0;
      const w = size(n).w;
      let svg = (w > 2 ? wire(x, cy, x + (w - 2) * CW, cy, pin) : "");
      const bx = x + (w - 2) * CW;
      svg += wire(bx, cy, bx + 8, cy, pin) +
        `<rect x="${bx + 8}" y="${cy - 12}" width="${2 * CW - 16}" height="24" rx="2" class="box${pout ? " ok" : ""}"/>` +
        `<text x="${bx + CW / 2 + 2}" y="${cy + 4}" class="btxt">COUNT</text><text x="${bx + CW * 1.5 - 2}" y="${cy + 4}" class="btxt">VALUE</text>` +
        `<text x="${bx + CW / 2 + 2}" y="${cy + 26}" class="lab">${esc(n.word)}</text><text x="${bx + CW * 1.5 - 2}" y="${cy + 26}" class="lab">${esc(n.value)}</text>` +
        (ctx.draft ? "" : `<text x="${bx + CW / 2 + 2}" y="${cy - 17}" class="val">${raw & 0x7fff}</text>`) +
        wire(bx + 2 * CW - 8, cy, bx + 2 * CW, cy, pout);
      if (n.reset) svg += lower(n.reset, bx, "RESET");
      return [svg, pout];
    }
    case "series": {
      let svg = "", p = pin, cx = x;
      for (const item of n.items) {
        const [part, o] = drawNode(item, cx, y, p, ctx);
        svg += part;
        p = o;
        cx += size(item).w * CW;
      }
      return [svg, out(p)];
    }
    case "parallel": {
      const s = size(n);
      let svg = "", any = false, ry = y;
      const tops = [];
      for (const item of n.items) {
        const is = size(item);
        const [part, o] = drawNode(item, x, ry, pin, ctx);
        svg += part;
        if (is.w < s.w) svg += wire(x + is.w * CW, ry + CH / 2, x + s.w * CW, ry + CH / 2, o);
        any = any || o;
        tops.push(ry + CH / 2);
        ry += is.h * CH;
      }
      svg += wire(x, tops[0], x, tops[tops.length - 1], pin);
      svg += wire(x + s.w * CW, tops[0], x + s.w * CW, tops[tops.length - 1], out(any));
      return [svg, out(any)];
    }
  }
  return ["", false];
}

function lowerBranch(branch, rx, y, mx, ctx, label) {
  const [svg, p] = drawNode(branch, rx, y + CH, !ctx.draft, ctx);
  const bw = size(branch).w, by = y + CH + CH / 2;
  return svg + wire(rx + bw * CW, by, mx, by, p) + wire(mx, by, mx, y + CH / 2 + 11, p) +
    `<text x="${mx + 5}" y="${by + 14}" class="sub" style="text-anchor:start">${label}</text>`;
}

// The output element, top right of the rung.
function drawOutput(o, x, y, pin, ctx, rungX) {
  const cy = y + CH / 2;
  const { live } = ctx;
  const mx = x + AW - 40;
  const coil = (letter, addr, note) => {
    const on = !ctx.draft && !!live[addr];
    return wire(x, cy, mx - 14, cy, pin) +
      `<path d="M${mx - 8} ${cy - 14} a14 14 0 0 0 0 28 M${mx + 8} ${cy - 14} a14 14 0 0 1 0 28" class="coil${on ? " on" : ""}"/>` +
      (letter ? `<text x="${mx}" y="${cy + 5}" class="edge">${letter}</text>` : "") +
      `<circle cx="${mx}" cy="${cy}" r="9" class="coilfill${on ? " on" : ""}"/>` +
      wire(mx + 14, cy, x + AW, cy, pin) +
      `<text x="${mx}" y="${cy + 27}" class="lab">${esc(addr)}</text>` +
      (note ? `<text x="${mx}" y="${cy - 19}" class="sub">${note}</text>`
        : mnem(ctx, addr) ? `<text x="${mx}" y="${cy - 19}" class="sub">${esc(mnem(ctx, addr))}</text>` : "");
  };
  const word = (title, addr, hex) => {
    const v = live[addr];
    const shown = ctx.draft || v === undefined ? "" : hex ? "@" + (v & 0xffff).toString(16).toUpperCase() : String(v);
    return wire(x, cy, mx - 26, cy, pin) +
      `<rect x="${mx - 26}" y="${cy - 11}" width="52" height="22" rx="11" class="box${pin ? " ok" : ""}"/>` +
      `<text x="${mx}" y="${cy + 4}" class="btxt">${title}</text>` + wire(mx + 26, cy, x + AW, cy, pin) +
      `<text x="${mx}" y="${cy + 27}" class="lab">${esc(addr)}</text>` +
      (shown ? `<text x="${mx}" y="${cy - 17}" class="val">${shown}</text>` : "");
  };
  if (!o) return wire(x, cy, x + 20, cy, pin);
  switch (o.t) {
    case "coil": return coil("", o.addr);
    case "set": return coil("S", o.addr, "SET (ext)");
    case "reset": return coil("R", o.addr, "RESET (ext)");
    case "out": return word("OUT", o.addr);
    case "seqr": {
      let s = word("SEQ.", o.addr, true);
      if (o.reset) s += lowerBranch(o.reset, rungX, y, mx, ctx, "RESET");
      return s;
    }
    case "block":
      return wire(x, cy, mx - 30, cy, pin) +
        `<text x="${mx}" y="${cy - 2}" class="btxt">-OBEY-</text><text x="${mx}" y="${cy + 12}" class="btxt">BLOCK</text>` +
        wire(mx + 30, cy, x + AW, cy, pin);
  }
  return "";
}

function rungSvg(rung, index, ctx, condWidth, blockNo) {
  const L = 52;
  const top = rung.comment ? 22 : 8;
  const ax = L + condWidth * CW + 20;
  const W = ax + AW + 26;
  const style = `<style>
      .w{stroke:var(--dead);stroke-width:2.2;stroke-dasharray:1.5 4.5;stroke-linecap:round}
      .w.on{stroke:var(--live);stroke-dasharray:none;filter:drop-shadow(0 0 3px var(--live))}
      .plate{stroke:var(--crt-text);stroke-width:2.6}.plate.on{stroke:var(--live)}
      .cbody{fill:transparent}.cbody.closed{fill:rgba(61,255,122,.22)}
      .lab{font:600 11px var(--mono);fill:var(--crt-text);text-anchor:middle}
      .val{font:700 11px var(--mono);fill:var(--amber);text-anchor:middle}
      .sub{font:600 9px var(--mono);fill:var(--dead);text-anchor:middle}
      .edge{font:700 13px var(--mono);fill:var(--crt-text);text-anchor:middle}
      .box{fill:#0c1f15;stroke:var(--crt-text);stroke-width:1.4}.box.ok{stroke:var(--live);fill:#0f2a1b}
      .btxt{font:700 11px var(--mono);fill:var(--crt-text);text-anchor:middle}
      .coil{fill:none;stroke:var(--crt-text);stroke-width:2.6}.coil.on{stroke:var(--live)}
      .coilfill{fill:transparent}.coilfill.on{fill:rgba(61,255,122,.35)}
      .rail{stroke:var(--live);stroke-width:4}.rail2{stroke:var(--dead);stroke-width:4}
      .rn{font:700 11px var(--mono);fill:var(--amber)}.title{font:600 11px var(--mono);fill:#6fae84}
      .stars{font:700 11px var(--mono);fill:var(--amber);text-anchor:middle;letter-spacing:.08em}
    </style>`;
  const rn = `<text x="6" y="${top + CH / 2 + 4}" class="rn">R${String(index + 1).padStart(3, "0")}</text>`;
  const title = rung.comment ? `<text x="${L + 8}" y="14" class="title">; ${esc(rung.comment)}</text>` : "";
  if (rung.output && rung.output.t === "end") {
    const H = top + 34;
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${style}
      <line x1="${L}" y1="0" x2="${L}" y2="${H}" class="rail"/><line x1="${W - 4}" y1="0" x2="${W - 4}" y2="${H}" class="rail2"/>
      ${rn}${title}<text x="${(L + W) / 2}" y="${top + 18}" class="stars">******** END OF BLOCK ${blockNo} ********</text></svg>`;
  }
  const s = size(rung.condition);
  const outRows = rung.output && rung.output.reset ? 1 + size(rung.output.reset).h : 1;
  const block = rung.output && rung.output.t === "block";
  const rows = Math.max(s.h, outRows);
  const H = top + rows * CH + (block ? 26 : 6);
  ctx = { ...ctx, L };
  let p = !ctx.draft;
  let svg = "";
  if (rung.condition) {
    const [cond, cp] = drawNode(rung.condition, L, top, true, ctx);
    svg += cond;
    p = cp;
  }
  svg += wire(L + s.w * CW, top + CH / 2, ax, top + CH / 2, p);
  svg += drawOutput(rung.output, ax, top, p, ctx, L);
  if (block) svg += `<text x="${(L + W) / 2}" y="${H - 8}" class="stars">******** START OF BLOCK ${blockNo} ********</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${style}
    <line x1="${L}" y1="0" x2="${L}" y2="${H}" class="rail"/>
    <line x1="${W - 4}" y1="0" x2="${W - 4}" y2="${H}" class="rail2"/>
    ${rn}${title}${svg}
  </svg>`;
}
// ---------------------------------------------------------------------------
// The MicroGEM Programmer: 25 keys laid out and coloured as on the real one.
// Each key has a main legend and a second legend (after the slash). The second
// legend is used after CTRL, and automatically where it is the only sensible
// meaning: ladder symbols while keying in a rung, table letters at the start
// of an address.

const KEYS = [
  ["ESC", "o"], ["◄", "o"], ["►", "y"], ["▲", "g"], ["▼", "g"],
  ["PROG", "g", "-] [-"], ["7", "g", "-(C)-"], ["8", "g", "-(D)-"], ["9", "g", "I"], ["NEXT", "g", "Q"],
  ["ADDR", "y", "-]/[-"], ["4", "g", "-(S)-"], ["5", "g", "BLK"], ["6", "g", "G"], ["PREV", "g", "W"],
  ["CTRL", "y", "-( )-"], ["1", "y", "LINK"], ["2", "y", "JOIN"], ["3", "g", "C"], ["FIND", "o", "D"],
  ["ENT", "y"], ["OD", "y", "ED"], ["0", "y", "MON"], ["BLNK", "y", "S"], ["DEL", "y"],
];
const SECOND = Object.fromEntries(KEYS.map(([p, , s]) => [p, s]));
const SYMBOLS = new Set(["-] [-", "-]/[-", "-( )-", "-(S)-", "-(C)-", "-(D)-", "LINK", "JOIN", "BLK"]);
// Table letters on the keys. I and Q are taken to mean the input (A) and
// output (B) tables until we know the MicroGEM's own table names.
const TABLE_KEY = { I: "A", Q: "B", G: "G", W: "W", C: "C", D: "D", S: "S" };
const LCD_W = 16;

// A rung drawn as text, the way the GEM 80 manual (T391) and its programmers
// draw ladder: each element's symbol on one line and its address on the line
// below, branches joined with + and !, rails at both ends. The programmer's
// 2 x 16 display is a window onto this that the arrow keys move around.
// Live wires are dashes and dead ones dots, as on the GEM 80 monitor.
const CELL = 8;

function textRung(rung, flow) {
  const cells = []; // the elements the cursor can sit on
  const live = (id) => (flow ? (flow[String(id)] ?? 0) !== 0 : true);
  const wire = (on) => (on ? "-" : ".");
  const opnd = (a) => (a && typeof a === "object" ? null : a);
  const leaf = (n) => {
    switch (n.t) {
      case "contact": return { sym: n.nc ? "]/[" : "] [", addr: n.addr };
      case "edge": return { sym: n.rising ? "]^[" : "]v[", addr: n.addr };
      case "const": return { sym: "", addr: "" };
      case "cmp": return { sym: `<${n.op}>`, addr: `${opnd(n.left) ?? ""} ${opnd(n.right) ?? ""}` };
      case "inv": return { sym: "<INV>", addr: "" };
      case "logic": case "arith": {
        const a = opnd(n.arg);
        return n.spec ? { sym: "SPEC.", addr: n.spec + (a !== null ? " " + a : "") } : { sym: `<${n.op}>`, addr: a ?? "" };
      }
      case "spec": return n.value != null
        ? { sym: "SPEC.--VALUE", addr: `${n.num}`.padEnd(7) + n.value, name: n.name }
        : { sym: "SPEC.", addr: n.num, name: n.name };
      case "delay": return { sym: "<DELAY>--VALUE", addr: `${n.word}`.padEnd(9) + n.value };
      case "count": return { sym: "<COUNT>--VALUE", addr: `${n.word}`.padEnd(9) + n.value };
    }
    return { sym: "?", addr: "" };
  };
  const branchOf = (n) => (n.t === "count" ? n.reset : (n.t === "logic" || n.t === "arith" || n.t === "spec") && n.arg && typeof n.arg === "object" ? n.arg : null);
  const width = (n) => { const l = leaf(n); return Math.max(CELL, l.sym.length + 4, String(l.addr).length + 4); };

  function measure(n) {
    if (!n) return { w: 0, h: 1 };
    if (n.t === "series") return n.items.map(measure).reduce((a, b) => ({ w: a.w + b.w, h: Math.max(a.h, b.h) }), { w: 0, h: 1 });
    if (n.t === "parallel") {
      const ms = n.items.map(measure);
      return { w: Math.max(...ms.map((m) => m.w)) + 2, h: ms.reduce((a, m) => a + m.h, 0) };
    }
    const b = branchOf(n);
    if (b) { const m = measure(b); return { w: m.w + 2 + width(n), h: 1 + m.h }; }
    return { w: width(n), h: 1 };
  }

  const m = measure(rung.condition);
  const out = rung.output || {};
  const OUT = { coil: "( )", out: "<OUT>", seqr: "<SEQR>", block: "<OBEY BLOCK>", end: "END OF BLOCK", set: "(L)", reset: "(U)" };
  const osym = OUT[out.t] || "";
  const ow = osym.length + 5;
  const seqrReset = out.t === "seqr" && out.reset ? out.reset : null;
  const rm = seqrReset ? measure(seqrReset) : { w: 0, h: 0 };
  const W = Math.max(1 + m.w + ow, 1 + rm.w + ow + 2, 2 * CELL);
  const rows = m.h + rm.h;
  const lines = Array.from({ length: rows * 2 }, () => Array(W).fill(" "));
  const put = (line, x, str) => { for (let k = 0; k < str.length; k++) if (x + k < W && lines[line]) lines[line][x + k] = str[k]; };
  const vline = (x, fromRow, toRow) => { for (let l = fromRow * 2 + 1; l < toRow * 2; l++) put(l, x, "!"); put(toRow * 2, x, "+"); };

  function draw(n, x, y, on, w) {
    if (!n) { put(y * 2, x, wire(on).repeat(w)); return on; }
    if (n.t === "series") {
      const ms = n.items.map(measure);
      const total = ms.reduce((a, b) => a + b.w, 0);
      let cx = x;
      n.items.forEach((item, k) => {
        const iw = ms[k].w + (k === n.items.length - 1 ? w - total : 0);
        on = draw(item, cx, y, on, iw);
        cx += iw;
      });
      return on;
    }
    if (n.t === "parallel") {
      // Branches hang from a + on the line above; right after the left rail
      // they hang from the rail itself, as in the manual.
      let row = y, any = false;
      const left = x === 1 ? 0 : x, right = x + w - 1;
      const starts = [];
      n.items.forEach((item) => {
        starts.push(row);
        put(row * 2, x, wire(on));
        any = draw(item, x + 1, row, on, w - 2) || any;
        row += measure(item).h;
      });
      const last = starts.at(-1);
      vline(left, y, last);
      vline(right, y, last);
      for (const r of starts) { put(r * 2, left, "+"); put(r * 2, right, "+"); }
      return any;
    }
    const b = branchOf(n);
    const L = leaf(n), o = live(n.id);
    let ex = x;
    if (b) {
      // A second input from a lower branch, which starts at the left rail.
      const bm = measure(b);
      put(y * 2, x, wire(on).repeat(bm.w + 2));
      draw(b, x, y + 1, true, bm.w + 1);
      vline(x + bm.w + 1, y, y + 1);
      // Lead the branch back to the left rail where the way is clear.
      let lx = x - 1;
      while (lx > 0 && lines[(y + 1) * 2][lx] === " ") put((y + 1) * 2, lx--, "-");
      if (lx === 0) put((y + 1) * 2, 0, "+");
      ex = x + bm.w + 2;
    }
    const ew = w - (ex - x);
    put(y * 2, ex, wire(on).repeat(2) + L.sym + wire(o).repeat(Math.max(0, ew - 2 - L.sym.length)));
    put(y * 2 + 1, ex + 2, String(L.addr).slice(0, ew - 2));
    if (n.t !== "const") cells.push({ row: y, x: ex + 2, len: L.sym.length, addr: n.addr || n.word || null, node: n });
    return n.t === "const" ? on : o;
  }

  // Left rail, then the condition, then wire across to the output and the right rail.
  for (let l = 0; l < rows * 2; l++) put(l, 0, l === 0 ? "+" : "!");
  const con = rung.condition ? draw(rung.condition, 1, 0, true, m.w) : true;
  const ox = W - ow;
  put(0, 1 + m.w, wire(con).repeat(Math.max(0, ox - 1 - m.w)));
  if (seqrReset) { draw(seqrReset, 1, m.h, true, ox - 1); vline(ox, 0, m.h); put(m.h * 2, 0, "+"); }
  put(0, ox, wire(con).repeat(2) + osym + wire(con).repeat(2) + "+");
  put(1, ox + 2, (out.addr || "").slice(0, ow - 3));
  for (let l = 1; l < rows * 2; l++) put(l, W - 1, "!");
  if (osym) cells.push({ row: 0, x: ox + 2, len: osym.length, addr: out.addr || null, node: out });
  cells.sort((a, b) => a.row - b.row || a.x - b.x);
  return { lines: lines.map((l) => l.join("")), cells, width: W };
}

// What each element key asks for. DELAY and COUNT sit in the rung like
// contacts (as on the GEM 80, their output passes along the rung); the coil,
// -(S)- (taken to be the sequencer, SEQR) and BLK end the rung.
const ELEMENTS = {
  "-] [-": { prompts: ["ADDR?"], make: (a) => ["c", a[0]] },
  "-]/[-": { prompts: ["ADDR?"], make: (a) => ["c", "NOT " + a[0]] },
  "-(D)-": { prompts: ["WORD?", "VALUE 0.1S?"], make: (a) => ["c", `DELAY ${a[0]} VALUE ${a[1]}`] },
  "-(C)-": { prompts: ["WORD?", "VALUE?"], make: (a) => ["c", `COUNT ${a[0]} VALUE ${a[1]}`] },
  "-( )-": { prompts: ["ADDR?"], make: (a) => ["a", a[0]] },
  "-(S)-": { prompts: ["SEQR WORD?"], make: (a) => ["a", "SEQR " + a[0]] },
};

// A rung being keyed in: a stack of open branch points (▼ opens one, ▼ again
// starts its next line down, JOIN closes it), each a list of parallel
// branches, each a list of series elements.
const newDraft = () => ({ stack: [{ branches: [[]] }], acts: [], history: [] });
const joinBranches = (sec) => {
  const bs = sec.branches.filter((b) => b.length).map((b) => b.join(" AND "));
  if (!bs.length) return "";
  return bs.length === 1 ? bs[0] : "(" + bs.join(" OR ") + ")";
};
function draftCond(d) {
  const stack = JSON.parse(JSON.stringify(d.stack));
  while (stack.length > 1) {
    const s = joinBranches(stack.pop());
    if (s) stack[stack.length - 1].branches.at(-1).push(s);
  }
  return joinBranches(stack[0]);
}
const draftText = (d) => {
  const c = draftCond(d);
  return (c || "") + (d.acts.length ? " -> " + d.acts.join(", ") : "");
};

// ---------------------------------------------------------------------------
// The 8920 Portable Programmer, for the GEM 80 (product data sheet T208): a
// 9 inch monochrome screen of 24 lines of 80 characters over a typewriter
// keyboard, a number pad and a row of GEM 80 function keys, with a key
// switch for PROGRAM or MONITOR ONLY. The screens follow the data sheet's
// Figure 7: the rung drawn as text with its addresses under it, where it is
// stored, the COMMAND LEVEL options and the controller status. The sheet
// names the options but not what each does; the meanings here are our best
// reading of them (see the ? help screen).

const COLS = 80, ROWS = 24;
// Figure 2, left to right; each with the PC key that also gives it.
const FKEYS = [
  ["SPEC", ""], ["BLOCK", ""], ["LOGIC", ""], ["ADD", ""], ["SUB", ""], ["AND", ""], ["VALUE", "F10"], ["OUT", ""],
  ["COUNT", "F8"], ["DELAY", "F7"], ["SEQR", ""], ["LINK", "F4"], ["JOIN", "F6"], ["N/O\n-] [-", "F1"], ["N/C\n-]/[-", "F2"], ["COIL\n-( )-", "F3"],
];
const PC_FKEY = { F1: "N/O", F2: "N/C", F3: "COIL", F4: "LINK", F5: "LF", F6: "JOIN", F7: "DELAY", F8: "COUNT", F9: "SPEC", F10: "VALUE" };
const ALPHA = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const NUMPAD = ["789", "456", "123", "0.-"];
// Series elements that pass the word on, so follow the one before with a space, not AND.
const WORD_ELEMENT = /^(AND|OR|XOR|ADD|SUB|SPEC|INV|DELAY|COUNT)\b/;
const RUNG_COMMANDS = "S, F, L, N, E, B, D, I, R, C, M, W, T?.";
const MAX_SERIES = 9, MAX_BRANCHES = 5; // per rung line, per branch point (T208, 4)

class Programmer8920 {
  constructor(box, send) {
    this.send = send;
    this.state = null;
    this.mode = "power"; // power, control, ladder, entry, tables, help
    this.monitorOnly = false;
    this.monitor = true;
    this.cur = 0; // the stored rung on screen
    this.pan = 0; this.scroll = 0;
    this.prompt = null; // { label, buf, done(text), hint }
    this.confirm = null; // { label, yes() }
    this.message = "";
    this.draft = null; // a rung being keyed in
    this.shown = null; // a rung keyed in or changed, displayed but not yet stored
    this.preview = null; // its parsed form, from the controller
    this.wantPreview = false;
    this.tableAt = "G0"; this.values = null;
    this.pendingLoad = null;
    box.innerHTML = this.markup();
    this.screen = box.querySelector(".p89-screen pre");
    this.unit = box.querySelector(".p89");
    this.keyEl = box.querySelector(".p89-key");
    box.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => { this.unit.focus(); this.key(b.dataset.k); }));
    this.keyEl.addEventListener("click", () => { this.monitorOnly = !this.monitorOnly; this.draw(); });
    this.unit.addEventListener("keydown", (e) => this.keydown(e));
    setTimeout(() => { this.mode = "control"; this.draw(); }, 1400);
    setInterval(() => { if (this.mode === "tables") this.readTables(); }, 400);
  }

  markup() {
    const fk = FKEYS.map(([k, pc]) => {
      const [name, sym] = k.split("\n");
      return `<button class="fk" data-k="${name}" title="${name}${pc ? ` (${pc})` : ""}">${name}${sym ? `<small>${sym}</small>` : ""}</button>`;
    }).join("");
    const alpha = ALPHA.map((row, r) => `<div class="kr" style="padding-left:${r * 14}px">${[...row].map((c) => `<button data-k="${c}">${c}</button>`).join("")}${r === 2 ? `<button data-k="@">@</button><button data-k="[">[</button><button data-k="]">]</button><button data-k="?">?</button>` : r === 1 ? `<button data-k="&quot;">"</button><button data-k="\\">\\</button>` : ""}</div>`).join("");
    const pad = NUMPAD.map((row) => `<div class="kr">${[...row].map((c) => `<button data-k="${c}">${c}</button>`).join("")}</div>`).join("");
    return `
<div class="p89" tabindex="0" aria-label="8920 Portable Programmer: click here, then type">
  <div class="p89-hood">
    <div class="p89-bezel"><div class="p89-screen"><pre aria-live="polite"></pre></div></div>
    <div class="p89-side">
      <div class="p89-badge"><b>${MAKER.mark}</b><span>${MAKER.line1}<br>${MAKER.line2}</span></div>
      <div class="p89-model">8920<small>PORTABLE PROGRAMMER</small></div>
      <button class="p89-key" title="Key switch: PROGRAM or MONITOR ONLY"><span class="barrel"></span></button>
      <div class="p89-keypos"><span data-pos="prog">PROGRAM</span><span data-pos="mon">MONITOR ONLY</span></div>
    </div>
  </div>
  <div class="p89-tray">
    <div class="p89-fkeys">${fk}</div>
    <div class="p89-main">
      <div class="p89-alpha">
        <div class="kr"><button data-k="ESC" class="wide">ESC</button><button data-k="◄">◄</button><button data-k="►">►</button><button data-k="▲">▲</button><button data-k="▼">▼</button><button data-k="RUBOUT" class="wide">RUBOUT</button></div>
        ${alpha}
        <div class="kr"><button data-k="LF" class="wide">LF</button><button data-k="SPACE" class="space">SPACE</button><button data-k="CR" class="wide">CR</button></div>
      </div>
      <div class="p89-pad">${pad}</div>
    </div>
  </div>
</div>
<p class="hint p89-help">Click the programmer and type, or use its keys. The PC keys F1 to F10 give N/O, N/C, COIL, LINK, LF, JOIN, DELAY, COUNT, SPEC and VALUE; Enter is CR, Backspace RUBOUT and Esc ESC. Press <b>?</b> for the options on each screen.</p>`;
  }

  // --- state from the controller --------------------------------------------

  update(state) {
    this.state = state;
    const n = (state.ladder || []).length;
    if (this.cur >= n) this.cur = Math.max(0, n - 1);
    this.draw();
  }

  reply(msg) {
    if (msg.type === "values" && this.mode === "tables") { this.values = msg; this.draw(); return true; }
    if (msg.type === "preview" && this.wantPreview) {
      this.wantPreview = false;
      this.preview = msg.rungs[0] || null;
      if (this.preview && this.draft && !this.draft.acts.length) this.preview.output = null;
      this.draw();
      return true;
    }
    if (msg.type === "error" && this.wantPreview) {
      // The last thing keyed in made the rung invalid: take it back.
      this.wantPreview = false;
      this.alarm("INVALID ENTRY - " + msg.message.toUpperCase());
      if (this.draft && this.draft.history.length) this.undo();
      else if (this.mode !== "entry") this.shown = null;
      return true;
    }
    if (msg.type === "loaded" && this.pendingLoad) {
      const done = this.pendingLoad; this.pendingLoad = null;
      this.shown = null; this.preview = null;
      if (done.cur !== undefined) this.cur = done.cur;
      this.say(done.message);
      return false;
    }
    if (msg.type === "error" && this.pendingLoad) {
      this.pendingLoad = null;
      this.alarm("NOT STORED - " + msg.message.toUpperCase());
      return false;
    }
    return false;
  }

  // --- keys --------------------------------------------------------------------

  keydown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let k = PC_FKEY[e.key] || { Enter: "CR", Escape: "ESC", Backspace: "RUBOUT", " ": "SPACE",
      ArrowLeft: "◄", ArrowRight: "►", ArrowUp: "▲", ArrowDown: "▼" }[e.key];
    if (!k && e.key.length === 1) k = e.key.toUpperCase();
    if (!k) return;
    e.preventDefault();
    this.key(k);
  }

  key(k) {
    this.unlockAudio();
    if (this.mode === "power") return;
    if (this.confirm) {
      const c = this.confirm; this.confirm = null;
      if (k === "Y") c.yes(); else this.say("CANCELLED");
      return this.draw();
    }
    if (["◄", "►", "▲", "▼"].includes(k) && !this.prompt) return this.move(k);
    if (this.prompt) return this.promptKey(k);
    this.message = "";
    const handler = { control: this.controlKey, ladder: this.ladderKey, entry: this.entryKey, tables: this.tablesKey, presets: this.presetsKey, help: this.helpKey }[this.mode];
    handler.call(this, k);
    this.draw();
  }

  move(k) {
    if (this.mode === "ladder" || this.mode === "entry") {
      if (k === "◄") this.pan = Math.max(0, this.pan - 8);
      if (k === "►") this.pan += 8;
      if (k === "▲") this.scroll = Math.max(0, this.scroll - 2);
      if (k === "▼") this.scroll += 2;
    } else if (this.mode === "tables") {
      if (k === "▲" || k === "◄") this.stepTables(-16);
      if (k === "▼" || k === "►") this.stepTables(16);
    } else if (this.mode === "presets") {
      this.presetPage = Math.max(0, (this.presetPage || 0) + (k === "▲" || k === "◄" ? -1 : 1));
    }
    this.draw();
  }

  ask(label, done, hint = "") { this.prompt = { label, buf: "", done, hint }; }

  promptKey(k) {
    const p = this.prompt;
    if (k === "ESC") { this.prompt = null; this.say(this.mode === "entry" ? "ELEMENT ABANDONED" : ""); }
    else if (k === "RUBOUT") p.buf = p.buf.slice(0, -1);
    else if (k === "CR" || (k === "SPACE" && p.spaceEnds !== false)) { this.prompt = null; p.done(p.buf.trim()); }
    else if (k === "SPACE") p.buf += " ";
    else if (k === "VALUE" && p.onValue) p.onValue();
    else if (k.length === 1) p.buf += k;
    else this.alarm("NOT ALLOWED HERE");
    this.draw();
  }

  // --- control mode ---------------------------------------------------------------

  controlKey(k) {
    const cmd = { H: "halt", R: "run", S: "single" }[k];
    if (k === "L") { this.mode = "ladder"; this.pan = 0; this.scroll = 0; }
    else if (k === "D") this.ask("FIRST LOCATION? ", (a) => this.openTables(a), "A TABLE AND WORD, E.G. G0");
    else if (k === "P") { this.mode = "presets"; this.presetPage = 0; }
    else if (k === "O") this.askPrint();
    else if (k === "?") this.help("control");
    else if (cmd || k === "T" || k === "N" || k === "C") {
      if (this.monitorOnly) return this.alarm("KEY SWITCH AT MONITOR ONLY");
      if (cmd) { this.send({ type: cmd }); this.say({ halt: "HALT", run: "RUN", single: "SINGLE CYCLE" }[cmd] + " SENT"); }
      else if (k === "T" || k === "N") { this.send({ type: "test_inputs", value: k === "T" }); this.say(k === "T" ? "TEST INPUTS" : "NORMAL INPUTS"); }
      else if (this.eprom()) this.alarm("PROGRAM IN EPROM - CANNOT CLEAR STORE");
      else this.confirm = { label: "CLEAR STORE: PROGRAM AND DATA TABLES WILL BE LOST. ARE YOU SURE (Y/N)? ",
        yes: () => { this.send({ type: "clear" }); this.cur = 0; this.say(`${this.connected()} - STORE CLEARED`); } };
    } else this.alarm("NOT AN OPTION");
  }

  // --- ladder mode: command level ----------------------------------------------

  rungs() { return (this.state && this.state.ladder) || []; }

  ladderKey(k) {
    const rungs = this.rungs(), n = rungs.length;
    const go = (i) => { this.cur = Math.max(0, Math.min(n - 1, i)); this.shown = null; this.preview = null; this.pan = 0; this.scroll = 0; };
    switch (k) {
      case "F": return n ? go(0) : this.alarm("NO PROGRAM");
      case "L": return n ? go(n - 1) : this.alarm("NO PROGRAM");
      case "N": return this.cur < n - 1 ? go(this.cur + 1) : this.alarm("LAST RUNG");
      case "B": return this.cur > 0 ? go(this.cur - 1) : this.alarm("FIRST RUNG");
      case "M": this.monitor = !this.monitor; return this.say(this.monitor ? "MONITOR ON" : "MONITOR OFF");
      case "T": this.mode = "control"; this.shown = null; this.preview = null; return;
      case "?": return this.help("ladder");
      case "S": return this.ask("SEARCH FOR? ", (a) => this.search(a), "AN ADDRESS, E.G. A0.3 OR G25: THE NEXT RUNG THAT USES IT");
      case "W": return this.askWrite();
    }
    if (this.monitorOnly) return this.alarm("KEY SWITCH AT MONITOR ONLY");
    if (this.eprom()) return this.alarm("PROGRAM IN EPROM - CANNOT ALTER ON LINE");
    switch (k) {
      case "E": this.draft = { stack: [{ branches: [[]] }], acts: [], history: [] }; this.mode = "entry"; this.preview = null; this.shown = null; this.pan = 0; this.scroll = 0; return;
      case "C": {
        const r = rungs[this.cur];
        if (!r) return this.alarm("NO RUNG TO CHANGE");
        this.ask("CHANGE RUNG: ", (text) => this.showText(text), "EDIT THE RUNG AS TEXT, THEN CR. I OR R STORES IT");
        this.prompt.buf = this.shown || r.source.split(";")[0].trim();
        this.prompt.spaceEnds = false;
        return;
      }
      case "I": case "R": {
        if (!this.shown) return this.alarm(k === "I" ? "NO NEW RUNG - E ENTERS ONE" : "NO CHANGED RUNG - C CHANGES THIS ONE");
        if (k === "R" && !rungs[this.cur]) return this.alarm("NO STORED RUNG TO REPLACE");
        return this.store(k === "R");
      }
      case "D": {
        if (this.shown) { this.shown = null; this.preview = null; return this.say("DISPLAYED RUNG ABANDONED"); }
        const r = rungs[this.cur];
        if (!r) return this.alarm("NO RUNG TO DELETE");
        this.confirm = { label: `DELETE RUNG ${this.cur + 1} (Y/N)? `, yes: () => this.remove() };
        return;
      }
    }
    this.alarm("NOT AN OPTION");
  }

  search(addr) {
    const rungs = this.rungs();
    if (!/^[A-Z]\d+(\.\d+)?$/.test(addr)) return this.alarm("NOT AN ADDRESS");
    const re = new RegExp("(^|[^A-Z0-9.@])" + addr.replace(".", "\\.") + "(?![0-9.])");
    for (let s = 1; s <= rungs.length; s++) {
      const j = (this.cur + s) % rungs.length;
      if (re.test(rungs[j].source.split(";")[0])) { this.cur = j; this.shown = null; this.preview = null; return this.say(`${addr} FOUND IN RUNG ${j + 1}`); }
    }
    this.alarm(`${addr} NOT FOUND`);
  }

  askWrite() {
    if (this.monitorOnly) return this.alarm("KEY SWITCH AT MONITOR ONLY");
    this.ask("WRITE TO? ", (addr) => {
      if (!/^[A-Z]\d+(\.\d+)?$/.test(addr)) return this.alarm("NOT AN ADDRESS");
      this.ask(`WRITE TO ${addr}  VALUE? `, (v) => {
        const value = /^@[0-9A-F]+$/.test(v) ? parseInt(v.slice(1), 16) : Number(v);
        if (v === "" || Number.isNaN(value)) return this.alarm("NOT A NUMBER");
        this.send({ type: "write", address: addr, value: value > 32767 ? value - 65536 : value });
        this.say(`${addr} = ${value}`);
      }, addr.includes(".") ? "1 OR 0" : "-32768 TO 32767, OR @0000 TO @FFFF");
    }, "A TABLE ADDRESS, E.G. G12 OR A0.3");
  }

  showText(text) {
    if (!text) return;
    this.shown = text;
    this.wantPreview = true;
    this.send({ type: "preview", source: text });
    this.say("DISPLAYED RUNG NOT STORED - I INSERTS IT, R REPLACES THE STORED RUNG");
  }

  store(replace) {
    const rungs = this.rungs();
    const lines = (this.state.program || "").split("\n");
    const r = rungs[this.cur];
    let cur = this.cur;
    if (replace) lines.splice(r.line - 1, 1, this.shown);
    else { lines.splice(r ? r.line : lines.length, 0, this.shown); cur = r ? this.cur + 1 : 0; }
    this.pendingLoad = { cur, message: replace ? `RUNG ${cur + 1} REPLACED` : `RUNG INSERTED AS RUNG ${cur + 1}` };
    this.send({ type: "load", source: lines.join("\n") });
  }

  remove() {
    const r = this.rungs()[this.cur];
    const lines = this.state.program.split("\n");
    lines.splice(r.line - 1, 1);
    this.pendingLoad = { cur: Math.max(0, this.cur - 1), message: `RUNG ${this.cur + 1} DELETED` };
    this.send({ type: "load", source: lines.join("\n") });
  }

  // --- ladder mode: rung entry -------------------------------------------------

  entryKey(k) {
    const d = this.draft;
    const top = d.stack.at(-1), line = top.branches.at(-1);
    const done = d.acts.length > 0;
    const element = (label, make, hint, opts = {}) => {
      if (done) return this.alarm("RUNG HAS ITS OUTPUT - ESC, THEN I TO INSERT IT");
      if (!opts.output && line.length >= MAX_SERIES) return this.alarm(`AT MOST ${MAX_SERIES} ELEMENTS IN SERIES`);
      this.ask(label, (text) => {
        if (!text && !opts.empty) return this.alarm("NOTHING ENTERED");
        this.push(make(text), opts.output);
      }, hint);
      Object.assign(this.prompt, opts.prompt || {});
    };
    const addr = "AN ADDRESS, E.G. A2.8 - SPACE OR CR ENDS IT";
    switch (k) {
      case "N/O": return element("N/O CONTACT ", (a) => a, addr);
      case "N/C": return element("N/C CONTACT ", (a) => "NOT " + a, addr);
      case "COIL": return element("COIL ", (a) => a, "A BIT ADDRESS, E.G. B1.13", { output: true });
      case "OUT": return element("OUT ", (a) => "OUT " + a, "A WORD, E.G. G12: THE RUNG WORD IS WRITTEN TO IT", { output: true });
      case "SEQR": return element("SEQR ", (a) => "SEQR " + a, "THE SEQUENCER WORD, E.G. G12", { output: true });
      case "AND": case "ADD": case "SUB":
        return element(k + " ", (a) => `${k} ${a}`, "A WORD OR A NUMBER, E.G. G4, 12 OR @00FF");
      case "LOGIC": return element("LOGIC ", (a) => a, "OR, XOR OR INV, AND ITS WORD OR NUMBER: E.G. OR @00F0", { prompt: { spaceEnds: false } });
      case "DELAY": case "COUNT": case "SPEC": return this.withValue(k);
      case "BLOCK":
        if (done) return this.alarm("RUNG HAS ITS OUTPUT");
        return this.ask("BLOCK: O = OBEY BLOCK, E = END OF BLOCK? ", (a) => {
          if (a === "O") this.push("BLOCK", true);
          else if (a === "E") { if (line.length || d.stack.length > 1 || top.branches.length > 1) return this.alarm("END OF BLOCK STANDS ALONE IN ITS RUNG"); this.push("END BLOCK", true); }
          else this.alarm("O OR E");
        });
      case "LINK":
        if (done) return this.alarm("RUNG HAS ITS OUTPUT");
        d.history.push(JSON.stringify({ stack: d.stack, acts: d.acts }));
        d.stack.push({ branches: [[]] });
        return this.say("BRANCH POINT - KEY THE TOP LINE, LF FOR THE NEXT LINE DOWN, JOIN TO CLOSE");
      case "LF":
        if (!line.length) return this.alarm("THIS LINE IS EMPTY");
        if (top.branches.length >= MAX_BRANCHES) return this.alarm(`AT MOST ${MAX_BRANCHES} PARALLEL BRANCHES`);
        d.history.push(JSON.stringify({ stack: d.stack, acts: d.acts }));
        top.branches.push([]);
        return this.say("NEXT LINE DOWN");
      case "JOIN": {
        if (d.stack.length === 1 && top.branches.length === 1) return this.alarm("NO BRANCH TO JOIN");
        d.history.push(JSON.stringify({ stack: d.stack, acts: d.acts }));
        if (d.stack.length > 1) {
          const s = joinLines(d.stack.pop());
          if (s) d.stack.at(-1).branches.at(-1).push(s);
        } else top.branches = [[joinLines(top)]];
        return this.refresh();
      }
      case "RUBOUT": return d.history.length ? this.undo() : this.alarm("NOTHING TO RUB OUT");
      case "ESC": {
        this.mode = "ladder";
        if (!done) { this.draft = null; this.preview = null; return this.say("RUNG ABANDONED: IT HAD NO OUTPUT"); }
        this.shown = draftSource(d); this.draft = null;
        return this.say("DISPLAYED RUNG NOT STORED - I INSERTS IT AFTER THE STORED RUNG, R REPLACES IT");
      }
      case "?": return this.help("entry");
    }
    this.alarm("PRESS A FUNCTION KEY FIRST: N/O, N/C, COIL ...");
  }

  // DELAY G26 VALUE 50, COUNT G25 VALUE 12, SPEC SQRT VALUE 100: the VALUE
  // key (or SPACE, after the word of a DELAY or COUNT) moves on to the value.
  withValue(k) {
    const d = this.draft;
    if (d.acts.length) return this.alarm("RUNG HAS ITS OUTPUT - ESC, THEN I TO INSERT IT");
    if (d.stack.at(-1).branches.at(-1).length >= MAX_SERIES) return this.alarm(`AT MOST ${MAX_SERIES} ELEMENTS IN SERIES`);
    const p = {
      label: k + " ", buf: "", first: null, spaceEnds: k !== "SPEC",
      hint: { DELAY: "ITS WORD, E.G. G26, THEN VALUE AND THE TIME IN 0.1 S", COUNT: "ITS WORD, E.G. G25, THEN VALUE AND THE COUNT",
        SPEC: "E.G. SQRT OR S12, OR DIV [AND 12] FOR A T FUNCTION, THEN VALUE OR CR" }[k],
    };
    p.onValue = () => {
      if (p.first !== null || !p.buf.trim()) return this.alarm("NOT ALLOWED HERE");
      p.first = p.buf.trim();
      p.label = `${k} ${p.first} VALUE `;
      p.buf = "";
      p.spaceEnds = true;
      p.hint = k === "DELAY" ? "THE TIME IN 0.1 S, OR A WORD" : "A NUMBER OR A WORD";
    };
    p.done = (text) => {
      if (p.first === null) {
        if (!text) return this.alarm("NOTHING ENTERED");
        if (k === "SPEC") return this.push(`SPEC ${text}`);
        p.buf = text; p.onValue(); this.prompt = p;
        return;
      }
      if (!text) { this.prompt = p; return this.alarm("NEEDS A VALUE"); }
      this.push(`${k} ${p.first} VALUE ${text}`);
    };
    this.prompt = p;
  }

  push(text, output) {
    const d = this.draft;
    d.history.push(JSON.stringify({ stack: d.stack, acts: d.acts }));
    if (output) d.acts.push(text); else d.stack.at(-1).branches.at(-1).push(text);
    this.refresh();
  }

  undo() {
    const d = this.draft;
    Object.assign(d, JSON.parse(d.history.pop()));
    this.refresh();
  }

  refresh() {
    const d = this.draft;
    const cond = draftCond8920(d);
    if (!cond && !d.acts.length) { this.preview = null; return this.draw(); }
    const out = d.acts[0];
    this.wantPreview = true;
    this.send({ type: "preview", source: out === "END BLOCK" ? "END BLOCK" : `${cond} -> ${out || "G63.15"}` });
  }

  // --- data tables mode ---------------------------------------------------------

  openTables(a) {
    if (!/^[A-Z]\d+$/.test(a)) return this.alarm("A TABLE AND WORD, E.G. G0");
    this.tableAt = a; this.values = null; this.mode = "tables";
    this.readTables();
  }

  readTables() { this.send({ type: "read", address: this.tableAt, count: 32 }); }

  stepTables(n) {
    const m = /^([A-Z])(\d+)$/.exec(this.tableAt);
    const size = this.values ? this.values.size : 9999;
    const w = Math.max(0, Math.min(Number(m[2]) + n, Math.max(0, size - 1)));
    this.tableAt = m[1] + w; this.readTables();
  }

  tablesKey(k) {
    if (k === "N") return this.stepTables(32);
    if (k === "B") return this.stepTables(-32);
    if (k === "S") return this.ask("FIRST LOCATION? ", (a) => this.openTables(a), "A TABLE AND WORD, E.G. R100");
    if (k === "W") return this.askWrite();
    if (k === "T") { this.mode = "control"; return; }
    if (k === "?") return this.help("tables");
    this.alarm("NOT AN OPTION");
  }

  // --- preset data table ------------------------------------------------------
  // The presets and messages kept with the program (PRESET and MESSAGE lines):
  // written into the tables at a program load, and kept on cassette with it.

  presetRows() {
    const s = this.state || {}, rows = [];
    const words = (s.presets || []).map(([a, v]) => `${a.padEnd(7)}=${String(v).padStart(7)}`);
    for (const [a, t] of Object.entries(s.messages || {}).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))) {
      rows.push(`${a.padEnd(7)}"${t.toUpperCase()}"`.slice(0, COLS - 2));
    }
    for (let i = 0; i < words.length; i += 3) rows.push(words.slice(i, i + 3).map((w) => w.padEnd(24)).join(""));
    return rows;
  }

  presetLines() {
    const s = this.state || {}, rows = this.presetRows();
    const per = ROWS - 8, pages = Math.max(1, Math.ceil(rows.length / per));
    this.presetPage = Math.min(this.presetPage || 0, pages - 1);
    const n = (count, what) => `${count} ${what}${count === 1 ? "" : "S"}`;
    const L = [`PRESET DATA TABLE - ${n((s.presets || []).length, "WORD")} AND ${n(Object.keys(s.messages || {}).length, "MESSAGE")} - PAGE ${this.presetPage + 1} OF ${pages}`, ""];
    if (!rows.length) L.push("  NO PRESET DATA - W ENTERS A VALUE, OR \"TEXT\" FOR A MESSAGE");
    for (const r of rows.slice(this.presetPage * per, (this.presetPage + 1) * per)) L.push(" " + r);
    while (L.length < ROWS - 4) L.push("");
    return this.foot(L, "COMMAND LEVEL - OPTIONS:  W, D, N, B, T, ?.");
  }

  presetsKey(k) {
    if (k === "N" || k === "B") { this.presetPage = Math.max(0, (this.presetPage || 0) + (k === "N" ? 1 : -1)); return; }
    if (k === "T") { this.mode = "control"; return; }
    if (k === "?") return this.help("presets");
    if (k !== "W" && k !== "D") return this.alarm("NOT AN OPTION");
    if (this.monitorOnly) return this.alarm("KEY SWITCH AT MONITOR ONLY");
    if (this.eprom()) return this.alarm("PRESET DATA IN EPROM - CANNOT ALTER ON LINE");
    const word = /^[A-Z]\d+$/;
    if (k === "D") {
      return this.ask("DELETE PRESET AT? ", (a) => {
        if (!word.test(a)) return this.alarm("A TABLE AND WORD, E.G. R100");
        const isText = a in ((this.state && this.state.messages) || {});
        this.pendingLoad = { message: `${isText ? "MESSAGE" : "PRESET"} AT ${a} DELETED` };
        this.send(isText ? { type: "message", address: a, text: null } : { type: "preset", address: a, value: null });
      }, "THE WORD, OR THE FIRST WORD OF A MESSAGE");
    }
    this.ask("PRESET LOCATION? ", (a) => {
      if (!word.test(a)) return this.alarm("A TABLE AND WORD, E.G. R100");
      this.ask(`PRESET ${a}  VALUE? `, (v) => {
        if (v.startsWith('"')) {
          const text = v.replace(/^"/, "").replace(/"$/, "");
          this.pendingLoad = { message: `MESSAGE AT ${a} STORED` };
          return this.send({ type: "message", address: a, text });
        }
        const value = /^@[0-9A-F]+$/.test(v) ? parseInt(v.slice(1), 16) : Number(v);
        if (v === "" || Number.isNaN(value) || value < -32768 || value > 65535) return this.alarm("NOT A NUMBER");
        this.pendingLoad = { message: `${a} PRESET TO ${value}` };
        this.send({ type: "preset", address: a, value: value > 32767 ? value - 65536 : value });
      }, 'A NUMBER (@ FOR HEX), OR "TEXT" FOR WRITEXT; \\N ENDS A LINE');
      this.prompt.spaceEnds = false;
    }, "A TABLE AND WORD THE PROGRAM KEEPS, E.G. R100 OR P100");
  }

  // --- print-out on the programmer's printer --------------------------------------

  askPrint() {
    this.ask("PRINT (P)ROGRAM OR (D)ATA TABLES? ", (w) => {
      if (w === "P") { this.send({ type: "printout" }); return this.say("PROGRAM PRINTED - SEE THE PRINT-OUT UNDER THE PROGRAM TEXT"); }
      if (w !== "D") return this.alarm("P OR D");
      this.ask("FIRST LOCATION? ", (a) => {
        if (!/^[A-Z]\d+$/.test(a)) return this.alarm("A TABLE AND WORD, E.G. G0");
        this.ask("HOW MANY LOCATIONS? ", (n) => {
          const count = Number(n || 64);
          if (!Number.isInteger(count) || count < 1) return this.alarm("NOT A NUMBER");
          this.send({ type: "printout", what: "tables", address: a, count });
          this.say(`${a} ON PRINTED - SEE THE PRINT-OUT UNDER THE PROGRAM TEXT`);
        }, "1 TO 2048, CR FOR 64");
      }, "A TABLE AND WORD, E.G. G0");
    }, "P: THE LADDER DIAGRAM, NAMES AND PRESETS   D: A RUN OF DATA TABLE WORDS");
  }

  // --- help -----------------------------------------------------------------

  help(from) { this.helpFrom = from; this.mode = "help"; }
  helpKey() { this.mode = this.helpFrom; }

  // --- the screen -----------------------------------------------------------------

  eprom() { return !!(this.state && this.state.model && this.state.model.eprom); }
  connected() { const m = this.state && this.state.model; return m ? `GEM80 ${m.title.replace("GEM 80/", "")}` : "NOT CONNECTED TO GEM80"; }

  status() {
    const s = this.state;
    if (!s) return "NOT CONNECTED TO GEM80";
    const run = s.running ? "RUNNING" : s.trip_code ? `HALTED - WATCHDOG TRIP F1=${s.trip_code}` : "HALTED";
    return `GEM 80 STATUS - ${run} - ${s.test_inputs ? "TEST" : "NORMAL"} INPUTS.`;
  }

  say(text) { this.message = text; this.draw(); }

  alarm(text) {
    this.message = text;
    this.beep();
    this.unit.classList.remove("alarm"); void this.unit.offsetWidth; this.unit.classList.add("alarm");
    this.draw();
  }

  unlockAudio() {
    if (this.audio) return;
    try { this.audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.audio = null; }
  }

  beep() {
    const a = this.audio;
    if (!a) return;
    try {
      const o = a.createOscillator(), g = a.createGain();
      o.type = "square"; o.frequency.value = 1150; g.gain.value = 0.04;
      o.connect(g).connect(a.destination);
      o.start(); o.stop(a.currentTime + 0.12);
    } catch { /* no sound */ }
  }

  lines() {
    const L = [];
    const s = this.state;
    if (this.mode === "power") {
      L.push("", "", "", "", "", "", "", "", center("PORTABLE GEM 80 PROGRAMMER - VERSION 4.5"), "", center("8920 - ENGLISH - 50 HZ"));
      return L;
    }
    if (!s) return ["", "", center("NOT CONNECTED TO GEM80")];
    if (this.mode === "help") return this.helpLines();
    if (this.mode === "control") {
      const m = s.model;
      L.push(center("PORTABLE GEM 80 PROGRAMMER - VERSION 4.5"), "", `  CONNECTED TO ${this.connected()}   ${m.memory} ${m.eprom ? "EPROM" : "RAM"}   PROGRAM ${s.instructions} OF ${m.instructions} INSTRUCTIONS`, "");
      L.push("  CONTROL MODE - OPTIONS:", "");
      L.push("     L   LADDER DIAGRAM - DISPLAY, MONITOR AND EDIT RUNGS");
      L.push("     D   DATA TABLES - MONITOR AND WRITE, 32 LOCATIONS AT A TIME");
      L.push("     P   PRESET DATA TABLE - VALUES AND MESSAGES KEPT WITH THE PROGRAM");
      L.push("     O   PRINT-OUT OF THE PROGRAM OR THE DATA TABLES", "");
      L.push("     H   HALT                R   RUN                 S   SINGLE CYCLE");
      L.push("     T   TEST INPUTS         N   NORMAL INPUTS       C   CLEAR STORE", "");
      L.push(`     KEY SWITCH AT ${this.monitorOnly ? "MONITOR ONLY: MONITORING ONLY" : "PROGRAM: ENTRY AND EDITING ALLOWED"}`);
      return this.foot(L, "COMMAND LEVEL - OPTIONS:  L, D, P, O, H, R, S, T, N, C, ?.");
    }
    if (this.mode === "tables") return this.tableLines();
    if (this.mode === "presets") return this.presetLines();
    // ladder and entry
    const rungs = this.rungs();
    const r = rungs[this.cur];
    L.push(`INSTRUCTIONS END AT ${s.instructions}`);
    if (this.mode === "entry") L.push("RUNG ENTRY - RUNG NOT YET STORED");
    else if (this.shown) L.push("DISPLAYED RUNG NOT STORED");
    else if (r && r.instructions) L.push(`DISPLAYED RUNG ${this.cur + 1} OF ${rungs.length} STORED AS INSTRUCTIONS ${r.instructions[0]} to ${r.instructions[1]}`);
    else L.push(rungs.length ? "" : "NO PROGRAM - E ENTERS A RUNG");
    L.push("");
    const show = this.mode === "entry" || this.shown ? this.preview : r;
    const body = [];
    if (show) {
      if (show.comment && !this.shown && this.mode !== "entry") body.push(";" + String(show.comment).split("\n")[0].toUpperCase());
      const live = this.monitor && show === r ? (s.flow || {}) : null;
      body.push(...textRung(show, live).lines);
    }
    const room = ROWS - 7;
    this.scroll = Math.min(this.scroll, Math.max(0, body.length - room));
    for (const line of body.slice(this.scroll, this.scroll + room)) L.push(line.slice(this.pan, this.pan + COLS));
    while (L.length < ROWS - 4) L.push("");
    if (this.mode === "entry") {
      const d = this.draft, top = d.stack.at(-1);
      L.push(`RUNG ENTRY - ${d.stack.length > 1 ? `BRANCH LINE ${top.branches.length} OF ${d.stack.length - 1} OPEN BRANCH POINT${d.stack.length > 2 ? "S" : ""}` : "MAIN LINE"} - ${d.acts.length ? "OUTPUT ENTERED: ESC" : "FUNCTION KEYS ENTER ELEMENTS"}`);
      return this.foot(L, "");
    }
    return this.foot(L, `COMMAND LEVEL - OPTIONS:  ${RUNG_COMMANDS}`);
  }

  tableLines() {
    const v = this.values;
    const L = [`DATA TABLE MONITOR - 32 LOCATIONS FROM ${this.tableAt}${v ? ` - ${v.address[0]} TABLE HAS ${v.size} WORDS` : ""}`, ""];
    const m = /^([A-Z])(\d+)$/.exec(this.tableAt);
    const cell = (i) => {
      if (!v || i >= v.values.length) return "".padEnd(38);
      const val = v.values[i], bits = (val & 0xFFFF).toString(2).padStart(16, "0");
      return `${(m[1] + (Number(m[2]) + i)).padEnd(6)}${String(val).padStart(7)}  ${bits.replace(/(\d{4})(?=\d)/g, "$1 ")}`.padEnd(38);
    };
    for (let i = 0; i < 16; i++) L.push(" " + cell(i) + "  " + cell(i + 16));
    while (L.length < ROWS - 4) L.push("");
    L.push("");
    return this.foot(L, "COMMAND LEVEL - OPTIONS:  N, B, S, W, T?.   ▲ ▼ MOVE 16 WORDS");
  }

  helpLines() {
    const text = {
      control: [
        "CONTROL MODE", "",
        "L  LADDER DIAGRAM: SHOW THE PROGRAM A RUNG AT A TIME, MONITOR IT AND EDIT IT",
        "D  DATA TABLES: MONITOR 32 LOCATIONS, AND WRITE TO THEM",
        "P  PRESET DATA TABLE: CONSTANTS AND MESSAGES LOADED WITH THE PROGRAM",
        "O  PRINT-OUT: THE PROGRAM, OR A RUN OF DATA TABLE WORDS",
        "H  HALT    R  RUN    S  SINGLE CYCLE: OBEY THE PROGRAM ONCE, FROM HALT",
        "T  TEST INPUTS: THE A TABLE IS NO LONGER UPDATED FROM THE INPUTS, SO INPUTS",
        "   CAN BE FORCED WITH W; THE WATCHDOG STAYS OPEN.    N  NORMAL INPUTS",
        "C  CLEAR STORE: ERASE THE PROGRAM AND THE DATA TABLES (ASKS FIRST)", "",
        "THE KEY SWITCH (RIGHT OF THE SCREEN) SETS PROGRAM OR MONITOR ONLY.",
      ],
      ladder: [
        "COMMAND LEVEL (LADDER DIAGRAM)", "",
        "F  FIRST RUNG      L  LAST RUNG       N  NEXT RUNG      B  BACK ONE RUNG",
        "S  SEARCH: THE NEXT RUNG THAT USES AN ADDRESS",
        "E  ENTER A NEW RUNG WITH THE FUNCTION KEYS; ESC WHEN IT IS COMPLETE",
        "I  INSERT THE DISPLAYED NEW RUNG AFTER THE STORED ONE",
        "R  REPLACE THE STORED RUNG WITH THE DISPLAYED ONE",
        "C  CHANGE: EDIT THE STORED RUNG AS TEXT, THEN I OR R",
        "D  DELETE THE STORED RUNG (ASKS FIRST), OR ABANDON A DISPLAYED ONE",
        "M  MONITOR ON OR OFF: ..] [.. AN OPEN CONTACT, --] [-- A CLOSED ONE",
        "W  WRITE A VALUE TO A DATA TABLE LOCATION    T  TERMINATE: BACK TO CONTROL MODE",
        "◄ ► ▲ ▼  MOVE ROUND A RUNG TOO BIG FOR THE SCREEN",
        "OUR READING OF THE OPTIONS: THE 8920 DATA SHEET NAMES THEM BUT NOT WHAT EACH DOES.",
      ],
      entry: [
        "RUNG ENTRY", "",
        "N/O -] [-  N/C -]/[-  AND THE ADDRESS, SPACE: A CONTACT IN SERIES",
        "LINK  OPEN A BRANCH POINT     LF  NEXT LINE DOWN     JOIN  CLOSE IT",
        "DELAY G26 VALUE 50, COUNT G25 VALUE 12, SPEC SQRT VALUE 100: ELEMENTS IN THE RUNG",
        "AND, ADD, SUB AND A WORD OR NUMBER; LOGIC FOR OR, XOR AND INV",
        "COIL -( )-, OUT, SEQR OR BLOCK: THE OUTPUT, WHICH ENDS THE RUNG",
        "RUBOUT  TAKE BACK THE LAST ENTRY     ESC  FINISH (OR ABANDON A RUNG WITH NO OUTPUT)",
        `A RUNG HAS UP TO ${MAX_BRANCHES} PARALLEL BRANCHES OF UP TO ${MAX_SERIES} SERIES ELEMENTS.`,
      ],
      presets: [
        "PRESET DATA TABLE", "",
        "W  WRITE A PRESET: A LOCATION, THEN A NUMBER, OR \"TEXT\" FOR A WRITEXT MESSAGE",
        "D  DELETE A PRESET OR A MESSAGE     N  NEXT PAGE     B  BACK     T  TERMINATE",
        "PRESETS ARE WRITTEN INTO THE TABLES WHEN THE PROGRAM IS LOADED, AND AGAIN",
        "ONLY WHERE THEY CHANGE. USE TABLES KEPT ACROSS RUN: P OR R ON A GEM 80.",
      ],
      tables: [
        "DATA TABLE MONITOR", "",
        "N  NEXT 32 LOCATIONS     B  BACK 32     ▲ ▼  16 AT A TIME",
        "S  START FROM ANOTHER LOCATION     W  WRITE A VALUE     T  TERMINATE",
        "EACH LOCATION SHOWS ITS VALUE AND BITS 15 TO 0.",
      ],
    }[this.helpFrom] || [];
    const L = ["", ...text.map((t) => "  " + t)];
    while (L.length < ROWS - 4) L.push("");
    return this.foot(L, "PRESS ANY KEY TO GO BACK");
  }

  foot(L, options) {
    while (L.length < ROWS - 3) L.push("");
    L.length = ROWS - 3;
    if (this.confirm) L.push(this.confirm.label + "_");
    else if (this.prompt) {
      const line = this.prompt.label + this.prompt.buf + "_";
      L.push(line.length > COLS ? "…" + line.slice(line.length - COLS + 1) : line);
    } else L.push(options);
    L.push(this.message || (this.prompt && this.prompt.hint ? "(" + this.prompt.hint + ")" : ""));
    L.push(this.status());
    return L;
  }

  draw() {
    if (!this.screen) return;
    const text = this.lines().slice(0, ROWS).map((l) => String(l).slice(0, COLS).padEnd(COLS)).join("\n");
    if (text !== this.last) { this.last = text; this.screen.textContent = text; }
    this.keyEl.classList.toggle("mon", this.monitorOnly);
    this.unit.querySelectorAll("[data-pos]").forEach((n) => n.classList.toggle("on", (n.dataset.pos === "mon") === this.monitorOnly));
  }
}

const center = (t) => " ".repeat(Math.max(0, Math.floor((COLS - t.length) / 2))) + t;

// A line of series elements: contacts follow each other with AND; an element
// that passes the word on (DELAY, SPEC, ADD ...) just follows.
const seriesText = (items) => items.reduce((acc, t) => (acc ? acc + (WORD_ELEMENT.test(t) ? " " : " AND ") + t : t), "");
function joinLines(section) {
  const lines = section.branches.filter((b) => b.length).map(seriesText);
  if (!lines.length) return "";
  return lines.length === 1 ? lines[0] : "(" + lines.join(" OR ") + ")";
}
function draftCond8920(d) {
  const stack = JSON.parse(JSON.stringify(d.stack));
  while (stack.length > 1) {
    const s = joinLines(stack.pop());
    if (s) stack.at(-1).branches.at(-1).push(s);
  }
  return joinLines(stack[0]);
}
function draftSource(d) {
  const out = d.acts[0];
  return out === "END BLOCK" ? out : `${draftCond8920(d)} -> ${out}`.trim();
}

class MicroGemPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._started = false;
  }

  set hass(hass) { this._hass = hass; this._maybeStart(); }
  set panel(panel) { this._panel = panel; this._maybeStart(); }
  set transport(transport) { this._transport = transport; this._maybeStart(); }

  _maybeStart() {
    if (this._started) return;
    let transport = this._transport;
    if (!transport && this._hass && this._panel) {
      transport = homeAssistantTransport(this._hass, this._panel.config.entry_id);
    }
    if (!transport) return;
    this._started = true;
    this._start(transport);
  }

  _start(transport) {
    const root = this.shadowRoot;
    root.innerHTML = `<style>${STYLE}</style>${MARKUP}`;
    const $ = (id) => root.getElementById(id);
    const send = (m) => transport.send(m);

    let state = null;
    let built = false;
    let examples = null; // demo programmes, fetched once connected
    let ha = null; // { device_id, entities: { run, input_0, output_0, ... } } inside Home Assistant
    let mode = "toggle";
    let programDirty = false;
    let shownTable = "G";
    let selected = 0;
    let draftRungs = null;
    let frame = 0;

    const P = {
      screen: "IDLE", ctrl: false, entry: null, addr: "G0", value: null,
      draft: null, replace: false, pending: null, answers: [], confirmDel: false, flash: "", cell: 0,
    };

    function el(tag, cls, text) {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function setMessage(text, isError) {
      $("message").textContent = text;
      $("message").classList.toggle("error", !!isError);
    }

    // I/O point i -> its address; unit n (0 = controller) uses word n of A and B.
    function ioAddress(table, i, perUnit) {
      const pts = state && state.points && state.points[table === "A" ? "inputs" : "outputs"];
      if (pts && pts[i]) return pts[i];
      const unit = Math.floor(i / perUnit), point = i % perUnit;
      return `${table}${unit * Math.ceil(perUnit / 16) + Math.floor(point / 16)}.${point % 16}`;
    }
    const io = () => state.io || { units: 1, inputs: state.inputs.length, outputs: state.outputs.length };

    const isGem80 = () => io().family === "gem80";

    function buildToggle(group, i, title, label) {
      const wires = { inputs: {} };
      for (const [k, point] of Object.entries(wiring().inputs)) wires.inputs[k] = describe(point);
      const b = el("button", "toggle");
      b.title = title;
      b.innerHTML = `<span class="plate"><span class="lever"></span></span><small>${label}</small>`;
      if (wires.inputs[i]) { b.disabled = true; b.title += `: wired to ${wires.inputs[i].title}`; }
      b.addEventListener("click", () => { if (mode === "toggle") send({ type: "input", index: i, value: !state.inputs[i] }); });
      const press = (v) => (e) => { if (mode === "momentary") { e.preventDefault(); send({ type: "input", index: i, value: v }); } };
      b.addEventListener("pointerdown", press(true));
      b.addEventListener("pointerup", press(false));
      b.addEventListener("pointerleave", (e) => { if (mode === "momentary" && state.inputs[i]) press(false)(e); });
      group.append(b);
    }

    function buildGem80() {
      const info = io(), model = state.model;
      const wires = { inputs: {}, outputs: {}, analogue: {} };
      for (const kind of ["inputs", "outputs", "analogue"]) {
        for (const [i, point] of Object.entries(wiring()[kind])) wires[kind][i] = describe(point);
      }
      $("unit").innerHTML = gem80Svg(info, model, wires);
      $("unit").classList.toggle("wirable", canWire());
      $("title").textContent = `Virtual ${model.label}`;
      $("about").textContent = `A ${model.label} compact controller running in software: a 19 inch subrack with ${info.slots.filter((s) => s.module).length} Compact I/O modules. Flip the inputs, watch the module lamps and the ladder, and program it from the 8920 Portable Programmer or the text editor.`;
      host.classList.add("g80");
      root.querySelector(".hw").classList.add("g80");
      $("progwrap").style.display = "none";
      $("g80-ctl").hidden = false;
      $("p8920").hidden = false;
      if (!pp) pp = new Programmer8920($("p8920"), send);
      $("printer").hidden = !(model.printer);
      if (model.printer && !paper) { paper = []; send({ type: "paper" }); }
      const t = $("toggles");
      t.replaceChildren();
      for (const slot of info.slots) {
        if (slot.kind === "analogue") { buildAnalogue(t, slot); continue; }
        if (!slot.module || slot.kind !== "input") continue;
        t.append(el("div", "group-label", `SLOT ${slot.slot} · ${slot.module} · ${slot.words.map((w) => "A" + w).join(" ")}`));
        const group = el("div", "toggles");
        group.style.setProperty("--n", Math.min(slot.channels, 16));
        for (let c = 0; c < slot.channels; c++) {
          const i = slot.first + c;
          buildToggle(group, i, `Slot ${slot.slot} channel ${c} (${ioAddress("A", i)})`, String(c % 16));
        }
        t.append(group);
      }
      if (!g80Built) {
        g80Built = true;
        $("g80-mode").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => send({ type: b.dataset.run === "1" ? "run" : "halt" })));
      }
      built = true;
      buildLinks();
    }
    // Sliders for an 8108's channels, in volts; a wired channel follows its sensor.
    function buildAnalogue(t, slot) {
      t.append(el("div", "group-label", `SLOTS ${slot.slot + 1}–${slot.slot} · ${slot.module} · A${slot.words[0]} · ANALOGUE, VOLTS`));
      const group = el("div", "analogue");
      for (let c = 0; c < slot.channels; c++) {
        const i = slot.first + c;
        const row = el("label", "an-row");
        const input = document.createElement("input");
        Object.assign(input, { type: "range", min: "-10", max: "10", step: "0.05", value: "0" });
        input.id = `ans-${i}`;
        input.setAttribute("aria-label", `Analogue channel ${c} (slot ${slot.slot}), volts`);
        input.addEventListener("input", () => send({ type: "analogue", index: i, value: Number(input.value) }));
        row.append(el("span", "an-ch", `CH ${c}`), input, el("span", "an-val", "0.00 V"));
        row.lastChild.id = `ansv-${i}`;
        group.append(row);
      }
      t.append(group);
    }
    function renderAnalogue() {
      const volts = state.analogue || [];
      const u = $("unit");
      const wiredAn = (wiring().analogue) || {};
      volts.forEach((v, i) => {
        const bar = u.querySelector(`#an-${i}`);
        if (bar) {
          const full = Number(bar.previousElementSibling.previousElementSibling.getAttribute("width"));
          const half = full / 2, len = Math.min(1, Math.abs(v) / 10) * half;
          const mid = Number(bar.previousElementSibling.getAttribute("x1"));
          bar.setAttribute("x", v < 0 ? mid - len : mid);
          bar.setAttribute("width", len);
        }
        const tv = u.querySelector(`#anv-${i}`);
        if (tv) tv.textContent = v.toFixed(2);
        const sl = root.querySelector(`#ans-${i}`);
        if (sl && root.activeElement !== sl) { sl.value = v; sl.disabled = !!wiredAn[i]; }
        const sv = root.querySelector(`#ansv-${i}`);
        if (sv) sv.textContent = `${v.toFixed(2)} V`;
      });
      const mux = state.mux || [];
      u.querySelectorAll("[id^=mux-]").forEach((n) => n.classList.toggle("on", mux.includes(Number(n.id.slice(4)))));
    }
    let g80Built = false;
    let pp = null; // the 8920 Portable Programmer, for a GEM 80

    function build() {
      if (isGem80()) return buildGem80();
      const { units, inputs: nIn, outputs: nOut } = io();
      let svgs = "";
      const wires = { inputs: {}, outputs: {} };
      for (const kind of ["inputs", "outputs"]) {
        for (const [i, point] of Object.entries(wiring()[kind])) wires[kind][i] = describe(point);
      }
      for (let u = 0; u < units; u++) svgs += unitSvg(nIn, nOut, u, u * nIn, u * nOut, wires);
      $("unit").innerHTML = svgs;
      $("unit").classList.toggle("wirable", canWire());
      const t = $("toggles");
      t.replaceChildren();
      for (let u = 0; u < units; u++) {
        if (units > 1) t.append(el("div", "group-label", u === 0 ? "CONTROLLER" : `EXPANSION UNIT ${u}`));
        const group = el("div", "toggles");
        group.style.setProperty("--n", Math.min(nIn, 16));
        for (let p = 0; p < nIn; p++) {
          const i = u * nIn + p;
          const b = el("button", "toggle");
          b.title = `Input terminal ${String(p).padStart(2, "0")}${u ? ` on expansion unit ${u}` : ""} (${ioAddress("A", i, nIn)})`;
          b.innerHTML = `<span class="plate"><span class="lever"></span></span><small>${String(p).padStart(2, "0")}</small>`;
          if (wires.inputs[i]) { b.disabled = true; b.title += `: wired to ${wires.inputs[i].title}`; }
          b.addEventListener("click", () => { if (mode === "toggle") send({ type: "input", index: i, value: !state.inputs[i] }); });
          const press = (v) => (e) => { if (mode === "momentary") { e.preventDefault(); send({ type: "input", index: i, value: v }); } };
          b.addEventListener("pointerdown", press(true));
          b.addEventListener("pointerup", press(false));
          b.addEventListener("pointerleave", (e) => { if (mode === "momentary" && state.inputs[i]) press(false)(e); });
          group.append(b);
        }
        t.append(group);
      }
      if (keysBuilt) { built = true; buildLinks(); return; }
      keysBuilt = true;
      const keys = $("keys");
      for (const [label, colour, second] of KEYS) {
        const k = el("button", "k " + colour);
        k.dataset.key = label;
        const shown = label === "0" ? "Ø" : label;
        k.innerHTML = `<span class="leg">${esc(shown)}${second ? "/<i>" + esc(second) + "</i>" : ""}</span><span class="cap"></span>`;
        k.setAttribute("aria-label", label + (second ? " / " + second : ""));
        k.addEventListener("click", () => press(label));
        keys.append(k);
      }
      $("keyswitch").addEventListener("click", () => send({ type: state.running ? "halt" : "run" }));
      built = true;
      buildLinks();
    }
    let keysBuilt = false;
    let builtFor = "";

    // ---- links to the Home Assistant entities ----
    const host = this;
    function moreInfo(entityId) {
      host.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
    }
    function navigate(path) {
      history.pushState(null, "", path);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    }
    function buildLinks() {
      if (!ha || !state) return;
      const box = $("chips");
      box.replaceChildren();
      const { inputs: nIn, outputs: nOut } = io();
      const chip = (key, label, cls) => {
        const id = ha.entities[key];
        if (!id) return null;
        const c = el("button", "chip " + cls);
        c.dataset.key = key;
        c.title = id;
        c.innerHTML = `<span class="dot"></span>${esc(label)}`;
        c.addEventListener("click", () => moreInfo(id));
        return c;
      };
      const row = (title, chips) => {
        const shown = chips.filter(Boolean);
        if (!shown.length) return;
        box.append(el("div", "chips-label", title));
        const r = el("div", "chips");
        r.append(...shown);
        box.append(r);
      };
      const first = (k) => ha.entities[k] ? ` (${ha.entities[k].replace(/_a0_0$|_b0_0$/, "_…")})` : "";
      row("Controller", [chip("run", "Run", "run"), chip("watchdog", "Watchdog", "run")]);
      row(`Inputs: switches${first("input_0")}`, state.inputs.map((_, i) => chip(`input_${i}`, ioAddress("A", i, nIn), "in")));
      row(`Outputs: binary sensors${first("output_0")}`, state.outputs.map((_, i) => chip(`output_${i}`, ioAddress("B", i, nOut), "out")));
      const wired = [];
      for (const [kind, table, per, arrow] of [["inputs", "A", nIn, "←"], ["outputs", "B", nOut, "→"]]) {
        for (const [i, point] of Object.entries(wiring()[kind]).sort((a, b) => a[0] - b[0])) {
          const c = el("button", "chip wire");
          c.title = `Edit the wiring of ${ioAddress(table, Number(i), per)}`;
          c.innerHTML = `${ioAddress(table, Number(i), per)} ${arrow} ${esc(describe(point).name)}`;
          c.addEventListener("click", () => openEditor(kind, Number(i)));
          wired.push(c);
        }
      }
      row("Field wiring", wired);
      const link = $("device-link");
      link.href = ha.device_id ? `/config/devices/device/${ha.device_id}` : "/config/integrations/integration/microgem";
      link.onclick = (e) => { e.preventDefault(); navigate(link.getAttribute("href")); };
      $("ha-links").hidden = false;
    }

    // ---- field wiring: terminals connected to Home Assistant entities ----
    const OFF = new Set(["off", "closed", "not_home", "away", "idle", "standby", "paused", "locked", "false", "0", "none", "", "unavailable", "unknown"]);
    const TRIGGERED = new Set(["button", "input_button", "scene", "script", "automation"]);
    const SWITCHABLE = new Set(["switch", "light", "fan", "input_boolean", "siren", "cover", "valve", "climate", "humidifier", "media_player", "water_heater", "vacuum", "remote", ...TRIGGERED]);
    const wiring = () => Object.assign({ inputs: {}, outputs: {}, analogue: {} }, (ha && ha.wiring) || {});
    const canWire = () => !!(ha && transport.wire);
    const hassState = (id) => host._hass && host._hass.states[id];
    function describe(point) {
      const st = hassState(point.entity_id);
      const name = (st && st.attributes.friendly_name) || point.entity_id;
      const short = name.length > 28 ? name.slice(0, 12) + "…" + name.slice(-15) : name;
      let detail = point.attribute ? `· ${point.attribute}${point.above != null ? " > " + point.above : ""}` : point.above != null ? `> ${point.above}` : "";
      if (point.invert) detail = (detail ? detail + " " : "") + "· inverted";
      return { name: short, detail, title: `${name} (${point.entity_id})${detail ? " " + detail : ""}` };
    }
    function closes(st, point) {
      // A missing or unavailable entity always leaves the contact open, inverted or not.
      if (!st || st.state === "unavailable" || st.state === "unknown") return false;
      return contact(st, point) !== !!point.invert;
    }
    function contact(st, point) {
      const attr = point.attribute;
      const v = attr ? st.attributes[attr] : st.state;
      if (point.above != null) { const n = Number(v); return v !== null && v !== "" && !Number.isNaN(n) && n > point.above; }
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v !== 0;
      return !OFF.has(String(v).trim().toLowerCase());
    }

    let editing = null; // { kind, index }
    function openEditor(kind, index) {
      if (!canWire()) return;
      editing = { kind, index };
      if (kind === "analogue") return openAnalogueEditor(index);
      const { inputs: nIn, outputs: nOut } = io();
      const per = kind === "inputs" ? nIn : nOut, unit = Math.floor(index / per);
      let where = `${kind === "inputs" ? "input terminal" : "relay output"} ${String(index % per).padStart(2, "0")}${unit ? ` on expansion unit ${unit}` : ""}`;
      if (isGem80()) {
        const slot = io().slots.find((sl) => sl.module && (sl.kind === "input") === (kind === "inputs") && index >= sl.first && index < sl.first + sl.channels);
        if (slot) where = `slot ${slot.slot} (${slot.module}) channel ${index - slot.first}`;
      }
      const addr = ioAddress(kind === "inputs" ? "A" : "B", index, per);
      const point = wiring()[kind][index];
      $("we-title").textContent = `Wire ${where} (${addr})`;
      $("we-hint").textContent = kind === "inputs"
        ? `${addr} follows the entity: its contact is closed while the entity is on, open, home, playing and so on, or while a number is above the value you set.`
        : `The relay switches the entity on when ${addr} is on and off when it is off. Buttons, scenes and scripts are pressed or run each time the relay closes.`;
      chosen = point ? point.entity_id : "";
      $("we-search").value = "";
      const domain = chosen.split(".")[0];
      filter = (chosen && FILTERS.find((f) => f.key !== "all" && filterHas(f, domain) && allowed(kind, f))?.key) || "switch";
      $("we-above").value = point && point.above != null ? point.above : "";
      $("we-invert").checked = !!(point && point.invert);
      $("we-attr-box").hidden = $("we-above-box").hidden = $("we-invert-box").hidden = kind !== "inputs";
      $("we-low-box").hidden = $("we-high-box").hidden = true;
      $("we-remove").hidden = !point;
      fillAttributes(point && point.attribute);
      renderPicker(true);
      $("unit").querySelectorAll(".term").forEach((t) => t.classList.toggle("sel", t.dataset.kind === kind && Number(t.dataset.index) === index));
      $("wire-ed").hidden = false;
      $("wire-ed").scrollIntoView({ block: "nearest", behavior: "smooth" });
      $("we-search").focus();
    }
    // An 8108 channel follows a number: low reads 0 V and high 10 V, in a
    // straight line, up to the module's ±10 V.
    function openAnalogueEditor(index) {
      const slot = io().slots.find((sl) => sl.kind === "analogue" && index >= sl.first && index < sl.first + sl.channels);
      const ch = index - slot.first;
      const point = wiring().analogue[index];
      $("we-title").textContent = `Wire analogue channel ${ch} of slot ${slot.slot} (${slot.module}, read through A${slot.words[0]})`;
      $("we-hint").textContent = "The channel's voltage follows the entity's number: the value you give for 0 V reads 0 V, the one for 10 V reads 10 V, in a straight line (the 8108 reads -10 V to +10 V). A temperature of 0 to 40 °C suits the Room heating demo.";
      chosen = point ? point.entity_id : "";
      $("we-search").value = "";
      filter = "sensor";
      $("we-low").value = point && point.low != null ? point.low : 0;
      $("we-high").value = point && point.high != null ? point.high : 40;
      $("we-attr-box").hidden = false;
      $("we-above-box").hidden = $("we-invert-box").hidden = true;
      $("we-low-box").hidden = $("we-high-box").hidden = false;
      $("we-remove").hidden = !point;
      fillAttributes(point && point.attribute);
      renderPicker(true);
      $("unit").querySelectorAll(".term").forEach((t) => t.classList.toggle("sel", t.dataset.kind === "analogue" && Number(t.dataset.index) === index));
      $("wire-ed").hidden = false;
      $("wire-ed").scrollIntoView({ block: "nearest", behavior: "smooth" });
      $("we-search").focus();
    }
    const volts = (value, point) => {
      const n = Number(value), lo = Number(point.low ?? 0), hi = Number(point.high ?? 100);
      if (value === null || value === "" || Number.isNaN(n) || hi === lo) return null;
      return Math.max(-10.235, Math.min(10.235, ((n - lo) / (hi - lo)) * 10));
    };
    function closeEditor() {
      editing = null;
      $("wire-ed").hidden = true;
      $("unit").querySelectorAll(".term.sel").forEach((t) => t.classList.remove("sel"));
    }
    function fillAttributes(chosen) {
      const st = hassState(chosen);
      const attrs = st ? Object.keys(st.attributes).filter((a) => a !== "friendly_name" && !/^(icon|entity_picture|supported_features|attribution)$/.test(a)) : [];
      if (chosen && !attrs.includes(chosen)) attrs.unshift(chosen);
      $("we-attr").replaceChildren(el("option", "", "State"), ...attrs.map((a) => { const o = el("option", "", a); o.value = a; return o; }));
      $("we-attr").firstChild.value = "";
      $("we-attr").value = chosen || "";
      wirePreview();
    }
    function editedPoint() {
      const entity_id = chosen;
      if (!entity_id) return null;
      const point = { entity_id };
      if (editing.kind === "analogue") {
        if ($("we-attr").value) point.attribute = $("we-attr").value;
        point.low = Number($("we-low").value || 0);
        point.high = Number($("we-high").value || 0);
        return point;
      }
      if (editing.kind === "inputs") {
        if ($("we-attr").value) point.attribute = $("we-attr").value;
        if ($("we-above").value !== "") point.above = Number($("we-above").value);
        if ($("we-invert").checked) point.invert = true;
      }
      return point;
    }
    function wirePreview() {
      const now = $("we-now");
      now.classList.remove("error");
      const point = editing && editedPoint();
      if (!point) { now.textContent = "Pick an entity from the list."; return; }
      const st = hassState(point.entity_id);
      if (!st) { now.textContent = `${point.entity_id} is not in Home Assistant at the moment.`; now.classList.add("error"); return; }
      const value = point.attribute ? st.attributes[point.attribute] : st.state;
      const shown = typeof value === "object" ? JSON.stringify(value) : String(value);
      if (editing.kind === "analogue") {
        const v = volts(value, point);
        now.textContent = point.high === point.low ? "The values for 0 V and 10 V must differ."
          : v === null ? `${describe(point).name} is ${shown.slice(0, 60)} now, which is not a number: the channel would read 0 V.`
          : `${describe(point).name} is ${shown.slice(0, 60)} now, so the channel would read ${v.toFixed(2)} V.`;
        if (point.high === point.low) now.classList.add("error");
        return;
      }
      now.textContent = editing.kind === "inputs"
        ? `${describe(point).name} is ${shown.slice(0, 60)} now, so ${io_addr()} would be ${closes(st, point) ? "closed (on)" : "open (off)"}.`
        : `${describe(point).name} is ${shown.slice(0, 60)} now.${TRIGGERED.has(point.entity_id.split(".")[0]) ? " Pressed or run when the relay closes." : ""}`;
    }
    function io_addr() {
      const { inputs: nIn, outputs: nOut } = io();
      return editing.kind === "inputs" ? ioAddress("A", editing.index, nIn) : ioAddress("B", editing.index, nOut);
    }

    // The entity picker: kinds of entity as filter buttons, a live search, a list.
    const FILTERS = [
      { key: "switch", label: "Switches", domains: ["switch"] },
      { key: "light", label: "Lights", domains: ["light"] },
      { key: "binary_sensor", label: "Binary sensors", domains: ["binary_sensor"], inputsOnly: true },
      { key: "sensor", label: "Sensors", domains: ["sensor"], inputsOnly: true },
      { key: "helper", label: "Helpers", domains: ["input_boolean", "input_number", "input_select", "counter", "timer"] },
      { key: "action", label: "Buttons, scenes, scripts", domains: ["button", "input_button", "scene", "script", "automation"] },
      { key: "other", label: "Other" },
      { key: "all", label: "All" },
    ];
    const NAMED = new Set(FILTERS.flatMap((f) => f.domains || []));
    const filterHas = (f, domain) => f.key === "all" || (f.domains ? f.domains.includes(domain) : !NAMED.has(domain));
    const allowed = (kind, f) => kind !== "outputs" || !f.inputsOnly;
    let chosen = "", filter = "switch", highlight = 0, shownIds = [];
    function matcher(text) {
      const terms = text.trim().toLowerCase().split(/\s+/).filter(Boolean).map((t) =>
        t.includes("*") || t.includes("?")
          ? new RegExp(t.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, "."))
          : t);
      return (hay) => terms.every((t) => (typeof t === "string" ? hay.includes(t) : t.test(hay)));
    }
    function candidates() {
      const states = (host._hass && host._hass.states) || {};
      // This controller's own switches and sensors are its internal I/O, not field devices.
      const own = new Set(Object.values(ha.entities || {}));
      return Object.keys(states).filter((id) => !own.has(id) && (editing.kind !== "outputs" || SWITCHABLE.has(id.split(".")[0])));
    }
    function renderPicker(scrollToChosen) {
      const states = (host._hass && host._hass.states) || {};
      const match = matcher($("we-search").value);
      const nameOf = (id) => (states[id] && states[id].attributes.friendly_name) || id;
      const found = candidates().filter((id) => match(`${id} ${nameOf(id)}`.toLowerCase()));
      const box = $("we-filters");
      box.replaceChildren();
      for (const f of FILTERS) {
        if (!allowed(editing.kind, f)) continue;
        const total = candidates().filter((id) => filterHas(f, id.split(".")[0])).length;
        if (!total && f.key !== "all") continue;
        const n = found.filter((id) => filterHas(f, id.split(".")[0])).length;
        const b = el("button");
        b.type = "button";
        b.setAttribute("role", "tab");
        b.className = f.key === filter ? "active" : "";
        b.innerHTML = `${esc(f.label)}<small>${n}</small>`;
        b.addEventListener("click", () => { filter = f.key; highlight = 0; renderPicker(); $("we-search").focus(); });
        box.append(b);
      }
      const f = FILTERS.find((x) => x.key === filter);
      shownIds = found.filter((id) => filterHas(f, id.split(".")[0]))
        .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      const list = $("we-results");
      list.replaceChildren();
      const LIMIT = 150;
      shownIds.slice(0, LIMIT).forEach((id, i) => {
        const st = states[id];
        const r = el("button");
        r.type = "button";
        r.setAttribute("role", "option");
        r.className = (id === chosen ? "chosen " : "") + (i === highlight ? "hl" : "");
        r.innerHTML = `<b>${esc(nameOf(id))}</b><code>${esc(id)}</code><span class="st">${esc(st ? st.state : "")}</span>`;
        r.addEventListener("click", () => choose(id));
        list.append(r);
      });
      if (!shownIds.length) {
        const elsewhere = found.length ? ` ${found.length} ${found.length === 1 ? "match is" : "matches are"} under the other buttons.` : "";
        list.append(el("div", "none", `Nothing here matches.${elsewhere}`));
      } else if (shownIds.length > LIMIT) list.append(el("div", "none", `…and ${shownIds.length - LIMIT} more. Keep typing to narrow it down.`));
      if (scrollToChosen) list.querySelector(".chosen")?.scrollIntoView({ block: "nearest" });
    }
    function choose(id) {
      chosen = id;
      fillAttributes(editing.kind !== "outputs" ? $("we-attr").value : "");
      renderPicker();
    }

    function saveWire(point) {
      const { kind, index } = editing;
      if (point && !hassState(point.entity_id)) { wirePreview(); return; }
      if (point && Object.values(ha.entities || {}).includes(point.entity_id)) {
        $("we-now").textContent = "That is one of this controller's own switches or sensors. Wire terminals to other devices.";
        $("we-now").classList.add("error");
        return;
      }
      transport.wire(kind, index, point)
        .then((w) => { ha.wiring = w; closeEditor(); built = false; schedule(); })
        .catch((err) => { $("we-now").textContent = "Not saved: " + (err.message || err.code || err); $("we-now").classList.add("error"); });
    }
    $("unit").addEventListener("click", (e) => {
      const t = e.target.closest && e.target.closest(".term, .wl");
      if (t) openEditor(t.dataset.kind, Number(t.dataset.index));
    });
    $("we-search").addEventListener("input", () => { highlight = 0; renderPicker(); });
    $("we-search").addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        highlight = Math.max(0, Math.min(Math.min(shownIds.length, 150) - 1, highlight + (e.key === "ArrowDown" ? 1 : -1)));
        renderPicker();
        $("we-results").querySelector(".hl")?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && shownIds[highlight] && shownIds[highlight] !== chosen) {
        e.preventDefault();
        e.stopPropagation();
        choose(shownIds[highlight]);
      }
    });
    $("we-attr").addEventListener("change", wirePreview);
    $("we-above").addEventListener("input", wirePreview);
    $("we-low").addEventListener("input", wirePreview);
    $("we-high").addEventListener("input", wirePreview);
    $("we-invert").addEventListener("change", wirePreview);
    $("we-save").addEventListener("click", () => saveWire(editedPoint()));
    $("we-remove").addEventListener("click", () => saveWire(null));
    $("we-cancel").addEventListener("click", closeEditor);
    $("wire-ed").addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeEditor();
      if (e.key === "Enter" && e.target.tagName === "INPUT") saveWire(editedPoint());
    });

    // ---- rendering ----
    function render() {
      frame = 0;
      if (!state) return;
      const shape = JSON.stringify(io());
      if (!built || shape !== builtFor) { builtFor = shape; build(); }
      const u = $("unit");
      state.inputs.forEach((v, i) => u.querySelector(`#in-${i}`)?.classList.toggle("on", v));
      state.outputs.forEach((v, i) => u.querySelector(`#out-${i}`)?.classList.toggle("on", v));
      state.inputs.forEach((v, i) => u.querySelector(`#cable-in-${i}`)?.classList.toggle("on", v));
      state.outputs.forEach((v, i) => u.querySelector(`#cable-out-${i}`)?.classList.toggle("on", v));
      u.querySelectorAll(".supply").forEach((n) => n.classList.add("on"));
      $("chips").querySelectorAll(".chip[data-key]").forEach((c) => {
        const [kind, n] = c.dataset.key.split("_");
        const on = kind === "run" ? state.running : kind === "watchdog" ? state.watchdog : (kind === "input" ? state.inputs : state.outputs)[Number(n)];
        c.classList.toggle("on", !!on);
      });
      u.querySelector("#led-wdog")?.classList.toggle("on", !!state.watchdog);
      u.querySelector("#led-wdog2")?.classList.toggle("on", !!state.watchdog);
      if (isGem80()) {
        $("g80-mode").querySelectorAll("button").forEach((b) => b.classList.toggle("active", (b.dataset.run === "1") === !!state.running));
        const m = state.model;
        $("g80-info").textContent = `${state.running ? "Running" : state.trip_code ? `Tripped by F1 = ${state.trip_code}` : "Halted"} · program ${state.instructions} of ${m.instructions} instructions · ${m.memory} ${m.eprom ? "EPROM" : "RAM"}`;
      }
      $("toggles").querySelectorAll(".toggle").forEach((n, i) => n.classList.toggle("on", state.inputs[i]));
      $("keyswitch").classList.toggle("halt", !state.running);
      $("kp-run").innerHTML = state.running ? "<b>RUN</b>" : "RUN";
      $("kp-halt").innerHTML = state.running ? "HALT" : "<b>HALT</b>";
      renderLadder();
      renderTables();
      renderLcd();
      if (pp && isGem80()) pp.update(state);
      if (state.printer) renderPrinter(state.printer);
      if (state.analogue && state.analogue.length) renderAnalogue();
      if (!programDirty && state.program !== undefined && $("program").value !== state.program) $("program").value = state.program;
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };

    function renderLadder() {
      const rungs = state.ladder || [];
      const box = $("ladder");
      const ctx = { live: state.live || {}, flow: state.flow || {}, names: state.names || {}, draft: false };
      const all = draftRungs ? rungs.concat(draftRungs.map((r) => ({ ...r, draft: true }))) : rungs;
      if (!all.length) { box.innerHTML = `<div class="ladder-empty">No program loaded.</div>`; return; }
      const condWidth = Math.max(...all.map((r) => size(r.condition).w));
      const skipped = new Set(state.skipped || []);
      const blocks = [];
      let next = 1;
      const parts = all.map((r, i) => {
        let no = "";
        if (r.output && r.output.t === "block") { no = next++; blocks.push(no); }
        else if (r.output && r.output.t === "end") no = blocks.pop() ?? "";
        const c = r.draft ? { ...ctx, draft: true } : ctx;
        const cls = `rung${i === selected && !r.draft ? " sel" : ""}${r.draft ? " draft" : ""}${skipped.has(i) ? " skipped" : ""}`;
        return { cls, svg: rungSvg(r, i, c, condWidth, no) };
      });
      // Update the rungs in place, touching only those that changed. Replacing
      // every rung on each state update made the hover highlight flicker.
      let rows = [...box.children].filter((n) => n.classList.contains("rung"));
      if (rows.length !== parts.length) {
        box.replaceChildren(...parts.map((_, i) => { const d = el("div"); d.dataset.i = i; return d; }));
        rows = [...box.children];
      }
      parts.forEach(({ cls, svg }, i) => {
        const row = rows[i];
        if (row.className !== cls) row.className = cls;
        if (row._svg !== svg) { row._svg = svg; row.innerHTML = svg; }
      });
    }

    function renderTables() {
      const pick = $("table-pick");
      if (!pick.childElementCount) {
        for (const letter of Object.keys(state.tables)) {
          const b = el("button", letter === shownTable ? "active" : "", letter);
          b.addEventListener("click", () => { shownTable = letter; pick.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b)); render(); });
          pick.append(b);
        }
      }
      const words = state.tables[shownTable] || [];
      $("tables").innerHTML = words.map((w, i) => {
        const signed = w & 0x8000 ? w - 0x10000 : w;
        const bits = w.toString(2).padStart(16, "0").replace(/(.{4})(?!$)/g, "$1 ");
        return `<tr><td>${shownTable}${i}</td><td>${signed}</td><td>${bits}</td></tr>`;
      }).join("");
    }

    // ---- the 2 x 16 display ----
    const fit = (s) => (s + " ".repeat(LCD_W)).slice(0, LCD_W);
    const cursor = () => (Date.now() % 1000 < 500 ? "_" : " ");
    const fields = (addr, value, loc) =>
      (addr || "").padEnd(5).slice(0, 5) + " " + (value || "").padStart(6).slice(-6) + " " + (loc || "").padStart(3).slice(-3);
    const fmtVal = (v) => (v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "ON" : "OFF") : (v < 0 ? "-" : "+") + String(Math.abs(v)).padStart(5, "0"));
    const loc = () => String(selected + 1).padStart(3, "0");

    // The display is a 2 x 16 window onto the rung drawn as text: the symbol
    // line of the cursor's branch and the address line under it. The element
    // under the cursor blinks.
    function ladderLines(rung, keying) {
      const t = textRung(rung, keying ? null : state.flow);
      if (!t.cells.length) return [t.lines[0].slice(0, LCD_W), t.lines[1].slice(0, LCD_W)];
      const c = keying ? t.cells.filter((x) => x.node.t !== "coil").at(-1) || t.cells.at(-1) : t.cells[Math.min(P.cell, t.cells.length - 1)];
      const off = Math.max(0, Math.min(c.x <= 8 ? 0 : c.x - 4, t.width - LCD_W));
      let l1 = t.lines[c.row * 2].slice(off, off + LCD_W);
      const l2 = t.lines[c.row * 2 + 1].slice(off, off + LCD_W);
      if (Date.now() % 1000 >= 650) {
        const a = c.x - off, b = Math.min(LCD_W, a + c.len);
        if (a >= 0) l1 = l1.slice(0, a) + " ".repeat(Math.max(0, b - a)) + l1.slice(b);
      }
      return [l1, l2];
    }

    // Arrow keys move the cursor around the drawn rung: ◄► along a branch,
    // ▲▼ to the branch above or below, and on to the next or previous rung.
    function moveCursor(t) {
      const rungs = state.ladder || [];
      if (!rungs.length) return;
      const cells = textRung(rungs[selected], null).cells;
      const here = cells[Math.min(P.cell, cells.length - 1)] || { row: 0, x: 0 };
      const rowCells = (r) => cells.map((c, k) => ({ ...c, k })).filter((c) => c.row === r);
      if (t === "◄" || t === "►") {
        const same = rowCells(here.row);
        const at = same.findIndex((c) => c.k === P.cell);
        const next = same[at + (t === "►" ? 1 : -1)];
        if (next) P.cell = next.k;
        return;
      }
      const rowsBelow = [...new Set(cells.map((c) => c.row))].sort((a, b) => a - b);
      const ri = rowsBelow.indexOf(here.row);
      const target = rowsBelow[ri + (t === "▼" ? 1 : -1)];
      if (target === undefined) {
        // Off the top or bottom of the rung: on to the previous or next one.
        selected = (selected + (t === "▼" ? 1 : -1) + rungs.length) % rungs.length;
        const nc = textRung(rungs[selected], null).cells;
        P.cell = t === "▼" ? 0 : Math.max(0, nc.findIndex((c) => c.row === Math.max(...nc.map((x) => x.row))));
        selectLine();
        schedule();
        return;
      }
      const cand = rowCells(target);
      cand.sort((a, b) => Math.abs(a.x - here.x) - Math.abs(b.x - here.x));
      P.cell = cand[0].k;
    }

    function lcdLines() {
      const rungs = (state && state.ladder) || [];
      if (P.flash) return [P.flash, ""];
      if (P.confirmDel) return [`DELETE RUNG ${loc()}?`, "ENT=YES  ESC=NO"];
      if (P.entry && P.entry.kind === "find") return ["FIND ADDR?", P.entry.buf + cursor()];
      if (P.screen === "IDLE") {
        if (state && !state.running && state.trip_code) return ["W/DOG TRIPPED", `F1 CODE ${state.trip_code}`.padEnd(16)];
        return [state && state.running ? "MICROGEM RUNNING" : "MICROGEM HALTED", "SELECT MODE:"];
      }
      if (P.screen === "MON") {
        let l1;
        if (P.entry && P.entry.kind === "addr") l1 = "ADDR? " + P.entry.buf + cursor();
        else if (P.entry && P.entry.kind === "value") l1 = "VALUE? " + P.entry.buf + cursor();
        else if (typeof P.value === "number") l1 = (P.value & 0xffff).toString(2).padStart(16, "0");
        else if (typeof P.value === "boolean") l1 = "MONITOR BIT " + (P.value ? "1" : "0");
        else l1 = "MONITOR";
        return [l1, fields(P.addr, fmtVal(P.value), "")];
      }
      // PROG
      if (P.pending) return [P.pending.name + " " + P.pending.prompts[P.answers.length], "> " + (P.entry ? P.entry.buf : "") + cursor()];
      if (P.draft) {
        // While keying in, show the rung so far as symbols, ending at the last element.
        const rung = draftRungs && draftRungs[0];
        if (!rung || !draftText(P.draft)) return ["KEY CONTACTS...", fields(P.replace ? "EDIT" : "NEW", "", loc())];
        return ladderLines(rung, true);
      }
      if (!rungs.length) return ["NO PROGRAM", "BLNK = NEW RUNG"];
      return ladderLines(rungs[selected], false);
    }

    function renderLcd() {
      const [l1, l2] = lcdLines();
      $("lcd1").textContent = fit(l1);
      $("lcd2").textContent = fit(l2);
      root.querySelectorAll(".k").forEach((k) => k.classList.toggle("lit", k.dataset.key === "CTRL" && P.ctrl));
      $("prog-help").innerHTML =
        P.screen === "MON" ? "<b>Monitor:</b> ADDR, a table key (I = inputs, Q = outputs, G, W, C, D, S) then the word; ► types a dot for a bit. ENT to watch. Then type a number and ENT to force it. ▲▼ step through words."
        : P.screen === "PROG" ? "<b>Program:</b> The display is a window onto the ladder, drawn as in the GEM 80 manual: symbols on the top line, addresses underneath, live wires as dashes and dead ones as dots. ◄► move along a branch and ▲▼ between branches and on to the next rung; NEXT/PREV jump a rung. BLNK keys in a new rung, ED (CTRL+OD) re-keys this one, DEL deletes, FIND jumps to an address. In a rung the keys give their symbols: contacts, -(D)- delay and -(C)- count; ▼ opens a parallel branch and JOIN closes it; end with a coil -( )-, -(S)- sequencer or BLK (OBEY BLOCK, or END OF BLOCK on an empty rung). ENT writes the rung, DEL undoes the last step."
        : "<b>Select mode:</b> PROG to program, ADDR or Ø (MON) to monitor. The key switch sets RUN or HALT. With the programmer focused you can also use your keyboard.";
    }
    setInterval(() => { if (state) renderLcd(); }, 250);
    setInterval(() => { if (P.screen === "MON" && !(P.entry && P.entry.kind === "addr")) send({ type: "read", address: P.addr }); }, 300);

    function flash(text) {
      P.flash = text;
      renderLcd();
      setTimeout(() => { P.flash = ""; renderLcd(); }, 1400);
    }

    // ---- key handling ----
    const awaitingAddress = () =>
      P.entry && (P.entry.kind === "addr" || P.entry.kind === "find" ||
        (P.entry.kind === "prompt" && /ADDR|BIT|WORD/.test(P.pending.prompts[P.answers.length])));

    function resolve(k) {
      if (k === "CTRL" && P.screen === "PROG" && P.draft && !P.entry && !P.ctrl) return "-( )-";
      if (k === "CTRL" && !P.ctrl) { P.ctrl = true; return null; }
      if (P.ctrl) { P.ctrl = false; return SECOND[k] || k; }
      const second = SECOND[k];
      if (P.entry) {
        if (awaitingAddress() && !P.entry.buf && second && TABLE_KEY[second]) return "L:" + TABLE_KEY[second];
        return k;
      }
      if (P.screen === "IDLE" && k === "0") return "MON";
      if (P.screen === "PROG" && P.draft && second && SYMBOLS.has(second)) return second;
      return k;
    }

    function press(k) {
      const t = resolve(k);
      if (t !== null) act(t);
      renderLcd();
    }

    function act(t) {
      // typing into an entry line
      if (P.entry) {
        const e = P.entry;
        if (t.startsWith("L:")) { e.buf += t.slice(2); return; }
        if (/^[0-9]$/.test(t)) { if (e.buf.length < 10) e.buf += t; return; }
        if (t === "." || t === "►") { if (awaitingAddress() && e.buf && !e.buf.includes(".")) e.buf += "."; else if (!awaitingAddress() && !e.buf.includes(".")) e.buf += "."; return; }
        if (t === "◄" || t === "BKSP") { e.buf = e.buf.slice(0, -1); return; }
        if (t === "DEL") { e.buf = ""; return; }
        if (t === "ESC") { P.entry = null; if (P.pending) P.pending = null; return; }
        if (t === "ENT") return submitEntry();
        if (P.screen === "MON" && e.kind === "value" && t === "-" && !e.buf) { e.buf = "-"; return; }
        return; // other keys ignored while typing
      }
      if (P.confirmDel) {
        if (t === "ENT") deleteRung();
        P.confirmDel = false;
        return;
      }
      switch (t) {
        case "ESC":
          if (P.draft) { P.draft = null; draftRungs = null; schedule(); }
          else P.screen = "IDLE";
          return;
        case "MON": P.screen = "MON"; P.draft = null; return;
        case "ADDR":
          if (P.screen !== "PROG") { P.screen = "MON"; P.entry = { kind: "addr", buf: "" }; }
          return;
        case "PROG":
          P.screen = "PROG"; P.draft = null; P.cell = 0; selectLine(); schedule();
          return;
      }
      if (P.screen === "MON") {
        if (/^[0-9]$/.test(t)) { P.entry = { kind: "value", buf: t }; return; }
        if (t === "▲" || t === "PREV") return stepAddr(-1, false);
        if (t === "▼" || t === "NEXT") return stepAddr(1, false);
        if (t === "◄") return stepAddr(-1, true);
        if (t === "►") return stepAddr(1, true);
        if (t === "FIND") { P.entry = { kind: "find", buf: "" }; return; }
        if (t === "ENT") { P.entry = { kind: "value", buf: "" }; return; }
        return;
      }
      if (P.screen === "PROG") return P.draft ? draftKey(t) : browseKey(t);
      if (P.screen === "IDLE" && t === "FIND") { P.screen = "PROG"; P.entry = { kind: "find", buf: "" }; }
    }

    function browseKey(t) {
      const n = (state.ladder || []).length;
      if (t === "PREV" && n) { selected = (selected - 1 + n) % n; P.cell = 0; selectLine(); schedule(); return; }
      if (t === "NEXT" && n) { selected = (selected + 1) % n; P.cell = 0; selectLine(); schedule(); return; }
      if (["◄", "►", "▲", "▼"].includes(t)) return moveCursor(t);
      if (t === "BLNK") { P.draft = newDraft(); P.replace = false; return; }
      if (t === "ED" || t === "OD") { if (n) { P.draft = newDraft(); P.replace = true; } return; }
      if (t === "DEL") { if (n) P.confirmDel = true; return; }
      if (t === "FIND") { P.entry = { kind: "find", buf: "" }; return; }
      if (SYMBOLS.has(t)) { P.draft = newDraft(); P.replace = false; return draftKey(t); }
    }

    function draftKey(t) {
      const d = P.draft;
      const snapshot = () => d.history.push(JSON.stringify({ stack: d.stack, acts: d.acts }));
      if (ELEMENTS[t]) {
        const spec = ELEMENTS[t];
        if (d.acts.length) return flash("OUTPUT DONE");
        P.pending = { name: t, ...spec };
        P.answers = [];
        P.entry = { kind: "prompt", buf: "" };
        return;
      }
      if (t === "▼") {
        if (d.acts.length) return flash("CONTACTS FIRST");
        snapshot();
        const top = d.stack.at(-1);
        if (d.stack.length === 1 || !top.branches.at(-1).length) d.stack.push({ branches: [[]] });
        else top.branches.push([]);
        return preview();
      }
      if (t === "JOIN") {
        if (d.stack.length === 1) return flash("NO BRANCH OPEN");
        snapshot();
        const s = joinBranches(d.stack.pop());
        if (s) d.stack.at(-1).branches.at(-1).push(s);
        return preview();
      }
      if (t === "LINK") return flash("LINK: SPACER ONLY");
      if (t === "BLK") {
        if (d.acts.length) return flash("OUTPUT DONE");
        snapshot();
        if (!draftCond(d)) { d.acts.push("END BLOCK"); return writeRung(); }
        d.acts.push("BLOCK");
        return preview();
      }
      if (t === "DEL") {
        const h = d.history.pop();
        if (h) { const o = JSON.parse(h); d.stack = o.stack; d.acts = o.acts; preview(); }
        else { P.draft = null; draftRungs = null; schedule(); }
        return;
      }
      if (t === "ENT") return writeRung();
    }

    function submitEntry() {
      const e = P.entry;
      const buf = e.buf;
      if (e.kind === "addr") {
        if (/^[A-Z]\d+(\.\d+)?$/.test(buf)) { P.addr = buf; P.value = null; send({ type: "read", address: buf }); P.entry = null; }
        else flash("BAD ADDRESS");
        return;
      }
      if (e.kind === "value") {
        const v = Number(buf);
        if (buf !== "" && !Number.isNaN(v)) send({ type: "write", address: P.addr, value: v });
        P.entry = null;
        return;
      }
      if (e.kind === "find") {
        P.entry = null;
        const rungs = state.ladder || [];
        const n = rungs.length;
        for (let i = 1; i <= n; i++) {
          const j = (selected + i) % n;
          if (new RegExp("(^|[^A-Z0-9.])" + buf.replace(".", "\\.") + "(?![0-9.])").test(rungs[j].source.split(";")[0])) {
            P.screen = "PROG"; selected = j; P.cell = 0; selectLine(); schedule(); return;
          }
        }
        return flash("NOT FOUND");
      }
      if (e.kind === "prompt") {
        const prompt = P.pending.prompts[P.answers.length];
        if (!buf) return;
        if (/ADDR|BIT/.test(prompt) && !/^[A-Z]\d+\.\d+$/.test(buf)) return flash("NEED BIT eg G0.1");
        if (/WORD/.test(prompt) && !/^[A-Z]\d+$/.test(buf)) return flash("NEED WORD eg G1");
        if (/VALUE/.test(prompt) && !/^\d+$/.test(buf)) return flash("NEED A NUMBER");
        P.answers.push(buf);
        e.buf = "";
        if (P.answers.length < P.pending.prompts.length) return;
        const [kind, text] = P.pending.make(P.answers);
        const d = P.draft;
        d.history.push(JSON.stringify({ stack: d.stack, acts: d.acts }));
        if (kind === "c") d.stack.at(-1).branches.at(-1).push(text);
        else d.acts.push(text);
        P.pending = null;
        P.entry = null;
        preview();
      }
    }

    function preview() {
      const d = P.draft;
      const cond = draftCond(d);
      if (d.acts.length) send({ type: "preview", source: (cond || "") + " -> " + d.acts[0] });
      else if (cond) send({ type: "preview", source: cond + " -> G63.15" });
      else { draftRungs = null; schedule(); }
    }

    function writeRung() {
      const d = P.draft;
      if (!d.acts.length) return flash("NEEDS AN OUTPUT");
      const text = d.acts[0] === "END BLOCK" ? "END BLOCK" : ((draftCond(d) || "") + " -> " + d.acts[0]).trim();
      const lines = (state.program || "").split("\n");
      const rungs = state.ladder || [];
      if (P.replace && rungs[selected]) lines.splice(rungs[selected].line - 1, 1, text);
      else {
        const at = rungs[selected] ? rungs[selected].line : lines.length;
        lines.splice(at, 0, text);
        if (rungs.length) selected += 1;
      }
      send({ type: "load", source: lines.join("\n") });
      programDirty = false;
      P.draft = null; draftRungs = null;
      flash(P.replace ? "RUNG CHANGED" : "RUNG WRITTEN");
    }

    function deleteRung() {
      const rungs = state.ladder || [];
      if (!rungs[selected]) return;
      const lines = state.program.split("\n");
      lines.splice(rungs[selected].line - 1, 1);
      send({ type: "load", source: lines.join("\n") });
      programDirty = false;
      selected = Math.max(0, selected - 1);
      flash("RUNG DELETED");
    }

    function stepAddr(d, bitwise) {
      const m = /^([A-Z])(\d+)(?:\.(\d+))?$/.exec(P.addr);
      if (!m) return;
      const [, t, w, b] = m;
      let word = Number(w);
      if (b !== undefined || bitwise) {
        let bit = (b === undefined ? 0 : Number(b)) + (bitwise ? d : 0);
        if (!bitwise) word = Math.max(0, word + d);
        if (bit > 15) { bit = 0; word++; } if (bit < 0) { bit = 15; word = Math.max(0, word - 1); }
        P.addr = `${t}${word}.${bit}`;
      } else P.addr = `${t}${Math.max(0, word + d)}`;
      P.value = null;
      send({ type: "read", address: P.addr });
    }

    // your computer keyboard works on the programmer too
    $("prog").addEventListener("keydown", (e) => {
      const map = { Enter: "ENT", Escape: "ESC", ArrowUp: "▲", ArrowDown: "▼", ArrowLeft: "◄", ArrowRight: "►", Delete: "DEL", Insert: "BLNK", Control: "CTRL" };
      let k = map[e.key];
      if (e.key === "Backspace") { e.preventDefault(); if (P.entry) act("BKSP"); else press("DEL"); return renderLcd(); }
      if (/^[a-zA-Z]$/.test(e.key) && P.entry) { e.preventDefault(); P.entry.buf += e.key.toUpperCase(); return renderLcd(); }
      if (e.key === "." || e.key === "-") { e.preventDefault(); act(e.key); return renderLcd(); }
      if (!k && /^[0-9]$/.test(e.key)) k = e.key;
      if (!k) return;
      e.preventDefault();
      const btn = root.querySelector(`.k[data-key="${CSS.escape(k)}"]`);
      if (btn) { btn.classList.add("down"); setTimeout(() => btn.classList.remove("down"), 120); }
      press(k);
    });

    function selectLine() {
      const r = (state.ladder || [])[selected];
      if (!r || programDirty) return;
      const ta = $("program");
      const lines = ta.value.split("\n");
      let start = 0;
      for (let i = 0; i < r.line - 1; i++) start += lines[i].length + 1;
      ta.setSelectionRange(start, start + lines[r.line - 1].length);
    }

    $("ladder").addEventListener("click", (e) => {
      const r = e.target.closest(".rung");
      if (!r || r.classList.contains("draft")) return;
      selected = Number(r.dataset.i);
      P.screen = "PROG"; P.draft = null; P.entry = null; P.pending = null; P.confirmDel = false; P.cell = 0;
      selectLine();
      schedule();
    });

    function onMessage(msg) {
      if (pp && state && isGem80() && pp.reply(msg)) return;
      if (msg.type === "state") {
        if (!examples) { examples = []; send({ type: "examples" }); }
        state = Object.assign(state || {}, msg);
        if (state.ladder && selected >= state.ladder.length) selected = Math.max(0, state.ladder.length - 1);
        if (P.screen === "MON" && state.live && P.addr in state.live) P.value = state.live[P.addr];
        schedule();
      } else if (msg.type === "examples") {
        examples = msg.examples;
        const sel = $("demo");
        sel.replaceChildren(el("option", "", "Demo programmes…"), ...examples.map((e, i) => {
          const o = el("option", "", e.title);
          o.value = String(i);
          return o;
        }));
      } else if (msg.type === "entities") {
        ha = msg;
        buildLinks();
        schedule();
      } else if (msg.type === "value") {
        if (msg.address === P.addr) { P.value = msg.value; renderLcd(); }
      } else if (msg.type === "preview") {
        if (!P.draft) return;
        draftRungs = msg.rungs;
        if (!P.draft.acts.length && draftRungs[0]) draftRungs[0].output = null;
        schedule();
      } else if (msg.type === "paper") {
        paper = msg.lines.slice();
        printedSeen = msg.printed;
        if (state) state.printer = Object.assign({}, state.printer || {}, msg, { lines: msg.lines.slice(-20) });
        drawPaper(msg);
      } else if (msg.type === "imported") {
        $("program").value = msg.source;
        programDirty = true;
        setMessage(`${msg.summary}. Check it, then Load program.`);
      } else if (msg.type === "printout") {
        $("printout-text").textContent = msg.text;
        $("printout-box").hidden = false;
      } else if (msg.type === "loaded") {
        programDirty = false;
        setMessage("Program loaded.");
      } else if (msg.type === "error") {
        if (P.screen === "PROG" || P.screen === "MON") flash("ERROR");
        setMessage(msg.message, true);
      }
    }

    $("program").addEventListener("input", () => { programDirty = true; setMessage("Edited, not loaded yet."); });
    $("demo").addEventListener("change", () => {
      const e = examples && examples[Number($("demo").value)];
      $("demo-load").disabled = !e;
      $("demo-about").textContent = e ? e.description : "";
    });
    $("demo-load").addEventListener("click", () => {
      const e = examples && examples[Number($("demo").value)];
      if (!e) return;
      // Replaces the program on the controller; the wiring is in its first comment lines.
      $("program").value = e.source;
      programDirty = true;
      send({ type: "load", source: e.source });
      if (state && state.printer) send({ type: "power_cycle" }); // so its printer port set-up takes
      selected = 0;
    });
    $("load").addEventListener("click", () => send({ type: "load", source: $("program").value }));

    // The printer on the printer port: keep our own roll of paper, topped
    // up from the last lines in each state, or fetched whole after a gap.
    let paper = null, printedSeen = 0;
    function renderPrinter(pr) {
      if (!paper) return;
      const fresh = pr.printed - printedSeen;
      if (fresh > pr.lines.length) { printedSeen = pr.printed; send({ type: "paper" }); return; }
      if (fresh > 0) paper.push(...pr.lines.slice(pr.lines.length - fresh));
      printedSeen = pr.printed;
      if (paper.length > 200) paper.splice(0, paper.length - 200);
      drawPaper(pr);
    }
    function drawPaper(pr) {
      const box = $("vp-paper"), pre = $("vp-lines");
      const atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
      const text = paper.join("\n") + (paper.length ? "\n" : "");
      const key = text + "\u0000" + pr.head;
      if (pre.dataset.key !== key) {
        pre.dataset.key = key;
        pre.textContent = text;
        pre.append(el("span", "head", pr.head || ""));
        if (atEnd) box.scrollTop = box.scrollHeight;
      }
      $("vp-lamp").classList.toggle("on", !!pr.on_line);
      $("vp-line").textContent = pr.on_line ? "Off line" : "On line";
      $("vp-status").textContent = `${pr.on_line ? "On line" : "Off line"} · buffer ${pr.buffered} of ${pr.size} characters · ${pr.printed} lines printed` + (pr.lost ? ` · ${pr.lost} characters lost off line` : "");
      const su = pr.setup || {}, port = $("vp-port");
      let portText = su.problem ? `Port 1: ${su.problem}.` : `Port 1: printer port, ${su.rate} bit/s, ${su.line} characters a line` + (su.padding ? `, ${su.padding} NULs after each` : "") + ".";
      if (pr.changed) portText += " P2 to P5 have changed; the port reads them at power on (or Halt and Run).";
      if (!pr.part_lines) portText += " (The 6K sends complete lines only.)";
      $("vp-port-text").textContent = portText;
      $("vp-power").hidden = !pr.changed;
      port.classList.toggle("bad", !!(su.problem || pr.changed));
      $("vp-keys-row").hidden = !(pr.keyboard && !su.problem);
    }
    $("vp-line").addEventListener("click", () => send({ type: "printer", action: state.printer && state.printer.on_line ? "off_line" : "on_line" }));
    $("vp-tear").addEventListener("click", () => send({ type: "printer", action: "tear_off" }));
    $("vp-power").addEventListener("click", () => send({ type: "power_cycle" }));
    // The serial keyboard: each key as it is pressed (J0 holds one at a time).
    $("vp-keys").addEventListener("keydown", (ev) => {
      const key = ev.key === "Enter" ? "\r" : ev.key === "Backspace" ? "\b" : ev.key === "Escape" ? "\x1b" : ev.key;
      if (key.length !== 1 || ev.ctrlKey || ev.metaKey) return;
      ev.preventDefault();
      send({ type: "printer", action: "type", text: key });
    });
    $("vp-save").addEventListener("click", () => download(`${fileStem()}-printer.txt`, (paper || []).join("\n") + "\n"));

    // Files: open, drop, convert, save and print-out.
    const fileStem = () => (state && state.model ? state.model.title : "microgem")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const download = (name, text) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      a.download = name;
      root.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    // A CSV of names or data merges into the programme: the one in the box
    // when a file is opened, the loaded one when the box itself is converted.
    const importText = (text, current = $("program").value) => send({ type: "import", text, current });
    const readFile = (file) => {
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) return setMessage("That file is over 2 MB, too big for a programme.", true);
      file.text().then(importText, () => setMessage("Could not read that file.", true));
    };
    $("open-file").addEventListener("click", () => $("file-input").click());
    $("file-input").addEventListener("change", (e) => { readFile(e.target.files[0]); e.target.value = ""; });
    $("convert").addEventListener("click", () => importText($("program").value, (state && state.program) || ""));
    $("save-file").addEventListener("click", () => download(`${fileStem()}-program.txt`, $("program").value));
    $("printout").addEventListener("click", () => send({ type: "printout" }));
    $("printout-close").addEventListener("click", () => { $("printout-box").hidden = true; });
    $("printout-save").addEventListener("click", () => download(`${fileStem()}-printout.txt`, $("printout-text").textContent));
    $("printout-print").addEventListener("click", () => {
      const w = window.open("", "_blank");
      if (!w) return setMessage("The browser blocked the print window; use Download instead.", true);
      const pre = w.document.createElement("pre");
      pre.style.font = "10pt/1.3 monospace";
      pre.textContent = $("printout-text").textContent;
      w.document.title = "Ladder print-out";
      w.document.body.appendChild(pre);
      w.print();
    });
    const ta = $("program");
    ta.addEventListener("dragover", (e) => { e.preventDefault(); ta.classList.add("drop"); });
    ta.addEventListener("dragleave", () => ta.classList.remove("drop"));
    ta.addEventListener("drop", (e) => {
      ta.classList.remove("drop");
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (!file) return;
      e.preventDefault();
      readFile(file);
    });
    $("program").addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); $("load").click(); }
    });
    root.querySelectorAll("#mode button").forEach((b) => b.addEventListener("click", () => {
      mode = b.dataset.mode;
      root.querySelectorAll("#mode button").forEach((x) => x.classList.toggle("active", x === b));
    }));

    transport.connect(onMessage, (text) => { $("conn").textContent = text; });
  }
}

if (!customElements.get("microgem-panel")) customElements.define("microgem-panel", MicroGemPanel);
