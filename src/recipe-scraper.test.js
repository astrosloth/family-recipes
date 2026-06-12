import { describe, it, expect, vi } from 'vitest';
import {
  extractSchemaRecipe,
  normalizeDuration,
  normalizeYield,
  normalizeImage,
  normalizeInstructions,
  scrapeDOMFallback
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

  describe('scrapeDOMFallback', () => {
    it('should parse details using DOM conventions when JSON-LD is missing', () => {
      // Create a mock document representing a standard recipe blog page
      const mockDoc = {
        title: 'Delicious Chocolate Cake - Sweet Recipes',
        location: { hostname: 'sweetrecipes.com' },
        querySelector: vi.fn().mockImplementation((selector) => {
          if (
            selector === 'meta[name="description"]' ||
            selector === 'meta[property="og:description"]'
          ) {
            return { getAttribute: () => 'A rich and moist chocolate cake.' };
          }
          if (
            selector === 'meta[property="og:image"]' ||
            selector === 'meta[name="twitter:image"]'
          ) {
            return { getAttribute: () => 'http://example.com/cake.jpg' };
          }
          return null;
        }),
        querySelectorAll: vi.fn().mockImplementation((selector) => {
          if (selector === 'h1') {
            return [{ innerText: 'Delicious Chocolate Cake' }];
          }
          // Scan for headings, list elements, etc.
          if (selector === 'h1, h2, h3, h4, h5, h6, p, div, span') {
            return [
              {
                tagName: 'H2',
                innerText: 'Ingredients',
                nextElementSibling: {
                  tagName: 'UL',
                  nextElementSibling: null,
                  querySelectorAll: () => [
                    { innerText: '2 cups flour' },
                    { innerText: '1 cup sugar' },
                    { innerText: '1/2 cup cocoa' }
                  ]
                }
              },
              {
                tagName: 'H2',
                innerText: 'Instructions',
                nextElementSibling: {
                  tagName: 'OL',
                  nextElementSibling: null,
                  querySelectorAll: () => [
                    { innerText: 'Mix dry ingredients.' },
                    { innerText: 'Bake at 350F for 30 minutes.' }
                  ]
                }
              },
              {
                tagName: 'H2',
                innerText: 'Notes',
                nextElementSibling: {
                  tagName: 'UL',
                  nextElementSibling: null,
                  querySelectorAll: () => [{ innerText: 'Best served with vanilla ice cream.' }]
                }
              }
            ];
          }
          if (selector === 'ul' || selector === 'ol') {
            return [];
          }
          return [];
        }),
        body: {
          innerText: 'Serves: 6. Prep time: 20 mins. Cook time: 35 mins.'
        }
      };

      const result = scrapeDOMFallback(mockDoc);
      expect(result).not.toBeNull();
      expect(result.title).toBe('Delicious Chocolate Cake');
      expect(result.description).toBe('A rich and moist chocolate cake.');
      expect(result.image).toBe('http://example.com/cake.jpg');
      expect(result.servings).toBe(6);
      expect(result.prepTime).toBe('20 mins');
      expect(result.cookTime).toBe('35 mins');
      expect(result.ingredients).toEqual(['2 cups flour', '1 cup sugar', '1/2 cup cocoa']);
      expect(result.instructions).toEqual(['Mix dry ingredients.', 'Bake at 350F for 30 minutes.']);
      expect(result.notes).toEqual(['Best served with vanilla ice cream.']);
    });
  });
});
