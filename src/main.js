/**
 * --- OUR FAMILY RECIPES CONTROL ENGINE ---
 * Static shell builder and PWA registrar.
 * Decoupled from state management to avoid ESM circular imports.
 */

import '@fortawesome/fontawesome-free/css/all.min.css';
import './style.css';
import { getState, updateState, subscribeState, toggleTheme } from './state-store';
import { parseRecipeMarkdown } from './recipe-parser';
import { fetchRecipeFiles, fetchRawFile, parseQuickConfigLink } from './github-service';

// Import visual components statically (No circular dependency!)
import { renderDashboard } from './components/Dashboard';
import { renderRecipeView } from './components/RecipeView';
import { renderCookingMode } from './components/CookingMode';
import { renderRecipeCreator } from './components/RecipeCreator';
import { renderSyncSettings } from './components/SyncSettings';
import { renderShoppingList } from './components/ShoppingList';

// Vite Raw Glob imports - packages recipes at build time for Reader offline fallback
const localRecipesRaw = import.meta.glob('/recipes/*.md', { query: '?raw', eager: true });

// --- DYNAMIC DATA LOAD FALLBACK STRATEGY ---

/**
 * Loads recipes pre-bundled during Vite packaging (Reader Offline Fallback).
 * @returns {array}
 */
const loadStaticRecipes = () => {
  try {
    return Object.entries(localRecipesRaw).map(([path, module]) => {
      const fileName = path.split('/').pop();
      const content = typeof module === 'string' ? module : module.default || '';
      return parseRecipeMarkdown(content, fileName, null);
    });
  } catch (err) {
    console.error('[State Engine] Glob static parsing failed:', err);
    return [];
  }
};

/**
 * Loads the repository config.json setting custom app title and accent color.
 * Supports both Live Sync (GitHub API) and Reader (Static Fetch) fallbacks.
 * @param {object} activeConfig
 */
const loadConfiguration = async (activeConfig) => {
  try {
    let rawConfig = null;
    if (activeConfig && activeConfig.token) {
      rawConfig = await fetchRawFile(activeConfig, 'recipes/config.json');
    } else {
      const res = await fetch('recipes/config.json');
      if (res.ok) {
        rawConfig = await res.text();
      }
    }

    if (rawConfig) {
      const configObj = JSON.parse(rawConfig);
      if (configObj && (configObj.appTitle || configObj.accentColor)) {
        updateState({
          appTitle: configObj.appTitle || 'Our Family Recipes',
          accentColor: configObj.accentColor || '#D97706'
        });
      }
    }
  } catch (err) {
    console.log('[Theme Engine] Configuration load bypassed:', err.message);
  }
};

/**
 * Master initialization strategy fetching from live GitHub or static glob.
 */
export const initializeRecipes = async () => {
  updateState({ loading: true });

  // Parse Multi-Device Setup Quick Link if present in hash
  const sharedConfig = parseQuickConfigLink((msg, type) => {
    import('./state-store').then((m) => m.showToast(msg, type));
  });
  const activeConfig = sharedConfig || getState().githubConfig;

  if (sharedConfig) {
    updateState({ githubConfig: sharedConfig });
  }

  // Synchronize app title and accent colors from repository config
  await loadConfiguration(activeConfig);

  if (activeConfig && activeConfig.token) {
    // Live GitHub Sync Mode
    try {
      import('./state-store').then((m) =>
        m.showToast('Connecting to GitHub repository...', 'info')
      );
      const files = await fetchRecipeFiles(activeConfig);

      const recipes = await Promise.all(
        files.map(async (file) => {
          const rawText = await fetchRawFile(activeConfig, file.path);
          return parseRecipeMarkdown(rawText, file.name, activeConfig);
        })
      );

      updateState({ recipes, loading: false });
      import('./state-store').then((m) =>
        m.showToast(`Dynamic Sync: Loaded ${recipes.length} recipes live!`, 'success')
      );
    } catch (err) {
      console.warn('[State Engine] Live connection failed. Loading local fallback...', err);
      import('./state-store').then((m) =>
        m.showToast('GitHub Sync Offline. Loading cached family recipes...', 'error')
      );

      // Cache Fallback
      const staticRecipes = loadStaticRecipes();
      updateState({ recipes: staticRecipes, loading: false });
    }
  } else {
    // Reader Fallback Mode
    const staticRecipes = loadStaticRecipes();
    updateState({ recipes: staticRecipes, loading: false });
  }
};

// --- LIGHT/DARK MODE HOOKS ---
const initTheme = () => {
  const savedTheme = localStorage.getItem('family-recipes-theme') || 'system';
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  const activeTheme = savedTheme === 'system' ? (systemDark ? 'dark' : 'light') : savedTheme;

  document.documentElement.setAttribute('data-theme', activeTheme);

  // Listen for system changes dynamically if System Auto is active
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const currentMode = localStorage.getItem('family-recipes-theme') || 'system';
    if (currentMode === 'system') {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      renderApp();
    }
  });
};

// --- ROUTER & ROUTE WATCHER ---
const parseRoute = () => {
  const hash = window.location.hash || '#home';

  if (hash.startsWith('#recipe?')) {
    const params = new URLSearchParams(hash.split('?')[1]);
    const id = params.get('id');
    updateState({ view: 'recipe', activeRecipeId: id });
  } else if (hash.startsWith('#cooking-mode')) {
    updateState({ view: 'cooking-mode' });
  } else if (hash.startsWith('#create')) {
    updateState({ view: 'create' });
  } else if (hash.startsWith('#shopping-list')) {
    updateState({ view: 'shopping-list' });
  } else if (hash.startsWith('#settings')) {
    updateState({ view: 'settings' });
  } else {
    updateState({ view: 'home', activeRecipeId: null });
  }
};

// --- DECLARATIVE LAYOUT ASSEMBLER ---
const renderApp = () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  const state = getState();
  const savedTheme = localStorage.getItem('family-recipes-theme') || 'system';

  const themeIcon =
    savedTheme === 'system'
      ? 'fa-circle-half-stroke'
      : savedTheme === 'dark'
        ? 'fa-sun'
        : 'fa-moon';

  const themeTitle =
    savedTheme === 'system'
      ? 'System Auto-Theme Active (Click to force Light Mode)'
      : savedTheme === 'dark'
        ? 'Dark Mode Pinned (Click to restore System Sync)'
        : 'Light Mode Pinned (Click to force Dark Mode)';

  const syncConnected = state.githubConfig && state.githubConfig.token;
  const syncIcon = syncConnected ? 'fa-cloud-arrow-up' : 'fa-cloud';

  // Renders the sticky navigation shell
  appContainer.innerHTML = `
    <header class="app-header">
      <div class="container nav-wrapper">
        <div class="logo" id="nav-logo">
          <i class="fa-solid fa-utensils"></i>
          <span>${state.appTitle || 'Our Family Recipes'}</span>
        </div>
        <nav class="nav-links">
          <div class="nav-link ${state.view === 'home' ? 'active' : ''}" id="nav-home">
            <i class="fa-solid fa-book-open"></i><span>Cookbook</span>
          </div>
          <div class="nav-link ${state.view === 'shopping-list' ? 'active' : ''}" id="nav-shopping">
            <i class="fa-solid fa-basket-shopping"></i><span>Shopping</span>
          </div>
          <div class="nav-link ${state.view === 'create' ? 'active' : ''}" id="nav-create">
            <i class="fa-solid fa-circle-plus"></i><span>Add Recipe</span>
          </div>
          <div class="nav-link ${state.view === 'settings' ? 'active' : ''}" id="nav-settings">
            <i class="fa-solid ${syncIcon}"></i><span>Sync</span>
          </div>
        </nav>
        <div class="header-actions">
          <button class="icon-button" id="theme-toggle" title="${themeTitle}">
            <i class="fa-solid ${themeIcon}"></i>
          </button>
        </div>
      </div>
    </header>
    
    <main class="app-main" id="app-main-content">
      <!-- DYNAMIC COMPONENT LOADS IN HERE -->
    </main>
    
    <div id="toast-container" class="toast-container"></div>
  `;

  // Attach Navigation Listeners (Pure Handler Delegation)
  document
    .getElementById('nav-logo')
    .addEventListener('click', () => (window.location.hash = '#home'));
  document
    .getElementById('nav-home')
    .addEventListener('click', () => (window.location.hash = '#home'));
  document
    .getElementById('nav-shopping')
    .addEventListener('click', () => (window.location.hash = '#shopping-list'));
  document
    .getElementById('nav-create')
    .addEventListener('click', () => (window.location.hash = '#create'));
  document
    .getElementById('nav-settings')
    .addEventListener('click', () => (window.location.hash = '#settings'));
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Render Component Views depending on Routing State
  const mainContent = document.getElementById('app-main-content');

  if (state.view === 'home') {
    renderDashboard(mainContent);
  } else if (state.view === 'recipe') {
    renderRecipeView(mainContent);
  } else if (state.view === 'cooking-mode') {
    // Cooking Mode is rendered as a standalone overlay to isolate focus
    renderCookingMode(appContainer);
  } else if (state.view === 'create') {
    renderRecipeCreator(mainContent);
  } else if (state.view === 'shopping-list') {
    renderShoppingList(mainContent);
  } else if (state.view === 'settings') {
    renderSyncSettings(mainContent);
  }
};

// --- INITIALIZATION ---
initTheme();
subscribeState(renderApp); // Subscribe renderer dynamically!
window.addEventListener('hashchange', parseRoute);
window.addEventListener('load', () => {
  // PWA Service Worker Registration
  if ('serviceWorker' in navigator && !window.location.hostname.includes('localhost')) {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => console.log('[PWA] Service Worker registered exactly', reg.scope))
      .catch((err) => console.error('[PWA] Service Worker registration failed', err));
  }

  parseRoute();
  initializeRecipes();
});
