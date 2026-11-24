import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/mcp/server.ts";
import { makeKiranaAgent } from "../src/agent.ts";
import { scriptedModel, lastToolResults } from "../src/harness/index.ts";

test("MCP server lists tools and parses an order", async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(b);
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(tools, ["check_stock", "parse_order", "reorder_list", "search_catalog"]);
  const res: any = await client.callTool({ name: "parse_order", arguments: { message: "2 kilo cheeni aur 3 maggi" } });
  const body = JSON.parse(res.content[0].text);
  assert.equal(body.total, 2 * 48 + 3 * 14);
  assert.match(body.reply, /Namaste/);
  await client.close();
});

test("agent: parse, fix a low-confidence line with search, set cart", async () => {
  const model = scriptedModel([
    { tools: [{ name: "parse_order", input: { message: "chai patti aur 2 kg cheeni" } }] },
    { tools: [{ name: "search_catalog", input: { query: "tata tea" } }] },
    { tools: [{ name: "set_cart", input: { lines: [{ sku_id: "tea-tata-500", qty: 1 }, { sku_id: "sugar-1", qty: 2 }] } }] },
    (req) => ({ text: `Total ₹${JSON.parse(lastToolResults(req)[0]).total}` }),
  ]);
  const { agent, state } = makeKiranaAgent(model);
  const r = await agent.run("chai patti aur 2 kg cheeni");
  assert.equal(r.status, "done");
  assert.equal(state.cart?.total, 290 + 96);
  assert.equal(r.output, "Total ₹386");
});

test("agent: invented sku ids are rejected", async () => {
  const model = scriptedModel([
    { tools: [{ name: "set_cart", input: { lines: [{ sku_id: "coke-1l", qty: 1 }] } }] },
    (req) => ({ text: lastToolResults(req)[0] }),
  ]);
  const { agent, state } = makeKiranaAgent(model);
  const r = await agent.run("1 coke");
  assert.match(r.output, /Unknown sku_id: coke-1l/);
  assert.equal(state.cart, null);
});
