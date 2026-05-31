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

/**
 * Fallback DOM Scraper that extracts recipe details based on standard DOM conventions and heuristics.
 * @returns {object|null} - Compiled fallback recipe details
 */
const scrapeDOMFallback = () => {
  try {
    const recipe = {
      title: '',
      description: '',
      prepTime: '15 mins',
      cookTime: '30 mins',
      servings: 4,
      image: '',
      categories: ['Main Course'],
      tags: [],
      ingredients: [],
      instructions: [],
      sourceDomain: window.location.hostname
    };

    // 1. Get Title: prioritize H1 elements, fallback to clean document title
    const h1s = Array.from(document.querySelectorAll('h1'));
    if (h1s.length > 0) {
      recipe.title = h1s[0].innerText.trim();
    } else {
      recipe.title = document.title.split(/[-|]/)[0].trim();
    }

    // 2. Get Description from meta tags
    const metaDesc =
      document.querySelector('meta[name="description"]') ||
      document.querySelector('meta[property="og:description"]');
    if (metaDesc) {
      recipe.description = metaDesc.getAttribute('content')?.trim() || '';
    }

    // 3. Get Image from OpenGraph / Twitter meta tags
    const metaImg =
      document.querySelector('meta[property="og:image"]') ||
      document.querySelector('meta[name="twitter:image"]');
    if (metaImg) {
      recipe.image = metaImg.getAttribute('content')?.trim() || '';
    }

    // 4. Try parsing ingredients and instructions by scanning headings
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, span'));

    let ingredientsHeader = null;
    let instructionsHeader = null;

    for (const el of headings) {
      const text = el.innerText.trim().toLowerCase();
      if (
        !ingredientsHeader &&
        (text === 'ingredients' || text === 'recipe ingredients' || text === 'what you need') &&
        el.tagName.startsWith('H')
      ) {
        ingredientsHeader = el;
      }
      if (
        !instructionsHeader &&
        (text === 'instructions' ||
          text === 'directions' ||
          text === 'steps' ||
          text === 'method' ||
          text === 'preparation') &&
        el.tagName.startsWith('H')
      ) {
        instructionsHeader = el;
      }
    }

    // Weak match fallback if H-tags didn't work
    if (!ingredientsHeader) {
      for (const el of headings) {
        const text = el.innerText.trim().toLowerCase();
        if (text === 'ingredients' || text === 'recipe ingredients') {
          ingredientsHeader = el;
          break;
        }
      }
    }
    if (!instructionsHeader) {
      for (const el of headings) {
        const text = el.innerText.trim().toLowerCase();
        if (
          text === 'instructions' ||
          text === 'directions' ||
          text === 'steps' ||
          text === 'method' ||
          text === 'preparation'
        ) {
          instructionsHeader = el;
          break;
        }
      }
    }

    // Helper to scrape list items after a header
    const scrapeListAfterElement = (headerEl) => {
      if (!headerEl) return [];
      const items = [];
      let current = headerEl;

      // Look up to 4 sibling elements
      for (let i = 0; i < 4; i++) {
        current = current.nextElementSibling;
        if (!current) break;

        // If it's a UL or OL, scrape its children
        if (current.tagName === 'UL' || current.tagName === 'OL') {
          const lis = current.querySelectorAll('li');
          lis.forEach((li) => {
            const txt = li.innerText.trim();
            if (txt.length > 0) items.push(txt);
          });
          break;
        }

        // If it's another heading, stop
        if (current.tagName.startsWith('H')) {
          break;
        }

        // If it contains list items, parse them
        const lis = current.querySelectorAll('li');
        if (lis.length > 0) {
          lis.forEach((li) => {
            const txt = li.innerText.trim();
            if (txt.length > 0) items.push(txt);
          });
          break;
        }

        // Fallback: If it's a paragraph or div with multiple lines
        if (current.tagName === 'P' || current.tagName === 'DIV') {
          const txt = current.innerText.trim();
          if (
            txt.length > 0 &&
            txt.length < 250 &&
            (current.tagName === 'P' || txt.includes('\n'))
          ) {
            if (txt.includes('\n')) {
              txt.split('\n').forEach((line) => {
                const l = line.trim();
                if (l.length > 0) items.push(l);
              });
            } else {
              items.push(txt);
            }
          }
        }
      }
      return items;
    };

    if (ingredientsHeader) {
      recipe.ingredients = scrapeListAfterElement(ingredientsHeader);
    }
    if (instructionsHeader) {
      recipe.instructions = scrapeListAfterElement(instructionsHeader);
    }

    // Heuristics broad search for Lists if headings didn't find anything
    if (recipe.ingredients.length === 0) {
      const uls = Array.from(document.querySelectorAll('ul'));
      for (const ul of uls) {
        const lis = Array.from(ul.querySelectorAll('li'));
        if (lis.length >= 3 && lis.length <= 40) {
          let score = 0;
          lis.slice(0, 5).forEach((li) => {
            const t = li.innerText.toLowerCase();
            if (/\d/.test(t)) score++;
            if (
              t.includes('cup') ||
              t.includes('tbsp') ||
              t.includes('tsp') ||
              t.includes('spoon') ||
              t.includes('gram') ||
              t.includes('oz') ||
              t.includes('pound')
            )
              score += 2;
          });
          if (score >= 4) {
            recipe.ingredients = lis.map((li) => li.innerText.trim()).filter((t) => t.length > 0);
            break;
          }
        }
      }
    }

    if (recipe.instructions.length === 0) {
      const ols = Array.from(document.querySelectorAll('ol, ul'));
      for (const ol of ols) {
        const lis = Array.from(ol.querySelectorAll('li'));
        if (lis.length >= 3 && lis.length <= 30) {
          let score = 0;
          lis.slice(0, 3).forEach((li) => {
            const t = li.innerText.toLowerCase();
            if (t.length > 30) score++;
            if (
              t.includes('heat') ||
              t.includes('bake') ||
              t.includes('mix') ||
              t.includes('add') ||
              t.includes('stir') ||
              t.includes('cook') ||
              t.includes('preheat')
            )
              score += 2;
          });
          if (score >= 3) {
            recipe.instructions = lis.map((li) => li.innerText.trim()).filter((t) => t.length > 0);
            break;
          }
        }
      }
    }

    // 5. Parse Servings
    const bodyText = document.body.innerText.toLowerCase();
    const servingsMatch = bodyText.match(/(?:serves|servings|yields?|makes)\s*:?\s*(\d+)/i);
    if (servingsMatch) {
      recipe.servings = parseInt(servingsMatch[1]);
    }

    // 6. Parse Prep/Cook Times
    const timeMatch = bodyText.match(
      /(?:prep|preparation)\s*(?:time)?\s*:?\s*(\d+\s*(?:min|hr|hour|minute)s?)/i
    );
    if (timeMatch) {
      recipe.prepTime = timeMatch[1].trim();
    }
    const cookMatch = bodyText.match(
      /(?:cook|baking)\s*(?:time)?\s*:?\s*(\d+\s*(?:min|hr|hour|minute)s?)/i
    );
    if (cookMatch) {
      recipe.cookTime = cookMatch[1].trim();
    }

    return recipe;
  } catch (err) {
    console.error('[Recipe Scraper] Fallback DOM scraper failed:', err);
    return null;
  }
};

// Listen for query requests from extension popup panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeRecipe') {
    console.log('[Recipe Scraper] Active tab query received');
    const schema = extractSchemaRecipe();

    if (!schema) {
      console.log('[Recipe Scraper] JSON-LD not found. Running DOM fallback...');
      const fallback = scrapeDOMFallback();
      if (fallback && (fallback.ingredients.length > 0 || fallback.instructions.length > 0)) {
        console.log('[Recipe Scraper] DOM fallback extraction succeeded:', fallback);
        sendResponse({
          ...fallback,
          success: true,
          isFallbackScrape: true
        });
      } else {
        sendResponse({
          success: false,
          error:
            'Could not find any structured Schema.org Recipe metadata or parse recipe content on this webpage.'
        });
      }
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
      sourceDomain: window.location.hostname,
      isFallbackScrape: false
    };

    sendResponse(normalized);
  }
  return false;
});
