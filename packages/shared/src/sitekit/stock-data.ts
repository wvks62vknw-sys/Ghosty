/**
 * The vetted pictures, by kind of business (see stock.ts). Each was looked at before it went in: sharp,
 * well lit, no recognisable brand front and centre, and a licence that allows use on a business site with
 * a credit (CC0, CC BY, CC BY-SA). Credits are shown in every site's footer.
 */
import { commons } from './stock';
import type { ImageRef, KindId } from './types';

/** Pictures by role: the hero, story pictures, and a gallery. */
export interface StockSet {
  hero: ImageRef;
  story: ImageRef[];
  gallery: ImageRef[];
}

const C = commons;

export const STOCK: Partial<Record<KindId, StockSet>> = {
  barber: {
    hero: C('4/4d/Barber_cutting_hair_with_comb._Back_view_of_man_in_barber_shop.jpg', 6016, 4016, 'A barber combing and cutting a client\'s hair', 'Nenad Stojkovic', 'CC BY 2.0', 'Barber cutting hair with comb', '60% 40%'),
    story: [
      C("a/a2/Caleb's_Chop_Shop.jpg", 5752, 3835, 'Barber chairs in a shop with a checkerboard floor', 'Tamanoeconomico', 'CC BY-SA 4.0', "Caleb's Chop Shop"),
      C('c/cc/Barber_Bros_Co,_Isle_of_Capri,_Queensland_07.jpg', 4032, 3024, 'A barber shop interior with a classic chair', 'Kgbo', 'CC BY-SA 4.0', 'Barber Bros Co 07'),
    ],
    gallery: [
      C('4/40/Barber_cutting_hair_with_comb._Back_view_of_young_man_in_barber_shop.jpg', 4016, 6016, 'Close-up of a scissor cut with a comb', 'Nenad Stojkovic', 'CC BY 2.0', 'Barber cutting hair with comb (young man)'),
      C('5/54/Barber_Bros_Co,_Isle_of_Capri,_Queensland_02.jpg', 4032, 3024, 'A white barber chair beside a wash basin', 'Kgbo', 'CC BY-SA 4.0', 'Barber Bros Co 02'),
      C('0/01/The_barber_chairs_gn.jpg', 4000, 3000, 'A row of black barber chairs', 'Gnangcomapp', 'CC BY-SA 4.0', 'The barber chairs'),
      C('f/ff/Barber_Bros_Co,_Isle_of_Capri,_Queensland_05.jpg', 4032, 3024, 'Vintage leather barber chair', 'Kgbo', 'CC BY-SA 4.0', 'Barber Bros Co 05'),
      C('7/7e/Detail_of_Damascus_steel_hair-cutting_shears_from_Japanese_company_Mizutani.jpg', 3024, 3024, 'Steel hair-cutting shears on a dark background', 'Pittigrilli', 'CC BY-SA 4.0', 'Damascus steel hair-cutting shears'),
      C('9/96/Barber_shop,_Quebec_city,_Canada.jpg', 7364, 4909, 'A black and white barber shop with a chequered floor', 'Wilfredor', 'CC0', 'Barber shop, Quebec city'),
    ],
  },
};

/** The pictures for a kind, falling back to a neighbour's when a kind has none of its own. */
export function stockFor(kind: KindId): StockSet | undefined {
  const near: Record<KindId, KindId[]> = {
    cafe: ['restaurant', 'shop'],
    restaurant: ['cafe'],
    barber: ['salon'],
    salon: ['barber'],
    trades: [],
    gym: [],
    photographer: ['portfolio'],
    shop: ['cafe'],
    clinic: [],
    estate: [],
    portfolio: ['photographer'],
    event: ['restaurant'],
    charity: [],
    saas: ['portfolio'],
  };
  return STOCK[kind] ?? near[kind].map((k) => STOCK[k]).find(Boolean);
}
