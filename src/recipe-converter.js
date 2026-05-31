/**
 * --- GOURMET INGREDIENT DENSITY & WEIGHT CONVERTER ---
 * Pure-functional pipeline transforming volume units into precise metric weights.
 */

// Density conversion tables: gram weights per volumetric unit (cup, tbsp, tsp)
const STAPLE_DENSITIES = {
  flour: { cup: 120, tbsp: 7.5, tsp: 2.5 },
  'all-purpose flour': { cup: 120, tbsp: 7.5, tsp: 2.5 },
  'bread flour': { cup: 127, tbsp: 8, tsp: 2.6 },
  'whole wheat flour': { cup: 120, tbsp: 7.5, tsp: 2.5 },

  sugar: { cup: 200, tbsp: 12.5, tsp: 4.2 },
  'granulated sugar': { cup: 200, tbsp: 12.5, tsp: 4.2 },
  'powdered sugar': { cup: 120, tbsp: 7.5, tsp: 2.5 },
  'confectioners sugar': { cup: 120, tbsp: 7.5, tsp: 2.5 },
  'brown sugar': { cup: 200, tbsp: 12.5, tsp: 4.2 },

  butter: { cup: 227, tbsp: 14.2, tsp: 4.7 },
  margarine: { cup: 227, tbsp: 14.2, tsp: 4.7 },

  salt: { cup: 288, tbsp: 18, tsp: 6 },
  'kosher salt': { cup: 192, tbsp: 12, tsp: 4 },

  water: { cup: 236.6, tbsp: 14.8, tsp: 4.9 },

  milk: { cup: 244, tbsp: 15.3, tsp: 5.1 },
  buttermilk: { cup: 242, tbsp: 15.1, tsp: 5 },
  'heavy cream': { cup: 238, tbsp: 14.9, tsp: 5 },

  'cocoa powder': { cup: 100, tbsp: 6.25, tsp: 2.1 },

  'olive oil': { cup: 216, tbsp: 13.5, tsp: 4.5 },
  'vegetable oil': { cup: 218, tbsp: 13.6, tsp: 4.5 },
  'canola oil': { cup: 218, tbsp: 13.6, tsp: 4.5 },
  'coconut oil': { cup: 216, tbsp: 13.5, tsp: 4.5 },

  honey: { cup: 340, tbsp: 21.3, tsp: 7.1 },
  'maple syrup': { cup: 322, tbsp: 20.1, tsp: 6.7 },
  molasses: { cup: 340, tbsp: 21.3, tsp: 7.1 },

  'chocolate chips': { cup: 170, tbsp: 10.6, tsp: 3.5 }
};

// Pre-sorted density lookup keys by length descending for optimal fuzzy matches (brown sugar matches before sugar)
const SORTED_STAPLE_KEYS = Object.keys(STAPLE_DENSITIES).sort((a, b) => b.length - a.length);

/**
 * Normalizes common volume units for matching.
 * @param {string} unit
 * @returns {string}
 */
const normalizeUnit = (unit) => {
  const u = unit.toLowerCase().trim();
  if (u === 'cup' || u === 'cups') return 'cup';
  if (u === 'tbsp' || u === 'tbsps' || u === 'tablespoon' || u === 'tablespoons') return 'tbsp';
  if (u === 'tsp' || u === 'tsps' || u === 'teaspoon' || u === 'teaspoons') return 'tsp';
  return u;
};

/**
 * Searches density tables for a matching ingredient name.
 * Uses a pure fuzzy lowercase substring comparison.
 * @param {string} name
 * @returns {string|null}
 */
const findStapleKey = (name) => {
  const cleanName = name.toLowerCase().trim();

  // Try exact matches first
  const exactMatch = Object.keys(STAPLE_DENSITIES).find((k) => k === cleanName);
  if (exactMatch) return exactMatch;

  // Try substring checks (e.g. "sifted flour" matching "flour") using pre-compiled keys
  return SORTED_STAPLE_KEYS.find((key) => cleanName.includes(key));
};

/**
 * Immutable transformation converting volume ingredients to precise gram weights.
 * If the ingredient is not convertible (or already metric/weight), returns it unchanged.
 *
 * @param {object} ingredient - { quantity, unit, name, scalable, originalText }
 * @returns {object} - Converted ingredient record
 */
export const convertIngredientToWeight = (ingredient) => {
  if (!ingredient.scalable || !ingredient.quantity || !ingredient.unit) {
    return ingredient;
  }

  const normUnit = normalizeUnit(ingredient.unit);
  if (normUnit !== 'cup' && normUnit !== 'tbsp' && normUnit !== 'tsp') {
    return ingredient; // Already a weight, count, or custom volume
  }

  const stapleKey = findStapleKey(ingredient.name);
  if (!stapleKey) {
    return ingredient; // No matching density staple found
  }

  const conversionFactors = STAPLE_DENSITIES[stapleKey];
  const factor = conversionFactors[normUnit];

  if (!factor) {
    return ingredient; // Density for specific volume unit missing
  }

  const convertedQty = Math.round(ingredient.quantity * factor * 10) / 10;

  return {
    ...ingredient,
    quantity: convertedQty,
    unit: 'g',
    converted: true,
    originalText: `${convertedQty}g ${ingredient.name}`
  };
};

/**
 * Batch-converts an entire ingredients array to weights.
 * @param {array} ingredientsList
 * @param {boolean} activeGrams
 * @returns {array}
 */
export const processIngredients = (ingredientsList, activeGrams = false) =>
  activeGrams ? ingredientsList.map(convertIngredientToWeight) : ingredientsList;
