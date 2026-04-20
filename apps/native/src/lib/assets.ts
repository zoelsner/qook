// Static require() map for the 24 Seedream v2 meal images.
// require() must take literal strings — no dynamic concatenation.

export const seedMeals = {
  'adana-kebab': require('../../assets/meals-seed/v2/adana-kebab.png'),
  'beef-broccoli-stirfry': require('../../assets/meals-seed/v2/beef-broccoli-stirfry.png'),
  'black-bean-quesadilla': require('../../assets/meals-seed/v2/black-bean-quesadilla.png'),
  'chicken-tikka': require('../../assets/meals-seed/v2/chicken-tikka.png'),
  'egg-fried-rice': require('../../assets/meals-seed/v2/egg-fried-rice.png'),
  'fattoush-grilled-chicken': require('../../assets/meals-seed/v2/fattoush-grilled-chicken.png'),
  'garlic-butter-spaghetti': require('../../assets/meals-seed/v2/garlic-butter-spaghetti.png'),
  'gochujang-pork': require('../../assets/meals-seed/v2/gochujang-pork.png'),
  'greek-chicken-bowl': require('../../assets/meals-seed/v2/greek-chicken-bowl.png'),
  'greek-lemon-chicken-orzo': require('../../assets/meals-seed/v2/greek-lemon-chicken-orzo.png'),
  'lamb-chops-bulgur': require('../../assets/meals-seed/v2/lamb-chops-bulgur.png'),
  'menemen-sucuk': require('../../assets/meals-seed/v2/menemen-sucuk.png'),
  'miso-salmon': require('../../assets/meals-seed/v2/miso-salmon.png'),
  'mushroom-risotto': require('../../assets/meals-seed/v2/mushroom-risotto.png'),
  'peanut-noodles': require('../../assets/meals-seed/v2/peanut-noodles.png'),
  'salmon-poke-bowl': require('../../assets/meals-seed/v2/salmon-poke-bowl.png'),
  'shakshuka-merguez': require('../../assets/meals-seed/v2/shakshuka-merguez.png'),
  'sheet-pan-chicken': require('../../assets/meals-seed/v2/sheet-pan-chicken.png'),
  'shrimp-tacos': require('../../assets/meals-seed/v2/shrimp-tacos.png'),
  'steak-eggs-bowl': require('../../assets/meals-seed/v2/steak-eggs-bowl.png'),
  'tuna-melt': require('../../assets/meals-seed/v2/tuna-melt.png'),
  'turkey-chili': require('../../assets/meals-seed/v2/turkey-chili.png'),
  'turkey-meatballs': require('../../assets/meals-seed/v2/turkey-meatballs.png'),
  'white-bean-tuna-salad': require('../../assets/meals-seed/v2/white-bean-tuna-salad.png'),
} as const;

export type SeedMealKey = keyof typeof seedMeals;

export const defaultMealBlurhash = 'L9I|#~%L00oMxvIUxv%M_3xvxvIU';
