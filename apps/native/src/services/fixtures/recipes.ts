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
        title: 'Quick pickle',
        objective: 'Pickle cucumber while salmon broils.',
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
      { atMin: 12, instruction: 'Pickle cucumber.', sectionTitle: 'Quick pickle' },
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
];
