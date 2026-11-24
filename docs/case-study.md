# Kirana Order Agent: reading Hinglish grocery orders

## The problem

Neighbourhood stores in India take a lot of orders over WhatsApp. Each message has to be read, interpreted, checked against the shelf, priced and answered by hand. Messages mix Hindi and English, spell the same item five ways, and lean on context ("bada wala", "wahi wala"). Generic chatbots handle this badly, and calling a large model for every message is slow and costs money a small shop won't spend.

## What I built

A web app, a Claude agent and an MCP server that share one core:

- an offline parser for Hinglish orders that runs in about a millisecond,
- a cart that checks stock, offers substitutes and asks about anything unclear,
- a Claude agent for messages the rules can't handle, which can't invent products,
- an MCP server so assistants can check stock, take orders and plan reorders.

## Key decisions

**Rules first, model second.** Most orders are simple. The rule-based parser handles them offline, and every line gets a confidence level. Claude is only needed for the hard lines. That keeps the common case free and instant.

**Small words matter.** "Do" means "two" in "do kilo pyaaz" and "give" in "bhej do". "G" is a unit in "500 g" and part of the name in "Parle G". The parser treats a unit as a unit only right after a number, and "do" as a number only when a product follows it. Each of these has its own test.

**The customer's brand wins.** If someone asks for Pillsbury and it's out of stock, the cart keeps Pillsbury, doesn't bill it, and asks "Aashirvaad chalega?" instead of quietly swapping brands.

**Guard the edges.** The agent's `set_cart` tool rejects any product id that isn't in the catalog, so the model can't add something the shop doesn't sell.

## Result

- 14 tests covering Hindi number words, units, size words, typos, brand handling, substitutes, the agent's tool use and the MCP server.
- The five sample orders in the app parse correctly, including out-of-stock substitutes and an item the shop doesn't sell.
- {{add a real number once you have one: e.g. tested with N real orders from a local shop, X% parsed without Claude}}

## Next

- Devanagari input.
- Load the catalog from a Google Sheet so a real shop can use it.
- Connect to the WhatsApp Business API, with the shopkeeper approving each reply.
