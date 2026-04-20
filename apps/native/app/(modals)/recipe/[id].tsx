import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { RecipeDetailModal } from '../../../src/features/recipe/RecipeDetailModal';

export default function RecipeModalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecipeDetailModal recipeId={id ?? ''} />;
}
