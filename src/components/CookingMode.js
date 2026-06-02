/**
 * --- INTERACTIVE COOKING MODE OVERLAY ---
 * Standalone, screen-filling overlay that isolates focus.
 * Implements ingredients checklists, step navs, and live-ticking timers.
 */

import {
  getState,
  updateState,
  showToast,
  stopCookingTimer,
  startCookingTimer
} from '../state-store';
import { formatIngredientQuantity } from '../recipe-parser';
import { scaleAndConvertIngredient } from '../recipe-converter';
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

  const isAlreadyMounted = window.cookingModeMounted;
  window.cookingModeMounted = true;

  // Selective update if overlay is already in DOM to avoid flashing/fading
  const overlay = appShellContainer.querySelector('.cooking-mode-overlay');
  if (overlay) {
    // 1. Update checklist checked states
    const prepItems = overlay.querySelectorAll('.ingredient-item');
    prepItems.forEach((item) => {
      const idx = item.getAttribute('data-prep-idx');
      const itemKey = `${recipe.id}-ing-${idx}`;
      const isChecked = cookingPrepped.includes(itemKey);
      if (isChecked) {
        item.classList.add('checked');
      } else {
        item.classList.remove('checked');
      }
    });

    // 2. Check if the step changed
    const currentRenderedStep = parseInt(overlay.dataset.renderedStep, 10);
    if (currentRenderedStep !== activeCookingStep) {
      overlay.dataset.renderedStep = activeCookingStep;

      // Update progress loader
      const progressMeta = overlay.querySelector('.progress-meta');
      if (progressMeta) {
        progressMeta.innerHTML = `
          <span>Step ${activeCookingStep} of ${totalSteps}</span>
          <span>${progressPercent}% Complete</span>
        `;
      }
      const progressBarFill = overlay.querySelector('.progress-bar-fill');
      if (progressBarFill) {
        progressBarFill.style.width = `${progressPercent}%`;
      }

      // Update step content
      const stepContainer = overlay.querySelector('.cooking-step-container');
      if (stepContainer) {
        stepContainer.innerHTML = `
          <div class="focus-step-number">Direction Step ${activeCookingStep}</div>
          <div class="focus-step-text">
            ${marked.parse(activeStep ? activeStep.text : 'Enjoy your meal!')}
          </div>
          ${
            activeStep && activeStep.timers.length > 0
              ? `
            <div style="margin-bottom: 32px;">
              ${activeStep.timers
                .map(
                  (t) => `
                <button class="btn btn-primary btn-start-step-timer" data-timer-mins="${t.minutes}" style="padding: 10px 16px; font-size: 13px; margin-right: 12px; background: rgba(217, 119, 6, 0.15); border: 1px solid hsl(var(--accent-primary-hsl)); color: hsl(var(--accent-primary-hsl));">
                  <i class="fa-solid fa-stopwatch"></i> Start ${t.originalText} timer
                </button>
              `
                )
                .join('')}
            </div>
          `
              : ''
          }
        `;

        // Re-bind timer click events for new step
        stepContainer.querySelectorAll('.btn-start-step-timer').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const mins = Number(e.currentTarget.getAttribute('data-timer-mins'));
            startCookingTimer(mins, getState().activeCookingStep);
          });
        });
      }

      // Update navigation buttons
      const prevBtn = overlay.querySelector('#btn-cook-prev');
      if (prevBtn) {
        if (activeCookingStep === 1) {
          prevBtn.setAttribute('disabled', 'true');
          prevBtn.style.opacity = '0.3';
          prevBtn.style.cursor = 'not-allowed';
        } else {
          prevBtn.removeAttribute('disabled');
          prevBtn.style.opacity = '';
          prevBtn.style.cursor = '';
        }
      }

      const nextBtn = overlay.querySelector('#btn-cook-next');
      if (nextBtn) {
        nextBtn.innerHTML =
          activeCookingStep === totalSteps
            ? 'Done Cooking! <i class="fa-solid fa-circle-check"></i>'
            : 'Next Step <i class="fa-solid fa-chevron-right"></i>';
      }
    }

    // 3. Update the floating timer panel
    let timerPane = overlay.querySelector('.cooking-timer-pane');
    if (timer) {
      const timerHtml = `
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
      `;

      if (timerPane) {
        timerPane.innerHTML = timerHtml;
      } else {
        timerPane = document.createElement('div');
        timerPane.className = 'cooking-timer-pane';
        timerPane.innerHTML = timerHtml;
        overlay.querySelector('.cooking-focus-column').appendChild(timerPane);
      }

      // Re-bind cancel click event
      const cancelBtn = timerPane.querySelector('#btn-cancel-timer');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', stopCookingTimer);
      }
    } else if (timerPane) {
      timerPane.remove();
    }

    // 4. Update step start timer button disabled states if timer is active
    const isTimerRunning = !!timer;
    overlay.querySelectorAll('.btn-start-step-timer').forEach((btn) => {
      if (isTimerRunning) {
        btn.setAttribute('disabled', 'true');
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
      } else {
        btn.removeAttribute('disabled');
        btn.style.opacity = '';
        btn.style.cursor = '';
      }
    });

    return;
  }

  // Overwrite the entire body/shell viewport to isolate focus
  appShellContainer.innerHTML = `
    <div class="cooking-mode-overlay ${isAlreadyMounted ? 'no-animation' : ''}" data-rendered-step="${activeCookingStep}">
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
                const {
                  quantity: displayQty,
                  unit: displayUnit,
                  name: displayText
                } = scaleAndConvertIngredient(ing, scaleFactor, gramsMode);

                const qtyStr = formatIngredientQuantity(displayQty, ing.rawQuantity);
                const isChecked = cookingPrepped.includes(`${recipe.id}-ing-${index}`);

                return `
                <li class="ingredient-item ${isChecked ? 'checked' : ''}" data-prep-idx="${index}">
                  <div class="ingredient-checkbox" style="border-color: rgba(255, 255, 255, 0.2);">
                    <i class="fa-solid fa-check"></i>
                  </div>
                  <span class="ingredient-text">
                    ${qtyStr ? `<span class="ingredient-quantity-badge" style="color: hsl(var(--accent-primary-hsl));">${qtyStr}</span>` : ''}
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
                  <button class="btn btn-primary btn-start-step-timer" data-timer-mins="${t.minutes}" ${timer ? 'disabled style="opacity:0.5; cursor:not-allowed; padding: 10px 16px; font-size: 13px; margin-right: 12px; background: rgba(217, 119, 6, 0.15); border: 1px solid hsl(var(--accent-primary-hsl)); color: hsl(var(--accent-primary-hsl));"' : 'style="padding: 10px 16px; font-size: 13px; margin-right: 12px; background: rgba(217, 119, 6, 0.15); border: 1px solid hsl(var(--accent-primary-hsl)); color: hsl(var(--accent-primary-hsl));"'} >
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
      const { cookingPrepped } = getState();
      const isChecked = cookingPrepped.includes(itemKey);

      const newPrepped = isChecked
        ? cookingPrepped.filter((k) => k !== itemKey)
        : [...cookingPrepped, itemKey];

      updateState({ cookingPrepped: newPrepped });
    });
  });

  // Step Navigation Event Handlers
  document.getElementById('btn-cook-prev').addEventListener('click', () => {
    const { activeCookingStep } = getState();
    if (activeCookingStep > 1) {
      updateState({ activeCookingStep: activeCookingStep - 1 });
    }
  });

  document.getElementById('btn-cook-next').addEventListener('click', () => {
    const { activeCookingStep } = getState();
    if (activeCookingStep < totalSteps) {
      updateState({ activeCookingStep: activeCookingStep + 1 });
    } else {
      // Completed last step! Celebrate!
      showToast("👨‍🍳 Gorgeous! You finished cooking Grandma's heirloom recipe!", 'success');
      window.location.hash = `#recipe?id=${recipe.id}`;
    }
  });

  // Automated Step-timer selectors
  document.querySelectorAll('.btn-start-step-timer').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const mins = Number(e.currentTarget.getAttribute('data-timer-mins'));
      // Start counting!
      const { activeCookingStep } = getState();
      startCookingTimer(mins, activeCookingStep);
    });
  });

  // Cancel countdown timers
  const cancelTimerBtn = document.getElementById('btn-cancel-timer');
  if (cancelTimerBtn) {
    cancelTimerBtn.addEventListener('click', stopCookingTimer);
  }
};
