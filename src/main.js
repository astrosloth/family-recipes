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
      if (configObj) {
        updateState({
          appTitle: configObj.appTitle || 'Our Family Recipes',
          accentColor: configObj.accentColor || '#D97706',
          customDensities: configObj.customDensities || getState().customDensities || {}
        });
      }
    }
  } catch (err) {
    console.info('[Theme Engine] Configuration load bypassed:', err.message);
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
    const params = new URLSearchParams(hash.split('?')[1]);
    const id = params.get('id');
    updateState({ view: 'create', activeRecipeId: id });
  } else if (hash.startsWith('#shopping-list')) {
    updateState({ view: 'shopping-list' });
  } else if (hash.startsWith('#settings')) {
    updateState({ view: 'settings' });
  } else {
    updateState({ view: 'home', activeRecipeId: null });
  }
};

// --- COMPONENT RUNTIME ERROR BOUNDARY UI ---
const renderErrorBoundary = (container, error) => {
  if (!container) return;
  const errorDetails = error ? error.stack || error.toString() : 'Unknown runtime error';

  container.innerHTML = `
    <div class="error-boundary-card container" style="margin: 2rem auto; padding: 2.5rem; max-width: 650px; border-radius: 16px; background: var(--bg-card); border: 1px solid rgba(239, 68, 68, 0.25); box-shadow: var(--shadow-lg); color: var(--text-main); text-align: left; animation: fadeIn 0.4s ease-out;">
      <div style="display: flex; align-items: center; gap: 1.25rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1.25rem;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.75rem; color: #ef4444;"></i>
        <div>
          <h2 style="margin: 0; font-size: 1.6rem; font-weight: 700; letter-spacing: -0.02em;">Gourmet Crash Recovery</h2>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.95rem; color: var(--text-muted);">A rendering exception was safely intercepted.</p>
        </div>
      </div>
      
      <p style="margin-bottom: 1.75rem; line-height: 1.6; font-size: 1rem; color: var(--text-main);">
        The AI safeguards isolated a visual rendering crash in this view to keep the rest of the application stable. You can easily head back to your cookbook home or inspect the Technical details below to debug the issue.
      </p>

      <div style="margin-bottom: 2rem;">
        <button class="button button-primary" id="error-boundary-home-btn" style="background: var(--accent-color, #D97706); border: none; padding: 0.85rem 1.75rem; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; box-shadow: var(--shadow-sm); transition: transform 0.2s, filter 0.2s;">
          <i class="fa-solid fa-house"></i> Back to Cookbook
        </button>
      </div>

      <details style="background: rgba(0, 0, 0, 0.03); border-radius: 8px; padding: 1.25rem; border: 1px solid var(--border-color); transition: background-color 0.2s;">
        <summary style="cursor: pointer; font-weight: 600; color: var(--text-muted); outline: none; list-style: none; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-bug" style="color: #ef4444;"></i> <span>Show Technical Trace</span>
        </summary>
        <pre style="margin-top: 1.25rem; padding: 1rem; background: rgba(0, 0, 0, 0.06); border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 0.85rem; color: #ef4444; max-height: 250px; white-space: pre-wrap; text-align: left; border-left: 3px solid #ef4444;">${errorDetails}</pre>
      </details>
    </div>
  `;

  // Attach recovery action
  const homeBtn = document.getElementById('error-boundary-home-btn');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      window.location.hash = '#home';
      import('./state-store').then((m) => {
        m.updateState({ view: 'home', activeRecipeId: null });
      });
    });

    // Simple hover styles injected via event listeners
    homeBtn.style.transition = 'transform 0.2s ease, filter 0.2s ease';
    homeBtn.addEventListener('mouseenter', () => {
      homeBtn.style.filter = 'brightness(1.1)';
      homeBtn.style.transform = 'translateY(-1px)';
    });
    homeBtn.addEventListener('mouseleave', () => {
      homeBtn.style.filter = 'none';
      homeBtn.style.transform = 'none';
    });
  }
};

// --- DECLARATIVE LAYOUT ASSEMBLER ---
const renderApp = () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  const state = getState();

  if (state.view !== 'cooking-mode') {
    window.cookingModeMounted = false;
  }

  if (state.view === 'cooking-mode') {
    const hasOverlay = appContainer.querySelector('.cooking-mode-overlay');
    if (!hasOverlay) {
      appContainer.innerHTML = '';
    }
    try {
      renderCookingMode(appContainer);
    } catch (err) {
      console.error('[App Shell] Cooking Mode rendering crashed:', err);
      renderErrorBoundary(appContainer, err);
    }
    return;
  }

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

  try {
    if (state.view === 'home') {
      renderDashboard(mainContent);
    } else if (state.view === 'recipe') {
      renderRecipeView(mainContent);
    } else if (state.view === 'create') {
      renderRecipeCreator(mainContent);
    } else if (state.view === 'shopping-list') {
      renderShoppingList(mainContent);
    } else if (state.view === 'settings') {
      renderSyncSettings(mainContent);
    }
  } catch (err) {
    console.error('[App Shell] Visual Component rendering crashed:', err);
    renderErrorBoundary(mainContent, err);
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
      .then((reg) => console.info('[PWA] Service Worker registered exactly', reg.scope))
      .catch((err) => console.error('[PWA] Service Worker registration failed', err));
  }

  parseRoute();
  initializeRecipes();
});

// --- GLOBAL RUNTIME EXCEPTION LISTENERS ---
// Prevent silent UI freezes and notify the user via beautiful custom toasters
window.addEventListener('error', (event) => {
  // Prevent potential recursion if error arises inside toaster rendering
  if (event.message && (event.message.includes('toast') || event.message.includes('Toast'))) return;
  console.error(
    '[Global Exception Handler] Intercepted runtime error:',
    event.error || event.message
  );
  import('./state-store').then((m) => {
    m.showToast(`Runtime Exception: ${event.message || 'An unexpected error occurred'}`, 'error');
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global Rejection Handler] Intercepted async failure:', event.reason);
  const reasonMessage = event.reason
    ? event.reason.message || String(event.reason)
    : 'Promise rejected without description';
  import('./state-store').then((m) => {
    m.showToast(`Async Rejection: ${reasonMessage}`, 'error');
  });
});
