#!/usr/bin/env node
// MCP server: lets any MCP client (Claude Desktop, Claude Code, a WhatsApp
// assistant that speaks MCP) check stock, parse orders and plan reorders
// against the store catalog.
//
//   node src/mcp/server.ts            (stdio transport)
//
// Claude Desktop config:
//   { "mcpServers": { "kirana": { "command": "node", "args": ["/path/to/kirana-order-agent/src/mcp/server.ts"] } } }
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CATALOG, byId, label } from "../core/catalog.ts";
import { parseOrder, rank } from "../core/parser.ts";
import { buildCart, confirmationMessage, lowStock } from "../core/cart.ts";

const text = (data: unknown) => ({ content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] });

export function createServer() {
  const server = new McpServer({ name: "kirana-order-agent", version: "0.1.0" });

  server.registerTool(
    "search_catalog",
    {
      description: "Search the store catalog by product, brand or Hindi/Hinglish name (e.g. 'aata', 'sarson ka tel'). Returns sku id, price in ₹ and stock.",
      inputSchema: { query: z.string() },
    },
    async ({ query }) => {
      const hits = rank(query.toLowerCase()).slice(0, 8);
      return text(hits.length ? hits.map(({ sku }) => ({ sku_id: sku.id, product: label(sku), price: sku.price, stock: sku.stock })) : `No match for "${query}".`);
    },
  );

  server.registerTool(
    "check_stock",
    {
      description: "Check current stock for one or more sku ids.",
      inputSchema: { sku_ids: z.array(z.string()) },
    },
    async ({ sku_ids }) =>
      text(sku_ids.map((id) => {
        const s = byId(id);
        return s ? { sku_id: id, product: label(s), stock: s.stock, in_stock: s.stock > 0 } : { sku_id: id, error: "unknown sku" };
      })),
  );

  server.registerTool(
    "parse_order",
    {
      description: "Turn a customer's WhatsApp order (Hindi, English or Hinglish) into a priced cart with stock checks, plus a ready-to-send confirmation message.",
      inputSchema: { message: z.string(), reply_language: z.enum(["hinglish", "english"]).optional() },
    },
    async ({ message, reply_language }) => {
      const parsed = parseOrder(message);
      const cart = buildCart(parsed);
      return text({
        items: parsed.map((p) => ({ text: p.raw, product: p.sku ? label(p.sku) : null, sku_id: p.sku?.id ?? null, qty: p.qty, confidence: p.confidence, note: p.note })),
        total: cart.total,
        questions: cart.questions,
        not_found: cart.notFound,
        reply: confirmationMessage(cart, reply_language ?? "hinglish"),
      });
    },
  );

  server.registerTool(
    "reorder_list",
    {
      description: "For the shopkeeper: products running low and suggested quantities to reorder from the distributor.",
      inputSchema: { threshold: z.number().int().min(1).max(100).optional() },
    },
    async ({ threshold }) =>
      text(lowStock(threshold ?? 10).map(({ sku, suggestQty }) => ({ sku_id: sku.id, product: label(sku), stock: sku.stock, reorder_qty: suggestQty }))),
  );

  return server;
}

// Run over stdio when executed directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  await createServer().connect(new StdioServerTransport());
  console.error(`kirana MCP server ready (${CATALOG.length} products)`);
}
