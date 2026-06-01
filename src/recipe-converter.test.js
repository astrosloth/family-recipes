import { describe, it, expect } from 'vitest';
import { convertIngredientToWeight, scaleAndConvertIngredient } from './recipe-converter';

describe('recipe-converter utilities', () => {
  describe('convertIngredientToWeight', () => {
    it('should convert volume units of matching staples into gram weights', () => {
      const flourIng = {
        name: 'all-purpose flour',
        quantity: 2,
        unit: 'cups',
        scalable: true
      };
      const converted = convertIngredientToWeight(flourIng);
      expect(converted.quantity).toBe(240); // 2 cups * 120g/cup = 240g
      expect(converted.unit).toBe('g');
      expect(converted.converted).toBe(true);
    });

    it('should fuzzy-match custom ingredient descriptors', () => {
      const brownSugarIng = {
        name: 'light brown sugar packed',
        quantity: 1,
        unit: 'cup',
        scalable: true
      };
      const converted = convertIngredientToWeight(brownSugarIng);
      expect(converted.quantity).toBe(200); // matches 'brown sugar' -> 200g/cup
      expect(converted.unit).toBe('g');
    });

    it('should return unchanged if ingredient is non-scalable or has no quantity/unit', () => {
      const nonScalable = {
        name: 'flour',
        quantity: 1,
        unit: 'cup',
        scalable: false
      };
      expect(convertIngredientToWeight(nonScalable)).toEqual(nonScalable);
    });

    it('should return unchanged if ingredient unit is not a common volume unit', () => {
      const weightIng = {
        name: 'chocolate chips',
        quantity: 100,
        unit: 'g',
        scalable: true
      };
      expect(convertIngredientToWeight(weightIng)).toEqual(weightIng);
    });

    it('should return unchanged if no matching density staple is found', () => {
      const customIng = {
        name: 'magical stardust',
        quantity: 1,
        unit: 'cup',
        scalable: true
      };
      expect(convertIngredientToWeight(customIng)).toEqual(customIng);
    });
  });

  describe('scaleAndConvertIngredient', () => {
    const butterIng = {
      name: 'unsalted butter',
      quantity: 1,
      unit: 'cup',
      scalable: true,
      rawQuantity: '1'
    };

    it('should scale quantities without converting if gramsMode is disabled', () => {
      const scaled = scaleAndConvertIngredient(butterIng, 2, false);
      expect(scaled.quantity).toBe(2);
      expect(scaled.unit).toBe('cup');
      expect(scaled.name).toBe('unsalted butter');
    });

    it('should scale and convert to grams if gramsMode is active', () => {
      const scaledAndConverted = scaleAndConvertIngredient(butterIng, 2, true);
      expect(scaledAndConverted.quantity).toBe(454); // 1 cup butter * 2 servings * 227g/cup = 454g
      expect(scaledAndConverted.unit).toBe('g');
    });

    it('should leave range quantities unscaled and unconverted', () => {
      const rangeIng = {
        name: 'celery stalks',
        quantity: null,
        unit: '',
        scalable: false,
        rawQuantity: '2-3'
      };
      const result = scaleAndConvertIngredient(rangeIng, 2, true);
      expect(result.quantity).toBeNull();
      expect(result.unit).toBe('');
      expect(result.name).toBe('celery stalks');
    });
  });
});
