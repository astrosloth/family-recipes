import { describe, it, expect, vi } from 'vitest';
import {
  extractSchemaRecipe,
  normalizeDuration,
  normalizeYield,
  normalizeImage,
  normalizeInstructions
} from './recipe-scraper';

describe('recipe-scraper utilities', () => {
  describe('normalizeDuration', () => {
    it('should normalize ISO durations', () => {
      expect(normalizeDuration('PT30M')).toBe('30 mins');
      expect(normalizeDuration('PT1H15M')).toBe('1 hr 15 mins');
      expect(normalizeDuration('PT2H')).toBe('2 hrs');
      expect(normalizeDuration('')).toBe('0 mins');
    });
  });

  describe('normalizeYield', () => {
    it('should parse yields', () => {
      expect(normalizeYield(8)).toBe(8);
      expect(normalizeYield('6 servings')).toBe(6);
      expect(normalizeYield('Makes 12 cookies')).toBe(12);
      expect(normalizeYield(null)).toBe(4);
    });
  });

  describe('normalizeImage', () => {
    it('should parse image parameters', () => {
      expect(normalizeImage('http://example.com/img.jpg')).toBe('http://example.com/img.jpg');
      expect(normalizeImage(['http://example.com/img1.jpg', 'img2.jpg'])).toBe(
        'http://example.com/img1.jpg'
      );
      expect(normalizeImage({ url: 'http://example.com/nested.jpg' })).toBe(
        'http://example.com/nested.jpg'
      );
      expect(normalizeImage(null)).toBe('');
    });
  });

  describe('normalizeInstructions', () => {
    it('should normalize step formats', () => {
      expect(normalizeInstructions('Mix ingredients.')).toEqual(['Mix ingredients.']);
      expect(
        normalizeInstructions([
          { '@type': 'HowToStep', text: 'Step 1' },
          { '@type': 'HowToStep', text: 'Step 2' }
        ])
      ).toEqual(['Step 1', 'Step 2']);
    });
  });

  describe('extractSchemaRecipe', () => {
    it('should extract recipe schema from script tag', () => {
      const mockDoc = {
        querySelectorAll: vi.fn().mockReturnValue([
          {
            innerText: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Recipe',
              name: 'Oatmeal Cookies',
              recipeIngredient: ['oats', 'sugar']
            })
          }
        ])
      };
      const result = extractSchemaRecipe(mockDoc);
      expect(result).not.toBeNull();
      expect(result.name).toBe('Oatmeal Cookies');
      expect(result.recipeIngredient).toEqual(['oats', 'sugar']);
    });
  });
});
