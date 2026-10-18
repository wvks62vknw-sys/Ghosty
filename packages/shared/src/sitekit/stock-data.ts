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
  cafe: {
    hero: C('c/c6/Latte_art_3.jpg', 3442, 2290, 'Milk being poured into a flat white to make latte art', 'Kim Sanso', 'CC0', 'Latte art 3', '45% 50%'),
    story: [
      C('3/3b/Barista_prepares_espresso_at_coffee_shop.jpg', 6048, 4032, 'A barista tamping espresso at the coffee machine', 'Shixart1985', 'CC BY 2.0', 'Barista prepares espresso at coffee shop'),
      C('c/cb/Empty_coffee_shop_interior_with_wooden_table_and_water_skis.jpg', 4096, 2730, 'A quiet café corner with a brick wall and a long wooden table', 'Drew Coffman', 'CC0', 'Empty coffee shop interior'),
    ],
    gallery: [
      C('8/8a/Latte_art_4.jpg', 3827, 2547, 'A hand holding a cup of coffee with latte art', 'Kim Sanso', 'CC0', 'Latte art 4'),
      C("5/58/Latte_art_at_Balzac's.jpg", 1600, 1200, 'A rosetta poured into a latte', 'Linda N.', 'CC BY 2.0', "Latte art at Balzac's"),
      C('1/1f/Matcha_tea_latte_with_rosetta_latte_art.jpg', 4032, 2268, 'A matcha latte on a wooden table', 'Irvan Ary Maulana', 'CC BY-SA 4.0', 'Matcha tea latte with rosetta latte art'),
      C('0/03/Coffee_preparation_in_a_modern_cafe_with_steaming_equipment_and_skilled_barista_at_work_during_the_morning_rush_hour.jpg', 4747, 3169, 'Steam rising from the espresso machine during the morning rush', 'Shixart1985', 'CC BY 2.0', 'Coffee preparation in a modern cafe'),
      C('0/01/Latte_art_and_laptop_(Unsplash).jpg', 3456, 1944, 'A latte beside a laptop on a café table', 'Nafinia Putra', 'CC0', 'Latte art and laptop'),
      C('3/36/Latte_art_smile.jpg', 2592, 1944, 'A coffee with a smiling face in the foam, next to a pastry', 'קלאופטרה', 'CC BY-SA 3.0', 'Latte art smile'),
    ],
  },
  trades: {
    hero: C('7/7d/Bathroom_of_Khan_Pool_Suite_in_Amantaka_luxury_Resort_&_Hotel_in_Luang_Prabang_Laos.jpg', 5768, 3845, 'A finished bathroom with twin basins, mirrors and a tiled floor', 'Basile Morin', 'CC BY-SA 4.0', 'Bathroom of Khan Pool Suite', '30% 50%'),
    story: [
      C('5/58/Plumber_01.jpg', 5472, 3648, 'A plumber drilling into a wall to fit pipework', 'Amuzujoe', 'CC BY-SA 4.0', 'Plumber 01'),
      C('a/ad/Rustic_tools_spread_across_a_weathered_wooden_workbench_showcasing_craftsmanship_and_utility.jpg', 4016, 6016, 'Spanners and hand tools on a workbench', 'Shixart1985', 'CC BY 2.0', 'Tools on a workbench'),
    ],
    gallery: [
      C('a/a7/Small_Bathroom_Renovation_in_Wellington.jpg', 3024, 4032, 'A small bathroom after renovation, with a walk-in shower', 'Smtzzz', 'CC BY-SA 4.0', 'Small bathroom renovation'),
      C('1/1a/Red_modern_bathroom_interior._(51528276166).jpg', 6016, 4016, 'A modern bathroom with a glass shower and a red feature wall', 'Nenad Stojkovic', 'CC BY 2.0', 'Red modern bathroom interior'),
      C('3/37/Electrician_Working.jpg', 2048, 1536, 'An electrician working with his tools laid out', 'editor B', 'CC BY 2.0', 'Electrician working'),
      C('b/b2/Haltern_am_See,_Sythen,_Werkzeughalle_der_Quarzwerke_--_2015_--_4990.jpg', 5245, 3497, 'A tidy workshop bench with tools on the wall', 'Dietmar Rabich', 'CC BY-SA 4.0', 'Werkzeughalle'),
      C('e/e8/Electricians_working_on_systems_equipment_in_the_back_of_house_area_of_the_future_LIRR_concourse._10-03-2019_(48844065291).jpg', 3024, 4032, 'Electricians working on plant-room equipment', 'MTA Capital Construction', 'CC BY 2.0', 'Electricians working on systems equipment'),
    ],
  },
  gym: {
    hero: C('0/02/GymNation_gym_interior_2024.jpg', 2500, 1407, 'A long gym floor lined with benches and racks under blue light', 'GymNation', 'CC BY-SA 4.0', 'GymNation gym interior 2024', '50% 60%'),
    story: [
      C('3/30/Kettlebell_workout.jpg', 5472, 3648, 'A man swinging a kettlebell overhead in a bright gym', 'Rafaelqcn', 'CC BY-SA 4.0', 'Kettlebell workout'),
      C('5/51/Marine_Corps_Base_Hawaii_cross-training_gym_celebrates_first_anniversary_120814-M-MM918-001.jpg', 2100, 1442, 'A cross-training gym with racks and rowers', 'Cpl. Reece Lodder', 'Public domain', 'Cross-training gym'),
    ],
    gallery: [
      C('e/ee/Brightly_colored_kettlebells_and_dumbbells.jpg', 4016, 6016, 'Racks of brightly coloured kettlebells and dumbbells', 'Shixart1985', 'CC BY 2.0', 'Brightly colored kettlebells and dumbbells'),
      C("2/27/Peterson_Airman_to_compete_in_England's_first-ever_Invictus_Games_(3561123).jpg", 3000, 2400, 'Trainers and a kettlebell on a gym floor', 'Senior Airman Rose Gudex, U.S. Space Force', 'Public domain', 'Kettlebell training'),
      C('2/29/Heidemarie_Couch,_CIV_(1)_(14504740111).jpg', 1920, 1112, 'A black and white photo of an athlete resting between sets', 'U.S. Department of Defense', 'Public domain', 'Training'),
    ],
  },
  restaurant: {
    hero: C('f/f3/Restaurant_room_of_Amantaka_luxury_Resort_&_Hotel_in_Luang_Prabang_Laos.jpg', 6585, 4390, 'An elegant dining room with laid tables and warm light', 'Basile Morin', 'CC BY-SA 4.0', 'Restaurant room of Amantaka'),
    story: [
      C('2/2e/Waiter_serves_a_dish_to_a_diner_at_a_restaurant_during_evening_hours_with_people_seated_at_tables_nearby.jpg', 6048, 4024, 'A waiter serving a dish to a diner in the evening', 'Shixart1985', 'CC BY 2.0', 'Waiter serves a dish to a diner'),
      C('3/35/Dining_area,_Locale_Restaurant,_Hastings_Street,_Noosa_Heads.jpg', 4032, 3024, 'A bright dining room with white tablecloths', 'Kgbo', 'CC BY-SA 4.0', 'Dining area, Locale Restaurant'),
    ],
    gallery: [
      C("4/49/Chef's_special_fish_dish_at_a_restaurant.jpg", 3664, 2931, 'A plated fish dish', 'Prayitno', 'CC BY 2.0', "Chef's special fish dish"),
      C('9/94/Delicious_gourmet_dish_served_at_a_restaurant_highlighting_tender_meat_undefined.jpg', 4160, 6240, 'A gourmet meat dish, carefully plated', 'Shixart1985', 'CC BY 2.0', 'Gourmet dish'),
      C("6/64/Restaurant_R'Evolution,_New_Orleans_dish_2017.jpg", 2500, 1874, 'A refined plated dish with a dark sauce', 'Jeff Marquis', 'CC BY 2.0', "Restaurant R'Evolution dish"),
      C('4/41/Starter_dish_in_Turkey.jpg', 2560, 1920, 'A selection of small starter plates', 'E4024', 'CC BY-SA 4.0', 'Starter dish'),
      C('c/c6/Flickr_-_The_U.S._Army_-_Executive_chef.jpg', 2000, 3008, 'A chef finishing a plate in the kitchen', 'The U.S. Army', 'Public domain', 'Executive chef'),
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
