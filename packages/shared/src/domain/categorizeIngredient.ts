import type { GroceryCategory } from '../types/primitives';

/**
 * Runtime ingredient categorizer — used as a fallback when Recipe ingredients
 * don't have a pre-computed `parsed.category` (mock fixtures, older cohort
 * rows, user-edited recipes, etc.).
 *
 * Rules are ordered; first match wins. Order matters because many tokens
 * collide across categories:
 *   - "chicken broth" → Pantry (broth beats chicken)
 *   - "frozen peas"   → Frozen (frozen beats peas)
 *   - "sour cream"    → Dairy  (cream beats nothing, but Dairy runs before Produce)
 *   - "black pepper"  → Pantry (pantry-specific pepper patterns beat the produce catch)
 *   - "bell pepper"   → Produce
 *
 * The patterns are tuned to the 24 mock recipes in
 * apps/native/src/services/fixtures/recipes.ts — they cover the common
 * American + East Asian + Mediterranean pantry and will misfile the odd
 * specialty ingredient into 'Other'. That's acceptable for v1; the Shop
 * screen always shows an 'Other' bucket at the end.
 */
const RULES: Array<{ cat: GroceryCategory; pattern: RegExp }> = [
  // ---- Top-priority disambiguators ----

  // Canned fish → Protein (must beat the generic `canned` pantry rule below)
  {
    cat: 'Protein',
    pattern: /\bcanned (?:tuna|salmon|sardines?|anchov(?:y|ies))\b/i,
  },

  // Pantry shelf-stable preparations that contain protein/produce words
  {
    cat: 'Pantry',
    pattern:
      /\b(broth|stock|tomato paste|tomato sauce|crushed tomato(?:es)?|diced tomato(?:es)?|fire-roasted|salsa|canned|coconut milk|peanut butter|molasses)\b/i,
  },

  // Pantry sauces/oils that contain protein-like tokens
  {
    cat: 'Pantry',
    pattern:
      /\b(soy sauce|fish sauce|oyster sauce|hoisin|worcestershire|sesame oil|olive oil|neutral oil|vegetable oil|tahini|mirin|shaoxing|sherry|sake|rice vinegar|red wine vinegar|white wine vinegar|apple cider vinegar|balsamic)\b/i,
  },

  // Pantry spice forms that contain produce-like tokens
  {
    cat: 'Pantry',
    pattern:
      /\b(black pepper|white pepper|chili (?:flakes?|powder|pepper)|red pepper flakes?|cayenne|smoked paprika|aleppo|urfa|garlic powder|onion powder|dried oregano|dried thyme|dried basil|italian seasoning|garam masala|kashmiri)\b/i,
  },

  // ---- Frozen (before produce/protein so 'frozen peas' wins, edamame lands here) ----
  { cat: 'Frozen', pattern: /\bfrozen\b|\bedamame\b/i },

  // ---- Dairy ----
  {
    cat: 'Dairy',
    pattern:
      /\b(milk|butter|yogurt|greek yogurt|feta|parmesan|cheddar|monterey jack|mozzarella|ricotta|mayo|mayonnaise|sour cream|cream cheese|heavy cream|half-and-half|cheese)\b/i,
  },

  // ---- Bakery ----
  {
    cat: 'Bakery',
    pattern:
      /\b(bread|pita|tortillas?|lavash|naan|sourdough|rye|brioche|baguette|crusty)\b/i,
  },

  // ---- Protein ----
  {
    cat: 'Protein',
    pattern:
      /\b(chicken|beef|pork|lamb|turkey|salmon|tuna|shrimp|fish fillet|cod|halibut|sucuk|merguez|sausage|chorizo|bacon|prosciutto|hanger|flank|steak|tofu|tempeh|eggs?|black beans|kidney beans|cannellini|chickpeas?|lentils?)\b/i,
  },

  // ---- Produce (fruits, veggies, fresh herbs) ----
  {
    cat: 'Produce',
    pattern:
      /\b(lemons?|limes?|oranges?|apples?|pears?|bananas?|berry|berries|strawberr(?:y|ies)|blueberr(?:y|ies)|avocados?|tomato(?:es)?|cucumbers?|english cucumber|persian cucumber|onions?|red onion|yellow onion|scallions?|shallots?|garlic|ginger|bell pepper|green pepper|red pepper|jalape(?:n|ñ)os?|serranos?|poblanos?|cilantro|parsley|flat-leaf parsley|basil|fresh basil|mint|dill|rosemary|sage|thyme|chives?|lettuce|romaine|spinach|kale|arugula|cabbage|broccoli|cauliflower|zucchini|eggplant|carrots?|celery|mushrooms?|cremini|shiitake|portobello|radish|potato(?:es)?|sweet potato(?:es)?|yam|corn|peas|asparagus|olives?|kalamata|romano)\b/i,
  },

  // ---- Pantry (general dry goods, grains, spices, sweeteners) ----
  {
    cat: 'Pantry',
    pattern:
      /\b(rice|arborio|carnaroli|basmati|jasmine|short-grain|noodles?|pasta|spaghetti|orzo|bulgur|couscous|quinoa|farro|panko|breadcrumbs?|flour|sugar|brown sugar|honey|maple|salt|kosher salt|flaky salt|vinegar|oil|cumin|paprika|oregano|cinnamon|nutmeg|allspice|cardamom|sumac|coriander|turmeric|gochujang|miso|kimchi|nori|sesame|harissa|sriracha|cornstarch|baking (?:powder|soda)|yeast|mustard|dijon|chili|cayenne|wine|beans?|legumes?|pine nuts?|walnuts?|almonds?|cashews?|pecans?|hazelnuts?|pistachios?)\b/i,
  },
];

export function categorizeIngredient(name: string): GroceryCategory {
  const normalized = name.trim();
  if (!normalized) return 'Other';
  for (const { cat, pattern } of RULES) {
    if (pattern.test(normalized)) return cat;
  }
  return 'Other';
}
