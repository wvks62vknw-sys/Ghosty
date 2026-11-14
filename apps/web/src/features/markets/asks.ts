/**
 * THE MARKETS BY CHAT (planlane): the words that work this screen from the chat, read on the phone with no model, in many wordings.
 * Pure (no DOM, no storage): the spec and the chat both read this. Returns null when the words are not for this screen, so the next
 * table (and then the brain) gets them. Never take words another table owns ("play music", "open the agenda": the VOICE lane's meanings;
 * "3 miles in km": the converter's units, checked first). Never a buy or sell call and never a forecast: "should I buy bitcoin?" and
 * "will bitcoin go up?" are not taken here.
 */
import { unitsAsked } from '../../convert/units';

export interface CoinName {
  id: string;
  sym: string;
  name: string;
}
/** The coins he can name in the chat by name or symbol (CoinGecko's ids). Any other coin goes on his list by CoinGecko's search. */
export const KNOWN_COINS: CoinName[] = (
  [
    ['bitcoin', 'BTC', 'Bitcoin', 'bitcoins|btc'], ['ethereum', 'ETH', 'Ethereum', 'ether|eth'], ['solana', 'SOL', 'Solana', 'sol'],
    ['ripple', 'XRP', 'XRP', 'ripple'], ['dogecoin', 'DOGE', 'Dogecoin', 'doge|dogecoins'], ['cardano', 'ADA', 'Cardano', 'ada'],
    ['chainlink', 'LINK', 'Chainlink', ''], ['litecoin', 'LTC', 'Litecoin', 'ltc|litecoins'], ['polkadot', 'DOT', 'Polkadot', ''],
    ['tron', 'TRX', 'TRON', 'trx'], ['avalanche-2', 'AVAX', 'Avalanche', 'avax'], ['shiba-inu', 'SHIB', 'Shiba Inu', 'shib'],
    ['binancecoin', 'BNB', 'BNB', 'binance coin'], ['tether', 'USDT', 'Tether', 'usdt'], ['usd-coin', 'USDC', 'USDC', 'usd coin'],
    ['monero', 'XMR', 'Monero', 'xmr'], ['stellar', 'XLM', 'Stellar', 'xlm'], ['bitcoin-cash', 'BCH', 'Bitcoin Cash', 'bch'],
    ['uniswap', 'UNI', 'Uniswap', ''], ['pepe', 'PEPE', 'Pepe', ''], ['sui', 'SUI', 'Sui', ''], ['the-open-network', 'TON', 'Toncoin', 'toncoin'],
    ['hedera-hashgraph', 'HBAR', 'Hedera', 'hbar'], ['cosmos', 'ATOM', 'Cosmos', 'atom'], ['aptos', 'APT', 'Aptos', ''],
    ['near', 'NEAR', 'NEAR Protocol', 'near protocol'], ['ethereum-classic', 'ETC', 'Ethereum Classic', ''],
  ] as const
).map(([id, sym, name]) => ({ id, sym, name }));
const ALIASES: [RegExp, string][] = (
  [
    ['bitcoin', 'bitcoins?|btc'], ['ethereum', 'ethereum|ether|eth'], ['solana', 'solana|sol'], ['ripple', 'xrp|ripple'], ['dogecoin', 'dogecoins?|doge'],
    ['cardano', 'cardano|ada'], ['chainlink', 'chainlink'], ['litecoin', 'litecoins?|ltc'], ['polkadot', 'polkadot'], ['tron', 'tron|trx'],
    ['avalanche-2', 'avalanche|avax'], ['shiba-inu', 'shiba(?: inu)?|shib'], ['binancecoin', 'bnb|binance coin'], ['tether', 'tether|usdt'],
    ['usd-coin', 'usdc|usd coin'], ['monero', 'monero|xmr'], ['stellar', 'stellar|xlm'], ['bitcoin-cash', 'bitcoin cash|bch'], ['uniswap', 'uniswap'],
    ['pepe', 'pepe'], ['sui', 'sui'], ['the-open-network', 'toncoin'], ['hedera-hashgraph', 'hedera|hbar'], ['cosmos', 'cosmos|atom'],
    ['aptos', 'aptos'], ['near', 'near protocol'], ['ethereum-classic', 'ethereum classic'],
  ] as const
).map(([id, words]) => [new RegExp(`^(?:${words})$`, 'i'), id]);
/** A coin he named, by name or symbol ("btc", "Bitcoin", "a bitcoin"), or null. */
export function coinNamed(words: string): CoinName | null {
  const w = words.trim().replace(/^(?:a|an|one|the|my)\s+/i, '').replace(/\s+(?:coins?|tokens?)$/i, '').trim();
  const hit = ALIASES.find(([re]) => re.test(w));
  return hit ? KNOWN_COINS.find((c) => c.id === hit[1]) ?? null : null;
}

/** Coin words that are also people's names, films or plain words ("How's Ada doing?", "watch tron"): taken only with a price cue or "my watchlist". */
const AMBIGUOUS = /^(?:(?:a|an|the|my)\s+)?(?:ada|sol|pepe|tron|cosmos|atom|near|sui|stellar|avalanche)$/i;
const ambiguous = (words: string): boolean => AMBIGUOUS.test(words.trim());

/** The money he can name, as CoinGecko's exchange rates key it. */
const CURRENCIES: [RegExp, string][] = [
  [/^(?:£|gbp|pounds?(?: sterling)?|sterling|quid|british pounds?)$/i, 'gbp'],
  [/^(?:\$|usd|(?:us |american )?dollars?|bucks)$/i, 'usd'],
  [/^(?:€|eur|euros?)$/i, 'eur'],
  [/^(?:¥|jpy|yen|japanese yen)$/i, 'jpy'],
  [/^(?:aed|dirhams?|uae dirhams?)$/i, 'aed'],
  [/^(?:inr|indian rupees?|₹)$/i, 'inr'],
  [/^(?:pkr|pakistani rupees?)$/i, 'pkr'],
  [/^(?:chf|swiss francs?|francs?)$/i, 'chf'],
  [/^(?:cad|canadian dollars?)$/i, 'cad'],
  [/^(?:aud|australian dollars?)$/i, 'aud'],
  [/^(?:sar|riyals?|saudi riyals?)$/i, 'sar'],
  [/^(?:try|lira|turkish lira)$/i, 'try'],
  [/^(?:pln|zloty|polish zloty)$/i, 'pln'],
  [/^(?:cny|yuan|renminbi|chinese yuan)$/i, 'cny'],
  [/^(?:sek|swedish kronor?)$/i, 'sek'],
  [/^(?:nok|norwegian kroner?)$/i, 'nok'],
  [/^(?:dkk|danish kroner?)$/i, 'dkk'],
  [/^(?:zar|rand|south african rand)$/i, 'zar'],
];
/** A currency he named ("pounds", "€", "US dollars"), as its code, or null. */
export function currencyNamed(words: string): string | null {
  const w = words.trim().replace(/^(?:a|an|one|the)\s+/i, '').trim();
  return CURRENCIES.find(([re]) => re.test(w))?.[1] ?? null;
}

export type MarketsAsk =
  | { what: 'price'; coin: CoinName }
  | { what: 'metal'; metal: 'xau' | 'xag' | 'both' }
  | { what: 'holdings'; coin?: CoinName }
  | { what: 'watch'; q: string; coin: CoinName | null }
  | { what: 'unwatch'; q: string; coin: CoinName | null }
  | { what: 'list' }
  | { what: 'hold'; coin: CoinName; amount: number }
  | { what: 'convert'; amount: number; from: string; to: string };

const NUM = String.raw`(\d[\d,]*(?:\.\d+)?|\.\d+)`;
const num = (s: string): number => Number(s.replace(/,/g, ''));
const CUR_WORD = String.raw`(£|\$|€|¥|₹|[a-z]+(?: [a-z]+)??)`;

export function marketsAsked(text: string): MarketsAsk | null {
  const t = text.trim().replace(/[?!.]+$/, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
  if (!t || t.length > 90) return null;
  // (as he types it fast: "whats", "hows", "wheres")
  const l = t.toLowerCase().replace(/^(what|how|where)s\b/, "$1's");
  // never a call to buy or sell, never a forecast: those go on to the brain
  if (/\bshould i\b|\b(?:buy|sell)(?:ing)? (?:some |more |any |my |a |the )?(?:crypto|coins?|bitcoin|ethereum|\w+coin|gold|silver)\b|\bgood time to\b|\binvest|\bpredict|\bforecast|\bwill .+ (?:go|rise|fall|drop|crash|hit)\b|\bgoing to (?:go|rise|fall|drop|crash|hit)\b/.test(l)) return null;
  // the converter's units first ("3 pounds in kg" is weight, not money)
  if (unitsAsked(t)) return null;

  // ---- HIS COINS: worth, how they are doing
  // (not a bare "my portfolio": that is his portfolio site, the brain's)
  if (/^(?:how(?:'s| is| are)|what(?:'s| is| are))(?: all)? my (?:coins|crypto|cryptos|holdings|crypto portfolio|coin portfolio|crypto holdings|investments in crypto)(?: (?:doing|worth|at|today|now|worth now|worth today|looking))*$/.test(l) || /^(?:show me |show )?my (?:holdings|crypto portfolio|coin holdings)$/.test(l))
    return { what: 'holdings' };
  let m = /^(?:what(?:'s| is)|how much is) my (.+?) worth(?: now| today)?$/.exec(l);
  if (m) {
    const coin = coinNamed(m[1]!);
    if (coin) return { what: 'holdings', coin };
    if (/^(?:coins|crypto|holdings|crypto portfolio|crypto holdings)$/.test(m[1]!)) return { what: 'holdings' };
  }

  // ---- WHAT HE HOLDS: "I have 0.2 bitcoin", "I own 0.5 BTC", "I've got 1,000 doge"; "I don't have any bitcoin now" takes it off
  m = new RegExp(String.raw`^(?:i(?: now)? (?:have|own|hold)|i've got|i have got|i bought|i've bought|put me down for|set my) ${NUM} (?:of )?(.+?)(?: now)?$`).exec(l);
  if (m) {
    const coin = coinNamed(m[2]!);
    if (coin && /^(?:i bought|i've bought)/.test(l)) return null; // (a purchase is not what he holds now: the brain asks)
    if (coin) return { what: 'hold', coin, amount: num(m[1]!) };
  }
  m = /^(?:i (?:don't|do not|no longer) (?:have|own|hold)(?: any)?|i (?:sold|have no|have none of)(?: all)?(?: of)?(?: my)?|i've sold(?: all)?(?: of)?(?: my)?|i have no) (.+?)(?: now| any more| anymore)?$/.exec(l);
  if (m) {
    const coin = coinNamed(m[1]!);
    if (coin) return { what: 'hold', coin, amount: 0 };
  }

  // ---- HIS WATCHLIST
  if (/^(?:show(?: me)?|what's on|what is on|read(?: me)?|open) my watch ?list$|^my watch ?list$/.test(l)) return { what: 'list' };
  m = /^(?:add|put) (.+?) (?:to|on|onto) (?:my|the) (?:watch ?list|markets?(?: list)?|coins?(?: list)?)$/.exec(l);
  if (m) return { what: 'watch', q: m[1]!.trim(), coin: coinNamed(m[1]!) };
  // (a bare "watch tron" or "watch cosmos" is a film or a series: those words need "on markets" or "on my watchlist")
  m = /^(?:start )?watch(?:ing)? (.+?)( for me| on markets| on my watch ?list)?$/.exec(l);
  if (m && coinNamed(m[1]!) && (!ambiguous(m[1]!) || /markets|watch ?list/.test(m[2] ?? ''))) return { what: 'watch', q: m[1]!.trim(), coin: coinNamed(m[1]!) };
  m = /^(?:remove|take|drop|delete) (.+?) (?:from|off) (?:my|the) (?:watch ?list|markets?(?: list)?|coins?(?: list)?)$/.exec(l);
  if (m) return { what: 'unwatch', q: m[1]!.trim(), coin: coinNamed(m[1]!) };
  m = /^stop watching (.+?)( on markets| on my watch ?list)?$/.exec(l);
  if (m && coinNamed(m[1]!) && (!ambiguous(m[1]!) || m[2])) return { what: 'unwatch', q: m[1]!.trim(), coin: coinNamed(m[1]!) };

  // ---- MONEY: "convert 50 pounds to euros", "£40 in euros", "how many euros for a pound", "what's a pound worth in euros"
  m = new RegExp(String.raw`^(?:convert |change |what(?:'s| is) |how much is |how much are )?(£|\$|€|¥|₹)?${NUM} ?${CUR_WORD}? (?:in|to|into|as) ${CUR_WORD}$`).exec(l);
  if (m) {
    const from = currencyNamed(m[1] ?? m[3] ?? '');
    const to = currencyNamed(m[4]!);
    if (from && to && from !== to && (!m[1] || !m[3])) return { what: 'convert', amount: num(m[2]!), from, to };
  }
  m = new RegExp(String.raw`^how many ${CUR_WORD} (?:for|is|are|in|to|does|do) (?:a|an|one|1|${NUM})? ?${CUR_WORD}(?: buy| get(?: me)?)?$`).exec(l);
  if (m) {
    const to = currencyNamed(m[1]!);
    const from = currencyNamed(m[3]!);
    if (from && to && from !== to) return { what: 'convert', amount: m[2] ? num(m[2]) : 1, from, to };
  }
  m = new RegExp(String.raw`^what(?:'s| is) (?:a|an|one|1) ${CUR_WORD} (?:worth )?in ${CUR_WORD}(?: today| now)?$`).exec(l);
  if (m) {
    const from = currencyNamed(m[1]!);
    const to = currencyNamed(m[2]!);
    if (from && to && from !== to) return { what: 'convert', amount: 1, from, to };
  }

  // ---- GOLD AND SILVER
  const metalOf = (w: string): 'xau' | 'xag' | 'both' | null => (/^(?:an ounce of )?gold$/.test(w) ? 'xau' : /^(?:an ounce of )?silver$/.test(w) ? 'xag' : /^gold and silver$|^silver and gold$/.test(w) ? 'both' : null);
  // (a price cue is needed: "what is gold?" is a learner's question, the brain's and School's, not a price)
  m = /^(what(?:'s| is| are)|how much is|how much are|how(?:'s| is)) (the price of |the )?(.+?)( (?:at|worth|doing|trading at|selling for|going for|price))?( (?:today|now|right now|an ounce|per ounce))?$/.exec(l);
  if (m && metalOf(m[3]!) && (/^how much/.test(m[1]!) || m[2] === 'the price of ' || m[4] || /ounce/.test(m[5] ?? '') || /^an ounce of /.test(m[3]!))) return { what: 'metal', metal: metalOf(m[3]!)! };
  m = /^(?:the )?(?:price of |prices of )?(.+?)(?: prices?)?(?: today| now)?$/.exec(l);
  if (m && metalOf(m[1]!) && /price/.test(l)) return { what: 'metal', metal: metalOf(m[1]!)! };

  // ---- A COIN'S PRICE: "what's bitcoin at", "price of ethereum", "how much is a bitcoin", "how's bitcoin doing", "eth price"
  m = /^(?:what(?:'s| is)|where(?:'s| is)|how much is|how much's|how(?:'s| is)) (?:the price of |the )?(.+?)(?: (?:at|worth|doing|trading at|going for|price))(?: (?:today|now|right now))?$/.exec(l) ??
    /^how much is (?:a |one |1 )?(.+?)(?: (?:today|now|right now))?$/.exec(l) ??
    /^(?:what(?:'s| is) )?(?:the )?(?:current |latest )?price of (.+?)(?: (?:today|now|right now))?$/.exec(l) ??
    /^(?:what(?:'s| is) )?(?:the )?(.+?) price(?: (?:today|now|right now))?$/.exec(l) ??
    /^(?:check|look up) (?:the price of )?(.+?)(?: price)?$/.exec(l);
  if (m) {
    const coin = coinNamed(m[1]!);
    // (a coin word that is also a name, "How's Ada doing?", "where's Sol at", is taken only with a price cue: "ada price", "price of ada", "ada coin")
    const cue = /\bprice\b|\bhow much\b|\b(?:coin|token)s?\b/.test(l);
    if (coin && (cue || !ambiguous(m[1]!))) return { what: 'price', coin };
  }
  return null;
}
