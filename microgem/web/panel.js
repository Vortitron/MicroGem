// <microgem-panel>: a GEC MicroGEM60 controller, its hand-held MicroGEM
// Programmer, a live ladder diagram, the program text and a data-table monitor.
// The hardware is drawn from photos of a real MicroGEM60 and programmer.
// Used by the standalone page (WebSocket transport) and by Home Assistant as a
// custom panel (transport over Home Assistant's own connection).

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
.wire-ed .fields { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.led { fill: #3a1414; transition: fill .04s; }
.led.g { fill: #15301a; }
.led.on { fill: #ff3b2f; filter: url(#glow); }
.led.g.on { fill: #4dff6a; }

.sim { margin-top: 16px; background: #2b2926; border-radius: 8px; padding: 10px 12px 12px; color: #e8e1d2;
  box-shadow: inset 0 2px 0 rgba(255,255,255,.06), 0 3px 8px rgba(0,0,0,.25); }
.sim-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; font: 600 .72rem/1 Arial, sans-serif; letter-spacing: .12em; }
.group-label { margin-top: 10px; font: 600 .62rem/1 Arial, sans-serif; letter-spacing: .1em; color: #b8ad95; }
.toggles { display: grid; grid-template-columns: repeat(var(--n, 12), minmax(0, 1fr)); gap: 4px; margin-top: 10px; }
.toggle { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: 0; padding: 0; cursor: pointer; color: inherit; touch-action: manipulation; }
.toggle .plate { width: 22px; height: 34px; border-radius: 4px; background: linear-gradient(#5a554d, #2b2824); position: relative; box-shadow: inset 0 1px 2px rgba(0,0,0,.6); }
.toggle .lever { position: absolute; left: 7px; width: 8px; height: 18px; border-radius: 4px; background: linear-gradient(90deg, #d8d4cc, #fff, #a8a39a); top: 14px; transition: top .06s; box-shadow: 0 2px 2px rgba(0,0,0,.5); }
.toggle.on .lever { top: 2px; }
.toggle small { font: 600 .62rem/1 var(--mono); color: #cfc3a8; }
.seg { display: inline-flex; border: 1px solid #77705f; border-radius: 4px; overflow: hidden; }
.seg button { border: 0; background: #4a453d; color: #e8e1d2; padding: 4px 9px; font: 600 .7rem/1.2 Arial, sans-serif; letter-spacing: .06em; cursor: pointer; min-width: 30px; }
.seg button.active { background: #e8e1d2; color: #2a241c; }

/* ---------- MicroGEM Programmer ---------- */
.progwrap { display: flex; flex-direction: column; align-items: center; }
.cable { width: 6px; height: 26px; background: #111; border-radius: 3px; margin-left: 150px; }
.prog { position: relative; width: 100%; max-width: 340px; padding: 18px 0 26px; outline: none; color: #f2f0ea;
  background: linear-gradient(170deg, #2a2a2a, #121212 60%, #0c0c0c);
  clip-path: polygon(13% 0, 87% 0, 87% 40%, 100% 49%, 100% 100%, 0 100%, 0 49%, 13% 40%);
  border-radius: 0 0 14px 14px; }
.prog:focus-visible { filter: drop-shadow(0 0 4px var(--accent)); }
.prog-head { position: relative; height: 54px; margin: 0 16%; }
.brand { position: absolute; right: 0; top: 4px; text-align: center; font: 900 .78rem/1 Arial, sans-serif; letter-spacing: .02em; }
.brand small { display: block; font: 800 .55rem/1.1 Arial, sans-serif; letter-spacing: .03em; }
.keyswitch { position: absolute; left: 0; top: -6px; width: 44px; height: 44px; border-radius: 6px; background: #1d1d1d; border: 2px solid #333;
  cursor: pointer; display: grid; place-items: center; padding: 0; }
.keyswitch .barrel { width: 26px; height: 26px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #555, #1a1a1a); position: relative; transition: transform .15s; }
.keyswitch .barrel::after { content: ""; position: absolute; left: 11px; top: -6px; width: 5px; height: 26px; border-radius: 2px; background: linear-gradient(90deg, #888, #ddd, #777); }
.keyswitch.halt .barrel { transform: rotate(-60deg); }
.keypos { position: absolute; left: 50px; top: 2px; font: 700 .52rem/1.5 Arial, sans-serif; color: #9a9a9a; letter-spacing: .06em; }
.keypos b { color: #f2f0ea; }
.lcdbox { margin: 6px 16% 0; }
.lcd { background: linear-gradient(#c9cdbb, #b7bca6); border: 4px solid #3a3a3a; border-radius: 3px; padding: 6px 6px; box-shadow: inset 0 2px 6px rgba(0,0,0,.45); }
.lcd div { font: 700 17px/1.25 "Courier New", var(--mono); color: #1c2117; white-space: pre; overflow: hidden; letter-spacing: .02em; text-align: center; }
.lcd-labels { display: flex; justify-content: space-between; padding: 5px 8px 0; font: 800 .62rem/1 Arial, sans-serif; letter-spacing: .03em; }
.keys { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px 10px; margin: 30px 8% 0; }
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
    <h1>Virtual MicroGEM</h1>
    <p>A GEC MicroGEM60 controller running in software. Flip the inputs, watch the relay outputs and the ladder, and program it from the MicroGEM Programmer or the text editor. <span class="conn" id="conn">Connecting…</span></p>
  </header>

  <div class="hw">
    <section aria-label="MicroGEM60 controller and expansion units">
      <div class="unit" id="unit"></div>
      <div class="wire-ed" id="wire-ed" hidden>
        <h3 id="we-title"></h3>
        <p class="hint" id="we-hint"></p>
        <div class="fields">
          <label style="flex-basis:100%">Home Assistant entity<input id="we-entity" list="we-list" placeholder="Start typing a name or entity id" autocomplete="off" spellcheck="false"></label>
          <label id="we-attr-box">Read<select id="we-attr"></select></label>
          <label id="we-above-box">Contact closes above<input id="we-above" type="number" step="any" placeholder="leave empty for on/off"></label>
        </div>
        <datalist id="we-list"></datalist>
        <p class="message" id="we-now"></p>
        <div class="row"><button class="btn primary" id="we-save">Connect</button><button class="btn" id="we-remove">Disconnect</button><button class="btn" id="we-cancel">Cancel</button></div>
      </div>
      <div class="sim">
        <div class="sim-head">
          <span>INPUT SIMULATOR · switches wired to the input terminals</span>
          <span class="seg" id="mode"><button data-mode="toggle" class="active">LATCH</button><button data-mode="momentary">PUSH</button></span>
        </div>
        <div id="toggles"></div>
      </div>
    </section>

    <section class="progwrap" aria-label="MicroGEM Programmer">
      <div class="cable"></div>
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
        <div class="keys" id="keys"></div>
      </div>
      <p class="prog-help" id="prog-help"></p>
    </section>
  </div>

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
  const label = (w, x, y, angle, end) => `<text class="wl"${end ? ' text-anchor="end"' : ""} transform="translate(${x} ${y}) rotate(${angle})">${esc(w.name)}${w.detail ? `<tspan> ${esc(w.detail)}</tspan>` : ""}<title>${esc(w.title)}</title></text>`;
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
        cablesIn += `<path class="cable in" id="cable-in-${g}" d="M${cx} 34 V-14"/><rect class="sheath" x="${cx - 5}" y="-26" width="10" height="16" rx="2"/>${label(w, cx + 4, -32, -50)}`;
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
        <rect class="sheath" x="${m - 7}" y="${H + 22}" width="14" height="18" rx="2"/>${label(w, m + 6, H + 50, -50, true)}`;
    }
  }

  const what = exp ? `MicroGEM expansion unit ${unit}` : "GEC MicroGEM60 controller";
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
    <text x="24" y="21" style="font:900 26px Arial Black,Arial,sans-serif;fill:#eee">GEC</text>
    <text x="96" y="10" style="font:700 11px Arial;fill:#eee">Industrial</text><text x="96" y="23" style="font:700 11px Arial;fill:#eee">Controls Ltd.</text>
    <text x="96" y="34" style="font:600 7.5px Arial;fill:#ddd;letter-spacing:.06em">KIDSGROVE</text><text x="96" y="43" style="font:600 7.5px Arial;fill:#ddd;letter-spacing:.06em">ENGLAND</text>
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
    default: return { w: 1, h: 1 };
  }
}

function wire(x1, y1, x2, y2, on) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="w${on ? " on" : ""}"/>`;
}

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
        pout, n.addr);
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
      (note ? `<text x="${mx}" y="${cy - 19}" class="sub">${note}</text>` : "");
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
      case "delay": return { sym: "<DELAY>--VALUE", addr: `${n.word}`.padEnd(9) + n.value };
      case "count": return { sym: "<COUNT>--VALUE", addr: `${n.word}`.padEnd(9) + n.value };
    }
    return { sym: "?", addr: "" };
  };
  const branchOf = (n) => (n.t === "count" ? n.reset : (n.t === "logic" || n.t === "arith") && n.arg && typeof n.arg === "object" ? n.arg : null);
  const width = (n) => Math.max(CELL, leaf(n).sym.length + 4);

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
      const unit = Math.floor(i / perUnit), point = i % perUnit;
      return `${table}${unit * Math.ceil(perUnit / 16) + Math.floor(point / 16)}.${point % 16}`;
    }
    const io = () => state.io || { units: 1, inputs: state.inputs.length, outputs: state.outputs.length };

    function build() {
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
    const wiring = () => (ha && ha.wiring) || { inputs: {}, outputs: {} };
    const canWire = () => !!(ha && transport.wire);
    const hassState = (id) => host._hass && host._hass.states[id];
    function describe(point) {
      const st = hassState(point.entity_id);
      const name = (st && st.attributes.friendly_name) || point.entity_id;
      const short = name.length > 26 ? name.slice(0, 25) + "…" : name;
      const detail = point.attribute ? `· ${point.attribute}${point.above != null ? " > " + point.above : ""}` : point.above != null ? `> ${point.above}` : "";
      return { name: short, detail, title: `${name} (${point.entity_id})${detail ? " " + detail : ""}` };
    }
    function closes(st, point) {
      if (!st) return false;
      const attr = point.attribute;
      if (attr && (st.state === "unavailable" || st.state === "unknown")) return false;
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
      const { inputs: nIn, outputs: nOut } = io();
      const per = kind === "inputs" ? nIn : nOut, unit = Math.floor(index / per);
      const where = `${kind === "inputs" ? "input terminal" : "relay output"} ${String(index % per).padStart(2, "0")}${unit ? ` on expansion unit ${unit}` : ""}`;
      const addr = ioAddress(kind === "inputs" ? "A" : "B", index, per);
      const point = wiring()[kind][index];
      $("we-title").textContent = `Wire ${where} (${addr})`;
      $("we-hint").textContent = kind === "inputs"
        ? `${addr} follows the entity: its contact is closed while the entity is on, open, home, playing and so on, or while a number is above the value you set.`
        : `The relay switches the entity on when ${addr} is on and off when it is off. Buttons, scenes and scripts are pressed or run each time the relay closes.`;
      const states = (host._hass && host._hass.states) || {};
      const ids = Object.keys(states).filter((id) => kind === "inputs" || SWITCHABLE.has(id.split(".")[0])).sort();
      $("we-list").replaceChildren(...ids.map((id) => {
        const o = el("option");
        o.value = id;
        o.label = states[id].attributes.friendly_name || id;
        return o;
      }));
      $("we-entity").value = point ? point.entity_id : "";
      $("we-above").value = point && point.above != null ? point.above : "";
      $("we-attr-box").hidden = $("we-above-box").hidden = kind !== "inputs";
      $("we-remove").hidden = !point;
      fillAttributes(point && point.attribute);
      $("unit").querySelectorAll(".term").forEach((t) => t.classList.toggle("sel", t.dataset.kind === kind && Number(t.dataset.index) === index));
      $("wire-ed").hidden = false;
      $("wire-ed").scrollIntoView({ block: "nearest", behavior: "smooth" });
      $("we-entity").focus();
    }
    function closeEditor() {
      editing = null;
      $("wire-ed").hidden = true;
      $("unit").querySelectorAll(".term.sel").forEach((t) => t.classList.remove("sel"));
    }
    function fillAttributes(chosen) {
      const st = hassState($("we-entity").value.trim());
      const attrs = st ? Object.keys(st.attributes).filter((a) => a !== "friendly_name" && !/^(icon|entity_picture|supported_features|attribution)$/.test(a)) : [];
      if (chosen && !attrs.includes(chosen)) attrs.unshift(chosen);
      $("we-attr").replaceChildren(el("option", "", "State"), ...attrs.map((a) => { const o = el("option", "", a); o.value = a; return o; }));
      $("we-attr").firstChild.value = "";
      $("we-attr").value = chosen || "";
      wirePreview();
    }
    function editedPoint() {
      const entity_id = $("we-entity").value.trim();
      if (!entity_id) return null;
      const point = { entity_id };
      if (editing.kind === "inputs") {
        if ($("we-attr").value) point.attribute = $("we-attr").value;
        if ($("we-above").value !== "") point.above = Number($("we-above").value);
      }
      return point;
    }
    function wirePreview() {
      const now = $("we-now");
      now.classList.remove("error");
      const point = editing && editedPoint();
      if (!point) { now.textContent = ""; return; }
      const st = hassState(point.entity_id);
      if (!st) { now.textContent = "No entity with that id."; now.classList.add("error"); return; }
      const value = point.attribute ? st.attributes[point.attribute] : st.state;
      const shown = typeof value === "object" ? JSON.stringify(value) : String(value);
      now.textContent = editing.kind === "inputs"
        ? `Now: ${shown.slice(0, 60)}, so the contact would be ${closes(st, point) ? "closed (on)" : "open (off)"}.`
        : `Now: ${shown.slice(0, 60)}.${TRIGGERED.has(point.entity_id.split(".")[0]) ? " Pressed or run when the relay closes." : ""}`;
    }
    function saveWire(point) {
      const { kind, index } = editing;
      if (point && !hassState(point.entity_id)) { wirePreview(); return; }
      transport.wire(kind, index, point)
        .then((w) => { ha.wiring = w; closeEditor(); built = false; schedule(); })
        .catch((err) => { $("we-now").textContent = "Not saved: " + (err.message || err.code || err); $("we-now").classList.add("error"); });
    }
    $("unit").addEventListener("click", (e) => {
      const t = e.target.closest && e.target.closest(".term");
      if (t) openEditor(t.dataset.kind, Number(t.dataset.index));
    });
    $("we-entity").addEventListener("input", () => fillAttributes($("we-attr").value));
    $("we-attr").addEventListener("change", wirePreview);
    $("we-above").addEventListener("input", wirePreview);
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
      $("toggles").querySelectorAll(".toggle").forEach((n, i) => n.classList.toggle("on", state.inputs[i]));
      $("keyswitch").classList.toggle("halt", !state.running);
      $("kp-run").innerHTML = state.running ? "<b>RUN</b>" : "RUN";
      $("kp-halt").innerHTML = state.running ? "HALT" : "<b>HALT</b>";
      renderLadder();
      renderTables();
      renderLcd();
      if (!programDirty && state.program !== undefined && $("program").value !== state.program) $("program").value = state.program;
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };

    function renderLadder() {
      const rungs = state.ladder || [];
      const box = $("ladder");
      const ctx = { live: state.live || {}, flow: state.flow || {}, draft: false };
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
      selected = 0;
    });
    $("load").addEventListener("click", () => send({ type: "load", source: $("program").value }));
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
