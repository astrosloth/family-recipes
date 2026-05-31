/**
 * --- SHOPPING & GROCERY LIST COMPONENT ---
 * Pure-functional pipeline rendering aggregated ingredients added from recipes.
 * Supports checking off items, adding custom goods, and bulk cleaning lists.
 */

import { getState, updateState, showToast } from '../state-store';
import { formatQuantity } from '../recipe-parser';

/**
 * Renders the Shopping list dashboard.
 * @param {HTMLElement} container
 */
export const renderShoppingList = (container) => {
  const { shoppingList } = getState();

  const hasItems = shoppingList.length > 0;

  // 1. Render layout shell
  container.innerHTML = `
    <div class="container">
      <div class="shopping-pane">
        <h1 class="shopping-title">
          <span>
            <i class="fa-solid fa-basket-shopping" style="color: hsl(var(--accent-primary-hsl)); margin-right: 12px;"></i>
            Shopping List
          </span>
          ${
            hasItems
              ? `
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" id="btn-clear-checked" style="padding: 8px 12px; font-size:12px;">
                <i class="fa-solid fa-broom"></i> Clear Checked
              </button>
              <button class="btn btn-danger" id="btn-clear-all" style="padding: 8px 12px; font-size:12px; background: rgba(190, 18, 60, 0.1); border-color: rgba(190, 18, 60, 0.2); color: hsl(var(--accent-tertiary-hsl));">
                <i class="fa-solid fa-trash-can"></i> Clear All
              </button>
            </div>
          `
              : ''
          }
        </h1>
        
        <!-- Grocery Checklist -->
        <div id="shopping-list-items-box">
          ${
            !hasItems
              ? `
            <div class="shopping-empty">
              <i class="fa-solid fa-cart-flat-bed-suitcases"></i>
              <p>Your shopping list is currently empty.</p>
              <span style="font-size: 13px; color: hsl(var(--text-tertiary-hsl));">Browse recipes and click <b>"Add Ingredients to List"</b> to build your grocery run!</span>
            </div>
          `
              : `
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${shoppingList
                .map((item) => {
                  const qtyStr = item.quantity ? `${formatQuantity(item.quantity)} ` : '';
                  const unitStr = item.unit ? `${item.unit} ` : '';
                  const sourceStr = item.recipeTitle
                    ? `<span style="font-size: 11px; color: hsl(var(--text-tertiary-hsl)); margin-left: 8px; font-style: italic;">(from ${item.recipeTitle})</span>`
                    : '';

                  return `
                  <div class="shopping-item ${item.checked ? 'checked' : ''}" data-shop-id="${item.id}">
                    <div class="shopping-item-left">
                      <div class="ingredient-checkbox" style="border-radius: 50%;">
                        <i class="fa-solid fa-check"></i>
                      </div>
                      <span class="shopping-item-text">
                        <b>${qtyStr}${unitStr}</b>${item.name}
                        ${sourceStr}
                      </span>
                    </div>
                    <button class="remove-shopping-item" data-remove-id="${item.id}" title="Remove Item">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                `;
                })
                .join('')}
            </div>
          `
          }
        </div>
        
        <!-- Custom Item Adder Form -->
        <div class="shopping-adder">
          <input 
            type="text" 
            id="custom-shop-input" 
            class="form-input" 
            placeholder="Add custom item... e.g. 2 gallons milk, aluminum foil" 
            autocomplete="off"
          />
          <button class="btn btn-primary" id="btn-add-custom-shop">
            <i class="fa-solid fa-plus"></i> Add
          </button>
        </div>
      </div>
    </div>
  `;

  // --- ATTACH EVENT HANDLERS (COMPOSITION ON STATE ENGINE) ---

  if (hasItems) {
    // Individual item check togglers
    document.querySelectorAll('.shopping-item-left').forEach((itemLeft) => {
      itemLeft.addEventListener('click', (e) => {
        const row = e.currentTarget.closest('.shopping-item');
        const id = row.getAttribute('data-shop-id');

        const newShoppingList = shoppingList.map((item) =>
          item.id === id ? { ...item, checked: !item.checked } : item
        );

        updateState({ shoppingList: newShoppingList });
      });
    });

    // Individual item removers
    document.querySelectorAll('.remove-shopping-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-remove-id');
        const newShoppingList = shoppingList.filter((item) => item.id !== id);

        updateState({ shoppingList: newShoppingList });
        showToast('Item removed from shopping list', 'info');
      });
    });

    // Clear Checked items
    document.getElementById('btn-clear-checked').addEventListener('click', () => {
      const remaining = shoppingList.filter((item) => !item.checked);
      const countCleared = shoppingList.length - remaining.length;

      updateState({ shoppingList: remaining });
      showToast(`Cleared ${countCleared} checked items!`, 'success');
    });

    // Clear Entire List
    document.getElementById('btn-clear-all').addEventListener('click', () => {
      if (!window.confirm('Are you sure you want to clear your entire grocery shopping list?'))
        return;

      updateState({ shoppingList: [] });
      showToast('Shopping list cleared completely.', 'info');
    });
  }

  // Add Custom Item triggers
  const addCustomItem = () => {
    const input = document.getElementById('custom-shop-input');
    const val = input.value.trim();
    if (val.length === 0) return;

    // Parse quantity/unit loosely if they start with quantities
    // e.g. "2 cartons milk" -> qty: 2, unit: "cartons", name: "milk"
    let quantity = null;
    let unit = '';
    let name = val;

    const quantityMatch = val.match(
      /^(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+(?:\.\d+)?)\s*(cup|cups|tbsp|tbsps|tsp|tsps|g|grams|kg|oz|ounces|lb|lbs|pounds|clove|cloves|can|cans|pinch|pinches|ml|l|slice|slices|carton|cartons|can|cans|pack|packs|bottle|bottles)?\s+(.+)$/i
    );

    if (quantityMatch) {
      const [_, qtyStr, unitStr, remainingName] = quantityMatch;
      // Use parseFraction logic imported dynamically or computed loosely
      const parts = qtyStr.split('/');
      if (parts.length === 2) {
        quantity = parseFloat(parts[0]) / parseFloat(parts[1]);
      } else {
        quantity = parseFloat(qtyStr);
      }
      unit = unitStr || '';
      name = remainingName;
    }

    const customItem = {
      id: `custom-shop-${Math.random().toString(36).substr(2, 5)}`,
      name,
      quantity,
      unit,
      checked: false,
      recipeTitle: 'Custom Items'
    };

    updateState({
      shoppingList: [...shoppingList, customItem]
    });

    showToast(`Added "${name}" to shopping list!`, 'success');
    input.value = '';
    input.focus();
  };

  document.getElementById('btn-add-custom-shop').addEventListener('click', addCustomItem);
  document.getElementById('custom-shop-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addCustomItem();
  });
};
