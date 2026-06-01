import { describe, it, expect } from 'vitest';
import {
  parseFraction,
  formatQuantity,
  formatIngredientQuantity,
  parseRecipeMarkdown
} from './recipe-parser';

describe('recipe-parser utilities', () => {
  describe('parseFraction', () => {
    it('should parse simple integers', () => {
      expect(parseFraction('2')).toBe(2);
      expect(parseFraction('12')).toBe(12);
    });

    it('should parse decimals', () => {
      expect(parseFraction('1.5')).toBe(1.5);
      expect(parseFraction('0.25')).toBe(0.25);
    });

    it('should parse simple fractions', () => {
      expect(parseFraction('1/2')).toBe(0.5);
      expect(parseFraction('3/4')).toBe(0.75);
    });

    it('should parse mixed numbers', () => {
      expect(parseFraction('1 1/2')).toBe(1.5);
      expect(parseFraction('2 3/4')).toBe(2.75);
    });

    it('should return null for range quantities or custom strings', () => {
      expect(parseFraction('2-3')).toBeNull();
      expect(parseFraction('1/2-3/4')).toBeNull();
      expect(parseFraction('2 to 3')).toBeNull();
      expect(parseFraction('a few')).toBeNull();
      expect(parseFraction('')).toBeNull();
      expect(parseFraction(null)).toBeNull();
    });
  });

  describe('formatQuantity', () => {
    it('should format integers as strings', () => {
      expect(formatQuantity(2)).toBe('2');
      expect(formatQuantity(10)).toBe('10');
    });

    it('should format common fractions', () => {
      expect(formatQuantity(0.5)).toBe('1/2');
      expect(formatQuantity(1.5)).toBe('1 1/2');
      expect(formatQuantity(0.25)).toBe('1/4');
      expect(formatQuantity(0.75)).toBe('3/4');
    });

    it('should fallback to 1 decimal place for arbitrary decimals', () => {
      expect(formatQuantity(0.19)).toBe('0.2');
      expect(formatQuantity(1.72)).toBe('1.7');
    });
  });

  describe('formatIngredientQuantity', () => {
    it('should use formatQuantity if quantity is set', () => {
      expect(formatIngredientQuantity(1.5, '1-2')).toBe('1 1/2');
      expect(formatIngredientQuantity(2, '')).toBe('2');
    });

    it('should fallback to rawQuantity if quantity is null/empty', () => {
      expect(formatIngredientQuantity(null, '2-3')).toBe('2-3');
      expect(formatIngredientQuantity(null, 'a pinch')).toBe('a pinch');
      expect(formatIngredientQuantity(null, '')).toBe('');
    });
  });

  describe('parseRecipeMarkdown', () => {
    const sampleMarkdown = `---
title: "Test Recipe"
description: "A test recipe description"
prepTime: "15 mins"
cookTime: "30 mins"
servings: 4
difficulty: "Medium"
image: "images/test-image.jpg"
categories: ["Dessert"]
tags: ["sweet", "baked"]
---

## Ingredients
- 2-3 cups flour
- 1 1/2 cups sugar
- 1/2 tsp salt
- pinch nutmeg

## Instructions
1. Mix everything together.
2. Bake for 30 minutes at 350F.

## Notes
- Serve warm with vanilla ice cream.
`;

    it('should successfully parse recipe metadata frontmatter', () => {
      const parsed = parseRecipeMarkdown(sampleMarkdown, 'test-recipe.md');
      expect(parsed.success).toBe(true);
      expect(parsed.title).toBe('Test Recipe');
      expect(parsed.description).toBe('A test recipe description');
      expect(parsed.prepTime).toBe('15 mins');
      expect(parsed.cookTime).toBe('30 mins');
      expect(parsed.servings).toBe(4);
      expect(parsed.difficulty).toBe('Medium');
      expect(parsed.categories).toEqual(['Dessert']);
      expect(parsed.tags).toEqual(['sweet', 'baked']);
    });

    it('should parse ingredient ranges and fractions cleanly', () => {
      const parsed = parseRecipeMarkdown(sampleMarkdown, 'test-recipe.md');
      const ing = parsed.ingredients;
      expect(ing.length).toBe(4);

      // Range ingredient "2-3 cups flour"
      expect(ing[0].quantity).toBeNull(); // range is not a single number
      expect(ing[0].rawQuantity).toBe('2-3');
      expect(ing[0].unit).toBe('cups');
      expect(ing[0].name).toBe('flour');
      expect(ing[0].scalable).toBe(false);

      // Fraction ingredient "1 1/2 cups sugar"
      expect(ing[1].quantity).toBe(1.5);
      expect(ing[1].rawQuantity).toBe('1 1/2');
      expect(ing[1].unit).toBe('cups');
      expect(ing[1].name).toBe('sugar');
      expect(ing[1].scalable).toBe(true);

      // Simple fraction "1/2 tsp salt"
      expect(ing[2].quantity).toBe(0.5);
      expect(ing[2].rawQuantity).toBe('1/2');
      expect(ing[2].unit).toBe('tsp');
      expect(ing[2].name).toBe('salt');
      expect(ing[2].scalable).toBe(true);

      // Custom "pinch nutmeg"
      expect(ing[3].quantity).toBeNull();
      expect(ing[3].rawQuantity).toBe('');
      expect(ing[3].unit).toBe('pinch');
      expect(ing[3].name).toBe('nutmeg');
      expect(ing[3].scalable).toBe(false);
    });

    it('should parse instructions step-by-step', () => {
      const parsed = parseRecipeMarkdown(sampleMarkdown, 'test-recipe.md');
      expect(parsed.instructions.length).toBe(2);
      expect(parsed.instructions[0].step).toBe(1);
      expect(parsed.instructions[0].text).toBe('Mix everything together.');
      expect(parsed.instructions[1].step).toBe(2);
      expect(parsed.instructions[1].text).toBe('Bake for 30 minutes at 350F.');
      expect(parsed.instructions[1].timers[0].minutes).toBe(30);
    });

    it('should parse notes section bullet points', () => {
      const parsed = parseRecipeMarkdown(sampleMarkdown, 'test-recipe.md');
      expect(parsed.notes.length).toBe(1);
      expect(parsed.notes[0]).toBe('Serve warm with vanilla ice cream.');
    });
  });
});
