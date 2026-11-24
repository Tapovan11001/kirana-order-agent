import { CATALOG, label } from "../src/core/catalog.ts";
import { parseOrder, type ParsedLine } from "../src/core/parser.ts";
import { buildCart, confirmationMessage, lowStock, type Cart } from "../src/core/cart.ts";
import { makeKiranaAgent } from "../src/agent.ts";
import { anthropicModel } from "../src/harness/models/anthropic.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const SAMPLES = [
  "bhaiya 2 kilo aata, ek amul butter bada wala aur 3 maggi bhej do",
  "1 litre sarson ka tel\n2 kg cheeni\nhaldi\nparle g 4 packet",
  "Pillsbury atta 5kg, dettol sabun, surf excel 1 kg and chai patti",
  "doodh 2 packet, dahi, 6 ande, double roti aur 1 coca cola",
  "do kilo pyaaz aur teen kilo aloo, tuvar dal 2 kg + jeera",
];

let engine: "rules" | "claude" = "rules";

// ---------- chat ----------
function bubble(text: string, who: "cust" | "shop", extra = ""): HTMLLIElement {
  const li = document.createElement("li");
  li.className = `bubble ${who} ${extra}`.trim();
  li.textContent = text;
  $("chat").append(li);
  li.scrollIntoView({ block: "nearest", behavior: "smooth" });
  return li;
}

// ---------- shop screen ----------
function renderShop(cart: Cart, parsed: ParsedLine[] | null) {
  const body = $("lines");
  body.replaceChildren();
  const rows: { raw: string; product: string; qty: number; total: number; pill: [string, string]; sub?: string }[] = [];
  if (parsed) {
    for (const p of parsed) {
      const line = p.sku ? cart.lines.find((l) => l.sku.id === p.sku!.id) : undefined;
      if (!p.sku || !line) {
        rows.push({ raw: p.raw, product: "Not in catalog", qty: p.qty, total: 0, pill: ["no", "ask customer"] });
        continue;
      }
      const pill: [string, string] = line.stockNote ? ["no", line.sku.stock === 0 ? "out of stock" : "short"] : p.confidence === "low" ? ["ask", "confirm"] : ["ok", "ok"];
      rows.push({ raw: p.raw, product: label(line.sku), qty: line.qty, total: line.lineTotal, pill, sub: line.substitute ? `Offer: ${label(line.substitute)} ₹${line.substitute.price}` : p.confidence === "low" ? p.note : undefined });
    }
  } else {
    for (const l of cart.lines) {
      rows.push({ raw: "(Claude)", product: label(l.sku), qty: l.qty, total: l.lineTotal, pill: l.stockNote ? ["no", l.sku.stock === 0 ? "out of stock" : "short"] : ["ok", "ok"], sub: l.substitute ? `Offer: ${label(l.substitute)} ₹${l.substitute.price}` : undefined });
    }
    for (const nf of cart.notFound) rows.push({ raw: nf, product: "Not in catalog", qty: 1, total: 0, pill: ["no", "ask customer"] });
  }
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="raw"></td><td><span class="prod"></span><span class="sub"></span></td><td class="n"></td><td class="n"></td><td><span class="pill"></span></td>`;
    tr.querySelector(".raw")!.textContent = r.raw;
    tr.querySelector(".prod")!.textContent = r.product;
    const sub = tr.querySelector<HTMLElement>(".sub")!;
    if (r.sub) sub.textContent = r.sub; else sub.remove();
    tr.querySelectorAll(".n")[0].textContent = String(r.qty);
    tr.querySelectorAll(".n")[1].textContent = r.total ? r.total.toLocaleString("en-IN") : "—";
    const pill = tr.querySelector(".pill")!;
    pill.classList.add(r.pill[0]);
    pill.textContent = r.pill[1];
    body.append(tr);
  }
  $("total").textContent = cart.total.toLocaleString("en-IN");
  $("questions").hidden = cart.questions.length === 0;
  $("q-list").replaceChildren(...cart.questions.map((q) => Object.assign(document.createElement("li"), { textContent: q })));
}

function renderReorder() {
  $("reorder").replaceChildren(
    ...lowStock(10).map(({ sku, suggestQty }) => Object.assign(document.createElement("li"), { textContent: `${label(sku)}: ${sku.stock} left, reorder ${suggestQty}` })),
  );
}

// ---------- handling an order ----------
async function handle(message: string) {
  bubble(message, "cust");
  const status = $("status");
  if (engine === "rules") {
    const t0 = performance.now();
    const parsed = parseOrder(message);
    const cart = buildCart(parsed);
    renderShop(cart, parsed);
    const ms = performance.now() - t0;
    const typing = bubble("typing…", "shop", "typing");
    await new Promise((r) => setTimeout(r, 450));
    typing.remove();
    bubble(confirmationMessage(cart), "shop");
    status.textContent = `Parsed ${parsed.length} item${parsed.length === 1 ? "" : "s"} in ${ms.toFixed(1)} ms, no network.`;
    return;
  }

  const key = $<HTMLInputElement>("api-key").value.trim();
  if (!key) {
    status.textContent = "Paste an Anthropic API key, or switch back to the offline parser.";
    $<HTMLInputElement>("api-key").focus();
    return;
  }
  try { sessionStorage.setItem("ko-key", key); } catch {}
  const typing = bubble("typing…", "shop", "typing");
  $<HTMLButtonElement>("send").disabled = true;
  const model = anthropicModel({ apiKey: key, browser: true, model: $<HTMLSelectElement>("model-id").value, maxTokens: 4000 });
  const { agent, state } = makeKiranaAgent(model, (e) => {
    if (e.kind === "tool_call") status.textContent = `Claude: ${e.name.replace("_", " ")}…`;
  });
  try {
    const r = await agent.run(message);
    typing.remove();
    if (state.cart) renderShop(state.cart, null);
    const err = r.trace.find((e) => e.kind === "error");
    if (r.output) bubble(r.output, "shop");
    status.textContent =
      r.status === "done" ? `Claude: ${r.toolCalls} tool calls, ${(r.usage.inputTokens + r.usage.outputTokens).toLocaleString()} tokens.` :
      err && err.kind === "error" ? friendly(err.message) : `Stopped: ${r.status}.`;
  } finally {
    $<HTMLButtonElement>("send").disabled = false;
  }
}

function friendly(msg: string) {
  if (/401|authentication|api-key/i.test(msg)) return "The API key was rejected.";
  if (/fetch|network|connection/i.test(msg)) return "Couldn't reach the Claude API from this page. Open the hosted site if this preview blocks outside requests.";
  return msg;
}

// ---------- controls ----------
for (const s of SAMPLES) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "sample";
  b.textContent = s.replace(/\n/g, " · ");
  b.title = s;
  b.addEventListener("click", () => handle(s));
  $("samples").append(b);
}
$("composer").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $<HTMLTextAreaElement>("msg").value.trim();
  if (!v) return;
  $<HTMLTextAreaElement>("msg").value = "";
  handle(v);
});
$("msg").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("composer").dispatchEvent(new Event("submit", { cancelable: true }));
  }
});

function setEngine(e: typeof engine) {
  engine = e;
  $("mode-rules").classList.toggle("on", e === "rules");
  $("mode-claude").classList.toggle("on", e === "claude");
  $("mode-rules").setAttribute("aria-checked", String(e === "rules"));
  $("mode-claude").setAttribute("aria-checked", String(e === "claude"));
  $("claude-panel").hidden = e !== "claude";
  $("engine-tag").textContent = e === "rules" ? "offline parser" : "claude agent";
}
$("mode-rules").addEventListener("click", () => setEngine("rules"));
$("mode-claude").addEventListener("click", () => setEngine("claude"));
try {
  const k = sessionStorage.getItem("ko-key");
  if (k) $<HTMLInputElement>("api-key").value = k;
} catch {}

renderReorder();
// Open in a working state: the first sample, already handled.
const first = SAMPLES[0];
bubble(first, "cust");
const parsed = parseOrder(first);
const cart = buildCart(parsed);
renderShop(cart, parsed);
bubble(confirmationMessage(cart), "shop");
$("status").textContent = `${CATALOG.length} products in the sample catalog. Tap a sample order or type your own.`;
