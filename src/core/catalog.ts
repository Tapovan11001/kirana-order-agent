// A sample catalog for a neighbourhood kirana / small FMCG distributor.
// Prices are illustrative (roughly retail, Nov 2026), not quotes.

export interface Sku {
  id: string;
  name: string;
  brand: string;
  category: string;
  /** Pack size as sold, e.g. "5 kg", "1 L", "70 g". */
  size: string;
  /** Size in base units (g or ml) so "2 kilo aata" can pick packs. */
  grams: number;
  price: number;
  stock: number;
  /** Words customers actually type: Hindi, Hinglish, short forms, brand-as-product. */
  aliases: string[];
}

const s = (id: string, name: string, brand: string, category: string, size: string, grams: number, price: number, stock: number, aliases: string[]): Sku =>
  ({ id, name, brand, category, size, grams, price, stock, aliases });

export const CATALOG: Sku[] = [
  s("atta-ash-5", "Whole Wheat Atta", "Aashirvaad", "atta", "5 kg", 5000, 285, 24, ["atta", "aata", "gehu ka atta", "wheat flour", "aashirvaad"]),
  s("atta-ash-10", "Whole Wheat Atta", "Aashirvaad", "atta", "10 kg", 10000, 545, 8, ["atta", "aata", "gehu ka atta", "wheat flour", "aashirvaad"]),
  s("atta-pil-5", "Chakki Fresh Atta", "Pillsbury", "atta", "5 kg", 5000, 265, 0, ["atta", "aata", "pillsbury"]),
  s("rice-ig-5", "Basmati Rice", "India Gate", "rice", "5 kg", 5000, 640, 10, ["chawal", "chaawal", "rice", "basmati", "india gate"]),
  s("rice-sona-10", "Sona Masoori Rice", "Daawat", "rice", "10 kg", 10000, 720, 6, ["chawal", "rice", "sona masoori", "sona masuri"]),
  s("sugar-1", "Sugar", "Loose", "sugar", "1 kg", 1000, 48, 60, ["cheeni", "chini", "shakkar", "sugar"]),
  s("salt-tata-1", "Iodised Salt", "Tata", "salt", "1 kg", 1000, 28, 80, ["namak", "salt", "tata namak", "tata salt"]),
  s("dal-toor-1", "Toor Dal", "Tata Sampann", "dal", "1 kg", 1000, 175, 20, ["toor dal", "tuvar dal", "arhar dal", "arhar", "toor"]),
  s("dal-moong-1", "Moong Dal", "Tata Sampann", "dal", "1 kg", 1000, 160, 14, ["moong dal", "mung dal", "moong"]),
  s("dal-chana-1", "Chana Dal", "Tata Sampann", "dal", "1 kg", 1000, 110, 18, ["chana dal", "chane ki dal"]),
  s("oil-fortune-1", "Refined Soyabean Oil", "Fortune", "oil", "1 L", 1000, 150, 30, ["tel", "oil", "refined", "soyabean oil", "fortune"]),
  s("oil-mustard-1", "Kachi Ghani Mustard Oil", "Fortune", "oil", "1 L", 1000, 175, 22, ["sarson ka tel", "sarson tel", "mustard oil", "kachi ghani"]),
  s("ghee-amul-1", "Pure Ghee", "Amul", "ghee", "1 L", 1000, 650, 9, ["ghee", "amul ghee", "desi ghee"]),
  s("butter-amul-100", "Butter", "Amul", "butter", "100 g", 100, 60, 40, ["butter", "makhan", "amul butter"]),
  s("butter-amul-500", "Butter", "Amul", "butter", "500 g", 500, 285, 12, ["butter", "makhan", "amul butter"]),
  s("milk-amul-500", "Taaza Toned Milk", "Amul", "milk", "500 ml", 500, 28, 50, ["doodh", "dudh", "milk", "amul taaza", "taaza"]),
  s("milk-amul-1", "Gold Full Cream Milk", "Amul", "milk", "1 L", 1000, 68, 30, ["doodh", "dudh", "milk", "amul gold", "full cream"]),
  s("curd-400", "Masti Dahi", "Amul", "curd", "400 g", 400, 35, 25, ["dahi", "curd", "masti dahi"]),
  s("paneer-200", "Malai Paneer", "Amul", "paneer", "200 g", 200, 95, 15, ["paneer", "malai paneer"]),
  s("tea-tata-500", "Tata Tea Premium", "Tata", "tea", "500 g", 500, 290, 18, ["chai", "chai patti", "chai ki patti", "tea", "tata tea"]),
  s("tea-redlabel-250", "Red Label Tea", "Brooke Bond", "tea", "250 g", 250, 155, 20, ["chai patti", "red label", "tea"]),
  s("coffee-nes-50", "Nescafe Classic", "Nestle", "coffee", "50 g", 50, 190, 10, ["coffee", "nescafe"]),
  s("maggi-70", "Maggi Masala Noodles", "Nestle", "noodles", "70 g", 70, 14, 120, ["maggi", "noodles", "maggie"]),
  s("maggi-4pk", "Maggi Masala Noodles 4-pack", "Nestle", "noodles", "280 g", 280, 56, 30, ["maggi", "maggi 4 pack", "maggie"]),
  s("parleg-250", "Parle-G Biscuits", "Parle", "biscuits", "250 g", 250, 25, 70, ["parle g", "parle-g", "parleg", "biscuit", "biskut"]),
  s("goodday-200", "Good Day Cashew", "Britannia", "biscuits", "200 g", 200, 40, 35, ["good day", "goodday", "biscuit"]),
  s("haldi-100", "Turmeric Powder", "Everest", "spices", "100 g", 100, 38, 25, ["haldi", "turmeric"]),
  s("mirch-100", "Red Chilli Powder", "Everest", "spices", "100 g", 100, 52, 25, ["mirchi", "lal mirch", "red chilli", "mirch powder"]),
  s("jeera-100", "Cumin Seeds", "Everest", "spices", "100 g", 100, 75, 15, ["jeera", "jira", "cumin"]),
  s("garam-100", "Garam Masala", "MDH", "spices", "100 g", 100, 92, 12, ["garam masala", "masala"]),
  s("soap-lux-4", "Lux Soap 4-pack", "Lux", "soap", "4 x 100 g", 400, 140, 20, ["sabun", "soap", "lux"]),
  s("soap-dettol-3", "Dettol Soap 3-pack", "Dettol", "soap", "3 x 75 g", 225, 135, 0, ["sabun", "soap", "dettol"]),
  s("surf-1", "Surf Excel Easy Wash", "Surf Excel", "detergent", "1 kg", 1000, 145, 18, ["surf", "surf excel", "detergent", "washing powder", "kapde dhone ka powder"]),
  s("vim-bar", "Vim Bar", "Vim", "dishwash", "300 g", 300, 30, 40, ["vim", "vim bar", "bartan sabun", "dishwash"]),
  s("colgate-200", "Colgate Strong Teeth", "Colgate", "toothpaste", "200 g", 200, 120, 22, ["colgate", "toothpaste", "manjan"]),
  s("eggs-6", "Farm Eggs", "Local", "eggs", "6 pcs", 0, 48, 30, ["ande", "anda", "egg", "eggs"]),
  s("bread-400", "Sandwich Bread", "Britannia", "bread", "400 g", 400, 50, 15, ["bread", "double roti", "pav"]),
  s("onion-1", "Onion", "Loose", "veg", "1 kg", 1000, 40, 100, ["pyaaz", "pyaz", "kanda", "onion"]),
  s("potato-1", "Potato", "Loose", "veg", "1 kg", 1000, 30, 100, ["aloo", "alu", "batata", "potato"]),
];

/** "Amul Butter 500 g", without repeating the brand when the name already has it. */
export function label(sku: Sku): string {
  const name = sku.name.toLowerCase().includes(sku.brand.toLowerCase()) || sku.brand === "Loose" || sku.brand === "Local" ? sku.name : `${sku.brand} ${sku.name}`;
  return `${name} ${sku.size}`;
}

export const byId = (id: string) => CATALOG.find((x) => x.id === id);
