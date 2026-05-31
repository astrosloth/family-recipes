/**
 * --- INTERACTIVE COOKING MODE OVERLAY ---
 * Standalone, screen-filling overlay that isolates focus.
 * Implements ingredients checklists, step navs, and live-ticking timers.
 */

import { getState, updateState, showToast, stopCookingTimer } from '../state-store';
import { formatQuantity } from '../recipe-parser';
import { convertIngredientToWeight } from '../recipe-converter';
import { marked } from 'marked';

/**
 * Renders the full-screen interactive cooking dashboard overlay.
 * @param {HTMLElement} appShellContainer
 */
export const renderCookingMode = (appShellContainer) => {
  const {
    recipes,
    activeRecipeId,
    servingsScale,
    gramsMode,
    activeCookingStep,
    cookingPrepped,
    timer
  } = getState();

  const recipe = recipes.find((r) => r.id === activeRecipeId);
  if (!recipe) {
    window.location.hash = '#home';
    return;
  }

  // Calculate servings scale
  const originalServings = recipe.servings || 4;
  const currentServings = servingsScale[recipe.id] || originalServings;
  const scaleFactor = currentServings / originalServings;

  const totalSteps = recipe.instructions.length;
  const activeStep =
    recipe.instructions.find((s) => s.step === activeCookingStep) || recipe.instructions[0];
  const progressPercent = Math.round(((activeCookingStep - 1) / totalSteps) * 100);

  // Overwrite the entire body/shell viewport to isolate focus
  appShellContainer.innerHTML = `
    <div class="cooking-mode-overlay">
      <!-- Header -->
      <header class="cooking-header">
        <h2 class="cooking-title"><i class="fa-solid fa-kitchen-set" style="color: hsl(var(--accent-primary-hsl)); margin-right: 12px;"></i> Cooking: ${recipe.title}</h2>
        <button class="btn icon-button close-cooking-btn" id="btn-close-cooking" title="Exit Cooking Focus">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </header>
      
      <!-- Obsidian Two-Column Layout -->
      <div class="cooking-layout">
        <!-- Checklist column -->
        <div class="cooking-prep-column">
          <h3>Prep Ingredients Checklist</h3>
          
          <ul class="ingredients-list" style="gap: 10px;">
            ${recipe.ingredients
              .map((ing, index) => {
                // Apply portions
                let displayQty = ing.quantity ? ing.quantity * scaleFactor : null;
                let displayUnit = ing.unit;
                let displayText = ing.name;

                if (gramsMode && ing.scalable) {
                  const converted = convertIngredientToWeight({
                    ...ing,
                    quantity: displayQty
                  });
                  displayQty = converted.quantity;
                  displayUnit = converted.unit;
                  displayText = converted.name;
                }

                const qtyStr = displayQty ? formatQuantity(displayQty) : '';
                const isChecked = cookingPrepped.includes(`${recipe.id}-ing-${index}`);

                return `
                <li class="ingredient-item ${isChecked ? 'checked' : ''}" data-prep-idx="${index}">
                  <div class="ingredient-checkbox" style="border-color: rgba(255, 255, 255, 0.2);">
                    <i class="fa-solid fa-check"></i>
                  </div>
                  <span class="ingredient-text">
                    ${displayQty ? `<span class="ingredient-quantity-badge" style="color: hsl(var(--accent-primary-hsl));">${qtyStr}</span>` : ''}
                    ${displayUnit ? `<span class="ingredient-quantity-badge" style="color: rgba(255,255,255,0.4); font-weight: 500;">${displayUnit}</span>` : ''}
                    ${displayText}
                  </span>
                </li>
              `;
              })
              .join('')}
          </ul>
        </div>
        
        <!-- Big step focus column -->
        <div class="cooking-focus-column">
          <!-- Step progress loader -->
          <div class="cooking-progress-wrapper">
            <div class="progress-meta">
              <span>Step ${activeCookingStep} of ${totalSteps}</span>
              <span>${progressPercent}% Complete</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
            </div>
          </div>
          
          <!-- Focus Step Content -->
          <div class="cooking-step-container">
            <div class="focus-step-number">Direction Step ${activeCookingStep}</div>
            <div class="focus-step-text">
              ${marked.parse(activeStep ? activeStep.text : 'Enjoy your meal!')}
            </div>
            
            <!-- Dynamic Clickable timers for focus step -->
            ${
              activeStep && activeStep.timers.length > 0
                ? `
              <div style="margin-bottom: 32px;">
                ${activeStep.timers
                  .map(
                    (t) => `
                  <button class="btn btn-primary" data-timer-mins="${t.minutes}" style="padding: 10px 16px; font-size: 13px; margin-right: 12px; background: rgba(217, 119, 6, 0.15); border: 1px solid hsl(var(--accent-primary-hsl)); color: hsl(var(--accent-primary-hsl));">
                    <i class="fa-solid fa-stopwatch"></i> Start ${t.originalText} timer
                  </button>
                `
                  )
                  .join('')}
              </div>
            `
                : ''
            }
          </div>
          
          <!-- Large Navigation Controls -->
          <div class="cooking-navigation">
            <button class="btn btn-secondary" id="btn-cook-prev" ${activeCookingStep === 1 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>
              <i class="fa-solid fa-chevron-left"></i> Previous Step
            </button>
            <button class="btn btn-primary" id="btn-cook-next" style="padding: 14px 28px; font-size: 16px;">
              ${activeCookingStep === totalSteps ? 'Done Cooking! <i class="fa-solid fa-circle-check"></i>' : 'Next Step <i class="fa-solid fa-chevron-right"></i>'}
            </button>
          </div>
          
          <!-- Visual Floating Timer Panel (Ticking live!) -->
          ${
            timer
              ? `
            <div class="cooking-timer-pane">
              <i class="fa-solid fa-stopwatch timer-icon-spinning"></i>
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 10px; text-transform: uppercase; color: rgba(255,255,255,0.4); font-weight:600;">Timer: Step ${timer.step}</span>
                <span class="timer-time-display">
                  ${Math.floor(timer.secondsRemaining / 60)}:${(timer.secondsRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div class="timer-actions">
                <button id="btn-cancel-timer" title="Cancel Countdown"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          `
              : ''
          }
        </div>
      </div>
    </div>
  `;

  // --- ATTACH EVENT HANDLERS (PURE COMPOSITION) ---

  // Close cooking Focus Overlay
  document.getElementById('btn-close-cooking').addEventListener('click', () => {
    window.location.hash = `#recipe?id=${recipe.id}`;
  });

  // Checklist prep items toggles
  document.querySelectorAll('.ingredient-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      const idx = e.currentTarget.getAttribute('data-prep-idx');
      const itemKey = `${recipe.id}-ing-${idx}`;
      const isChecked = cookingPrepped.includes(itemKey);

      const newPrepped = isChecked
        ? cookingPrepped.filter((k) => k !== itemKey)
        : [...cookingPrepped, itemKey];

      updateState({ cookingPrepped: newPrepped });
    });
  });

  // Step Navigation Event Handlers
  document.getElementById('btn-cook-prev').addEventListener('click', () => {
    if (activeCookingStep > 1) {
      updateState({ activeCookingStep: activeCookingStep - 1 });
    }
  });

  document.getElementById('btn-cook-next').addEventListener('click', () => {
    if (activeCookingStep < totalSteps) {
      updateState({ activeCookingStep: activeCookingStep + 1 });
    } else {
      // Completed last step! Celebrate!
      showToast("👨‍🍳 Gorgeous! You finished cooking Grandma's heirloom recipe!", 'success');
      window.location.hash = `#recipe?id=${recipe.id}`;
    }
  });

  // Automated Step-timer selectors
  document.querySelectorAll('[data-timer-mins]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const mins = Number(e.currentTarget.getAttribute('data-timer-mins'));
      // Start counting!
      import('../state-store').then((m) => m.startCookingTimer(mins, activeCookingStep));
    });
  });

  // Cancel countdown timers
  const cancelTimerBtn = document.getElementById('btn-cancel-timer');
  if (cancelTimerBtn) {
    cancelTimerBtn.addEventListener('click', stopCookingTimer);
  }
};
