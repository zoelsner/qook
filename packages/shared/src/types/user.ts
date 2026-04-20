import type {
  DietaryTag,
  EnergyTier,
  PreferenceState,
  Timestamp,
  UnitSystem,
} from './primitives';

export interface User {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  hasCompletedOnboarding: boolean;
  firstDeckGeneratedAt?: Timestamp;
  aiDataConsentAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSeenAt: Timestamp;
}

export interface Preference {
  name: string;
  state: PreferenceState;
}

export interface UserPreferences {
  userId: string;
  householdSize: number;
  unitSystem: UnitSystem;
  cuisines: Preference[];
  proteinPriorities: Preference[];
  avoidIngredients: string[];
  cookingTools: string[];
  dietaryConstraints: DietaryTag[];
  defaultTier: EnergyTier;
  generationDay: number;
  updatedAt: Timestamp;
}

export interface UserSavedRecipe {
  id: string;
  userId: string;
  recipeId: string;
  savedAt: Timestamp;
  lastServedAt?: Timestamp;
  timesCooked: number;
}
