/**
 * --- UNIVERSAL RECIPE SCHEMA.ORG CONTENT SCRAPER ---
 * Message listener for dynamic injections. Scraper logic is in recipe-scraper.js.
 */

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
      notes: scrapeNotesFromDOM(),
      sourceDomain: window.location.hostname,
      isFallbackScrape: false
    };

    sendResponse(normalized);
  }
  return false;
});
