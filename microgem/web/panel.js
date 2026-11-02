// <microgem-panel>: the MicroGEM unit, its hand-held programmer, a live ladder
// diagram, the program text and a data-table monitor.
// Used by the standalone page (WebSocket transport) and by Home Assistant as a
// custom panel (transport over Home Assistant's own connection).

const STYLE = `
:host {
  --bg: #e9e6df; --text: #23211d; --muted: #6b665c; --panel: #f7f5f0; --border: #cfc9bd;
  --accent: #2f5d8a; --error: #b3261e;
  --case: #cfc6b0; --case-hi: #e6dfcd; --case-lo: #a99d80; --strip: #2f2a24;
  --led-off: #3c332b; --led-in: #43f26a; --led-out: #ff4433; --led-amber: #ffb52e;
  --crt: #07130d; --crt-line: #2a3a31; --live: #3dff7a; --dead: #4d6b5a; --crt-text: #9fe8b6; --amber: #ffbf3d;
  --mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  display: block; min-height: 100%; background: var(--bg); color: var(--text);
  font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :host { --bg: #1b1a18; --text: #ece8df; --muted: #a39d90; --panel: #252320; --border: #3c3934; --accent: #86b4e3; --error: #ff8a80; }
}
* { box-sizing: border-box; }
main { max-width: 1180px; margin: 0 auto; padding: 24px 16px 48px; }
header h1 { margin: 0; font-size: 1.4rem; }
header p { margin: 4px 0 18px; color: var(--muted); }
.conn { font-size: .8rem; }
h2 { margin: 0 0 8px; font-size: 1rem; }
.hint { margin: 0 0 8px; color: var(--muted); font-size: .85rem; }

/* ---------- hardware row ---------- */
.hw { display: grid; grid-template-columns: minmax(0, 1.75fr) minmax(280px, 1fr); gap: 20px; align-items: start; }
.unit svg { width: 100%; height: auto; display: block; filter: drop-shadow(0 8px 14px rgba(0,0,0,.28)); }
.led { fill: var(--led-off); transition: fill .04s; }
.led.in.on { fill: var(--led-in); filter: url(#glow); }
.led.out.on { fill: var(--led-out); filter: url(#glow); }
.led.amber.on { fill: var(--led-amber); filter: url(#glow); }

.sim { margin-top: 14px; background: #3a3631; border-radius: 8px; padding: 10px 12px 12px; color: #e8e1d2;
  box-shadow: inset 0 2px 0 rgba(255,255,255,.08), 0 3px 8px rgba(0,0,0,.25); }
.sim-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; font: 600 .72rem/1 Arial, sans-serif; letter-spacing: .12em; }
.toggles { display: grid; grid-template-columns: repeat(var(--n, 16), minmax(0, 1fr)); gap: 4px; margin-top: 10px; }
.toggle { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: 0; padding: 0; cursor: pointer; color: inherit; touch-action: manipulation; }
.toggle .plate { width: 22px; height: 34px; border-radius: 4px; background: linear-gradient(#5a554d, #2b2824); position: relative; box-shadow: inset 0 1px 2px rgba(0,0,0,.6); }
.toggle .lever { position: absolute; left: 7px; width: 8px; height: 18px; border-radius: 4px; background: linear-gradient(90deg, #d8d4cc, #fff, #a8a39a); top: 14px; transition: top .06s; box-shadow: 0 2px 2px rgba(0,0,0,.5); }
.toggle.on .lever { top: 2px; }
.toggle small { font: 600 .6rem/1 var(--mono); color: #cfc3a8; }
.seg { display: inline-flex; border: 1px solid #77705f; border-radius: 4px; overflow: hidden; }
.seg button { border: 0; background: #4a453d; color: #e8e1d2; padding: 4px 9px; font: 600 .7rem/1.2 Arial, sans-serif; letter-spacing: .06em; cursor: pointer; min-width: 30px; }
.seg button.active { background: #e8e1d2; color: #2a241c; }

/* ---------- programmer ---------- */
.prog { background: linear-gradient(160deg, #f2c832, #d9a915); border-radius: 18px 18px 26px 26px; padding: 14px 14px 18px;
  box-shadow: inset 0 2px 0 rgba(255,255,255,.5), inset 0 -3px 0 rgba(0,0,0,.18), 0 10px 18px rgba(0,0,0,.3); color: #2b2205; outline: none; }
.prog:focus-visible { box-shadow: 0 0 0 3px var(--accent), 0 10px 18px rgba(0,0,0,.3); }
.prog-top { display: flex; justify-content: space-between; align-items: baseline; font: 800 .8rem/1 Arial, sans-serif; letter-spacing: .14em; margin: 0 4px 8px; }
.prog-top span:last-child { font-weight: 600; letter-spacing: .05em; font-size: .68rem; }
.lcd { background: #0b1a10; border-radius: 6px; border: 3px solid #1d1a12; padding: 8px 10px; box-shadow: inset 0 0 12px rgba(0,0,0,.9); }
.lcd div { font: 600 15px/1.35 var(--mono); color: #6dff8d; text-shadow: 0 0 6px rgba(80,255,120,.75); white-space: pre; overflow: hidden; letter-spacing: .06em; }
.lcd .lbl { display: flex; justify-content: space-between; font: 700 .55rem/1 Arial, sans-serif; color: #4f8d5c; text-shadow: none; letter-spacing: .12em; margin-top: 4px; }
.keys { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; margin-top: 14px; }
.key { position: relative; border: 0; border-radius: 6px; padding: 9px 0 7px; min-width: 0; cursor: pointer; touch-action: manipulation;
  background: linear-gradient(#3b3a37, #1f1e1c); color: #f5f1e6; font: 700 .78rem/1 Arial, sans-serif;
  box-shadow: 0 3px 0 #0b0b0a, inset 0 1px 0 rgba(255,255,255,.18); }
.key:active, .key.down { transform: translateY(2px); box-shadow: 0 1px 0 #0b0b0a; }
.key small { display: block; font: 700 .55rem/1 Arial, sans-serif; color: #f2c832; margin-top: 3px; letter-spacing: .05em; }
.key.sym small { color: #7a5a00; }
.key.sym { font: 700 .82rem/1 var(--mono); background: linear-gradient(#e9e4d6, #c7c0ae); color: #1f1b12; box-shadow: 0 3px 0 #7d7562, inset 0 1px 0 #fff; }
.key.fn { background: linear-gradient(#7a2a20, #4d1711); }
.key.go { background: linear-gradient(#2f6b3a, #1d4524); }
.key.wide { grid-column: span 2; }
.key.lit::after { content: ""; position: absolute; top: 4px; right: 5px; width: 5px; height: 5px; border-radius: 50%; background: #f2c832; box-shadow: 0 0 5px #f2c832; }
.prog-help { font-size: .72rem; margin: 10px 4px 0; color: #4a3b06; }
.cable { height: 18px; margin: -2px auto 0; width: 34px; border-radius: 0 0 10px 10px; background: repeating-linear-gradient(#262420 0 4px, #3b3833 4px 7px); }

/* ---------- ladder ---------- */
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 14px; min-width: 0; margin-top: 20px; }
.crt { background: var(--crt); border-radius: 8px; padding: 10px 6px; overflow-x: auto; box-shadow: inset 0 0 30px rgba(0,0,0,.8); }
.rung { cursor: pointer; border-radius: 4px; display: block; }
.rung:hover { background: rgba(120,255,160,.04); }
.rung.sel { background: rgba(120,255,160,.09); outline: 1px dashed #3d6b4e; }
.rung.draft { outline: 1px dashed var(--amber); }
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

@media (max-width: 900px) {
  .hw, .grid { grid-template-columns: 1fr; }
  .prog { max-width: 420px; margin: 0 auto; width: 100%; }
}
@media (max-width: 600px) {
  .toggles { grid-template-columns: repeat(8, minmax(0, 1fr)); row-gap: 10px; }
}
`;

const MARKUP = `
<main>
  <header>
    <h1>Virtual MicroGEM</h1>
    <p>A GEC MicroGEM style programmable controller running in software. Flip the inputs, watch the outputs and the ladder, and program it from the hand-held programmer or the text editor. <span class="conn" id="conn">Connecting…</span></p>
  </header>

  <div class="hw">
    <section aria-label="MicroGEM controller">
      <div class="unit" id="unit"></div>
      <div class="sim">
        <div class="sim-head">
          <span>INPUT SIMULATOR</span>
          <span class="seg" id="mode"><button data-mode="toggle" class="active">LATCH</button><button data-mode="momentary">PUSH</button></span>
        </div>
        <div class="toggles" id="toggles"></div>
      </div>
    </section>

    <section aria-label="Hand-held programmer">
      <div class="prog" id="prog" tabindex="0">
        <div class="prog-top"><span>MICROGEM PROGRAMMER</span><span id="prog-mode">MON</span></div>
        <div class="lcd"><div id="lcd1"></div><div id="lcd2"></div><div class="lbl"><span>ADDR</span><span>VALUE</span></div></div>
        <div class="keys" id="keys"></div>
        <p class="prog-help" id="prog-help"></p>
      </div>
      <div class="cable"></div>
    </section>
  </div>

  <section class="panel">
    <h2>Ladder diagram</h2>
    <p class="hint">Live: green wires carry power, lit contacts are closed. Click a rung to select it in the programmer and the text.</p>
    <div class="crt" id="ladder"></div>
  </section>

  <div class="grid">
    <section class="panel">
      <h2>Program text</h2>
      <p class="hint">One rung per line: contacts on the left of <code>-&gt;</code>, coils and function blocks on the right. Comment lines above a rung become its title.</p>
      <textarea id="program" spellcheck="false" aria-label="Ladder program"></textarea>
      <div class="row"><button class="btn primary" id="load">Load program</button><span class="message" id="message"></span></div>
      <details>
        <summary>Language reference</summary>
        <p><b>Addresses:</b> <code>A0.3</code> is bit 3 of word 0 in table A. Inputs are A, outputs are B, workspace is G H L N O U, retained workspace is R W.</p>
        <p><b>Contacts:</b> <code>A0.0</code>, <code>NOT A0.0</code>, <code>RISE A0.0</code>, <code>FALL A0.0</code>, <code>TRUE</code>, joined with <code>AND</code>, <code>OR</code> and brackets. Word comparisons: <code>G1 GE 5</code> (EQ NE GT LT GE LE).</p>
        <p><b>Outputs:</b> a bit address is a coil; <code>SET B0.0</code>, <code>RESET B0.0</code>; <code>DELAY 2.5s G0.1</code>; <code>COUNT 10 G1 G0.2</code>; <code>CLEAR G1</code>; <code>OUT 42 G2</code>; <code>ADD G1 G2 G3</code> (also SUB MULT DIV). Separate several with commas.</p>
        <p><b>Flags (read-only):</b> <code>E0.0</code> pulses every 0.1 s, <code>E0.1</code> every second, <code>E0.6</code> after a program load, <code>E0.7</code> when ADD or SUB hits the limit. <code>E1</code> to <code>E6</code> hold the time and date, <code>E7</code> the last scan time in ms. Hex numbers: <code>@00FF</code>.</p>
        <p>This notation is provisional until we find the original GEM 80 programming manual (T391).</p>
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

/** Talks to the standalone server at ./ws */
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
  };
}

// ---------------------------------------------------------------------------
// The MicroGEM unit, drawn as SVG.

function unitSvg(nIn, nOut) {
  const W = 760, H = 330, x0 = 70, x1 = W - 40;
  const step = (n) => (x1 - x0) / Math.max(n, 1);
  const terms = (n, y, kind, prefix) => {
    let s = "";
    const st = step(n);
    for (let i = 0; i < n; i++) {
      const cx = x0 + st * (i + 0.5);
      s += `<g><rect x="${cx - st / 2 + 2}" y="${y}" width="${st - 4}" height="30" rx="2" fill="#2a2a27"/>
        <circle cx="${cx}" cy="${y + 15}" r="${Math.min(9, st / 2 - 4)}" fill="url(#screw)"/>
        <line x1="${cx - 5}" y1="${y + 15}" x2="${cx + 5}" y2="${y + 15}" stroke="#4b4740" stroke-width="2"/></g>`;
      const ly = kind === "in" ? y + 54 : y - 26;
      s += `<circle class="led ${kind}" id="${kind}-${i}" cx="${cx}" cy="${ly}" r="6"/>
        <text x="${cx}" y="${kind === "in" ? ly + 18 : ly - 11}" text-anchor="middle" class="num">${i}</text>`;
    }
    s += `<text x="${x0 - 12}" y="${y + 20}" text-anchor="end" class="cap">${prefix}</text>`;
    return s;
  };
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="MicroGEM unit with ${nIn} inputs and ${nOut} outputs">
  <defs>
    <linearGradient id="caseg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3dccb"/><stop offset="1" stop-color="#c3b99f"/></linearGradient>
    <radialGradient id="screw" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#f4f1ea"/><stop offset="1" stop-color="#8c8574"/></radialGradient>
    <filter id="glow" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <style>.num{font:700 10px Arial,sans-serif;fill:#4a4234}.cap{font:700 11px Arial,sans-serif;fill:#4a4234;letter-spacing:.12em}</style>
  </defs>
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="14" fill="url(#caseg)" stroke="#9c9178" stroke-width="2"/>
  <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="10" fill="none" stroke="#f3eee2" stroke-opacity=".7"/>
  <circle cx="30" cy="30" r="6" fill="url(#screw)"/><circle cx="${W - 30}" cy="30" r="6" fill="url(#screw)"/>
  <circle cx="30" cy="${H - 30}" r="6" fill="url(#screw)"/><circle cx="${W - 30}" cy="${H - 30}" r="6" fill="url(#screw)"/>
  ${terms(nIn, 26, "in", "IN")}
  <rect x="${x0}" y="134" width="${x1 - x0}" height="62" rx="6" fill="#2f2a24"/>
  <rect x="${x0 + 14}" y="146" width="62" height="38" rx="3" fill="#f1e7d0"/>
  <text x="${x0 + 45}" y="173" text-anchor="middle" style="font:900 22px 'Arial Black',Arial,sans-serif;fill:#2f2a24;letter-spacing:.04em">GEC</text>
  <text x="${x0 + 92}" y="175" style="font:700 24px Arial,sans-serif;fill:#f1e7d0;letter-spacing:.18em">MICROGEM</text>
  <text x="${x0 + 94}" y="190" style="font:600 8px Arial,sans-serif;fill:#b9ad93;letter-spacing:.2em">PROGRAMMABLE CONTROLLER</text>
  <g transform="translate(${x1 - 200},152)">
    <circle class="led amber" id="led-power" cx="10" cy="14" r="6"/><text x="22" y="18" style="font:700 9px Arial;fill:#e9dfc8;letter-spacing:.1em">PWR</text>
    <circle class="led in" id="led-run" cx="62" cy="14" r="6"/><text x="74" y="18" style="font:700 9px Arial;fill:#e9dfc8;letter-spacing:.1em">RUN</text>
    <circle class="led out" id="led-halt" cx="112" cy="14" r="6"/><text x="124" y="18" style="font:700 9px Arial;fill:#e9dfc8;letter-spacing:.1em">HALT</text>
    <circle cx="178" cy="14" r="12" fill="#14120f" stroke="#7b7262" stroke-width="2"/>
    <circle cx="173" cy="11" r="1.6" fill="#9a917f"/><circle cx="183" cy="11" r="1.6" fill="#9a917f"/><circle cx="178" cy="19" r="1.6" fill="#9a917f"/>
    <text x="178" y="38" text-anchor="middle" style="font:700 7px Arial;fill:#b9ad93;letter-spacing:.1em">PROG</text>
  </g>
  ${terms(nOut, H - 56, "out", "OUT")}
</svg>`;
}

// ---------------------------------------------------------------------------
// Ladder diagram rendering.

const CW = 92, CH = 58, AW = 150;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const OPS = { EQ: "=", NE: "≠", GT: ">", LT: "<", GE: "≥", LE: "≤" };

function size(n) {
  switch (n.t) {
    case "series": return n.items.map(size).reduce((a, b) => ({ w: a.w + b.w, h: Math.max(a.h, b.h) }), { w: 0, h: 1 });
    case "parallel": return n.items.map(size).reduce((a, b) => ({ w: Math.max(a.w, b.w), h: a.h + b.h }), { w: 0, h: 0 });
    case "not": { const s = size(n.x); return { w: s.w + 1, h: s.h }; }
    default: return { w: 1, h: 1 };
  }
}

function value(live, operand) {
  if (/^-?\d+$/.test(operand)) return Number(operand);
  if (/^@/.test(operand)) { const v = parseInt(operand.slice(1), 16); return v & 0x8000 ? v - 0x10000 : v; }
  return live[operand] ?? 0;
}

const CMP = { EQ: (a, b) => a === b, NE: (a, b) => a !== b, GT: (a, b) => a > b, LT: (a, b) => a < b, GE: (a, b) => a >= b, LE: (a, b) => a <= b };

function wire(x1, y1, x2, y2, on) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="w${on ? " on" : ""}"/>`;
}

// Draw node n with its left edge at x and top at y; returns [svg, powerOut].
function drawNode(n, x, y, pin, live) {
  const cy = y + CH / 2;
  const cell = (inner, pout, label, sub) => {
    const mx = x + CW / 2;
    return [
      wire(x, cy, mx - 13, cy, pin) + inner(mx) + wire(mx + 13, cy, x + CW, cy, pout) +
        (label ? `<text x="${mx}" y="${cy - 17}" class="lab">${esc(label)}</text>` : "") +
        (sub !== undefined ? `<text x="${mx}" y="${cy + 26}" class="sub">${esc(sub)}</text>` : ""),
      pout,
    ];
  };
  switch (n.t) {
    case "contact": {
      const bit = !!live[n.addr];
      const closed = n.nc ? !bit : bit;
      const pout = pin && closed;
      return cell((mx) =>
        `<rect x="${mx - 9}" y="${cy - 11}" width="18" height="22" class="cbody${closed ? " closed" : ""}"/>` +
        `<line x1="${mx - 9}" y1="${cy - 13}" x2="${mx - 9}" y2="${cy + 13}" class="plate${pin ? " on" : ""}"/>` +
        `<line x1="${mx + 9}" y1="${cy - 13}" x2="${mx + 9}" y2="${cy + 13}" class="plate${pout ? " on" : ""}"/>` +
        (n.nc ? `<line x1="${mx - 12}" y1="${cy + 12}" x2="${mx + 12}" y2="${cy - 12}" class="plate${pout ? " on" : ""}"/>` : ""),
        pout, n.addr);
    }
    case "edge": {
      const pout = false; // a one-scan pulse: too quick to see
      return cell((mx) =>
        `<line x1="${mx - 9}" y1="${cy - 13}" x2="${mx - 9}" y2="${cy + 13}" class="plate${pin ? " on" : ""}"/>` +
        `<line x1="${mx + 9}" y1="${cy - 13}" x2="${mx + 9}" y2="${cy + 13}" class="plate"/>` +
        `<text x="${mx}" y="${cy + 5}" class="edge">${n.rising ? "↑" : "↓"}</text>`,
        pout, n.addr, n.rising ? "rise" : "fall");
    }
    case "const":
      return [wire(x, cy, x + CW, cy, pin && n.value) + (n.value ? "" : `<text x="${x + CW / 2}" y="${cy - 8}" class="lab">FALSE</text>`), pin && n.value];
    case "cmp": {
      const a = value(live, n.left), b = value(live, n.right);
      const ok = CMP[n.op](a, b);
      const pout = pin && ok;
      return [
        wire(x, cy, x + 6, cy, pin) +
          `<rect x="${x + 6}" y="${cy - 17}" width="${CW - 12}" height="34" rx="3" class="box${ok ? " ok" : ""}"/>` +
          `<text x="${x + CW / 2}" y="${cy - 2}" class="btxt">${esc(n.left)} ${OPS[n.op]} ${esc(n.right)}</text>` +
          `<text x="${x + CW / 2}" y="${cy + 11}" class="bsub">${a} ${OPS[n.op]} ${b}</text>` +
          wire(x + CW - 6, cy, x + CW, cy, pout),
        pout,
      ];
    }
    case "not": {
      const s = size(n.x);
      const [inner, p] = drawNode(n.x, x, y, true, live);
      const pout = pin && !p;
      const nx = x + s.w * CW;
      return [
        `<g opacity=".85">${inner}</g>` +
          `<rect x="${nx + 8}" y="${cy - 14}" width="${CW - 16}" height="28" rx="14" class="box${!p ? " ok" : ""}"/>` +
          `<text x="${nx + CW / 2}" y="${cy + 4}" class="btxt">NOT</text>` +
          wire(nx, cy, nx + 8, cy, p) + wire(nx + CW - 8, cy, nx + CW, cy, pout),
        pout,
      ];
    }
    case "series": {
      let svg = "", p = pin, cx = x;
      const h = size(n).h;
      for (const item of n.items) {
        const s = size(item);
        const [part, out] = drawNode(item, cx, y, p, live);
        svg += part;
        p = out;
        cx += s.w * CW;
      }
      return [svg, p];
    }
    case "parallel": {
      const s = size(n);
      let svg = "", any = false, ry = y;
      const tops = [];
      for (const item of n.items) {
        const is = size(item);
        const [part, out] = drawNode(item, x, ry, pin, live);
        svg += part;
        if (is.w < s.w) svg += wire(x + is.w * CW, ry + CH / 2, x + s.w * CW, ry + CH / 2, out);
        any = any || out;
        tops.push(ry + CH / 2);
        ry += is.h * CH;
      }
      svg += wire(x, tops[0], x, tops[tops.length - 1], pin);
      svg += wire(x + s.w * CW, tops[0], x + s.w * CW, tops[tops.length - 1], any);
      return [svg, any];
    }
  }
  return ["", false];
}

function fmtTime(ms) {
  if (ms >= 60000 && ms % 60000 === 0) return ms / 60000 + "m";
  return (ms / 1000).toFixed(ms % 1000 ? 1 : 0) + "s";
}

function drawAction(a, x, y, pin, live, timerMs) {
  const cy = y + CH / 2;
  const coil = (letter, addr) => {
    const on = !!live[addr];
    const mx = x + AW - 40;
    return wire(x, cy, mx - 14, cy, pin) +
      `<path d="M${mx - 8} ${cy - 14} a14 14 0 0 0 0 28 M${mx + 8} ${cy - 14} a14 14 0 0 1 0 28" class="coil${on ? " on" : ""}"/>` +
      (letter ? `<text x="${mx}" y="${cy + 5}" class="edge">${letter}</text>` : "") +
      `<circle cx="${mx}" cy="${cy}" r="9" class="coilfill${on ? " on" : ""}"/>` +
      wire(mx + 14, cy, x + AW, cy, false) +
      `<text x="${mx}" y="${cy - 19}" class="lab">${esc(addr)}</text>`;
  };
  const block = (title, lines, done) => {
    const on = done === undefined ? pin : !!live[done];
    let s = wire(x, cy, x + 10, cy, pin) +
      `<rect x="${x + 10}" y="${cy - 24}" width="${AW - 22}" height="48" rx="3" class="box${on ? " ok" : ""}"/>` +
      `<text x="${x + 10 + (AW - 22) / 2}" y="${cy - 10}" class="btxt">${esc(title)}</text>`;
    lines.forEach((l, i) => { s += `<text x="${x + 10 + (AW - 22) / 2}" y="${cy + 4 + i * 12}" class="bsub">${esc(l)}</text>`; });
    return s + wire(x + AW - 12, cy, x + AW, cy, false);
  };
  switch (a.t) {
    case "coil": return coil("", a.addr);
    case "set": return coil("S", a.addr);
    case "reset": return coil("R", a.addr);
    case "delay": {
      const pct = Math.min(1, (timerMs || 0) / a.preset_ms);
      return block("DELAY " + fmtTime(a.preset_ms), [`${((timerMs || 0) / 1000).toFixed(1)}s → ${a.done}`], a.done) +
        `<rect x="${x + 18}" y="${cy + 15}" width="${(AW - 38) * pct}" height="4" class="bar"/>`;
    }
    case "count": return block(`COUNT ${a.preset}`, [`${a.count} = ${live[a.count] ?? 0}`, `done → ${a.done}`], a.done);
    case "clear": return block("CLEAR", [a.addr]);
    case "out": return block("OUT", [`${a.src} → ${a.dest}`, `${a.dest} = ${live[a.dest] ?? 0}`]);
    case "arith": return block(a.op, [`${a.left} , ${a.right}`, `→ ${a.dest} = ${live[a.dest] ?? 0}`]);
  }
  return "";
}

function rungSvg(rung, index, live, timers, condWidth) {
  const s = size(rung.condition);
  const rows = Math.max(s.h, rung.actions.length);
  const top = rung.comment ? 22 : 8;
  const L = 52;
  const ax = L + condWidth * CW + 20;
  const W = ax + AW + 26;
  const H = top + rows * CH + 6;
  const [cond, p] = drawNode(rung.condition, L, top, true, live);
  let svg = cond + wire(L + s.w * CW, top + CH / 2, ax, top + CH / 2, p);
  rung.actions.forEach((a, i) => {
    svg += drawAction(a, ax, top + i * CH, p, live, timers[`${index}.${i}`]);
  });
  if (rung.actions.length > 1) svg += wire(ax, top + CH / 2, ax, top + (rung.actions.length - 0.5) * CH, p);
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .w{stroke:var(--dead);stroke-width:2.2}.w.on{stroke:var(--live);filter:drop-shadow(0 0 3px var(--live))}
      .plate{stroke:var(--crt-text);stroke-width:2.6}.plate.on{stroke:var(--live)}
      .cbody{fill:transparent}.cbody.closed{fill:rgba(61,255,122,.22)}
      .lab{font:600 11px var(--mono);fill:var(--crt-text);text-anchor:middle}
      .sub{font:600 9px var(--mono);fill:var(--dead);text-anchor:middle}
      .edge{font:700 13px var(--mono);fill:var(--crt-text);text-anchor:middle}
      .box{fill:#0c1f15;stroke:var(--crt-text);stroke-width:1.4}.box.ok{stroke:var(--live);fill:#0f2a1b}
      .btxt{font:700 11px var(--mono);fill:var(--crt-text);text-anchor:middle}
      .bsub{font:600 9.5px var(--mono);fill:var(--amber);text-anchor:middle}
      .coil{fill:none;stroke:var(--crt-text);stroke-width:2.6}.coil.on{stroke:var(--live)}
      .coilfill{fill:transparent}.coilfill.on{fill:rgba(61,255,122,.35)}
      .bar{fill:var(--amber)}
      .rail{stroke:var(--live);stroke-width:4}.rail2{stroke:var(--dead);stroke-width:4}
      .rn{font:700 11px var(--mono);fill:var(--amber)}.title{font:600 11px var(--mono);fill:#6fae84}
    </style>
    <line x1="${L}" y1="0" x2="${L}" y2="${H}" class="rail"/>
    <line x1="${W - 4}" y1="0" x2="${W - 4}" y2="${H}" class="rail2"/>
    <text x="6" y="${top + CH / 2 + 4}" class="rn">R${String(index + 1).padStart(3, "0")}</text>
    ${rung.comment ? `<text x="${L + 8}" y="14" class="title">; ${esc(rung.comment)}</text>` : ""}
    ${svg}
  </svg>`;
}

// ---------------------------------------------------------------------------
// The hand-held programmer.

const KEYS = [
  [["MON", "fn"], ["PROG", "fn"], ["RUN", "go"], ["HALT", "fn"], ["CLR", "fn"]],
  [["-] [-", "sym", "NO"], ["-]/[-", "sym", "NC"], ["-( )-", "sym", "COIL"], ["-(S)-", "sym", "SET"], ["-(R)-", "sym", "RESET"]],
  [["OR", "sym"], ["DELAY", "sym"], ["COUNT", "sym"], ["INS", ""], ["DEL", ""]],
  [["7", "", "G"], ["8", "", "H"], ["9", "", "W"], ["ADDR", ""], ["PREV", ""]],
  [["4", "", "C"], ["5", "", "D"], ["6", "", "R"], ["VALUE", ""], ["NEXT", ""]],
  [["1", "", "A"], ["2", "", "B"], ["3", "", "E"], [".", ""], ["−", ""]],
  [["TABLE", "fn"], ["0", "", "F"], ["ENTER", "go wide"], ["WRITE", "go"]],
];
const LETTER_OF = { 1: "A", 2: "B", 3: "E", 4: "C", 5: "D", 6: "R", 7: "G", 8: "H", 9: "W", 0: "F" };
const LCD_W = 22;

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
    let mode = "toggle";
    let programDirty = false;
    let shownTable = "G";
    let selected = 0;
    let draftRungs = null; // preview of the rung being keyed in
    let frame = 0;

    // ---- programmer state ----
    const P = {
      mode: "MON", field: "view", buf: "", addr: "G0", value: null, shift: false,
      draft: { cond: "", acts: [] }, pending: null, prompts: [], answers: [], confirmDel: false, flash: "",
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

    // ---- build the hardware once we know the I/O count ----
    function build(nIn, nOut) {
      $("unit").innerHTML = unitSvg(nIn, nOut);
      const t = $("toggles");
      t.style.setProperty("--n", Math.min(nIn, 16));
      t.replaceChildren();
      for (let i = 0; i < nIn; i++) {
        const b = el("button", "toggle");
        b.title = `Input A${Math.floor(i / 16)}.${i % 16}`;
        b.innerHTML = `<span class="plate"><span class="lever"></span></span><small>${i}</small>`;
        b.addEventListener("click", () => { if (mode === "toggle") send({ type: "input", index: i, value: !state.inputs[i] }); });
        const press = (v) => (e) => { if (mode === "momentary") { e.preventDefault(); send({ type: "input", index: i, value: v }); } };
        b.addEventListener("pointerdown", press(true));
        b.addEventListener("pointerup", press(false));
        b.addEventListener("pointerleave", (e) => { if (mode === "momentary" && state.inputs[i]) press(false)(e); });
        t.append(b);
      }
      const keys = $("keys");
      for (const row of KEYS) for (const [label, cls, sub] of row) {
        const k = el("button", "key " + (cls || ""));
        k.dataset.key = label;
        k.innerHTML = esc(label) + (sub ? `<small>${esc(sub)}</small>` : "");
        k.addEventListener("click", () => key(label));
        keys.append(k);
      }
      built = true;
    }

    // ---- rendering ----
    function render() {
      frame = 0;
      if (!state) return;
      if (!built) build(state.inputs.length, state.outputs.length);
      const u = $("unit");
      state.inputs.forEach((v, i) => u.querySelector(`#in-${i}`)?.classList.toggle("on", v));
      state.outputs.forEach((v, i) => u.querySelector(`#out-${i}`)?.classList.toggle("on", v));
      u.querySelector("#led-power")?.classList.add("on");
      u.querySelector("#led-run")?.classList.toggle("on", state.running);
      u.querySelector("#led-halt")?.classList.toggle("on", !state.running);
      $("toggles").querySelectorAll(".toggle").forEach((n, i) => n.classList.toggle("on", state.inputs[i]));
      renderLadder();
      renderTables();
      renderLcd();
      if (!programDirty && state.program !== undefined && $("program").value !== state.program) $("program").value = state.program;
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };

    function renderLadder() {
      const rungs = state.ladder || [];
      const box = $("ladder");
      const live = state.live || {};
      const all = draftRungs ? rungs.concat(draftRungs.map((r) => ({ ...r, draft: true }))) : rungs;
      if (!all.length) { box.innerHTML = `<div class="ladder-empty">No program loaded.</div>`; return; }
      const condWidth = Math.max(...all.map((r) => size(r.condition).w));
      box.innerHTML = all.map((r, i) =>
        `<div class="rung${i === selected && !r.draft ? " sel" : ""}${r.draft ? " draft" : ""}" data-i="${i}">${rungSvg(r, i, r.draft ? {} : live, state.timers || {}, condWidth)}</div>`).join("");
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

    // ---- programmer ----
    const pad = (s) => (s + " ".repeat(LCD_W)).slice(0, LCD_W);
    const scroll = (s) => {
      if (s.length <= LCD_W) return s;
      const t = Math.floor(Date.now() / 350) % (s.length + 4);
      return (s + "    " + s).slice(t, t + LCD_W);
    };
    const cursor = () => (Date.now() % 1000 < 500 ? "_" : " ");
    const draftText = () => {
      const d = P.draft;
      return (d.cond || "") + (d.acts.length ? " -> " + d.acts.join(", ") : "");
    };
    const fmtVal = (v) => (typeof v === "boolean" ? (v ? "1  ON" : "0  OFF") : (v < 0 ? "-" : "+") + String(Math.abs(v)).padStart(5, "0"));

    function renderLcd() {
      let l1 = "", l2 = "";
      const rungs = (state && state.ladder) || [];
      if (P.flash) { l1 = P.flash; l2 = ""; }
      else if (P.mode === "MON") {
        l1 = "ADDR  " + (P.field === "addr" ? P.buf + cursor() : P.addr);
        l2 = "VALUE " + (P.field === "value" ? P.buf + cursor() : P.value === null ? "-----" : fmtVal(P.value));
      } else if (P.pending) {
        const prompt = P.prompts[P.answers.length];
        l1 = P.pending.label + " " + prompt;
        l2 = "> " + P.buf + cursor();
      } else if (P.field === "draft") {
        l1 = "NEW RUNG  ENTER=keep";
        l2 = scroll(draftText() || "key contacts...") + "";
      } else if (P.confirmDel) {
        l1 = `DELETE R${String(selected + 1).padStart(3, "0")}?`;
        l2 = "ENTER=yes  CLR=no";
      } else {
        const r = rungs[selected];
        l1 = rungs.length ? `R${String(selected + 1).padStart(3, "0")}/${String(rungs.length).padStart(3, "0")} ${r && r.comment ? r.comment : ""}` : "NO PROGRAM  INS=new";
        l2 = r ? scroll(r.source.split(";")[0].trim()) : "";
      }
      $("lcd1").textContent = pad(l1);
      $("lcd2").textContent = pad(l2);
      $("prog-mode").textContent = P.mode + (P.shift ? " ·TABLE" : "");
      root.querySelectorAll(".key").forEach((k) => {
        const name = k.dataset.key;
        k.classList.toggle("lit", (name === P.mode) || (name === "TABLE" && P.shift) || (name === "RUN" && state && state.running) || (name === "HALT" && state && !state.running));
      });
      $("prog-help").textContent = P.mode === "MON"
        ? "MON: ADDR, a table (TABLE + key) and word, ENTER to watch. VALUE, number, ENTER to force it. PREV/NEXT step."
        : "PROG: PREV/NEXT browse rungs. INS starts a rung: contact keys, OR, then a coil or block. ENTER keeps the rung, DEL removes one.";
    }
    setInterval(() => { if (state) renderLcd(); }, 250);
    setInterval(() => { if (P.mode === "MON" && P.field !== "addr") send({ type: "read", address: P.addr }); }, 300);

    function flash(text) {
      P.flash = text;
      renderLcd();
      setTimeout(() => { P.flash = ""; renderLcd(); }, 1400);
    }

    const ELEMENTS = {
      "-] [-": { label: "-] [-", prompts: ["ADDR?"], make: (a) => ["c", a[0]] },
      "-]/[-": { label: "-]/[-", prompts: ["ADDR?"], make: (a) => ["c", "NOT " + a[0]] },
      "-( )-": { label: "-( )-", prompts: ["ADDR?"], make: (a) => ["a", a[0]] },
      "-(S)-": { label: "-(S)-", prompts: ["ADDR?"], make: (a) => ["a", "SET " + a[0]] },
      "-(R)-": { label: "-(R)-", prompts: ["ADDR?"], make: (a) => ["a", "RESET " + a[0]] },
      DELAY: { label: "DELAY", prompts: ["TIME s?", "DONE BIT?"], make: (a) => ["a", `DELAY ${a[0]}s ${a[1]}`] },
      COUNT: { label: "COUNT", prompts: ["PRESET?", "COUNT WORD?", "DONE BIT?"], make: (a) => ["a", `COUNT ${a[0]} ${a[1]} ${a[2]}`] },
    };

    function previewDraft() {
      const text = draftText();
      if (P.draft.acts.length) send({ type: "preview", source: text });
      else if (P.draft.cond) send({ type: "preview", source: P.draft.cond + " -> G63.15" });
      else { draftRungs = null; schedule(); }
    }

    function commitRung() {
      const text = draftText();
      if (!P.draft.acts.length) { flash("NEEDS AN OUTPUT"); return; }
      const lines = (state.program || "").split("\n");
      const rungs = state.ladder || [];
      const at = rungs[selected] ? rungs[selected].line : lines.length;
      lines.splice(at, 0, text);
      send({ type: "load", source: lines.join("\n") });
      programDirty = false;
      P.field = "view"; P.draft = { cond: "", acts: [] }; draftRungs = null;
      selected = Math.min(selected + 1, rungs.length);
      flash("RUNG WRITTEN");
    }

    function key(k) {
      const digit = /^[0-9]$/.test(k);
      if (k === "TABLE") { P.shift = !P.shift; return renderLcd(); }
      if (digit && P.shift) { P.shift = false; return typed(LETTER_OF[k]); }
      if (digit || k === "." || k === "−") return typed(k === "−" ? "-" : k);
      P.shift = false;
      switch (k) {
        case "MON": case "PROG":
          P.mode = k; P.field = k === "PROG" ? "view" : "view"; P.buf = ""; P.pending = null; P.confirmDel = false;
          return renderLcd();
        case "RUN": return send({ type: "run" });
        case "HALT": return send({ type: "halt" });
        case "CLR":
          if (P.buf) P.buf = "";
          else if (P.pending) P.pending = null;
          else if (P.confirmDel) P.confirmDel = false;
          else if (P.field === "draft") { P.field = "view"; P.draft = { cond: "", acts: [] }; draftRungs = null; schedule(); }
          else P.field = "view";
          return renderLcd();
        case "ADDR": if (P.mode === "MON") { P.field = "addr"; P.buf = ""; } return renderLcd();
        case "VALUE": if (P.mode === "MON") { P.field = "value"; P.buf = ""; } return renderLcd();
        case "PREV": case "NEXT": return step(k === "NEXT" ? 1 : -1);
        case "INS":
          if (P.mode !== "PROG") { P.mode = "PROG"; }
          P.field = "draft"; P.draft = { cond: "", acts: [] }; P.pending = null;
          return renderLcd();
        case "DEL":
          if (P.mode === "PROG" && P.field === "view" && (state.ladder || []).length) P.confirmDel = true;
          return renderLcd();
        case "OR":
          if (P.mode === "PROG" && P.field === "draft" && P.draft.cond && !P.draft.acts.length) {
            P.draft.cond = "(" + P.draft.cond + ") OR";
            P.orPending = true;
          }
          return renderLcd();
        case "ENTER": return enter();
        case "WRITE":
          if (P.mode === "PROG" && P.field === "draft" && !P.pending) return commitRung();
          return enter();
      }
      if (ELEMENTS[k]) {
        if (P.mode !== "PROG" || P.field !== "draft") { P.mode = "PROG"; P.field = "draft"; P.draft = { cond: "", acts: [] }; }
        const spec = ELEMENTS[k];
        if (spec.make([""])[0] === "c" && P.draft.acts.length) { flash("CONTACTS FIRST"); return; }
        P.pending = spec; P.prompts = spec.prompts; P.answers = []; P.buf = "";
        return renderLcd();
      }
    }

    function typed(ch) {
      if (P.mode === "MON" && P.field === "view") { P.field = "addr"; P.buf = ""; }
      if (P.mode === "PROG" && !P.pending) return;
      if (P.buf.length < 12) P.buf += ch;
      renderLcd();
    }

    function step(d) {
      if (P.mode === "MON") {
        const m = /^([A-Z])(\d+)(?:\.(\d+))?$/.exec(P.addr);
        if (!m) return;
        let [, t, w, b] = m;
        if (b !== undefined) {
          let bit = Number(b) + d, word = Number(w);
          if (bit > 15) { bit = 0; word++; } if (bit < 0) { bit = 15; word = Math.max(0, word - 1); }
          P.addr = `${t}${word}.${bit}`;
        } else P.addr = `${t}${Math.max(0, Number(w) + d)}`;
        P.value = null;
        send({ type: "read", address: P.addr });
      } else {
        const n = (state.ladder || []).length;
        if (n) selected = (selected + d + n) % n;
        P.confirmDel = false;
        selectLine();
        schedule();
      }
      renderLcd();
    }

    function enter() {
      if (P.mode === "MON") {
        if (P.field === "addr") {
          if (/^[A-Z]\d+(\.\d+)?$/.test(P.buf)) { P.addr = P.buf; P.value = null; send({ type: "read", address: P.addr }); }
          else flash("BAD ADDRESS");
          P.field = "view"; P.buf = "";
        } else if (P.field === "value") {
          const v = P.buf.startsWith("@") ? parseInt(P.buf.slice(1), 16) : Number(P.buf);
          if (P.buf !== "" && !Number.isNaN(v)) send({ type: "write", address: P.addr, value: v });
          P.field = "view"; P.buf = "";
        }
        return renderLcd();
      }
      if (P.confirmDel) {
        const rungs = state.ladder || [];
        const lines = state.program.split("\n");
        lines.splice(rungs[selected].line - 1, 1);
        send({ type: "load", source: lines.join("\n") });
        programDirty = false;
        P.confirmDel = false;
        selected = Math.max(0, selected - 1);
        flash("RUNG DELETED");
        return;
      }
      if (P.pending) {
        if (!P.buf) return;
        P.answers.push(P.buf);
        P.buf = "";
        if (P.answers.length < P.prompts.length) return renderLcd();
        const [kind, text] = P.pending.make(P.answers);
        if (kind === "c") {
          if (!P.draft.cond) P.draft.cond = text;
          else if (P.orPending) { P.draft.cond += " " + text; P.orPending = false; }
          else P.draft.cond += " AND " + text;
        } else {
          if (!P.draft.cond) P.draft.cond = "TRUE";
          P.draft.acts.push(text);
        }
        P.pending = null;
        previewDraft();
        return renderLcd();
      }
      if (P.field === "draft") return commitRung();
    }

    // physical keyboard on the programmer
    $("prog").addEventListener("keydown", (e) => {
      const map = { Enter: "ENTER", Escape: "CLR", Backspace: "CLR", ArrowDown: "NEXT", ArrowRight: "NEXT", ArrowUp: "PREV", ArrowLeft: "PREV", Delete: "DEL", Insert: "INS", "-": "−", ".": "." };
      let k = map[e.key];
      if (!k && /^[0-9]$/.test(e.key)) k = e.key;
      if (!k && /^[a-zA-Z]$/.test(e.key) && (P.field === "addr" || P.pending)) { e.preventDefault(); return typed(e.key.toUpperCase()); }
      if (!k && e.key === "@") { e.preventDefault(); return typed("@"); }
      if (!k) return;
      e.preventDefault();
      if (k === "CLR" && e.key === "Backspace" && P.buf) { P.buf = P.buf.slice(0, -1); return renderLcd(); }
      const btn = root.querySelector(`.key[data-key="${CSS.escape(k)}"]`);
      if (btn) { btn.classList.add("down"); setTimeout(() => btn.classList.remove("down"), 120); }
      key(k);
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
      P.mode = "PROG"; P.field = "view"; P.pending = null; P.confirmDel = false;
      selectLine();
      schedule();
    });

    function onMessage(msg) {
      if (msg.type === "state") {
        state = Object.assign(state || {}, msg);
        if (state.ladder && selected >= state.ladder.length) selected = Math.max(0, state.ladder.length - 1);
        if (P.mode === "MON" && state.live && P.addr in state.live) P.value = state.live[P.addr];
        schedule();
      } else if (msg.type === "value") {
        if (msg.address === P.addr) { P.value = msg.value; renderLcd(); }
      } else if (msg.type === "preview") {
        draftRungs = msg.rungs;
        if (!P.draft.acts.length && draftRungs[0]) draftRungs[0].actions = [];
        schedule();
      } else if (msg.type === "loaded") {
        programDirty = false;
        setMessage("Program loaded.");
      } else if (msg.type === "error") {
        if (P.mode === "PROG" && P.field === "draft") flash("ERROR: " + msg.message.slice(0, 14));
        setMessage(msg.message, true);
      }
    }

    $("program").addEventListener("input", () => { programDirty = true; setMessage("Edited, not loaded yet."); });
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
