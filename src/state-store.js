/**
 * --- DECOUPLED GLOBAL STATE STORE ---
 * Safe, immutable state manager and action dispatcher.
 * Completely resolves ESM circular dependencies.
 */

// --- INITIAL CONSOLIDATED STATE RECORD ---
let state = {
  recipes: [],
  loading: true,
  view: 'home',
  activeRecipeId: null,
  searchQuery: '',
  selectedCategory: '',
  selectedTags: [],
  favorites: JSON.parse(localStorage.getItem('family-recipes-favorites')) || [],
  shoppingList: JSON.parse(localStorage.getItem('family-recipes-shopping-list')) || [],
  githubConfig: JSON.parse(localStorage.getItem('family-recipes-git-config')) || null,
  gramsMode: JSON.parse(localStorage.getItem('family-recipes-grams-mode')) || false,
  servingsScale: {},
  appTitle: localStorage.getItem('family-recipes-app-title') || 'Our Family Recipes',
  accentColor: localStorage.getItem('family-recipes-accent-color') || '#D97706',
  customDensities: JSON.parse(localStorage.getItem('family-recipes-custom-densities')) || {},

  // Cooking focus state
  activeCookingStep: 1,
  cookingPrepped: [],

  // Retro Cooking Timer state
  timer: null // { minutes, secondsRemaining, intervalId, step }
};

// Subscriptions listener array
const listeners = [];

/**
 * Subscribes rendering views to state updates.
 * @param {function} listener
 */
export const subscribeState = (listener) => {
  listeners.push(listener);
};

/**
 * Pure unidirectional state updates. Updates state immutably and notifies subscribers.
 * @param {object} newState
 */
export const updateState = (newState) => {
  // Capture values before update
  const oldFavs = state.favorites;
  const oldShopping = state.shoppingList;
  const oldGrams = state.gramsMode;
  const oldGit = state.githubConfig;
  const oldTitle = state.appTitle;
  const oldAccent = state.accentColor;
  const oldDensities = state.customDensities;

  state = { ...state, ...newState };

  // Persist only if the values have actually changed referentially
  if (state.favorites !== oldFavs) {
    localStorage.setItem('family-recipes-favorites', JSON.stringify(state.favorites));
  }
  if (state.shoppingList !== oldShopping) {
    localStorage.setItem('family-recipes-shopping-list', JSON.stringify(state.shoppingList));
  }
  if (state.gramsMode !== oldGrams) {
    localStorage.setItem('family-recipes-grams-mode', JSON.stringify(state.gramsMode));
  }
  if (state.githubConfig !== oldGit) {
    if (state.githubConfig) {
      localStorage.setItem('family-recipes-git-config', JSON.stringify(state.githubConfig));
    } else {
      localStorage.removeItem('family-recipes-git-config');
    }
  }
  if (state.appTitle !== oldTitle) {
    localStorage.setItem('family-recipes-app-title', state.appTitle);
    document.title = state.appTitle;
  }
  if (state.accentColor !== oldAccent) {
    localStorage.setItem('family-recipes-accent-color', state.accentColor);
    applyCustomAccent(state.accentColor);
  }
  if (state.customDensities !== oldDensities) {
    localStorage.setItem('family-recipes-custom-densities', JSON.stringify(state.customDensities));
  }

  // Notify all active rendering subscribers
  listeners.forEach((listener) => listener(state));
};

/**
 * Gets the current immutable state.
 * @returns {object}
 */
export const getState = () => state;

// --- TOAST NOTIFICATIONS ACTION DISPATCHER ---
export const showToast = (message, type = 'info') => {
  const container =
    document.getElementById('toast-container') ||
    (() => {
      const el = document.createElement('div');
      el.id = 'toast-container';
      el.className = 'toast-container';
      document.body.appendChild(el);
      return el;
    })();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon =
    type === 'success'
      ? 'fa-circle-check'
      : type === 'error'
        ? 'fa-circle-exclamation'
        : 'fa-circle-info';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

  container.appendChild(toast);

  // Animate slide-out and remove
  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

// --- RETRO COOKING TIMER MODULE ---
export const startCookingTimer = (minutes, stepNum) => {
  // Clear any existing timer thread first
  if (state.timer && state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
  }

  showToast(`Cooking timer started for ${minutes} minutes!`, 'info');
  const secondsTotal = minutes * 60;

  const intervalId = setInterval(() => {
    const curTimer = getState().timer;
    if (!curTimer) {
      clearInterval(intervalId);
      return;
    }

    const rem = curTimer.secondsRemaining - 1;
    if (rem <= 0) {
      clearInterval(intervalId);
      updateState({ timer: null });

      // Sound custom buzzer alert!
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioContext.currentTime); // High A chime
      gain.gain.setValueAtTime(0.5, audioContext.currentTime);

      osc.start();
      setTimeout(() => {
        osc.stop();
        audioContext.close();
      }, 1000);

      showToast(`⏱️ Step ${stepNum} timer finished!`, 'success');
    } else {
      updateState({
        timer: { ...curTimer, secondsRemaining: rem }
      });
    }
  }, 1000);

  updateState({
    timer: {
      minutes,
      secondsRemaining: secondsTotal,
      intervalId,
      step: stepNum
    }
  });
};

export const stopCookingTimer = () => {
  if (state.timer && state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
  }
  updateState({ timer: null });
  showToast('Timer cancelled', 'info');
};

export const toggleTheme = () => {
  const savedTheme = localStorage.getItem('family-recipes-theme') || 'system';
  const nextTheme = savedTheme === 'system' ? 'light' : savedTheme === 'light' ? 'dark' : 'system';

  localStorage.setItem('family-recipes-theme', nextTheme);

  // Apply the theme to documentElement attribute
  if (nextTheme === 'system') {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', systemDark ? 'dark' : 'light');
    showToast('Theme set to System Auto-Sync', 'success');
  } else {
    document.documentElement.setAttribute('data-theme', nextTheme);
    showToast(`Theme set to ${nextTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}`, 'success');
  }

  updateState({});
};

// --- CUSTOM ACCENT COLORS HSL GENERATOR SYSTEM ---
const hexToHsl = (hex) => {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;

  let max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

export const applyCustomAccent = (hexColor) => {
  try {
    const { h, s, l } = hexToHsl(hexColor);
    document.documentElement.style.setProperty('--accent-primary-hsl', `${h}, ${s}%, ${l}%`);
    document.documentElement.style.setProperty(
      '--accent-primary-hover-hsl',
      `${h}, ${s}%, ${Math.max(0, l - 10)}%`
    );
  } catch (e) {
    console.warn('[Theme Engine] Failed to apply custom accent color:', e);
  }
};

// Apply initial custom configuration on library load
applyCustomAccent(state.accentColor);
document.title = state.appTitle;
