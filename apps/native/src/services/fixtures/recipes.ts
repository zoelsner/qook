import type { Recipe, Timestamp } from '@qook/shared';

const now = Date.now() as Timestamp;

export const mockRecipes: Recipe[] = [
  {
    id: 'rec_001',
    slug: 'miso-salmon-bowl',
    signature: 'mock-sig-001',
    title: 'Miso Salmon Bowl',
    cuisine: 'Japanese',
    tier: 'after-work',
    tags: ['bowl', 'fish'],
    dietaryTags: ['pescatarian', 'dairy-free'],
    timeMinutes: 25,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'salmon fillet', quantity: '8 oz' },
          { item: 'short-grain rice', quantity: '1 cup' },
          { item: 'miso paste', quantity: '2 tbsp' },
          { item: 'mirin', quantity: '1 tbsp' },
          { item: 'soy sauce', quantity: '1 tbsp' },
        ],
      },
      {
        title: 'Side',
        role: 'side',
        items: [
          { item: 'cucumber', quantity: '1' },
          { item: 'rice vinegar', quantity: '2 tsp' },
          { item: 'sesame seeds', quantity: '1 tsp' },
        ],
      },
    ],
    steps: [
      {
        title: 'Cook rice',
        objective: 'Get rice steaming first so it finishes with the salmon.',
        steps: [
          {
            instruction: 'Rinse rice twice, then cook per package instructions.',
            durationMin: 2,
          },
        ],
      },
      {
        title: 'Glaze and broil salmon',
        objective: 'Build the miso glaze and get caramelization on top.',
        steps: [
          {
            instruction: 'Whisk miso, mirin, and soy until smooth.',
            durationMin: 2,
          },
          {
            instruction: 'Brush onto salmon; broil on high for 7-8 minutes until lacquered.',
            durationMin: 8,
          },
        ],
      },
      {
        title: 'Cucumber finish',
        objective: 'Quick vinegar cucumber while salmon broils.',
        steps: [
          {
            instruction: 'Thin-slice cucumber, toss with rice vinegar and a pinch of salt.',
            durationMin: 3,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Start rice.', sectionTitle: 'Cook rice' },
      { atMin: 2, instruction: 'Whisk glaze.', sectionTitle: 'Glaze and broil salmon' },
      { atMin: 4, instruction: 'Broil salmon.', sectionTitle: 'Glaze and broil salmon' },
      { atMin: 12, instruction: 'Dress cucumber.', sectionTitle: 'Cucumber finish' },
    ],
    notes:
      'Miso Salmon Bowl is a Japanese dish built for bold flavor and a satisfying finish.',
    localImageKey: 'miso-salmon',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_002',
    slug: 'sheet-pan-chicken-and-vegetables',
    signature: 'mock-sig-002',
    title: 'Sheet Pan Chicken and Vegetables',
    cuisine: 'Mediterranean',
    tier: 'got-energy',
    tags: ['sheet-pan', 'one-pan'],
    dietaryTags: ['gluten-free', 'dairy-free', 'high-protein'],
    timeMinutes: 40,
    servings: 4,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'bone-in chicken thighs', quantity: '2 lb' },
          { item: 'olive oil', quantity: '3 tbsp' },
          { item: 'lemon', quantity: '1' },
          { item: 'garlic', quantity: '4 cloves' },
          { item: 'oregano', quantity: '1 tbsp' },
        ],
      },
      {
        title: 'Side',
        role: 'side',
        items: [
          { item: 'baby potatoes', quantity: '1 lb' },
          { item: 'red onion', quantity: '1' },
          { item: 'bell pepper', quantity: '2' },
        ],
      },
    ],
    steps: [
      {
        title: 'Prep and marinate',
        objective: 'Season chicken and cut vegetables so the tray goes in together.',
        steps: [
          {
            instruction:
              'Toss chicken with olive oil, lemon juice, minced garlic, oregano, salt, and pepper.',
            durationMin: 8,
          },
          {
            instruction: 'Halve potatoes; wedge onion; slice peppers.',
            durationMin: 5,
          },
        ],
      },
      {
        title: 'Roast',
        objective: 'One tray, hot oven, minimal babysitting.',
        steps: [
          {
            instruction:
              'Spread chicken skin-up over the vegetables on a sheet pan. Roast at 425F for 25 minutes until chicken reads 165F and skin is crisp.',
            durationMin: 25,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Marinate chicken.', sectionTitle: 'Prep and marinate' },
      { atMin: 8, instruction: 'Cut vegetables.', sectionTitle: 'Prep and marinate' },
      { atMin: 13, instruction: 'Roast at 425F.', sectionTitle: 'Roast' },
    ],
    notes: 'A hands-off Mediterranean sheet-pan dinner with crisp skin and caramelized edges.',
    localImageKey: 'sheet-pan-chicken',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_003',
    slug: 'peanut-noodles',
    signature: 'mock-sig-003',
    title: 'Peanut Noodles',
    cuisine: 'Thai',
    tier: 'brain-is-fried',
    tags: ['noodles', 'no-cook'],
    dietaryTags: ['vegetarian', 'dairy-free'],
    timeMinutes: 15,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'rice noodles', quantity: '8 oz' },
          { item: 'peanut butter', quantity: '1/3 cup' },
          { item: 'soy sauce', quantity: '3 tbsp' },
          { item: 'lime', quantity: '1' },
          { item: 'honey', quantity: '1 tbsp' },
        ],
      },
      {
        title: 'Side',
        role: 'side',
        items: [
          { item: 'cucumber', quantity: '1' },
          { item: 'scallion', quantity: '3' },
          { item: 'cilantro', quantity: '1/4 cup' },
        ],
      },
    ],
    steps: [
      {
        title: 'Cook noodles',
        objective: 'Boil water, cook noodles to just-tender.',
        steps: [
          {
            instruction: 'Cook rice noodles per package, drain, rinse cold.',
            durationMin: 6,
          },
        ],
      },
      {
        title: 'Build sauce and toss',
        objective: 'Whisk sauce, toss with noodles and vegetables.',
        steps: [
          {
            instruction:
              'Whisk peanut butter, soy, lime juice, and honey with 2 tbsp hot water until pourable.',
            durationMin: 3,
          },
          {
            instruction:
              'Toss noodles with sauce, sliced cucumber, scallions, and torn cilantro.',
            durationMin: 4,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Boil water.', sectionTitle: 'Cook noodles' },
      { atMin: 6, instruction: 'Whisk sauce.', sectionTitle: 'Build sauce and toss' },
      { atMin: 9, instruction: 'Toss and serve.', sectionTitle: 'Build sauce and toss' },
    ],
    notes:
      'Fifteen-minute Thai-inspired peanut noodles - the lowest-effort weeknight dinner in the book.',
    localImageKey: 'peanut-noodles',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },

  // ──────────────────────────────────────────────────────────────────────
  // brain-is-fried (≤15m)
  // ──────────────────────────────────────────────────────────────────────
  {
    id: 'rec_004',
    slug: 'egg-fried-rice',
    signature: 'mock-sig-004',
    title: 'Egg Fried Rice',
    cuisine: 'Chinese',
    tier: 'brain-is-fried',
    tags: ['rice', 'one-pan'],
    dietaryTags: ['vegetarian'],
    timeMinutes: 12,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'day-old cooked rice', quantity: '3 cups' },
          { item: 'eggs', quantity: '3' },
          { item: 'scallion', quantity: '3' },
          { item: 'soy sauce', quantity: '2 tbsp' },
          { item: 'toasted sesame oil', quantity: '1 tsp' },
          { item: 'neutral oil', quantity: '2 tbsp' },
        ],
      },
      {
        title: 'Aromatics',
        role: 'other',
        items: [
          { item: 'garlic', quantity: '2 cloves' },
          { item: 'frozen peas', quantity: '1/2 cup' },
        ],
      },
    ],
    steps: [
      {
        title: 'Scramble eggs',
        objective: 'Quick soft scramble, set aside.',
        steps: [
          {
            instruction:
              'Heat 1 tbsp oil in a wok or large skillet over high. Scramble beaten eggs until just set, about 60 seconds. Scrape out.',
            durationMin: 2,
          },
        ],
      },
      {
        title: 'Fry rice',
        objective: 'Blast heat until grains separate and edges crisp.',
        steps: [
          {
            instruction:
              'Add 1 tbsp oil plus garlic to the hot pan; stir 20 seconds until fragrant.',
            durationMin: 1,
          },
          {
            instruction:
              'Add rice, break up clumps, and stir-fry over high heat until grains loosen and pick up some color, 4 minutes.',
            durationMin: 4,
          },
          {
            instruction:
              'Return eggs, add peas, soy, and sesame oil; toss 2 minutes until peas are hot. Finish with sliced scallion.',
            durationMin: 2,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Heat pan; scramble eggs.', sectionTitle: 'Scramble eggs' },
      { atMin: 2, instruction: 'Garlic in pan.', sectionTitle: 'Fry rice' },
      { atMin: 3, instruction: 'Fry rice on high.', sectionTitle: 'Fry rice' },
      { atMin: 7, instruction: 'Add eggs, peas, soy, sesame.', sectionTitle: 'Fry rice' },
    ],
    notes: 'Takeout-style fried rice; day-old rice is the single non-negotiable.',
    localImageKey: 'egg-fried-rice',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_005',
    slug: 'tuna-melt',
    signature: 'mock-sig-005',
    title: 'Tuna Melt',
    cuisine: 'American',
    tier: 'brain-is-fried',
    tags: ['sandwich', 'toaster'],
    dietaryTags: ['pescatarian', 'high-protein'],
    timeMinutes: 12,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'canned tuna in oil', quantity: '2 cans (5 oz each)' },
          { item: 'mayo', quantity: '3 tbsp' },
          { item: 'dijon mustard', quantity: '1 tsp' },
          { item: 'celery', quantity: '1 stalk' },
          { item: 'red onion', quantity: '2 tbsp, minced' },
          { item: 'lemon', quantity: '1/2' },
        ],
      },
      {
        title: 'Build',
        role: 'other',
        items: [
          { item: 'sourdough or rye', quantity: '4 slices' },
          { item: 'sharp cheddar', quantity: '4 oz' },
          { item: 'butter', quantity: '2 tbsp' },
        ],
      },
    ],
    steps: [
      {
        title: 'Mix tuna salad',
        objective: 'Bright, not drowned in mayo.',
        steps: [
          {
            instruction:
              'Drain tuna, flake into a bowl, mix with mayo, dijon, minced celery, onion, and a squeeze of lemon. Salt to taste.',
            durationMin: 4,
          },
        ],
      },
      {
        title: 'Melt and toast',
        objective: 'Golden bread, bubbling cheese.',
        steps: [
          {
            instruction:
              'Butter one side of each bread slice. Build sandwiches butter-out with tuna and cheddar.',
            durationMin: 2,
          },
          {
            instruction:
              'Griddle over medium 3 minutes per side until deep golden and cheese melts through.',
            durationMin: 6,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Mix tuna salad.', sectionTitle: 'Mix tuna salad' },
      { atMin: 4, instruction: 'Build sandwiches.', sectionTitle: 'Melt and toast' },
      { atMin: 6, instruction: 'Griddle, flip at 9m.', sectionTitle: 'Melt and toast' },
    ],
    notes: 'Diner-style tuna melt - crunch, melt, lemon.',
    localImageKey: 'tuna-melt',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_006',
    slug: 'white-bean-tuna-salad',
    signature: 'mock-sig-006',
    title: 'White Bean and Tuna Salad',
    cuisine: 'Mediterranean',
    tier: 'brain-is-fried',
    tags: ['no-cook', 'pantry'],
    dietaryTags: ['pescatarian', 'gluten-free', 'dairy-free', 'high-protein'],
    timeMinutes: 10,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'canned tuna in olive oil', quantity: '2 cans (5 oz each)' },
          { item: 'cannellini beans', quantity: '1 can (15 oz)' },
          { item: 'cherry tomatoes', quantity: '1 cup' },
          { item: 'red onion', quantity: '1/4' },
          { item: 'flat-leaf parsley', quantity: '1/4 cup' },
        ],
      },
      {
        title: 'Dressing',
        role: 'sauce',
        items: [
          { item: 'lemon', quantity: '1' },
          { item: 'extra-virgin olive oil', quantity: '3 tbsp' },
          { item: 'red wine vinegar', quantity: '1 tsp' },
          { item: 'flaky salt + black pepper', quantity: 'to taste' },
        ],
      },
    ],
    steps: [
      {
        title: 'Assemble',
        objective: 'No cooking, just layering and dressing.',
        steps: [
          {
            instruction:
              'Drain and rinse beans. Halve tomatoes. Thin-slice onion and soak in cold water 2 minutes to tame bite.',
            durationMin: 4,
          },
          {
            instruction:
              'Flake tuna over beans. Add tomatoes, drained onion, torn parsley. Whisk lemon juice, oil, vinegar; pour over. Toss gently.',
            durationMin: 4,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Prep onion, tomatoes, beans.', sectionTitle: 'Assemble' },
      { atMin: 4, instruction: 'Dress and toss.', sectionTitle: 'Assemble' },
    ],
    notes: 'Pantry salad that eats like a full meal - protein + fiber + brightness.',
    localImageKey: 'white-bean-tuna-salad',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_007',
    slug: 'garlic-butter-spaghetti',
    signature: 'mock-sig-007',
    title: 'Garlic Butter Spaghetti',
    cuisine: 'Italian',
    tier: 'brain-is-fried',
    tags: ['pasta', 'pantry'],
    dietaryTags: ['vegetarian'],
    timeMinutes: 15,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'spaghetti', quantity: '8 oz' },
          { item: 'butter', quantity: '4 tbsp' },
          { item: 'garlic', quantity: '5 cloves' },
          { item: 'parmesan, grated', quantity: '1/2 cup' },
          { item: 'chili flakes', quantity: '1/4 tsp' },
          { item: 'flat-leaf parsley', quantity: '2 tbsp' },
        ],
      },
    ],
    steps: [
      {
        title: 'Boil pasta',
        objective: 'Salt the water like the sea.',
        steps: [
          {
            instruction:
              'Boil generously salted water. Cook spaghetti 1 minute short of package time; reserve 1 cup pasta water before draining.',
            durationMin: 9,
          },
        ],
      },
      {
        title: 'Build sauce',
        objective: 'Bloom garlic in butter, emulsify with pasta water.',
        steps: [
          {
            instruction:
              'While pasta cooks, melt butter in a wide skillet over low. Add thin-sliced garlic and chili flakes; cook 2 minutes until fragrant, not browned.',
            durationMin: 2,
          },
          {
            instruction:
              'Add drained pasta + 1/2 cup pasta water and parmesan to skillet. Toss hard for 60 seconds until glossy. Splash more water if tight.',
            durationMin: 2,
          },
          {
            instruction: 'Finish with torn parsley and black pepper.',
            durationMin: 1,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Boil pasta.', sectionTitle: 'Boil pasta' },
      { atMin: 7, instruction: 'Bloom garlic in butter.', sectionTitle: 'Build sauce' },
      { atMin: 9, instruction: 'Drain; toss with butter sauce.', sectionTitle: 'Build sauce' },
      { atMin: 11, instruction: 'Parsley, pepper, plate.', sectionTitle: 'Build sauce' },
    ],
    notes: 'The pasta you make when the fridge is empty and you still need dinner.',
    localImageKey: 'garlic-butter-spaghetti',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_008',
    slug: 'black-bean-quesadilla',
    signature: 'mock-sig-008',
    title: 'Black Bean Quesadilla',
    cuisine: 'Mexican',
    tier: 'brain-is-fried',
    tags: ['one-pan', 'vegetarian'],
    dietaryTags: ['vegetarian'],
    timeMinutes: 12,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'black beans', quantity: '1 can (15 oz)' },
          { item: 'flour tortillas', quantity: '4 (10-inch)' },
          { item: 'monterey jack', quantity: '2 cups, shredded' },
          { item: 'cumin', quantity: '1 tsp' },
          { item: 'smoked paprika', quantity: '1/2 tsp' },
          { item: 'scallion', quantity: '3' },
        ],
      },
      {
        title: 'Top',
        role: 'garnish',
        items: [
          { item: 'sour cream or yogurt', quantity: '1/4 cup' },
          { item: 'salsa', quantity: '1/2 cup' },
          { item: 'lime', quantity: '1' },
        ],
      },
    ],
    steps: [
      {
        title: 'Warm and mash beans',
        objective: 'Seasoned bean layer, thick enough to hold.',
        steps: [
          {
            instruction:
              'Drain beans; warm in a skillet with cumin, smoked paprika, and 2 tbsp water. Mash roughly with a fork. Salt to taste.',
            durationMin: 4,
          },
        ],
      },
      {
        title: 'Fold and crisp',
        objective: 'Golden tortilla, oozy cheese pull.',
        steps: [
          {
            instruction:
              'Wipe pan, set medium heat. Place tortilla, scatter cheese and beans over half, top with sliced scallion; fold.',
            durationMin: 2,
          },
          {
            instruction:
              'Toast 2 minutes per side until tortilla is deeply golden and cheese melts. Repeat with second.',
            durationMin: 5,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Warm beans with spices.', sectionTitle: 'Warm and mash beans' },
      { atMin: 4, instruction: 'Build first quesadilla.', sectionTitle: 'Fold and crisp' },
      { atMin: 6, instruction: 'Toast, flip.', sectionTitle: 'Fold and crisp' },
      { atMin: 10, instruction: 'Second quesadilla.', sectionTitle: 'Fold and crisp' },
    ],
    notes: 'Crisp-edged, smoky, with enough bean mash to actually fill you up.',
    localImageKey: 'black-bean-quesadilla',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },

  // ──────────────────────────────────────────────────────────────────────
  // after-work (≤30m)
  // ──────────────────────────────────────────────────────────────────────
  {
    id: 'rec_009',
    slug: 'beef-broccoli-stirfry',
    signature: 'mock-sig-009',
    title: 'Beef and Broccoli Stir-Fry',
    cuisine: 'Chinese',
    tier: 'after-work',
    tags: ['stir-fry', 'one-pan'],
    dietaryTags: ['dairy-free', 'high-protein'],
    timeMinutes: 25,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'flank steak', quantity: '12 oz' },
          { item: 'broccoli florets', quantity: '4 cups' },
          { item: 'jasmine rice', quantity: '1 cup' },
          { item: 'neutral oil', quantity: '2 tbsp' },
          { item: 'ginger', quantity: '1 tbsp, grated' },
          { item: 'garlic', quantity: '3 cloves' },
        ],
      },
      {
        title: 'Sauce',
        role: 'sauce',
        items: [
          { item: 'soy sauce', quantity: '3 tbsp' },
          { item: 'oyster sauce', quantity: '2 tbsp' },
          { item: 'shaoxing wine or dry sherry', quantity: '1 tbsp' },
          { item: 'brown sugar', quantity: '1 tsp' },
          { item: 'cornstarch', quantity: '1 tbsp' },
        ],
      },
    ],
    steps: [
      {
        title: 'Rice + prep',
        objective: 'Rice on first, everything else sliced thin.',
        steps: [
          {
            instruction:
              'Start rice per package. Slice steak thin against the grain. Toss with 1 tbsp soy and 1 tsp cornstarch; rest 10 min.',
            durationMin: 3,
          },
          {
            instruction: 'Whisk remaining sauce ingredients with 1/3 cup water.',
            durationMin: 2,
          },
        ],
      },
      {
        title: 'Stir-fry',
        objective: 'Sear beef, steam-fry broccoli, combine.',
        steps: [
          {
            instruction:
              'Blanch broccoli 90 seconds in boiling water; drain. Heat wok or skillet ripping hot with 1 tbsp oil.',
            durationMin: 4,
          },
          {
            instruction:
              'Sear beef in one layer 60 seconds, flip 30 seconds; remove. Add ginger and garlic; 20 seconds.',
            durationMin: 3,
          },
          {
            instruction:
              'Return beef with broccoli and sauce; toss 90 seconds until glossy and thickened.',
            durationMin: 2,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Rice on.', sectionTitle: 'Rice + prep' },
      { atMin: 3, instruction: 'Marinate beef; whisk sauce.', sectionTitle: 'Rice + prep' },
      { atMin: 13, instruction: 'Blanch broccoli, heat wok.', sectionTitle: 'Stir-fry' },
      { atMin: 17, instruction: 'Sear beef.', sectionTitle: 'Stir-fry' },
      { atMin: 20, instruction: 'Combine with sauce.', sectionTitle: 'Stir-fry' },
    ],
    notes: 'Takeout-better beef and broccoli in one pan with a glossy sauce.',
    localImageKey: 'beef-broccoli-stirfry',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_010',
    slug: 'shrimp-tacos',
    signature: 'mock-sig-010',
    title: 'Chili-Lime Shrimp Tacos',
    cuisine: 'Mexican',
    tier: 'after-work',
    tags: ['tacos', 'fast'],
    dietaryTags: ['pescatarian', 'dairy-free', 'high-protein'],
    timeMinutes: 25,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'large shrimp, peeled', quantity: '1 lb' },
          { item: 'chili powder', quantity: '1 tbsp' },
          { item: 'cumin', quantity: '1 tsp' },
          { item: 'smoked paprika', quantity: '1 tsp' },
          { item: 'lime', quantity: '2' },
          { item: 'neutral oil', quantity: '1 tbsp' },
        ],
      },
      {
        title: 'Slaw',
        role: 'side',
        items: [
          { item: 'green cabbage, shredded', quantity: '2 cups' },
          { item: 'cilantro', quantity: '1/4 cup' },
          { item: 'jalapeno, thin-sliced', quantity: '1' },
          { item: 'mayo or yogurt', quantity: '3 tbsp' },
        ],
      },
      {
        title: 'Wrap',
        role: 'other',
        items: [
          { item: 'corn tortillas', quantity: '6 (6-inch)' },
          { item: 'avocado', quantity: '1' },
        ],
      },
    ],
    steps: [
      {
        title: 'Season shrimp and slaw',
        objective: 'Build flavor while the pan heats.',
        steps: [
          {
            instruction:
              'Pat shrimp dry; toss with oil, chili powder, cumin, paprika, juice of 1 lime, salt.',
            durationMin: 4,
          },
          {
            instruction:
              'Mix cabbage, cilantro, jalapeno, mayo, juice of 1/2 lime, pinch salt. Set aside.',
            durationMin: 4,
          },
        ],
      },
      {
        title: 'Sear and wrap',
        objective: 'Shrimp cooks fast; char tortillas while you plate.',
        steps: [
          {
            instruction:
              'Heat a dry skillet hot. Sear shrimp in a single layer 90 seconds, flip 60 seconds until just opaque.',
            durationMin: 3,
          },
          {
            instruction: 'Char tortillas 30 sec per side over open flame or dry pan.',
            durationMin: 4,
          },
          {
            instruction:
              'Build: tortilla + slaw + shrimp + sliced avocado + lime squeeze.',
            durationMin: 4,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Season shrimp.', sectionTitle: 'Season shrimp and slaw' },
      { atMin: 4, instruction: 'Mix slaw.', sectionTitle: 'Season shrimp and slaw' },
      { atMin: 12, instruction: 'Sear shrimp.', sectionTitle: 'Sear and wrap' },
      { atMin: 15, instruction: 'Char tortillas.', sectionTitle: 'Sear and wrap' },
      { atMin: 19, instruction: 'Build tacos.', sectionTitle: 'Sear and wrap' },
    ],
    notes: 'Bright, smoky shrimp tacos with a creamy-crunchy slaw in under 30.',
    localImageKey: 'shrimp-tacos',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_011',
    slug: 'turkey-meatballs',
    signature: 'mock-sig-011',
    title: 'Turkey Meatballs with Marinara',
    cuisine: 'Italian-American',
    tier: 'after-work',
    tags: ['meatballs', 'pasta-friendly'],
    dietaryTags: ['high-protein'],
    timeMinutes: 30,
    servings: 4,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Meatballs',
        role: 'main',
        items: [
          { item: 'ground turkey, 93/7', quantity: '1 lb' },
          { item: 'panko', quantity: '1/2 cup' },
          { item: 'milk', quantity: '1/4 cup' },
          { item: 'egg', quantity: '1' },
          { item: 'parmesan, grated', quantity: '1/3 cup' },
          { item: 'garlic', quantity: '2 cloves' },
          { item: 'italian seasoning', quantity: '1 tbsp' },
        ],
      },
      {
        title: 'Sauce',
        role: 'sauce',
        items: [
          { item: 'crushed tomatoes', quantity: '1 can (28 oz)' },
          { item: 'olive oil', quantity: '2 tbsp' },
          { item: 'garlic', quantity: '3 cloves' },
          { item: 'red pepper flakes', quantity: '1/2 tsp' },
          { item: 'fresh basil', quantity: '1/4 cup' },
        ],
      },
    ],
    steps: [
      {
        title: 'Mix and form',
        objective: 'Panko + milk = tender meatballs.',
        steps: [
          {
            instruction:
              'Soak panko in milk 2 minutes. Combine with turkey, egg, parmesan, grated garlic, seasoning, 1 tsp salt. Form 16 meatballs.',
            durationMin: 8,
          },
        ],
      },
      {
        title: 'Build sauce, simmer',
        objective: 'Quick tomato sauce; meatballs finish in it.',
        steps: [
          {
            instruction:
              'Heat olive oil medium in a wide pot. Sliver garlic, add with pepper flakes; sizzle 60 seconds.',
            durationMin: 2,
          },
          {
            instruction:
              'Pour in crushed tomatoes, 1 tsp salt. Simmer 5 minutes to take off raw edge.',
            durationMin: 5,
          },
          {
            instruction:
              'Nestle meatballs in sauce, cover, simmer 12 minutes until cooked through (165F). Tear basil over.',
            durationMin: 12,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Mix meatball mixture.', sectionTitle: 'Mix and form' },
      { atMin: 8, instruction: 'Sweat garlic in oil.', sectionTitle: 'Build sauce, simmer' },
      { atMin: 10, instruction: 'Add tomatoes, simmer.', sectionTitle: 'Build sauce, simmer' },
      { atMin: 15, instruction: 'Add meatballs, cover.', sectionTitle: 'Build sauce, simmer' },
    ],
    notes: 'Tender turkey meatballs that poach in marinara - no-fry, still deeply flavorful.',
    localImageKey: 'turkey-meatballs',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_012',
    slug: 'gochujang-pork',
    signature: 'mock-sig-012',
    title: 'Gochujang Pork over Rice',
    cuisine: 'Korean',
    tier: 'after-work',
    tags: ['rice-bowl', 'spicy'],
    dietaryTags: ['dairy-free', 'high-protein'],
    timeMinutes: 25,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'ground pork', quantity: '1 lb' },
          { item: 'jasmine rice', quantity: '1 cup' },
          { item: 'gochujang', quantity: '3 tbsp' },
          { item: 'soy sauce', quantity: '2 tbsp' },
          { item: 'brown sugar', quantity: '1 tbsp' },
          { item: 'ginger', quantity: '1 tbsp, grated' },
          { item: 'garlic', quantity: '3 cloves' },
          { item: 'sesame oil', quantity: '1 tsp' },
        ],
      },
      {
        title: 'Top',
        role: 'garnish',
        items: [
          { item: 'egg', quantity: '2' },
          { item: 'scallion', quantity: '3' },
          { item: 'toasted sesame seeds', quantity: '1 tsp' },
          { item: 'cucumber', quantity: '1' },
        ],
      },
    ],
    steps: [
      {
        title: 'Rice + sauce',
        objective: 'Start rice; mix the glaze.',
        steps: [
          {
            instruction:
              'Start rice per package. Whisk gochujang, soy, sugar, ginger, garlic, sesame oil, 2 tbsp water.',
            durationMin: 4,
          },
        ],
      },
      {
        title: 'Sear pork, fry eggs',
        objective: 'Crispy pork edges + runny yolk.',
        steps: [
          {
            instruction:
              'Heat a dry skillet high. Brown pork hard, breaking up into clumps, 6 minutes until edges crisp.',
            durationMin: 6,
          },
          {
            instruction: 'Pour in sauce; bubble 2 minutes until it clings to the pork.',
            durationMin: 2,
          },
          {
            instruction: 'In a second pan, fry eggs sunny-side-up in 1 tbsp oil.',
            durationMin: 3,
          },
          {
            instruction:
              'Plate: rice, pork, egg on top, sliced cucumber on the side, scallion and sesame scatter.',
            durationMin: 3,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Rice on; whisk sauce.', sectionTitle: 'Rice + sauce' },
      { atMin: 12, instruction: 'Sear pork.', sectionTitle: 'Sear pork, fry eggs' },
      { atMin: 18, instruction: 'Glaze with sauce.', sectionTitle: 'Sear pork, fry eggs' },
      { atMin: 20, instruction: 'Fry eggs.', sectionTitle: 'Sear pork, fry eggs' },
      { atMin: 22, instruction: 'Plate and garnish.', sectionTitle: 'Sear pork, fry eggs' },
    ],
    notes:
      'Sweet-spicy-savory pork over rice - the bowl that makes a weeknight feel intentional.',
    localImageKey: 'gochujang-pork',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_013',
    slug: 'turkey-chili',
    signature: 'mock-sig-013',
    title: 'Weeknight Turkey Chili',
    cuisine: 'American',
    tier: 'after-work',
    tags: ['one-pot', 'cozy'],
    dietaryTags: ['gluten-free', 'dairy-free', 'high-protein'],
    timeMinutes: 30,
    servings: 4,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'ground turkey', quantity: '1.5 lb' },
          { item: 'yellow onion', quantity: '1' },
          { item: 'garlic', quantity: '4 cloves' },
          { item: 'kidney beans', quantity: '1 can (15 oz)' },
          { item: 'black beans', quantity: '1 can (15 oz)' },
          { item: 'fire-roasted diced tomatoes', quantity: '1 can (28 oz)' },
          { item: 'tomato paste', quantity: '2 tbsp' },
        ],
      },
      {
        title: 'Spices',
        role: 'other',
        items: [
          { item: 'chili powder', quantity: '2 tbsp' },
          { item: 'cumin', quantity: '1 tbsp' },
          { item: 'smoked paprika', quantity: '1 tsp' },
          { item: 'oregano', quantity: '1 tsp' },
          { item: 'chicken broth', quantity: '1 cup' },
        ],
      },
    ],
    steps: [
      {
        title: 'Brown and build',
        objective: 'Deep fond, toasted spices, rich base.',
        steps: [
          {
            instruction:
              'Heat 1 tbsp oil in a dutch oven over medium-high. Brown turkey hard, 6 minutes, breaking up.',
            durationMin: 6,
          },
          {
            instruction: 'Add diced onion + garlic, cook 3 minutes until soft.',
            durationMin: 3,
          },
          {
            instruction: 'Stir in tomato paste and spices, toast 60 seconds.',
            durationMin: 1,
          },
        ],
      },
      {
        title: 'Simmer',
        objective: 'Thicken to spoon-able.',
        steps: [
          {
            instruction:
              'Add tomatoes, drained beans, broth, 1 tsp salt. Bring to simmer; cook uncovered 15 minutes, stirring, until thickened.',
            durationMin: 15,
          },
          {
            instruction: 'Taste, adjust salt and heat. Serve with your favorite toppers.',
            durationMin: 1,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Brown turkey.', sectionTitle: 'Brown and build' },
      { atMin: 6, instruction: 'Sweat onion, garlic.', sectionTitle: 'Brown and build' },
      { atMin: 9, instruction: 'Toast tomato paste + spices.', sectionTitle: 'Brown and build' },
      { atMin: 10, instruction: 'Add tomatoes + beans + broth; simmer.', sectionTitle: 'Simmer' },
    ],
    notes: 'A deeply spiced 30-minute chili that tastes like it simmered all afternoon.',
    localImageKey: 'turkey-chili',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_014',
    slug: 'menemen-sucuk',
    signature: 'mock-sig-014',
    title: 'Menemen with Sucuk',
    cuisine: 'Turkish',
    tier: 'after-work',
    tags: ['eggs', 'skillet'],
    dietaryTags: ['gluten-free', 'high-protein'],
    timeMinutes: 20,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'sucuk (turkish garlic sausage), sliced', quantity: '6 oz' },
          { item: 'eggs', quantity: '4' },
          { item: 'ripe tomatoes', quantity: '3' },
          { item: 'green bell pepper or romano', quantity: '2' },
          { item: 'yellow onion', quantity: '1/2' },
          { item: 'olive oil', quantity: '2 tbsp' },
          { item: 'aleppo pepper', quantity: '1 tsp' },
        ],
      },
      {
        title: 'Serve',
        role: 'garnish',
        items: [
          { item: 'flat-leaf parsley', quantity: '2 tbsp' },
          { item: 'feta, crumbled', quantity: '1/4 cup' },
          { item: 'crusty bread', quantity: 'to serve' },
        ],
      },
    ],
    steps: [
      {
        title: 'Crisp sucuk, build base',
        objective: 'Render spicy fat, then soften the vegetables in it.',
        steps: [
          {
            instruction:
              'Render sucuk in a dry skillet over medium 3 minutes until edges crisp; scoop out, leaving rendered fat.',
            durationMin: 3,
          },
          {
            instruction:
              'Add olive oil, diced onion, sliced peppers; cook 5 minutes until soft.',
            durationMin: 5,
          },
          {
            instruction:
              'Grate tomatoes on a box grater into the pan (discard skins). Add aleppo + 1/2 tsp salt; simmer 5 minutes to thicken.',
            durationMin: 5,
          },
        ],
      },
      {
        title: 'Fold in eggs',
        objective: 'Soft curds; do NOT scramble tight.',
        steps: [
          {
            instruction:
              'Return sucuk. Crack in eggs and stir gently with a spatula just until set with soft folds, 3 minutes.',
            durationMin: 3,
          },
          {
            instruction: 'Scatter parsley and feta. Serve from the pan with bread.',
            durationMin: 1,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Crisp sucuk.', sectionTitle: 'Crisp sucuk, build base' },
      { atMin: 3, instruction: 'Sweat onion + peppers.', sectionTitle: 'Crisp sucuk, build base' },
      { atMin: 8, instruction: 'Grated tomato, simmer.', sectionTitle: 'Crisp sucuk, build base' },
      { atMin: 13, instruction: 'Fold eggs through.', sectionTitle: 'Fold in eggs' },
    ],
    notes: 'Turkish breakfast-for-dinner: jammy tomato, soft eggs, spicy sausage.',
    localImageKey: 'menemen-sucuk',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_015',
    slug: 'salmon-poke-bowl',
    signature: 'mock-sig-015',
    title: 'Salmon Poke Bowl',
    cuisine: 'Hawaiian',
    tier: 'after-work',
    tags: ['bowl', 'no-cook-main'],
    dietaryTags: ['pescatarian', 'dairy-free', 'high-protein'],
    timeMinutes: 25,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'sushi-grade salmon', quantity: '10 oz' },
          { item: 'short-grain rice', quantity: '1 cup' },
          { item: 'soy sauce', quantity: '3 tbsp' },
          { item: 'sesame oil', quantity: '1 tsp' },
          { item: 'rice vinegar', quantity: '1 tsp' },
          { item: 'scallion', quantity: '3' },
        ],
      },
      {
        title: 'Bowl',
        role: 'side',
        items: [
          { item: 'avocado', quantity: '1' },
          { item: 'cucumber', quantity: '1' },
          { item: 'edamame, shelled', quantity: '1 cup' },
          { item: 'nori, shredded', quantity: '1 sheet' },
          { item: 'toasted sesame seeds', quantity: '1 tsp' },
        ],
      },
    ],
    steps: [
      {
        title: 'Rice and marinade',
        objective: 'Start rice; build the poke sauce.',
        steps: [
          {
            instruction:
              'Start rice per package. Dice salmon into 1/2-inch cubes; toss with soy, sesame oil, rice vinegar, sliced scallion. Chill while rice cooks.',
            durationMin: 5,
          },
        ],
      },
      {
        title: 'Assemble',
        objective: 'Rice base, cold toppings, finish with nori and sesame.',
        steps: [
          {
            instruction: 'Slice avocado and cucumber. Warm edamame if frozen.',
            durationMin: 4,
          },
          {
            instruction:
              'Divide rice. Arrange salmon, avocado, cucumber, edamame around it. Shower with shredded nori and sesame.',
            durationMin: 3,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Rice on; marinate salmon.', sectionTitle: 'Rice and marinade' },
      { atMin: 18, instruction: 'Prep bowl veg.', sectionTitle: 'Assemble' },
      { atMin: 22, instruction: 'Build and garnish.', sectionTitle: 'Assemble' },
    ],
    notes: 'Cold, clean poke bowl that eats like a restaurant lunch - minimal stove time.',
    localImageKey: 'salmon-poke-bowl',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_016',
    slug: 'steak-eggs-bowl',
    signature: 'mock-sig-016',
    title: 'Steak and Eggs Rice Bowl',
    cuisine: 'American',
    tier: 'after-work',
    tags: ['bowl', 'brinner'],
    dietaryTags: ['gluten-free', 'high-protein'],
    timeMinutes: 25,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'hanger or flank steak', quantity: '12 oz' },
          { item: 'eggs', quantity: '4' },
          { item: 'jasmine rice', quantity: '1 cup' },
          { item: 'butter', quantity: '1 tbsp' },
          { item: 'neutral oil', quantity: '1 tbsp' },
        ],
      },
      {
        title: 'Sauce + garnish',
        role: 'sauce',
        items: [
          { item: 'soy sauce', quantity: '2 tbsp' },
          { item: 'worcestershire', quantity: '1 tsp' },
          { item: 'black pepper', quantity: '1 tsp' },
          { item: 'scallion', quantity: '3' },
          { item: 'kimchi (optional)', quantity: '1/2 cup' },
        ],
      },
    ],
    steps: [
      {
        title: 'Rice and rest',
        objective: 'Rice on; steak at room temp.',
        steps: [
          {
            instruction:
              'Start rice per package. Pull steak from fridge, pat dry, salt generously. Rest at room temp while rice cooks.',
            durationMin: 3,
          },
        ],
      },
      {
        title: 'Sear steak, fry eggs',
        objective: 'Hard sear + 5m rest; soft fried eggs.',
        steps: [
          {
            instruction:
              'Heat 1 tbsp oil in a cast-iron rip-hot. Sear steak 3 minutes; flip, add butter, baste 2 minutes. Rest 5 minutes.',
            durationMin: 10,
          },
          {
            instruction:
              'Lower heat; fry eggs sunny-side-up in residual fat 3 minutes until whites set.',
            durationMin: 3,
          },
          {
            instruction:
              'Slice steak against the grain. Build bowl: rice, steak, egg on top, soy + worcestershire drizzle, scallion, black pepper, kimchi.',
            durationMin: 4,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Rice on; salt steak.', sectionTitle: 'Rice and rest' },
      { atMin: 13, instruction: 'Sear steak.', sectionTitle: 'Sear steak, fry eggs' },
      { atMin: 18, instruction: 'Rest steak; fry eggs.', sectionTitle: 'Sear steak, fry eggs' },
      { atMin: 21, instruction: 'Slice; plate.', sectionTitle: 'Sear steak, fry eggs' },
    ],
    notes: 'Diner comfort in bowl form - crusty steak, runny egg, rice to soak it all.',
    localImageKey: 'steak-eggs-bowl',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },

  // ──────────────────────────────────────────────────────────────────────
  // got-energy (≤45m)
  // ──────────────────────────────────────────────────────────────────────
  {
    id: 'rec_017',
    slug: 'chicken-tikka',
    signature: 'mock-sig-017',
    title: 'Chicken Tikka',
    cuisine: 'Indian',
    tier: 'got-energy',
    tags: ['grill', 'marinade'],
    dietaryTags: ['gluten-free', 'high-protein'],
    timeMinutes: 40,
    servings: 4,
    difficulty: 'Medium',
    ingredients: [
      {
        title: 'Marinade',
        role: 'sauce',
        items: [
          { item: 'chicken thighs, boneless', quantity: '1.5 lb' },
          { item: 'full-fat yogurt', quantity: '3/4 cup' },
          { item: 'lemon', quantity: '1' },
          { item: 'ginger', quantity: '1 tbsp, grated' },
          { item: 'garlic', quantity: '4 cloves, grated' },
          { item: 'garam masala', quantity: '1 tbsp' },
          { item: 'smoked paprika', quantity: '2 tsp' },
          { item: 'kashmiri chili powder', quantity: '1 tsp' },
          { item: 'ground cumin', quantity: '1 tsp' },
          { item: 'kosher salt', quantity: '1.5 tsp' },
        ],
      },
      {
        title: 'Serve',
        role: 'side',
        items: [
          { item: 'basmati rice or naan', quantity: 'to serve' },
          { item: 'red onion, thin-sliced', quantity: '1/2' },
          { item: 'lemon wedges', quantity: '1' },
          { item: 'cilantro', quantity: '1/4 cup' },
        ],
      },
    ],
    steps: [
      {
        title: 'Marinate',
        objective: 'Yogurt + spice = tender and deeply flavored.',
        steps: [
          {
            instruction:
              'Cut chicken into 1.5-inch chunks. Whisk marinade; toss chicken in it. Rest 20 minutes (or overnight).',
            durationMin: 20,
          },
        ],
      },
      {
        title: 'Broil or grill',
        objective: 'Char edges, juicy interior.',
        steps: [
          {
            instruction:
              'Preheat broiler on high with rack 6 inches from element. Line a sheet pan with foil.',
            durationMin: 3,
          },
          {
            instruction:
              'Thread chicken on skewers or spread on sheet pan. Broil 8 minutes, flip, broil 6 minutes until 165F and edges char.',
            durationMin: 14,
          },
          {
            instruction: 'Rest 3 minutes; shower with cilantro, onion, lemon.',
            durationMin: 3,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Mix marinade; coat chicken.', sectionTitle: 'Marinate' },
      { atMin: 20, instruction: 'Preheat broiler.', sectionTitle: 'Broil or grill' },
      { atMin: 23, instruction: 'Broil side 1.', sectionTitle: 'Broil or grill' },
      { atMin: 31, instruction: 'Flip; broil side 2.', sectionTitle: 'Broil or grill' },
      { atMin: 37, instruction: 'Rest and garnish.', sectionTitle: 'Broil or grill' },
    ],
    notes:
      'Charred, smoky chicken tikka with yogurt-tenderized chunks - rice or naan does the rest.',
    localImageKey: 'chicken-tikka',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_018',
    slug: 'greek-chicken-bowl',
    signature: 'mock-sig-018',
    title: 'Greek Chicken Bowl',
    cuisine: 'Greek',
    tier: 'got-energy',
    tags: ['bowl', 'grain'],
    dietaryTags: ['gluten-free', 'high-protein'],
    timeMinutes: 35,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'chicken thighs, boneless', quantity: '1 lb' },
          { item: 'olive oil', quantity: '3 tbsp' },
          { item: 'lemon', quantity: '1' },
          { item: 'dried oregano', quantity: '1 tbsp' },
          { item: 'garlic', quantity: '3 cloves' },
        ],
      },
      {
        title: 'Bowl base',
        role: 'side',
        items: [
          { item: 'orzo or farro', quantity: '1 cup' },
          { item: 'english cucumber', quantity: '1' },
          { item: 'cherry tomatoes', quantity: '1 cup' },
          { item: 'kalamata olives', quantity: '1/3 cup' },
          { item: 'red onion', quantity: '1/4' },
          { item: 'feta', quantity: '4 oz' },
        ],
      },
      {
        title: 'Tzatziki',
        role: 'sauce',
        items: [
          { item: 'greek yogurt', quantity: '1 cup' },
          { item: 'cucumber, grated', quantity: '1/4' },
          { item: 'garlic', quantity: '1 clove' },
          { item: 'dill', quantity: '1 tbsp' },
        ],
      },
    ],
    steps: [
      {
        title: 'Marinate and grain',
        objective: 'Chicken building flavor while grain cooks.',
        steps: [
          {
            instruction:
              'Whisk olive oil, lemon juice, oregano, grated garlic, 1 tsp salt. Toss chicken; rest 15 minutes.',
            durationMin: 15,
          },
          {
            instruction: 'Start orzo or farro per package in salted water.',
            durationMin: 1,
          },
        ],
      },
      {
        title: 'Sear chicken, mix tzatziki',
        objective: 'Golden crust; cool creamy sauce.',
        steps: [
          {
            instruction:
              'Heat a skillet over medium-high. Sear chicken 6 minutes per side until 165F.',
            durationMin: 12,
          },
          {
            instruction:
              'Squeeze grated cucumber dry. Mix with yogurt, minced garlic, dill, pinch salt.',
            durationMin: 3,
          },
          {
            instruction:
              'Slice chicken. Build bowl: grain, diced cucumber and tomato, olives, onion, feta, chicken, tzatziki dollop.',
            durationMin: 4,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Marinate chicken.', sectionTitle: 'Marinate and grain' },
      { atMin: 15, instruction: 'Start grain; prep veg.', sectionTitle: 'Marinate and grain' },
      { atMin: 16, instruction: 'Sear chicken.', sectionTitle: 'Sear chicken, mix tzatziki' },
      {
        atMin: 28,
        instruction: 'Mix tzatziki; slice chicken.',
        sectionTitle: 'Sear chicken, mix tzatziki',
      },
      { atMin: 31, instruction: 'Build bowl.', sectionTitle: 'Sear chicken, mix tzatziki' },
    ],
    notes: "Bright, herbaceous, feta-forward - the bowl you'd order twice a week.",
    localImageKey: 'greek-chicken-bowl',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_019',
    slug: 'mushroom-risotto',
    signature: 'mock-sig-019',
    title: 'Mushroom Risotto',
    cuisine: 'Italian',
    tier: 'got-energy',
    tags: ['rice', 'stovetop'],
    dietaryTags: ['vegetarian', 'gluten-free'],
    timeMinutes: 40,
    servings: 2,
    difficulty: 'Medium',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'arborio or carnaroli rice', quantity: '1 cup' },
          { item: 'mixed mushrooms (cremini, shiitake)', quantity: '12 oz' },
          { item: 'shallot', quantity: '2' },
          { item: 'garlic', quantity: '2 cloves' },
          { item: 'dry white wine', quantity: '1/2 cup' },
          { item: 'vegetable or chicken broth, warm', quantity: '4 cups' },
          { item: 'butter', quantity: '3 tbsp' },
          { item: 'parmesan, grated', quantity: '2/3 cup' },
          { item: 'thyme', quantity: '1 tsp' },
        ],
      },
    ],
    steps: [
      {
        title: 'Brown mushrooms',
        objective: 'Dry sear first - color, not steam.',
        steps: [
          {
            instruction:
              'Slice mushrooms. Heat 1 tbsp butter in a wide skillet over high. Sear mushrooms in a single layer 6 minutes undisturbed, toss, 2 more minutes until deeply browned. Season; set aside.',
            durationMin: 8,
          },
        ],
      },
      {
        title: 'Build the risotto',
        objective: 'Toast rice, ladle stock, stir steadily.',
        steps: [
          {
            instruction:
              'Lower heat, add 1 tbsp butter, diced shallot, garlic, thyme; sweat 3 minutes.',
            durationMin: 3,
          },
          {
            instruction:
              'Add rice; toast 90 seconds until edges translucent. Pour in wine; stir until mostly absorbed.',
            durationMin: 3,
          },
          {
            instruction:
              'Add warm broth 1 ladle at a time, stirring until each is absorbed. Continue 18 minutes until rice is al dente and creamy.',
            durationMin: 18,
          },
          {
            instruction:
              'Stir in mushrooms, remaining butter, parmesan. Rest 2 minutes; plate.',
            durationMin: 3,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Brown mushrooms.', sectionTitle: 'Brown mushrooms' },
      { atMin: 8, instruction: 'Sweat shallot + thyme.', sectionTitle: 'Build the risotto' },
      { atMin: 11, instruction: 'Toast rice; deglaze wine.', sectionTitle: 'Build the risotto' },
      { atMin: 14, instruction: 'Ladle broth, stir steady.', sectionTitle: 'Build the risotto' },
      { atMin: 32, instruction: 'Finish with butter + parm.', sectionTitle: 'Build the risotto' },
    ],
    notes:
      'Creamy, earthy risotto - the dinner that fills the kitchen with butter-mushroom smell.',
    localImageKey: 'mushroom-risotto',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_020',
    slug: 'fattoush-grilled-chicken',
    signature: 'mock-sig-020',
    title: 'Fattoush with Grilled Chicken',
    cuisine: 'Lebanese',
    tier: 'got-energy',
    tags: ['salad', 'grill'],
    dietaryTags: ['high-protein'],
    timeMinutes: 40,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Chicken',
        role: 'main',
        items: [
          { item: 'chicken breasts or thighs', quantity: '1 lb' },
          { item: 'olive oil', quantity: '2 tbsp' },
          { item: 'sumac', quantity: '1 tsp' },
          { item: 'garlic', quantity: '2 cloves' },
          { item: 'lemon', quantity: '1' },
        ],
      },
      {
        title: 'Salad',
        role: 'side',
        items: [
          { item: 'pita bread', quantity: '2' },
          { item: 'romaine', quantity: '1 head' },
          { item: 'persian cucumber', quantity: '2' },
          { item: 'roma tomato', quantity: '3' },
          { item: 'radish', quantity: '4' },
          { item: 'fresh mint', quantity: '1/4 cup' },
          { item: 'flat-leaf parsley', quantity: '1/2 cup' },
          { item: 'scallion', quantity: '3' },
        ],
      },
      {
        title: 'Dressing',
        role: 'sauce',
        items: [
          { item: 'pomegranate molasses', quantity: '1 tbsp' },
          { item: 'olive oil', quantity: '1/4 cup' },
          { item: 'sumac', quantity: '1 tsp' },
          { item: 'garlic', quantity: '1 clove' },
        ],
      },
    ],
    steps: [
      {
        title: 'Marinate and toast pita',
        objective: 'Chicken builds flavor; pita becomes crunchy.',
        steps: [
          {
            instruction:
              'Whisk oil, sumac, grated garlic, lemon juice, 1 tsp salt. Toss chicken; rest 15 minutes.',
            durationMin: 15,
          },
          {
            instruction: 'Tear pita into pieces, toast in 375F oven 8 minutes until crisp; cool.',
            durationMin: 8,
          },
        ],
      },
      {
        title: 'Grill and toss',
        objective: 'Chicken gets color, salad stays loud.',
        steps: [
          {
            instruction:
              'Heat a skillet or grill pan medium-high. Cook chicken 5 minutes per side until 165F. Rest 5 minutes; slice.',
            durationMin: 12,
          },
          {
            instruction:
              'Chop romaine, tomatoes, cucumbers, radishes, herbs. Whisk dressing. Toss salad with dressing and toasted pita.',
            durationMin: 5,
          },
          {
            instruction: 'Top with sliced chicken.',
            durationMin: 1,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Marinate chicken.', sectionTitle: 'Marinate and toast pita' },
      { atMin: 5, instruction: 'Toast pita.', sectionTitle: 'Marinate and toast pita' },
      { atMin: 15, instruction: 'Grill chicken.', sectionTitle: 'Grill and toss' },
      { atMin: 27, instruction: 'Chop and dress salad.', sectionTitle: 'Grill and toss' },
      { atMin: 33, instruction: 'Plate with chicken.', sectionTitle: 'Grill and toss' },
    ],
    notes: 'Herbaceous, sumac-bright Lebanese salad with crunchy pita and juicy chicken.',
    localImageKey: 'fattoush-grilled-chicken',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_021',
    slug: 'shakshuka-merguez',
    signature: 'mock-sig-021',
    title: 'Shakshuka with Merguez',
    cuisine: 'Moroccan',
    tier: 'got-energy',
    tags: ['skillet', 'eggs'],
    dietaryTags: ['gluten-free', 'high-protein'],
    timeMinutes: 35,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'merguez sausage', quantity: '8 oz' },
          { item: 'eggs', quantity: '4' },
          { item: 'crushed tomatoes', quantity: '1 can (28 oz)' },
          { item: 'yellow onion', quantity: '1' },
          { item: 'red bell pepper', quantity: '1' },
          { item: 'garlic', quantity: '3 cloves' },
          { item: 'olive oil', quantity: '2 tbsp' },
        ],
      },
      {
        title: 'Spices',
        role: 'other',
        items: [
          { item: 'ground cumin', quantity: '1 tsp' },
          { item: 'smoked paprika', quantity: '1 tsp' },
          { item: 'coriander', quantity: '1/2 tsp' },
          { item: 'harissa (optional)', quantity: '1 tbsp' },
        ],
      },
      {
        title: 'Serve',
        role: 'garnish',
        items: [
          { item: 'feta', quantity: '2 oz' },
          { item: 'cilantro', quantity: '2 tbsp' },
          { item: 'crusty bread', quantity: 'to serve' },
        ],
      },
    ],
    steps: [
      {
        title: 'Crisp sausage, build base',
        objective: 'Render merguez fat, sweat veg in it.',
        steps: [
          {
            instruction:
              'Slice merguez into coins. Crisp in a wide skillet 5 minutes over medium; scoop out.',
            durationMin: 5,
          },
          {
            instruction:
              'Add olive oil, diced onion, sliced pepper; cook 6 minutes until soft.',
            durationMin: 6,
          },
          {
            instruction: 'Add garlic, spices, harissa; toast 60 seconds.',
            durationMin: 1,
          },
          {
            instruction: 'Add tomatoes and 1 tsp salt. Simmer 10 minutes to thicken.',
            durationMin: 10,
          },
        ],
      },
      {
        title: 'Poach eggs',
        objective: 'Runny yolk in a bubbling tomato pool.',
        steps: [
          {
            instruction:
              'Return merguez. Make 4 wells; crack an egg into each. Cover, cook 6 minutes until whites set and yolks jiggle.',
            durationMin: 6,
          },
          {
            instruction: 'Shower with feta and cilantro. Serve from pan with bread.',
            durationMin: 1,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Crisp merguez.', sectionTitle: 'Crisp sausage, build base' },
      { atMin: 5, instruction: 'Sweat onion + pepper.', sectionTitle: 'Crisp sausage, build base' },
      {
        atMin: 11,
        instruction: 'Toast spices + harissa.',
        sectionTitle: 'Crisp sausage, build base',
      },
      { atMin: 12, instruction: 'Simmer tomatoes.', sectionTitle: 'Crisp sausage, build base' },
      { atMin: 22, instruction: 'Poach eggs, covered.', sectionTitle: 'Poach eggs' },
    ],
    notes: 'Spicy merguez shakshuka - the skillet brunch that plays as dinner.',
    localImageKey: 'shakshuka-merguez',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },

  // ──────────────────────────────────────────────────────────────────────
  // weekend-project (>45m)
  // ──────────────────────────────────────────────────────────────────────
  {
    id: 'rec_022',
    slug: 'adana-kebab',
    signature: 'mock-sig-022',
    title: 'Adana Kebab',
    cuisine: 'Turkish',
    tier: 'weekend-project',
    tags: ['grill', 'hand-formed'],
    dietaryTags: ['dairy-free', 'high-protein'],
    timeMinutes: 75,
    servings: 4,
    difficulty: 'Advanced',
    ingredients: [
      {
        title: 'Kebab',
        role: 'main',
        items: [
          { item: 'ground lamb (fatty) or 70/30 beef', quantity: '1.5 lb' },
          { item: 'red bell pepper', quantity: '1' },
          { item: 'yellow onion', quantity: '1/2' },
          { item: 'garlic', quantity: '3 cloves' },
          { item: 'aleppo or urfa pepper', quantity: '2 tbsp' },
          { item: 'sumac', quantity: '1 tbsp' },
          { item: 'kosher salt', quantity: '1.5 tsp' },
          { item: 'black pepper', quantity: '1 tsp' },
        ],
      },
      {
        title: 'Flatbread and sides',
        role: 'side',
        items: [
          { item: 'lavash or pita', quantity: '4' },
          { item: 'red onion, thin-sliced', quantity: '1' },
          { item: 'sumac', quantity: '1 tsp' },
          { item: 'flat-leaf parsley', quantity: '1/2 cup' },
          { item: 'tomato, sliced', quantity: '2' },
          { item: 'lemon wedges', quantity: '1' },
        ],
      },
    ],
    steps: [
      {
        title: 'Mince and rest',
        objective: 'Paste-like texture makes the skewer hold.',
        steps: [
          {
            instruction:
              'Fine-mince pepper, onion, garlic (or pulse in a food processor). Squeeze dry in a towel - no water in the mix.',
            durationMin: 10,
          },
          {
            instruction:
              'Combine with meat, aleppo, sumac, salt, pepper. Knead 3 minutes until paste-like and tacky.',
            durationMin: 4,
          },
          {
            instruction: 'Cover and chill 30 minutes.',
            durationMin: 30,
          },
        ],
      },
      {
        title: 'Skewer and cook',
        objective: 'Thin, even kebabs; sear hard.',
        steps: [
          {
            instruction:
              'Preheat broiler high or charcoal grill. Divide meat into 8 portions; press each tightly onto flat skewers in a long finger-shape.',
            durationMin: 8,
          },
          {
            instruction:
              'Sear 5 minutes, flip, 5 minutes more until deeply browned and 145F internal. Rest 3 minutes.',
            durationMin: 13,
          },
          {
            instruction:
              'Warm lavash briefly. Toss onion with sumac, parsley. Plate kebabs with flatbread, onion salad, tomato, lemon.',
            durationMin: 5,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Mince veg; squeeze dry.', sectionTitle: 'Mince and rest' },
      { atMin: 10, instruction: 'Knead mix.', sectionTitle: 'Mince and rest' },
      { atMin: 14, instruction: 'Chill.', sectionTitle: 'Mince and rest' },
      { atMin: 44, instruction: 'Form skewers; preheat.', sectionTitle: 'Skewer and cook' },
      { atMin: 52, instruction: 'Sear; flip.', sectionTitle: 'Skewer and cook' },
      { atMin: 65, instruction: 'Rest; plate with sides.', sectionTitle: 'Skewer and cook' },
    ],
    notes:
      'Hand-formed Turkish kebabs with charred crust - a proper weekend grill dinner.',
    localImageKey: 'adana-kebab',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_023',
    slug: 'lamb-chops-bulgur',
    signature: 'mock-sig-023',
    title: 'Lamb Chops with Herbed Bulgur',
    cuisine: 'Mediterranean',
    tier: 'weekend-project',
    tags: ['grill', 'grain'],
    dietaryTags: ['high-protein'],
    timeMinutes: 60,
    servings: 4,
    difficulty: 'Medium',
    ingredients: [
      {
        title: 'Chops',
        role: 'main',
        items: [
          { item: 'lamb rib or loin chops', quantity: '2 lb (8 chops)' },
          { item: 'olive oil', quantity: '3 tbsp' },
          { item: 'garlic', quantity: '4 cloves' },
          { item: 'rosemary', quantity: '2 tbsp' },
          { item: 'lemon zest', quantity: '1 tsp' },
        ],
      },
      {
        title: 'Bulgur',
        role: 'side',
        items: [
          { item: 'coarse bulgur', quantity: '1 cup' },
          { item: 'chicken or vegetable broth', quantity: '2 cups' },
          { item: 'flat-leaf parsley', quantity: '1/2 cup' },
          { item: 'mint', quantity: '1/4 cup' },
          { item: 'scallion', quantity: '3' },
          { item: 'lemon', quantity: '1' },
          { item: 'olive oil', quantity: '2 tbsp' },
          { item: 'toasted pine nuts', quantity: '1/4 cup' },
        ],
      },
    ],
    steps: [
      {
        title: 'Marinate',
        objective: 'Rub lamb with garlic-rosemary paste.',
        steps: [
          {
            instruction:
              'Pound garlic with rosemary, zest, salt, olive oil into a paste. Rub onto chops; rest 30 minutes room temp.',
            durationMin: 30,
          },
        ],
      },
      {
        title: 'Cook bulgur, sear chops',
        objective: 'Grain absorbs while lamb gets a crust.',
        steps: [
          {
            instruction:
              'Bring broth to a boil, stir in bulgur, cover, reduce to low, cook 12 minutes. Off heat, rest 5 minutes.',
            durationMin: 17,
          },
          {
            instruction:
              'Heat a cast-iron ripping hot. Sear chops 2-3 minutes per side for medium-rare (125F).',
            durationMin: 6,
          },
          {
            instruction: 'Rest chops 5 minutes.',
            durationMin: 5,
          },
          {
            instruction:
              'Fluff bulgur with a fork. Fold in chopped herbs, scallion, lemon juice, olive oil, pine nuts.',
            durationMin: 2,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Marinate lamb.', sectionTitle: 'Marinate' },
      { atMin: 30, instruction: 'Start bulgur.', sectionTitle: 'Cook bulgur, sear chops' },
      { atMin: 47, instruction: 'Sear chops.', sectionTitle: 'Cook bulgur, sear chops' },
      {
        atMin: 53,
        instruction: 'Rest chops; finish bulgur.',
        sectionTitle: 'Cook bulgur, sear chops',
      },
    ],
    notes:
      'Garlic-rosemary lamb chops with a herb-forward bulgur pilaf - dinner-party leaning.',
    localImageKey: 'lamb-chops-bulgur',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rec_024',
    slug: 'greek-lemon-chicken-orzo',
    signature: 'mock-sig-024',
    title: 'Greek Lemon Chicken and Orzo',
    cuisine: 'Greek',
    tier: 'weekend-project',
    tags: ['oven', 'one-pot'],
    dietaryTags: ['high-protein'],
    timeMinutes: 60,
    servings: 4,
    difficulty: 'Medium',
    ingredients: [
      {
        title: 'Main',
        role: 'main',
        items: [
          { item: 'bone-in skin-on chicken thighs', quantity: '2.5 lb' },
          { item: 'olive oil', quantity: '3 tbsp' },
          { item: 'dried oregano', quantity: '1 tbsp' },
          { item: 'garlic', quantity: '6 cloves' },
          { item: 'lemon', quantity: '2' },
        ],
      },
      {
        title: 'Orzo',
        role: 'side',
        items: [
          { item: 'orzo', quantity: '1.5 cups' },
          { item: 'chicken broth', quantity: '3 cups' },
          { item: 'dry white wine', quantity: '1/2 cup' },
          { item: 'cherry tomatoes', quantity: '1 pint' },
          { item: 'baby spinach', quantity: '4 cups' },
          { item: 'feta', quantity: '4 oz' },
          { item: 'dill', quantity: '2 tbsp' },
        ],
      },
    ],
    steps: [
      {
        title: 'Sear chicken',
        objective: 'Crisp skin now so oven work is easy.',
        steps: [
          {
            instruction: 'Pat chicken dry, salt skin side generously. Rub with oregano and pepper.',
            durationMin: 3,
          },
          {
            instruction:
              'Heat olive oil in a large oven-safe skillet medium-high. Sear thighs skin-down 8 minutes until deeply golden; flip, 2 minutes. Remove.',
            durationMin: 12,
          },
        ],
      },
      {
        title: 'Build orzo bed',
        objective: 'Toast, deglaze, layer.',
        steps: [
          {
            instruction:
              'Lower heat. Add sliced garlic and orzo to the skillet; toast 2 minutes.',
            durationMin: 2,
          },
          {
            instruction:
              'Deglaze with wine, scrape fond. Add broth, juice of 1 lemon, tomatoes, 1 tsp salt.',
            durationMin: 3,
          },
        ],
      },
      {
        title: 'Roast and finish',
        objective: 'Chicken steams orzo, skin crisps.',
        steps: [
          {
            instruction:
              'Nestle chicken back on top, skin up. Transfer to 400F oven; bake 25 minutes until chicken hits 165F and orzo is creamy.',
            durationMin: 25,
          },
          {
            instruction:
              'Off heat, stir spinach into orzo to wilt. Slice second lemon; scatter feta and dill. Serve from pan.',
            durationMin: 5,
          },
        ],
      },
    ],
    timeline: [
      { atMin: 0, instruction: 'Season chicken.', sectionTitle: 'Sear chicken' },
      { atMin: 3, instruction: 'Sear skin down.', sectionTitle: 'Sear chicken' },
      { atMin: 15, instruction: 'Toast orzo + garlic.', sectionTitle: 'Build orzo bed' },
      {
        atMin: 17,
        instruction: 'Deglaze, add broth + tomato.',
        sectionTitle: 'Build orzo bed',
      },
      { atMin: 20, instruction: 'Oven 400F; 25m.', sectionTitle: 'Roast and finish' },
      { atMin: 45, instruction: 'Stir spinach; finish.', sectionTitle: 'Roast and finish' },
    ],
    notes: 'One-skillet Sunday-night chicken with lemony, tomato-streaked orzo.',
    localImageKey: 'greek-lemon-chicken-orzo',
    blurhash: 'L9I|#~%L00oMxvIUxv%M_3xvxvIU',
    imageStatus: 'ready',
    source: 'cohort',
    createdAt: now,
    updatedAt: now,
  },
];
