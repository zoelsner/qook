// Static require() map for the 24 Seedream v2 meal images.
// require() must take literal strings — no dynamic concatenation.

export const seedMeals = {
  'adana-kebab': require('../../assets/meals-seed/v2/adana-kebab.webp'),
  'beef-broccoli-stirfry': require('../../assets/meals-seed/v2/beef-broccoli-stirfry.webp'),
  'black-bean-quesadilla': require('../../assets/meals-seed/v2/black-bean-quesadilla.webp'),
  'chicken-tikka': require('../../assets/meals-seed/v2/chicken-tikka.webp'),
  'egg-fried-rice': require('../../assets/meals-seed/v2/egg-fried-rice.webp'),
  'fattoush-grilled-chicken': require('../../assets/meals-seed/v2/fattoush-grilled-chicken.webp'),
  'garlic-butter-spaghetti': require('../../assets/meals-seed/v2/garlic-butter-spaghetti.webp'),
  'gochujang-pork': require('../../assets/meals-seed/v2/gochujang-pork.webp'),
  'greek-chicken-bowl': require('../../assets/meals-seed/v2/greek-chicken-bowl.webp'),
  'greek-lemon-chicken-orzo': require('../../assets/meals-seed/v2/greek-lemon-chicken-orzo.webp'),
  'lamb-chops-bulgur': require('../../assets/meals-seed/v2/lamb-chops-bulgur.webp'),
  'menemen-sucuk': require('../../assets/meals-seed/v2/menemen-sucuk.webp'),
  'miso-salmon': require('../../assets/meals-seed/v2/miso-salmon.webp'),
  'mushroom-risotto': require('../../assets/meals-seed/v2/mushroom-risotto.webp'),
  'peanut-noodles': require('../../assets/meals-seed/v2/peanut-noodles.webp'),
  'salmon-poke-bowl': require('../../assets/meals-seed/v2/salmon-poke-bowl.webp'),
  'shakshuka-merguez': require('../../assets/meals-seed/v2/shakshuka-merguez.webp'),
  'sheet-pan-chicken': require('../../assets/meals-seed/v2/sheet-pan-chicken.webp'),
  'shrimp-tacos': require('../../assets/meals-seed/v2/shrimp-tacos.webp'),
  'steak-eggs-bowl': require('../../assets/meals-seed/v2/steak-eggs-bowl.webp'),
  'tuna-melt': require('../../assets/meals-seed/v2/tuna-melt.webp'),
  'turkey-chili': require('../../assets/meals-seed/v2/turkey-chili.webp'),
  'turkey-meatballs': require('../../assets/meals-seed/v2/turkey-meatballs.webp'),
  'white-bean-tuna-salad': require('../../assets/meals-seed/v2/white-bean-tuna-salad.webp'),
} as const;

export type SeedMealKey = keyof typeof seedMeals;

export const defaultMealBlurhash = 'L9I|#~%L00oMxvIUxv%M_3xvxvIU';
