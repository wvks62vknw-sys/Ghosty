/**
 * THE SHOPPING LIST BY AISLE (APPS ROUND, BODY AND KITCHEN lane): each thing on the list placed in the aisle a UK supermarket
 * keeps it in, by its words, so the list reads in the order he walks the shop. Display only: the list in my brain is unchanged.
 */
export const AISLES: { id: string; label: string; words: RegExp }[] = [
  { id: 'fruit', label: 'Fruit and veg', words: /\b(?:apples?|bananas?|oranges?|lemons?|limes?|grapes?|berries|strawberr|blueberr|pears?|onions?|garlic|potato|carrots?|peppers?|tomato|lettuce|salad|cucumber|spinach|broccoli|mushrooms?|leeks?|courgettes?|avocados?|herbs?|ginger|celery|peas?\b|spring onions?|fruit|veg)/i },
  { id: 'bakery', label: 'Bakery', words: /\b(?:bread|rolls?|bagels?|wraps?|tortillas?|croissants?|baguettes?|crumpets?|muffins?|pittas?|naan)\b/i },
  { id: 'dairy', label: 'Dairy and eggs', words: /\b(?:milk|cheese|cheddar|butter|yogh?urt|cream|eggs?|margarine|mozzarella|parmesan|feta)\b/i },
  { id: 'meat', label: 'Meat and fish', words: /\b(?:chicken|beef|mince|pork|lamb|sausages?|bacon|ham|turkey|salmon|tuna steak|cod|fish|prawns?|steak)\b/i },
  { id: 'frozen', label: 'Frozen', words: /\b(?:frozen|ice cream|ice lollies|chips|fish fingers)\b/i },
  { id: 'cupboard', label: 'Tins, jars and dry food', words: /\b(?:pasta|spaghetti|rice|noodles|flour|sugar|oats|cereal|tins?|tinned|beans|chickpeas|lentils|tuna|sweetcorn|tomatoes? (?:tin|puree)|chopped tomatoes|passata|stock|soy sauce|oil|vinegar|salt|pepper\b|spices?|curry paste|honey|jam|peanut butter|coffee|tea\b|biscuits?|crisps|chocolate|nuts)\b/i },
  { id: 'drinks', label: 'Drinks', words: /\b(?:water|juice|squash|cola|coke|lemonade|beer|wine|cider|lager)\b/i },
  { id: 'home', label: 'Household', words: /\b(?:toilet roll|kitchen roll|bin bags|washing up|detergent|soap|shampoo|toothpaste|bleach|sponges?|foil|cling film|batteries|tissues)\b/i },
];
/** The aisle a thing on the list belongs to ('other' when no word fits). */
export function aisleOf(text: string): { id: string; label: string } {
  // (household first, so "toilet roll" is never the bakery's rolls, nor "kitchen roll")
  const a = [...AISLES.filter((x) => x.id === 'home'), ...AISLES.filter((x) => x.id !== 'home')].find((x) => x.words.test(text));
  return a ? { id: a.id, label: a.label } : { id: 'other', label: 'Everything else' };
}
/** The list in shop order: each aisle in turn, everything else last. */
export function byAisle<T extends { text: string }>(list: T[]): { aisle: { id: string; label: string }; items: T[] }[] {
  const order = [...AISLES.map((a) => a.id), 'other'];
  const groups = new Map<string, { aisle: { id: string; label: string }; items: T[] }>();
  for (const x of list) {
    const a = aisleOf(x.text);
    (groups.get(a.id) ?? groups.set(a.id, { aisle: a, items: [] }).get(a.id)!).items.push(x);
  }
  return order.map((id) => groups.get(id)).filter((g): g is { aisle: { id: string; label: string }; items: T[] } => !!g);
}
