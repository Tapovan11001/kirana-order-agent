# Kirana Order Agent

Customers order groceries on WhatsApp the way they talk:

> bhaiya 2 kilo aata, ek amul butter bada wala aur 3 maggi bhej do

This turns that into a priced cart matched to the shop's catalog, checks stock, offers substitutes for anything that's out, asks about anything ambiguous, and drafts the reply in the customer's own mix of Hindi and English. It also runs as an **MCP server**, so any MCP-capable assistant can check stock, take orders and plan reorders.

**Live:** {{live-url}} (the offline parser works without an API key)

## How it works in 100 words

Shop customers type orders on WhatsApp the way they talk: "2 kilo aata, ek amul butter bada wala". Kirana Order Agent reads the message, splits it into items, understands Hindi numbers and words like "bada" (big), forgives small typos, and matches each item to the shop's product list. Then it checks stock, adds up the bill and suggests a replacement for anything sold out. Finally it writes a friendly reply in the same Hinglish the customer used. Simple orders are handled instantly without any AI. When a message is confusing, Claude steps in and searches the catalog, but it can only pick products the shop actually sells.

_Created by Aarav Makhija._

## Why

Most small shops in India already take orders on WhatsApp. The shopkeeper reads every message, works out what "bada wala" means, checks the shelf, adds it up and types a reply. It's slow at peak hours and easy to get wrong. The hard part isn't the AI, it's the language: Hinglish, spelling variants (aata/atta, chini/cheeni), local names (double roti, sarson ka tel), brands used as product names (Maggi, Surf), and "do" meaning both "two" and "give".

## How it works

Three layers, from cheapest to smartest:

1. **Offline parser** ([`src/core/parser.ts`](src/core/parser.ts)). Rules plus fuzzy matching, no network, about a millisecond per message. Handles Hindi number words (ek, do, dedh, dhai), units (kilo, litre, packet, dabba), size words (bada, chhota), typos (maggie, tuvar), and picks pack sizes ("10 kilo aata" becomes one 10 kg bag). Every line gets a confidence level.
2. **Cart** ([`src/core/cart.ts`](src/core/cart.ts)). Prices, stock checks, same-category substitutes, questions for the customer, and the reply text. Out-of-stock lines aren't billed until the customer picks a substitute.
3. **Claude agent** ([`src/agent.ts`](src/agent.ts)). For messages the rules can't handle. Claude runs the parser first, uses `search_catalog` for the unclear lines, then `set_cart`. It can't invent products: `set_cart` rejects any sku id that isn't in the catalog. The loop runs on [TinyHarness](https://github.com/Tapovan11001/tinyharness), vendored in `src/harness/`.

```
WhatsApp message ─▶ parse_order (rules) ─▶ high confidence? ─▶ set_cart ─▶ reply
                                               │ no
                                               ▼
                                         search_catalog (Claude decides)
```

## MCP server

[`src/mcp/server.ts`](src/mcp/server.ts) exposes the store to any MCP client:

| Tool | What it does |
|---|---|
| `search_catalog` | Find products by name, brand or Hindi name |
| `check_stock` | Stock for one or more sku ids |
| `parse_order` | Message in, priced cart plus ready-to-send reply out |
| `reorder_list` | For the shopkeeper: what's running low and how much to reorder |

Add it to Claude Desktop:

```json
{
  "mcpServers": {
    "kirana": { "command": "node", "args": ["/absolute/path/to/kirana-order-agent/src/mcp/server.ts"] }
  }
}
```

Then ask "Do we have Pillsbury atta? If not what can I offer instead?" or "What should I reorder from the distributor this week?".

## Run it

```bash
npm install
npm test        # 14 tests: parser, cart, agent wiring and the MCP server
npm run dev     # web app at localhost:5173
npm run mcp     # MCP server over stdio
```

Needs Node 22.18 or newer (it runs the TypeScript directly).

## Project layout

| Path | What's in it |
|---|---|
| `src/core/catalog.ts` | 39-product sample catalog with Hindi/Hinglish aliases |
| `src/core/parser.ts` | Splitting, quantities, units, sizes, fuzzy matching |
| `src/core/cart.ts` | Stock checks, substitutes, reply text, reorder list |
| `src/agent.ts` | Claude tools and system prompt |
| `src/mcp/server.ts` | MCP server |
| `web/` | Chat on the left, the shopkeeper's screen on the right |

## Limits

- Roman-script Hinglish only for now. Devanagari input (२ किलो आटा) is next.
- The catalog and prices are a sample. A real shop would load its own from a sheet or its billing software.
- It drafts the reply; it doesn't send it. Connecting to the WhatsApp Business API is a separate step.

## Case study

[docs/case-study.md](docs/case-study.md)

## License

MIT
