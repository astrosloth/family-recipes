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
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('family-recipes-theme', newTheme);

  updateState({});
};
