/**
 * --- UNIVERSAL RECIPE SCHEMA.ORG CONTENT SCRAPER ---
 * Pure-functional pipeline extracting JSON-LD recipe structures from active tabs.
 */

/**
 * Searches the DOM for all JSON-LD blocks, compiles and flattens arrays,
 * and extracts the first matching Schema.org Recipe object.
 *
 * @returns {object|null} - Extracted raw Recipe JSON schema
 */
const extractSchemaRecipe = () => {
  try {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

    // Pure transformation pipeline flattens arrays and graphs
    return (
      scripts
        .map((script) => {
          try {
            return JSON.parse(script.innerText);
          } catch {
            return null;
          }
        })
        .filter((data) => data !== null)
        .flatMap((data) => (Array.isArray(data) ? data : [data]))
        .flatMap((data) => (data['@graph'] ? data['@graph'] : [data]))
        .find((item) => {
          if (!item || !item['@type']) return false;
          const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
          return types.some((t) => t === 'Recipe' || t.endsWith('/Recipe'));
        }) || null
    );
  } catch (err) {
    console.error('[Recipe Scraper] Scanning DOM JSON-LD failed:', err);
    return null;
  }
};

/**
 * Normalizes Schema.org image values (can be string, array, or nested object).
 * @param {any} imgValue
 * @returns {string}
 */
const normalizeImage = (imgValue) => {
  if (!imgValue) return '';
  if (typeof imgValue === 'string') return imgValue;
  if (Array.isArray(imgValue) && imgValue.length > 0) {
    return typeof imgValue[0] === 'string' ? imgValue[0] : imgValue[0]?.url || '';
  }
  return imgValue.url || '';
};

/**
 * Normalizes ISO 8601 duration strings (e.g. "PT30M" -> "30 mins", "PT1H15M" -> "1 hr 15 mins").
 * @param {string} isoStr
 * @returns {string}
 */
const normalizeDuration = (isoStr) => {
  if (!isoStr || typeof isoStr !== 'string') return '0 mins';

  const matches = isoStr.match(/P(?:T)?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!matches) return isoStr.replace('PT', '').toLowerCase();

  const [_, hrs, mins] = matches;
  const hrVal = hrs ? `${hrs} hr` + (parseInt(hrs) > 1 ? 's' : '') : '';
  const minVal = mins ? `${mins} min` + (parseInt(mins) > 1 ? 's' : '') : '';

  return [hrVal, minVal].filter((v) => v.length > 0).join(' ') || '0 mins';
};

/**
 * Normalizes yields (can be string like "8 servings" or integer like 8).
 * @param {any} yieldVal
 * @returns {number}
 */
const normalizeYield = (yieldVal) => {
  if (!yieldVal) return 4;
  if (typeof yieldVal === 'number') return yieldVal;
  const num = parseInt(yieldVal.toString().match(/\d+/)?.[0]);
  return !isNaN(num) ? num : 4;
};

/**
 * Extracts instruction steps dynamically (handles strings, objects, and nested lists).
 * @param {any} instructionsVal
 * @returns {array} - Array of strings
 */
const normalizeInstructions = (instructionsVal) => {
  if (!instructionsVal) return [];

  const list = Array.isArray(instructionsVal) ? instructionsVal : [instructionsVal];

  // Recursively flattens structures (some sites nest sections of steps!)
  return list
    .flatMap((item) => {
      if (typeof item === 'string') return [item];
      if (item && item['@type'] === 'HowToStep') return [item.text || item.name];
      if (item && item['@type'] === 'HowToSection' && item.itemListElement) {
        return normalizeInstructions(item.itemListElement);
      }
      return item.text || item.name ? [item.text || item.name] : [];
    })
    .filter((text) => typeof text === 'string' && text.trim().length > 0);
};

// Listen for query requests from extension popup panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeRecipe') {
    console.log('[Recipe Scraper] Active tab query received');
    const schema = extractSchemaRecipe();

    if (!schema) {
      sendResponse({
        success: false,
        error: 'Could not find any structured Schema.org Recipe metadata on this webpage.'
      });
      return;
    }

    // Compile normalized clean response using pure map associations
    const normalized = {
      success: true,
      title: schema.name || document.title.split('-')[0].trim(),
      description: schema.description || '',
      prepTime: normalizeDuration(schema.prepTime || schema.totalTime),
      cookTime: normalizeDuration(schema.cookTime),
      servings: normalizeYield(schema.recipeYield),
      image: normalizeImage(schema.image),
      categories: schema.recipeCategory
        ? Array.isArray(schema.recipeCategory)
          ? schema.recipeCategory
          : [schema.recipeCategory]
        : ['Main Course'],
      tags: schema.keywords
        ? Array.isArray(schema.keywords)
          ? schema.keywords
          : schema.keywords.split(',').map((s) => s.trim())
        : [],
      ingredients: Array.isArray(schema.recipeIngredient)
        ? schema.recipeIngredient.map((i) => i.trim())
        : [],
      instructions: normalizeInstructions(schema.recipeInstructions),
      sourceDomain: window.location.hostname
    };

    sendResponse(normalized);
  }
  return false;
});
