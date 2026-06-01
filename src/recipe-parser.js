/**
 * --- PURE FUNCTIONAL RECIPE PARSING PIPELINE ---
 * Safe, immutable transformations parsing markdown recipes.
 */

// Regular expressions for parsing
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const INGREDIENT_LINE_REGEX =
  /^\s*-\s+(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+(?:\.\d+)?|-)?\s*(cup|cups|tbsp|tbsps|tsp|tsps|g|grams|kg|oz|ounces|lb|lbs|pounds|clove|cloves|can|cans|pinch|pinches|ml|l|slice|slices)?\s+(.+)$/i;
const DURATION_REGEX =
  /\b(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+(?:\.\d+)?)\s*(mins?|minutes?|hours?|hrs?)\b/gi;

/**
 * Parses fractional strings (e.g. "1 1/2", "3/4") into decimal numbers.
 * @param {string} fractionStr
 * @returns {number|null}
 */
export const parseFraction = (fractionStr) => {
  if (!fractionStr) return null;
  const trimmed = fractionStr.trim();

  // Mixed number (e.g., "1 1/2")
  if (trimmed.includes(' ')) {
    const parts = trimmed.split(/\s+/);
    const whole = parseFloat(parts[0]);
    const fraction = parseFraction(parts[1]);
    return whole + (fraction || 0);
  }

  // Standard fraction (e.g., "1/2")
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    const numerator = parseFloat(parts[0]);
    const denominator = parseFloat(parts[1]);
    return denominator !== 0 ? numerator / denominator : null;
  }

  // Decimal or integer
  const parsed = parseFloat(trimmed);
  return !isNaN(parsed) ? parsed : null;
};

/**
 * Formats a decimal quantity back into a readable fractional string.
 * @param {number} decimalVal
 * @returns {string}
 */
export const formatQuantity = (decimalVal) => {
  if (!decimalVal) return '';
  if (Number.isInteger(decimalVal)) return decimalVal.toString();

  const whole = Math.floor(decimalVal);
  const remainder = decimalVal - whole;

  // Find nearest common culinary fraction (tolerance 0.02)
  const fractions = [
    { fraction: '1/8', val: 0.125 },
    { fraction: '1/4', val: 0.25 },
    { fraction: '1/3', val: 0.333 },
    { fraction: '3/8', val: 0.375 },
    { fraction: '1/2', val: 0.5 },
    { fraction: '5/8', val: 0.625 },
    { fraction: '2/3', val: 0.666 },
    { fraction: '3/4', val: 0.75 },
    { fraction: '7/8', val: 0.875 }
  ];

  const matched = fractions.find((f) => Math.abs(remainder - f.val) < 0.03);

  if (matched) {
    return whole > 0 ? `${whole} ${matched.fraction}` : matched.fraction;
  }

  // Fallback to 1 decimal place
  return decimalVal.toFixed(1);
};

/**
 * Resolves a local markdown relative image path to its absolute environment URL.
 * @param {string} imagePath
 * @param {object|null} githubConfig
 * @returns {string}
 */
export const resolveImagePath = (imagePath, githubConfig = null) => {
  if (!imagePath) return '';
  if (
    imagePath.startsWith('http://') ||
    imagePath.startsWith('https://') ||
    imagePath.startsWith('data:')
  ) {
    return imagePath;
  }

  const cleanPath = imagePath.replace(/^\.\//, '');

  if (githubConfig && githubConfig.token) {
    // Dynamic GitHub content URL
    return `https://raw.githubusercontent.com/${githubConfig.owner}/${githubConfig.repo}/${githubConfig.branch || 'main'}/recipes/${cleanPath}`;
  }

  // Fallback static public assets path
  return `./recipes/${cleanPath}`;
};

/**
 * Parses individual YAML frontmatter lines.
 * @param {string} yamlText
 * @returns {object}
 */
const parseYaml = (yamlText) =>
  yamlText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .reduce((acc, line) => {
      const sep = line.indexOf(':');
      if (sep === -1) return acc;

      const key = line.slice(0, sep).trim();
      let val = line.slice(sep + 1).trim();

      // Clean quotes
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }

      // Parse arrays (e.g. ["Dessert", "Baking"])
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          val = JSON.parse(val.replace(/'/g, '"'));
        } catch {
          val = val
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim().replace(/^["']|["']$/g, ''));
        }
      } else if (!isNaN(val) && val !== '') {
        val = Number(val);
      }

      acc[key] = val;
      return acc;
    }, {});

/**
 * Parses standard ingredients list from markdown body.
 * @param {string} sectionText
 * @returns {array}
 */
const parseIngredientsSection = (sectionText) =>
  sectionText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .map((line) => {
      const match = line.match(INGREDIENT_LINE_REGEX);
      if (!match) {
        return {
          originalText: line.replace(/^\s*-\s+/, ''),
          quantity: null,
          unit: '',
          name: line.replace(/^\s*-\s+/, ''),
          scalable: false
        };
      }

      const [_, rawQty, rawUnit, name] = match;
      const quantity = rawQty ? parseFraction(rawQty) : null;

      return {
        originalText: line.replace(/^\s*-\s+/, ''),
        quantity,
        unit: rawUnit ? rawUnit.toLowerCase().trim() : '',
        name: name.trim(),
        scalable: quantity !== null
      };
    });

/**
 * Parses instructions ordered list from markdown body.
 * @param {string} sectionText
 * @returns {array}
 */
const parseInstructionsSection = (sectionText) =>
  sectionText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line, index) => {
      const stepText = line.replace(/^\d+\.\s+/, '');

      // Extract cooking timer details dynamically
      const durationMatches = Array.from(stepText.matchAll(DURATION_REGEX));
      const timers = durationMatches.map((m) => {
        const [_, qtyStr, unitStr] = m;
        const rawMinutes = parseFraction(qtyStr);

        let minutes = rawMinutes || 0;
        if (unitStr.toLowerCase().startsWith('hour') || unitStr.toLowerCase().startsWith('hr')) {
          minutes = minutes * 60;
        }

        return {
          originalText: m[0],
          minutes: Math.round(minutes)
        };
      });

      return {
        step: index + 1,
        text: stepText,
        timers
      };
    });

/**
 * Parses notes list from markdown body (accepts lists starting with '-' or '*').
 * @param {string} sectionText
 * @returns {array}
 */
const parseNotesSection = (sectionText) =>
  sectionText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('## Notes'))
    .map((line) => line.replace(/^\s*[-*]\s+/, ''));

/**
 * The master functional parsing pipeline.
 * Takes a markdown raw string and constructs a highly structured, immutable recipe record.
 * Uses Try-Catch isolation to prevent malformed files from breaking execution.
 *
 * @param {string} mdContent
 * @param {string} fileName
 * @param {object|null} githubConfig
 * @returns {object}
 */
export const parseRecipeMarkdown = (mdContent, fileName = '', githubConfig = null) => {
  try {
    const match = mdContent.match(FRONTMATTER_REGEX);
    if (!match) {
      throw new Error('Missing closed YAML frontmatter metadata blocks');
    }

    const [_, yamlBlock, bodyContent] = match;
    const metadata = parseYaml(yamlBlock);

    // Resolve relative path mapping
    const resolvedImage = metadata.image ? resolveImagePath(metadata.image, githubConfig) : '';

    // Split body into segments dynamically considering ## Ingredients, ## Instructions, and ## Notes
    const ingredientsStartIndex = bodyContent.indexOf('## Ingredients');
    const instructionsStartIndex = bodyContent.indexOf('## Instructions');
    const notesStartIndex = bodyContent.indexOf('## Notes');

    if (ingredientsStartIndex === -1) {
      throw new Error("Missing '## Ingredients' markdown header section");
    }

    let ingredientsBlock = '';
    let instructionsBlock = '';
    let notesBlock = '';

    if (instructionsStartIndex !== -1) {
      ingredientsBlock = bodyContent.slice(ingredientsStartIndex, instructionsStartIndex);

      if (notesStartIndex !== -1) {
        instructionsBlock = bodyContent.slice(instructionsStartIndex, notesStartIndex);
        notesBlock = bodyContent.slice(notesStartIndex);
      } else {
        instructionsBlock = bodyContent.slice(instructionsStartIndex);
      }
    } else {
      if (notesStartIndex !== -1) {
        ingredientsBlock = bodyContent.slice(ingredientsStartIndex, notesStartIndex);
        notesBlock = bodyContent.slice(notesStartIndex);
      } else {
        ingredientsBlock = bodyContent.slice(ingredientsStartIndex);
      }
    }

    const ingredients = parseIngredientsSection(ingredientsBlock);
    const instructions = parseInstructionsSection(instructionsBlock);
    const notes = notesBlock ? parseNotesSection(notesBlock) : [];

    return {
      success: true,
      id: fileName.replace(/\.md$/, ''),
      fileName,
      title: metadata.title || fileName.replace(/\.md$/, '').replace(/-/g, ' '),
      description: metadata.description || '',
      prepTime: metadata.prepTime || '0m',
      cookTime: metadata.cookTime || '0m',
      servings: Number(metadata.servings) || 4,
      difficulty: metadata.difficulty || 'Easy',
      image: resolvedImage,
      categories: Array.isArray(metadata.categories)
        ? metadata.categories
        : [metadata.categories || 'Other'],
      tags: Array.isArray(metadata.tags) ? metadata.tags : metadata.tags ? [metadata.tags] : [],
      ingredients,
      instructions,
      notes,
      rawContent: mdContent
    };
  } catch (error) {
    console.error(`[Recipe Parser Error] in file "${fileName}":`, error.message);
    return {
      success: false,
      id: fileName.replace(/\.md$/, ''),
      fileName,
      title: fileName.replace(/\.md$/, '').replace(/-/g, ' '),
      error: error.message,
      rawContent: mdContent
    };
  }
};
