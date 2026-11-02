// <microgem-panel>: the MicroGEM front panel, program editor and table monitor.
// Used by the standalone page (with a WebSocket transport) and by Home Assistant
// as a custom panel (with a transport over Home Assistant's own connection).

const STYLE = `
  :host {
    --bg: #e9e6df;
    --text: #23211d;
    --muted: #6b665c;
    --panel: #f7f5f0;
    --border: #cfc9bd;
    --case: #d8cfb8;
    --case-edge: #b3a789;
    --strip: #3b2f24;
    --strip-text: #f1e7d0;
    --led-off: #4a3f36;
    --led-in: #4cff6a;
    --led-out: #ff4a3a;
    --led-amber: #ffb52e;
    --accent: #2f5d8a;
    --error: #b3261e;
    --mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :host {
      --bg: #1b1a18;
      --text: #ece8df;
      --muted: #a39d90;
      --panel: #252320;
      --border: #3c3934;
      --accent: #86b4e3;
      --error: #ff8a80;
    }
  }
  * { box-sizing: border-box; }
  :host {
    display: block;
    min-height: 100%;
    background: var(--bg);
    color: var(--text);
    font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  main { max-width: 1060px; margin: 0 auto; padding: 24px 16px 48px; }
  header h1 { margin: 0; font-size: 1.4rem; }
  header p { margin: 4px 0 20px; color: var(--muted); }

  /* ---- the device ---- */
  .device {
    background: linear-gradient(#e2dac6, var(--case));
    border: 2px solid var(--case-edge);
    border-radius: 10px;
    box-shadow: 0 6px 18px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.6);
    padding: 14px;
    color: #2a241c;
  }
  .strip {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    background: var(--strip); color: var(--strip-text);
    border-radius: 4px; padding: 8px 14px;
  }
  .badge { font: 700 1.3rem/1 Arial Black, Arial, sans-serif; letter-spacing: .08em; }
  .model { font: 700 1.05rem/1 Arial, sans-serif; letter-spacing: .25em; }
  .status { display: flex; gap: 14px; font: 600 .7rem/1 Arial, sans-serif; letter-spacing: .08em; }
  .status span { display: flex; align-items: center; gap: 6px; }
  .bank { margin-top: 14px; }
  .bank h2 {
    margin: 0 0 6px; font: 700 .72rem/1 Arial, sans-serif; letter-spacing: .14em; color: #4b4232;
  }
  .leds {
    display: grid; grid-template-columns: repeat(16, minmax(0, 1fr)); gap: 4px;
    background: #2b251e; border-radius: 4px; padding: 8px 6px 6px;
  }
  .cell { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .cell small { font: 600 .62rem/1 var(--mono); color: #cfc3a8; }
  .led {
    width: 14px; height: 14px; border-radius: 50%;
    background: var(--led-off);
    box-shadow: inset 0 -2px 3px rgba(0,0,0,.5);
    transition: background .05s, box-shadow .05s;
  }
  .led.in.on  { background: var(--led-in);  box-shadow: 0 0 8px var(--led-in), inset 0 -2px 3px rgba(0,0,0,.2); }
  .led.out.on { background: var(--led-out); box-shadow: 0 0 8px var(--led-out), inset 0 -2px 3px rgba(0,0,0,.2); }
  .led.amber.on { background: var(--led-amber); box-shadow: 0 0 8px var(--led-amber); }
  .led.small { width: 10px; height: 10px; }
  .terminals { display: grid; grid-template-columns: repeat(16, minmax(0, 1fr)); gap: 4px; margin-top: 6px; }
  .terminals i {
    justify-self: center; width: 12px; height: 12px; border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #f3f0e8, #8e8676);
    position: relative;
  }
  .terminals i::after { content: ""; position: absolute; inset: 5px 2px; background: #5c5548; }

  /* ---- input switches ---- */
  .switches { display: grid; grid-template-columns: repeat(16, minmax(0, 1fr)); gap: 4px; margin-top: 10px; }
  .switches button {
    font: 600 .7rem/1 var(--mono); padding: 10px 0; min-width: 0;
    border: 1px solid #6e6453; border-radius: 4px; cursor: pointer;
    background: #f4efe3; color: #2a241c; box-shadow: 0 2px 0 #6e6453;
    touch-action: manipulation;
  }
  .switches button.on { background: #3c6e47; color: #fff; transform: translateY(2px); box-shadow: none; }
  .mode { display: flex; gap: 8px; align-items: center; margin-top: 10px; font-size: .8rem; color: #4b4232; flex-wrap: wrap; }
  .seg { display: inline-flex; border: 1px solid #6e6453; border-radius: 4px; overflow: hidden; }
  .seg button { border: 0; background: #f4efe3; min-width: 32px; padding: 4px 10px; font: inherit; cursor: pointer; color: #2a241c; }
  .seg button.active { background: var(--strip); color: var(--strip-text); }

  /* ---- panels ---- */
  .grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; margin-top: 20px; }
  .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 14px; min-width: 0; }
  .panel h2 { margin: 0 0 8px; font-size: 1rem; }
  .panel p.hint { margin: 0 0 8px; color: var(--muted); font-size: .85rem; }
  textarea {
    width: 100%; min-height: 340px; resize: vertical;
    font: 13px/1.5 var(--mono); color: var(--text); background: var(--bg);
    border: 1px solid var(--border); border-radius: 6px; padding: 10px; tab-size: 4;
  }
  .row { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
  .btn {
    font: inherit; padding: 7px 14px; border-radius: 6px; cursor: pointer;
    border: 1px solid var(--border); background: var(--panel); color: var(--text);
  }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .message { font-size: .85rem; color: var(--muted); }
  .message.error { color: var(--error); }
  table { width: 100%; border-collapse: collapse; font: 12px/1.4 var(--mono); }
  th, td { text-align: left; padding: 3px 4px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  th { color: var(--muted); font-weight: 600; }
  td.bits { letter-spacing: .05em; }
  .table-scroll { overflow-x: auto; }
  details { margin-top: 12px; font-size: .85rem; }
  details code { font-family: var(--mono); }
  .conn { font-size: .8rem; color: var(--muted); }

  @media (max-width: 760px) {
    .grid { grid-template-columns: 1fr; }
    .leds, .terminals, .switches { grid-template-columns: repeat(8, minmax(0, 1fr)); row-gap: 8px; }
    .strip { flex-wrap: wrap; }
    .status { gap: 10px; width: 100%; justify-content: flex-end; }
    .model { letter-spacing: .12em; }
  }
`;

const MARKUP = `
<main>
  <header>
    <h1>Virtual MicroGEM</h1>
    <p>A GEM 80 style programmable controller running in software. Flip the inputs, watch the outputs, and edit the ladder program. <span class="conn" id="conn">Connecting…</span></p>
  </header>

  <section class="device" aria-label="MicroGEM front panel">
    <div class="strip">
      <span class="badge">GEC</span>
      <span class="model">MICROGEM</span>
      <div class="status">
        <span><i class="led small amber" id="led-power"></i>POWER</span>
        <span><i class="led small in" id="led-run"></i>RUN</span>
        <span><i class="led small out" id="led-halt"></i>HALT</span>
      </div>
    </div>

    <div class="bank">
      <h2>INPUTS · A TABLE</h2>
      <div class="leds" id="input-leds"></div>
      <div class="terminals" id="input-terms"></div>
    </div>
    <div class="bank">
      <h2>OUTPUTS · B TABLE</h2>
      <div class="leds" id="output-leds"></div>
      <div class="terminals" id="output-terms"></div>
    </div>

    <div class="switches" id="switches" aria-label="Input switches"></div>
    <div class="mode">
      <span>Input switches act as</span>
      <span class="seg" id="mode">
        <button data-mode="toggle" class="active">Switches</button>
        <button data-mode="momentary">Push-buttons</button>
      </span>
      <span class="seg" id="runhalt" style="margin-left:auto">
        <button data-cmd="run">RUN</button>
        <button data-cmd="halt">HALT</button>
      </span>
    </div>
  </section>

  <div class="grid">
    <section class="panel">
      <h2>Program</h2>
      <p class="hint">One rung per line: contacts on the left of <code>-&gt;</code>, coils and function blocks on the right.</p>
      <textarea id="program" spellcheck="false" aria-label="Ladder program"></textarea>
      <div class="row">
        <button class="btn primary" id="load">Load program</button>
        <span class="message" id="message"></span>
      </div>
      <details>
        <summary>Language reference</summary>
        <p><b>Addresses:</b> <code>A0.3</code> is bit 3 of word 0 in table A. Inputs are A, outputs are B, workspace is G H L N O U, retained workspace is R W.</p>
        <p><b>Contacts:</b> <code>A0.0</code>, <code>NOT A0.0</code>, <code>RISE A0.0</code>, <code>FALL A0.0</code>, <code>TRUE</code>, joined with <code>AND</code>, <code>OR</code> and brackets. Word comparisons: <code>G1 GE 5</code> (EQ NE GT LT GE LE).</p>
        <p><b>Outputs:</b> a bit address is a coil; <code>SET B0.0</code>, <code>RESET B0.0</code>; <code>DELAY 2.5s G0.1</code>; <code>COUNT 10 G1 G0.2</code>; <code>CLEAR G1</code>; <code>OUT 42 G2</code>; <code>ADD G1 G2 G3</code> (also SUB MULT DIV). Separate several with commas.</p>
        <p><b>Flags (read-only):</b> <code>E0.0</code> pulses every 0.1 s, <code>E0.1</code> every second, <code>E0.6</code> after a program load, <code>E0.7</code> when ADD or SUB hits the limit. <code>E1</code> to <code>E6</code> hold the time and date, <code>E7</code> the last scan time in ms. Numbers can be written in hex as <code>@00FF</code>.</p>
        <p>This notation is provisional until we find the original GEM 80 programming manual (T391).</p>
      </details>
    </section>

    <section class="panel">
      <h2>Data tables</h2>
      <p class="hint">First eight words of a table, as a signed number and as bits 15 to 0.</p>
      <div class="seg" id="table-pick" style="margin-bottom:8px"></div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Word</th><th>Value</th><th>Bits 15…0</th></tr></thead>
          <tbody id="tables"></tbody>
        </table>
      </div>
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

class MicroGemPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._started = false;
  }

  // Home Assistant sets these two properties on custom panels.
  set hass(hass) {
    this._hass = hass;
    this._maybeStart();
  }
  set panel(panel) {
    this._panel = panel;
    this._maybeStart();
  }

  set transport(transport) {
    this._transport = transport;
    this._maybeStart();
  }

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
      let state = null;
      let mode = "toggle";
      let built = false;
      let programDirty = false;
      let shownTable = "G";

      function el(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        return node;
      }

      function build(nIn, nOut) {
        const bank = (leds, terms, n, kind) => {
          leds.replaceChildren(); terms.replaceChildren();
          for (let i = 0; i < n; i++) {
            const cell = el("div", "cell");
            cell.append(el("i", "led " + kind), el("small", "", String(i)));
            leds.append(cell);
            terms.append(el("i"));
          }
        };
        bank($("input-leds"), $("input-terms"), nIn, "in");
        bank($("output-leds"), $("output-terms"), nOut, "out");

        const sw = $("switches");
        sw.replaceChildren();
        for (let i = 0; i < nIn; i++) {
          const b = el("button", "", "A0." + i);
          b.title = "Input " + i;
          b.addEventListener("click", () => {
            if (mode === "toggle") send({ type: "input", index: i, value: !state.inputs[i] });
          });
          const press = (v) => (e) => { if (mode === "momentary") { e.preventDefault(); send({ type: "input", index: i, value: v }); } };
          b.addEventListener("pointerdown", press(true));
          b.addEventListener("pointerup", press(false));
          b.addEventListener("pointerleave", (e) => { if (mode === "momentary" && state.inputs[i]) press(false)(e); });
          sw.append(b);
        }
        built = true;
      }

      function render() {
        if (!built) build(state.inputs.length, state.outputs.length);
        $("input-leds").querySelectorAll(".led").forEach((n, i) => n.classList.toggle("on", state.inputs[i]));
        $("output-leds").querySelectorAll(".led").forEach((n, i) => n.classList.toggle("on", state.outputs[i]));
        $("switches").querySelectorAll("button").forEach((n, i) => n.classList.toggle("on", state.inputs[i]));
        $("led-power").classList.add("on");
        $("led-run").classList.toggle("on", state.running);
        $("led-halt").classList.toggle("on", !state.running);
        root.querySelectorAll("#runhalt button").forEach((b) =>
          b.classList.toggle("active", (b.dataset.cmd === "run") === state.running));

        const pick = $("table-pick");
        if (!pick.childElementCount) {
          for (const letter of Object.keys(state.tables)) {
            const b = el("button", letter === shownTable ? "active" : "", letter);
            b.addEventListener("click", () => { shownTable = letter; pick.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b)); render(); });
            pick.append(b);
          }
        }
        const rows = [];
        for (const [letter, words] of Object.entries(state.tables)) {
          if (letter !== shownTable) continue;
          words.forEach((w, i) => {
            const signed = w & 0x8000 ? w - 0x10000 : w;
            const bits = w.toString(2).padStart(16, "0").replace(/(.{4})(?!$)/g, "$1 ");
            rows.push(`<tr><td>${letter}${i}</td><td>${signed}</td><td class="bits">${bits}</td></tr>`);
          });
        }
        $("tables").innerHTML = rows.join("");

        if (!programDirty && state.program !== undefined && $("program").value !== state.program) {
          $("program").value = state.program;
        }
      }

      function setMessage(text, isError) {
        $("message").textContent = text;
        $("message").classList.toggle("error", !!isError);
      }

      function send(message) { transport.send(message); }

      function onMessage(msg) {
        if (msg.type === "state") {
          state = Object.assign(state || {}, msg);
          render();
        } else if (msg.type === "loaded") {
          programDirty = false;
          setMessage("Program loaded.");
        } else if (msg.type === "error") {
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
      root.querySelectorAll("#runhalt button").forEach((b) =>
        b.addEventListener("click", () => send({ type: b.dataset.cmd })));

      transport.connect(onMessage, (text) => { $("conn").textContent = text; });
  }
}

if (!customElements.get("microgem-panel")) customElements.define("microgem-panel", MicroGemPanel);
