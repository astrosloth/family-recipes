/**
 * --- RECIPE DETAIL COMPONENT ---
 * Declarative details viewer. Manages ingredient rescalers, weight converter toggles,
 * inline timer setups, SEO JSON-LD injections, and authenticated deletes.
 */

import { getState, updateState, showToast } from '../state-store';
import { formatQuantity, formatIngredientQuantity } from '../recipe-parser';
import { scaleAndConvertIngredient } from '../recipe-converter';
import { deleteRecipeFile } from '../github-service';
import { marked } from 'marked';

/**
 * Dynamically compiles and injects conforming JSON-LD Schema.org Recipe tags.
 * Ensures premium Google Rich Snippet indexing and total interoperability!
 *
 * @param {object} recipe
 */
const injectRecipeSchemaJson = (recipe) => {
  // Clear any existing recipe JSON-LD block
  document.getElementById('recipe-json-ld-schema')?.remove();

  const imageUrl =
    recipe.image ||
    'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80';

  // Format times in ISO 8601 duration format (e.g. "30 mins" -> "PT30M", "1 hr 15 mins" -> "PT1H15M")
  const parseIsoDuration = (timeStr) => {
    const clean = timeStr.toLowerCase();
    let duration = 'PT';

    const hourMatch = clean.match(/(\d+)\s*(hr|hour)/);
    const minMatch = clean.match(/(\d+)\s*(min|minute)/);

    if (hourMatch) duration += `${hourMatch[1]}H`;
    if (minMatch) duration += `${minMatch[1]}M`;

    return duration === 'PT' ? 'PT0M' : duration;
  };

  const schema = {
    '@context': 'https://schema.org/',
    '@type': 'Recipe',
    name: recipe.title,
    image: [imageUrl],
    description: recipe.description,
    prepTime: parseIsoDuration(recipe.prepTime),
    cookTime: parseIsoDuration(recipe.cookTime),
    recipeYield: `${recipe.servings} servings`,
    recipeCategory: recipe.categories[0] || 'Cooking',
    keywords: recipe.tags.join(', '),
    recipeIngredient: recipe.ingredients.map((i) => {
      const qtyStr = formatIngredientQuantity(i.quantity, i.rawQuantity);
      const qtyWithSpace = qtyStr ? `${qtyStr} ` : '';
      const unitStr = i.unit ? `${i.unit} ` : '';
      return `${qtyWithSpace}${unitStr}${i.name}`.trim();
    }),
    recipeInstructions: recipe.instructions.map((step) => ({
      '@type': 'HowToStep',
      text: step.text
    }))
  };

  const script = document.createElement('script');
  script.id = 'recipe-json-ld-schema';
  script.type = 'application/ld+json';
  script.innerHTML = JSON.stringify(schema);
  document.head.appendChild(script);
};

/**
 * Renders the recipe detail pane.
 * @param {HTMLElement} container
 */
export const renderRecipeView = (container) => {
  const {
    recipes,
    activeRecipeId,
    servingsScale,
    gramsMode,
    githubConfig,
    shoppingList,
    cookingPrepped
  } = getState();

  const recipe = recipes.find((r) => r.id === activeRecipeId);

  // 1. Handle Missing Recipe
  if (!recipe) {
    container.innerHTML = `
      <div class="container" style="text-align: center; padding: 60px 0;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 40px; color: hsl(var(--accent-tertiary-hsl)); margin-bottom: 16px;"></i>
        <h2>Recipe Not Found</h2>
        <p>The recipe you are looking for does not exist or has been deleted.</p>
        <button class="btn btn-primary" onclick="window.location.hash = '#home'">Back to Cookbook</button>
      </div>
    `;
    return;
  }

  // 2. Inject conforming SEO Schema JSON-LD dynamically
  injectRecipeSchemaJson(recipe);

  // 3. Scale math
  const originalServings = recipe.servings || 4;
  const currentServings = servingsScale[recipe.id] || originalServings;
  const scaleFactor = currentServings / originalServings;

  // 4. Multi-device / Auth editing credentials
  const canEdit = githubConfig && githubConfig.token;

  // 5. Render Detail Panel
  container.innerHTML = `
    <div class="container recipe-detail">
      <a class="back-btn" id="btn-back"><i class="fa-solid fa-arrow-left"></i> Back to Cookbook</a>
      
      <!-- Premium Hero Banner -->
      <div class="recipe-banner">
        <div class="banner-img-wrapper">
          <img 
            src="${recipe.image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80'}" 
            alt="${recipe.title}" 
            class="banner-img"
            onerror="this.src='https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80'"
          />
        </div>
        
        <div class="banner-info">
          <div class="recipe-categories-list">
            ${recipe.categories.map((c) => `<span class="recipe-category-badge">${c}</span>`).join('')}
          </div>
          <h1 class="recipe-title-text">${recipe.title}</h1>
          <p class="recipe-desc-text">${recipe.description || 'A delicious secret family heirloom recipe passed down through generations.'}</p>
          
          <!-- Actions -->
          <div class="recipe-actions">
            <button class="btn btn-primary" id="btn-start-cooking"><i class="fa-solid fa-kitchen-set"></i> Start Cooking</button>
            <button class="btn btn-secondary" id="btn-print"><i class="fa-solid fa-print"></i> Print Recipe</button>
            ${
              canEdit
                ? `
              <button class="btn btn-secondary" id="btn-edit-recipe"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
              <button class="btn btn-danger" id="btn-delete-recipe"><i class="fa-solid fa-trash-can"></i> Delete</button>
            `
                : ''
            }
          </div>
          
          <!-- Statistics -->
          <div class="banner-stats">
            <div class="banner-stat">
              <span class="stat-label">Prep</span>
              <span class="stat-value">${recipe.prepTime}</span>
            </div>
            <div class="banner-stat">
              <span class="stat-label">Cook</span>
              <span class="stat-value">${recipe.cookTime}</span>
            </div>
            <div class="banner-stat">
              <span class="stat-label">Yield</span>
              <span class="stat-value">${currentServings} Servings</span>
            </div>
            <div class="banner-stat">
              <span class="stat-label">Level</span>
              <span class="stat-value">${recipe.difficulty}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Recipe Split Content Grid -->
      <div class="recipe-body-grid">
        <!-- Ingredients column -->
        <div class="ingredients-pane">
          <div class="ingredients-header">
            <h2 class="ingredients-title">Ingredients</h2>
          </div>
          
          <!-- Scalers Control Box -->
          <div class="ingredients-controls">
            <div class="servings-control">
              <span>Adjust Portions:</span>
              <div class="servings-adjuster">
                <button id="btn-servings-dec"><i class="fa-solid fa-minus"></i></button>
                <span class="servings-number">${currentServings}</span>
                <button id="btn-servings-inc"><i class="fa-solid fa-plus"></i></button>
              </div>
            </div>
            
            <div class="toggle-control">
              <span>Gourmet Weight (g):</span>
              <label class="switch">
                <input type="checkbox" id="toggle-grams-mode" ${gramsMode ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
          </div>
          
          <!-- Ingredients Checklist -->
          <ul class="ingredients-list">
            ${recipe.ingredients
              .map((ing, index) => {
                const {
                  quantity: displayQty,
                  unit: displayUnit,
                  name: displayText
                } = scaleAndConvertIngredient(ing, scaleFactor, gramsMode);

                const qtyStr = formatIngredientQuantity(displayQty, ing.rawQuantity);
                const isChecked = cookingPrepped.includes(`${recipe.id}-ing-${index}`);

                return `
                <li class="ingredient-item ${isChecked ? 'checked' : ''}" data-ing-idx="${index}">
                  <div class="ingredient-checkbox">
                    <i class="fa-solid fa-check"></i>
                  </div>
                  <span class="ingredient-text">
                    ${qtyStr ? `<span class="ingredient-quantity-badge">${qtyStr}</span>` : ''}
                    ${displayUnit ? `<span class="ingredient-quantity-badge" style="color: hsl(var(--text-secondary-hsl)); font-weight: 500;">${displayUnit}</span>` : ''}
                    ${displayText}
                  </span>
                </li>
              `;
              })
              .join('')}
          </ul>
          
          <!-- Add to Aggregated Shopping List Button -->
          <div class="shopping-list-add-box">
            <button class="btn btn-secondary" id="btn-add-all-shopping" style="width: 100%; justify-content: center;">
              <i class="fa-solid fa-basket-shopping"></i> Add Ingredients to List
            </button>
          </div>
        </div>
        
        <!-- Instructions column -->
        <div class="instructions-pane">
          <h2 class="instructions-title-main">Directions</h2>
          
          <ol class="instructions-list">
            ${recipe.instructions
              .map(
                (step) => `
              <li class="instruction-step">
                <div class="step-number">${step.step}</div>
                <div class="step-content">
                  <div class="step-text">
                    <!-- Render direct marked markdown parsing of instruction steps -->
                    ${marked.parse(step.text)}
                    
                    <!-- Inject Dynamic Clickable Timer badges -->
                    ${step.timers
                      .map(
                        (t) => `
                      <span class="timer-badge" data-timer-mins="${t.minutes}" data-timer-step="${step.step}">
                        <i class="fa-solid fa-stopwatch"></i> ${t.originalText}
                      </span>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              </li>
            `
              )
              .join('')}
          </ol>
          
          <!-- Recipe Notes (Gourmet Tip Box) -->
          ${
            recipe.notes && recipe.notes.length > 0
              ? `
            <div class="recipe-notes-box" style="margin-top: 32px; padding: 24px; background: hsl(var(--bg-secondary-hsl)); border-radius: var(--border-radius-md); border-left: 4px solid hsl(var(--accent-primary-hsl));">
              <h3 style="font-family: var(--font-serif); font-size: 18px; margin-bottom: 12px; color: hsl(var(--text-primary-hsl)); display: flex; align-items: center; gap: 8px; margin-top: 0;">
                <i class="fa-solid fa-lightbulb" style="color: hsl(var(--accent-primary-hsl)); font-weight: 600;"></i> Notes & Cooking Tips
              </h3>
              <ul style="margin: 0; padding-left: 20px; color: hsl(var(--text-secondary-hsl)); font-size: 14.5px; display: flex; flex-direction: column; gap: 8px; line-height: 1.5;">
                ${recipe.notes.map((note) => `<li>${marked.parseInline(note)}</li>`).join('')}
              </ul>
            </div>
          `
              : ''
          }
        </div>
      </div>
    </div>
  `;

  // --- COMPONENT HANDLERS & BINDINGS ---

  // Back button routing handler
  document
    .getElementById('btn-back')
    .addEventListener('click', () => (window.location.hash = '#home'));

  // Portion Rescaler Event Handlers
  document.getElementById('btn-servings-dec').addEventListener('click', () => {
    if (currentServings > 1) {
      updateState({
        servingsScale: {
          ...servingsScale,
          [recipe.id]: currentServings - 1
        }
      });
    }
  });
  document.getElementById('btn-servings-inc').addEventListener('click', () => {
    updateState({
      servingsScale: {
        ...servingsScale,
        [recipe.id]: currentServings + 1
      }
    });
  });

  // Grams conversion toggle
  document.getElementById('toggle-grams-mode').addEventListener('change', (e) => {
    updateState({ gramsMode: e.target.checked });
  });

  // Ingredient prep cross-off toggler
  document.querySelectorAll('.ingredient-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      const idx = e.currentTarget.getAttribute('data-ing-idx');
      const itemKey = `${recipe.id}-ing-${idx}`;
      const isChecked = cookingPrepped.includes(itemKey);

      const newPrepped = isChecked
        ? cookingPrepped.filter((k) => k !== itemKey)
        : [...cookingPrepped, itemKey];

      updateState({ cookingPrepped: newPrepped });
    });
  });

  // Start Cooking Mode triggers
  document.getElementById('btn-start-cooking').addEventListener('click', () => {
    // Reset cooking step to 1 and route to overlay
    updateState({ activeCookingStep: 1 });
    window.location.hash = '#cooking-mode';
  });

  // Print trigger
  document.getElementById('btn-print').addEventListener('click', () => window.print());

  // Add Ingredients to Aggregated Shopping List
  document.getElementById('btn-add-all-shopping').addEventListener('click', () => {
    const listToInject = recipe.ingredients.map((ing) => {
      const {
        quantity: displayQty,
        unit: displayUnit,
        name: displayName
      } = scaleAndConvertIngredient(ing, scaleFactor, gramsMode);

      return {
        id: `${recipe.id}-shop-${Math.random().toString(36).substr(2, 5)}`,
        name: displayName,
        quantity: displayQty,
        rawQuantity: ing.rawQuantity || '',
        unit: displayUnit,
        checked: false,
        recipeTitle: recipe.title
      };
    });

    updateState({
      shoppingList: [...shoppingList, ...listToInject]
    });

    showToast(`Added ${listToInject.length} ingredients to your Shopping List!`, 'success');
  });

  // Dynamic cooking step timers
  document.querySelectorAll('.timer-badge').forEach((badge) => {
    badge.addEventListener('click', (e) => {
      const el = e.currentTarget;
      const mins = Number(el.getAttribute('data-timer-mins'));
      const step = Number(el.getAttribute('data-timer-step'));

      // Import the dynamic main app timer starter dynamically
      import('../state-store').then((m) => m.startCookingTimer(mins, step));
    });
  });

  // EDIT RECIPE (Authenticated)
  const editBtn = document.getElementById('btn-edit-recipe');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      window.location.hash = `#create?id=${recipe.id}`;
    });
  }

  // DELETE RECIPE (Authenticated live GitHub REST commit deletes!)
  const deleteBtn = document.getElementById('btn-delete-recipe');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const confirmText = `Are you absolutely sure you want to delete "${recipe.title}"? This commits a file deletion directly to your GitHub repository!`;
      if (!window.confirm(confirmText)) return;

      try {
        showToast('Deleting recipe file on GitHub...', 'info');

        // Push raw commit deletion
        await deleteRecipeFile(githubConfig, `${recipe.id}.md`, null);

        // Remove locally from state list
        const remaining = recipes.filter((r) => r.id !== recipe.id);
        updateState({ recipes: remaining });

        showToast('Recipe deleted successfully from repository!', 'success');
        window.location.hash = '#home';
      } catch (err) {
        showToast(`Failed to delete: ${err.message}`, 'error');
      }
    });
  }
};
