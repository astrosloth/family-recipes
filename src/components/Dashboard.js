/**
 * --- COOKBOOK DASHBOARD VIEW ---
 * Declarative component rendering categories, tag aggregates, and recipe card collections.
 */

import { getState, updateState } from '../state-store';

// Categories with matching icons
const CATEGORY_STAPLES = [
  { name: 'Breakfast', icon: 'fa-egg' },
  { name: 'Main Course', icon: 'fa-bowl-food' },
  { name: 'Dessert', icon: 'fa-cake-candles' },
  { name: 'Baking', icon: 'fa-bread-slice' },
  { name: 'Appetizer', icon: 'fa-carrot' }
];

/**
 * Aggregates all unique tags across parsed recipes.
 * @param {array} recipes
 * @returns {array}
 */
const getUniqueTags = (recipes) =>
  [...new Set(recipes.filter((r) => r.success).flatMap((r) => r.tags || []))].sort();

/**
 * Renders the dashboard view dynamically inside the main content shell.
 * @param {HTMLElement} container
 */
export const renderDashboard = (container) => {
  const { recipes, loading, searchQuery, selectedCategory, selectedTags, favorites } = getState();

  // 1. Render Loading State
  if (loading) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; gap: 20px;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 40px; color: hsl(var(--accent-primary-hsl));"></i>
        <h3 style="font-family: var(--font-sans); font-size: 18px; color: hsl(var(--text-secondary-hsl));">Fetching family secrets...</h3>
      </div>
    `;
    return;
  }

  // 2. Aggregate Tags
  const availableTags = getUniqueTags(recipes);

  // 3. Pipeline Filter Recipes using Declarative Combinators
  const filteredRecipes = recipes.filter((recipe) => {
    // Search matching (Text, ingredients, or tags)
    const matchSearch =
      searchQuery.trim() === '' ||
      recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (recipe.description &&
        recipe.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (recipe.tags &&
        recipe.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      (recipe.ingredients &&
        recipe.ingredients.some((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase())));

    // Category matching
    const matchCategory =
      selectedCategory === '' ||
      (recipe.categories &&
        recipe.categories.some((c) => c.toLowerCase() === selectedCategory.toLowerCase()));

    // Tags matching (Intersection: recipe must match ALL selected tags)
    const matchTags =
      selectedTags.length === 0 ||
      (recipe.tags && selectedTags.every((tag) => recipe.tags.includes(tag)));

    return matchSearch && matchCategory && matchTags;
  });

  // 4. Render Layout HTML
  const showTagCloud = !document.getElementById('tag-cloud')?.classList.contains('hidden');
  const favoritesSet = new Set(favorites.map(String));

  container.innerHTML = `
    <div class="hero-section">
      <h1 class="hero-title">Our Family Cookbook</h1>
      <p class="hero-subtitle">Handed down recipes, made for modern kitchens. Access offline, sync instantly with GitHub.</p>
    </div>
    
    <div class="search-filter-bar">
      <!-- Search Field -->
      <div class="search-input-wrapper">
        <input 
          type="text" 
          id="search-box" 
          class="search-input" 
          placeholder="Search by recipe, ingredient, or tags..." 
          value="${searchQuery}"
          autocomplete="off"
        />
        <i class="fa-solid fa-magnifying-glass"></i>
      </div>
      
      <!-- Category Card Selector -->
      <div class="categories-container">
        <div class="category-card ${selectedCategory === '' ? 'active' : ''}" data-cat="">
          <i class="fa-solid fa-border-all"></i>
          <span>All Recipes</span>
        </div>
        ${CATEGORY_STAPLES.map(
          (cat) => `
          <div class="category-card ${selectedCategory === cat.name ? 'active' : ''}" data-cat="${cat.name}">
            <i class="fa-solid ${cat.icon}"></i>
            <span>${cat.name}</span>
          </div>
        `
        ).join('')}
      </div>
      
      <!-- Tag Drawer Cloud -->
      <div class="tag-filter-section">
        <button class="tag-toggle-btn" id="tag-cloud-toggle">
          <i class="fa-solid fa-tags"></i>
          <span>${showTagCloud ? 'Hide Tags Cloud' : 'Filter by Tags'}</span>
          <i class="fa-solid ${showTagCloud ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
        </button>
        
        <div class="tag-cloud ${showTagCloud ? '' : 'hidden'}" id="tag-cloud">
          ${availableTags.length === 0 ? '<span style="font-size: 13px; color: hsl(var(--text-tertiary-hsl));">No tags found</span>' : ''}
          ${availableTags
            .map((tag) => {
              const isActive = selectedTags.includes(tag);
              return `<span class="tag-badge ${isActive ? 'active' : ''}" data-tag="${tag}">${tag}</span>`;
            })
            .join('')}
        </div>
      </div>
    </div>
    
    <!-- Recipe Grid -->
    <div class="recipes-grid">
      ${filteredRecipes
        .map((recipe) => {
          const isFavorite = favoritesSet.has(String(recipe.id));

          // 4a. Handle Fault-Tolerant Malformed Recipe Warning Card
          if (!recipe.success) {
            return `
            <div class="recipe-card error-recipe-card">
              <div class="card-content">
                <h3 class="error-card-title"><i class="fa-solid fa-triangle-exclamation"></i> Recipe Load Warning</h3>
                <div class="error-card-text">File: <b>${recipe.fileName}</b><br>Reason: ${recipe.error}</div>
                <div style="margin-top: auto;">
                  <button class="btn btn-secondary btn-danger" onclick="window.location.hash = '#settings'" style="width: 100%; justify-content: center; font-size: 13px; padding: 8px;">
                    <i class="fa-solid fa-screwdriver-wrench"></i> Configure Sync Settings
                  </button>
                </div>
              </div>
            </div>
          `;
          }

          // 4b. Render Beautiful Premium Card
          return `
          <div class="recipe-card" data-id="${recipe.id}">
            <div class="card-img-wrapper" id="card-img-${recipe.id}">
              <img 
                src="${recipe.image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80'}" 
                alt="${recipe.title}" 
                class="card-img" 
                loading="lazy"
                onerror="this.src='https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80'"
              />
              <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-fav-id="${recipe.id}">
                <i class="fa-solid fa-heart"></i>
              </button>
            </div>
            
            <div class="card-content">
              <div class="card-meta">
                <span class="card-category">${recipe.categories[0] || 'Recipe'}</span>
              </div>
              <h3 class="card-title" id="card-title-${recipe.id}">${recipe.title}</h3>
              <p class="card-description">${recipe.description || 'No description provided.'}</p>
              
              <div class="card-stats">
                <span class="card-stat"><i class="fa-regular fa-clock"></i> ${recipe.prepTime}</span>
                <span class="card-stat"><i class="fa-solid fa-fire-burner"></i> ${recipe.cookTime}</span>
                <span class="card-stat"><i class="fa-solid fa-chart-line"></i> ${recipe.difficulty}</span>
              </div>
            </div>
          </div>
        `;
        })
        .join('')}
    </div>
    
    <!-- Empty State -->
    ${
      filteredRecipes.length === 0
        ? `
      <div class="empty-state">
        <i class="fa-solid fa-mortar-pestle"></i>
        <h3>No Recipes Match Your Filters</h3>
        <p>Try refining your search text, selecting another category, or resetting active tags.</p>
        <button class="btn btn-primary" id="btn-reset-filters">Reset All Filters</button>
      </div>
    `
        : ''
    }
  `;

  // --- ATTACH EVENT HANDLERS (PURE COMPOSITION) ---

  // Search input change handler
  const searchBox = document.getElementById('search-box');
  searchBox.addEventListener('input', (e) => {
    updateState({ searchQuery: e.target.value });
    // Refocus box and keep cursor position
    const box = document.getElementById('search-box');
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  });

  // Category click handlers
  document.querySelectorAll('.category-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      const cardEl = e.currentTarget;
      const cat = cardEl.getAttribute('data-cat');
      updateState({ selectedCategory: cat });
    });
  });

  // Tag cloud toggle click
  const tagToggle = document.getElementById('tag-cloud-toggle');
  tagToggle.addEventListener('click', () => {
    const cloud = document.getElementById('tag-cloud');
    const isHidden = cloud.classList.contains('hidden');

    if (isHidden) {
      cloud.classList.remove('hidden');
      tagToggle.innerHTML =
        '<i class="fa-solid fa-tags"></i> <span>Hide Tags Cloud</span> <i class="fa-solid fa-chevron-up"></i>';
    } else {
      cloud.classList.add('hidden');
      tagToggle.innerHTML =
        '<i class="fa-solid fa-tags"></i> <span>Filter by Tags</span> <i class="fa-solid fa-chevron-down"></i>';
    }
  });

  // Tag badge click handlers
  document.querySelectorAll('.tag-badge').forEach((badge) => {
    badge.addEventListener('click', (e) => {
      const tag = e.currentTarget.getAttribute('data-tag');
      const isSelected = selectedTags.includes(tag);

      const newSelectedTags = isSelected
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag];

      updateState({ selectedTags: newSelectedTags });
    });
  });

  // Favorite button click handlers (stops event bubbling!)
  document.querySelectorAll('.favorite-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const favId = e.currentTarget.getAttribute('data-fav-id');
      const isFav = favoritesSet.has(favId);

      const newFavorites = isFav ? favorites.filter((f) => String(f) !== favId) : [...favorites, favId];

      updateState({ favorites: newFavorites });
    });
  });

  // Card details routing click handlers
  document.querySelectorAll('.recipe-card').forEach((card) => {
    const id = card.getAttribute('data-id');
    if (!id) return;

    const routeHandler = () => (window.location.hash = `#recipe?id=${id}`);

    const cardTitle = card.querySelector(`#card-title-${id}`);
    const cardImg = card.querySelector(`#card-img-${id}`);

    if (cardTitle) cardTitle.addEventListener('click', routeHandler);
    if (cardImg) cardImg.addEventListener('click', routeHandler);
  });

  // Reset filters handler
  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      updateState({
        searchQuery: '',
        selectedCategory: '',
        selectedTags: []
      });
    });
  }
};
