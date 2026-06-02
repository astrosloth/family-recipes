import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getState,
  updateState,
  subscribeState,
  startCookingTimer,
  stopCookingTimer,
  toggleTheme,
  applyCustomAccent
} from './state-store';

describe('state-store.js', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clear localStorage mock
    localStorage.clear();

    // Setup helper to create robust mock DOM elements
    const createMockElement = () => ({
      id: '',
      type: '',
      innerHTML: '',
      className: '',
      style: {
        setProperty: vi.fn(),
        animation: ''
      },
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      appendChild: vi.fn(),
      remove: vi.fn(),
      querySelector: vi.fn().mockImplementation(() => createMockElement()),
      querySelectorAll: vi.fn().mockReturnValue([])
    });

    // Mock document
    global.document = {
      title: '',
      documentElement: createMockElement(),
      body: createMockElement(),
      createElement: vi.fn().mockImplementation(() => createMockElement()),
      getElementById: vi.fn().mockReturnValue(null),
      querySelector: vi.fn().mockReturnValue(null),
      querySelectorAll: vi.fn().mockReturnValue([])
    };

    // Mock matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });

    // Mock AudioContext using standard constructible function (not arrow function)
    const mockAudioContext = vi.fn().mockImplementation(function () {
      return {
        createOscillator: vi.fn().mockReturnValue({
          connect: vi.fn(),
          type: '',
          frequency: { setValueAtTime: vi.fn() },
          start: vi.fn(),
          stop: vi.fn()
        }),
        createGain: vi.fn().mockReturnValue({
          connect: vi.fn(),
          gain: { setValueAtTime: vi.fn() }
        }),
        destination: {},
        currentTime: 0,
        close: vi.fn()
      };
    });

    global.AudioContext = mockAudioContext;
    window.AudioContext = mockAudioContext;
    window.webkitAudioContext = mockAudioContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with correct default values', () => {
    const state = getState();
    expect(state.recipes).toEqual([]);
    expect(state.loading).toBe(true);
    expect(state.view).toBe('home');
    expect(state.favorites).toEqual([]);
    expect(state.timer).toBeNull();
  });

  it('should update state immutably and notify subscribers', () => {
    const listener = vi.fn();
    subscribeState(listener);

    updateState({ view: 'recipe', activeRecipeId: '123' });

    const state = getState();
    expect(state.view).toBe('recipe');
    expect(state.activeRecipeId).toBe('123');
    expect(listener).toHaveBeenCalledWith(state);
  });

  it('should persist favorites to localStorage when updated', () => {
    updateState({ favorites: ['recipe-1'] });
    expect(localStorage.getItem('family-recipes-favorites')).toBe(JSON.stringify(['recipe-1']));
  });

  it('should persist shoppingList to localStorage when updated', () => {
    updateState({ shoppingList: [{ id: '1', name: 'sugar' }] });
    expect(localStorage.getItem('family-recipes-shopping-list')).toBe(
      JSON.stringify([{ id: '1', name: 'sugar' }])
    );
  });

  it('should persist theme configuration parameters', () => {
    updateState({ appTitle: 'My Test Cookbook', accentColor: '#ff0000' });
    expect(localStorage.getItem('family-recipes-app-title')).toBe('My Test Cookbook');
    expect(localStorage.getItem('family-recipes-accent-color')).toBe('#ff0000');
    expect(document.title).toBe('My Test Cookbook');
    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--accent-primary-hsl',
      expect.any(String)
    );
  });

  it('should start and stop cooking timer', () => {
    startCookingTimer(10, 2);
    const state = getState();
    expect(state.timer).not.toBeNull();
    expect(state.timer.minutes).toBe(10);
    expect(state.timer.secondsRemaining).toBe(600);
    expect(state.timer.step).toBe(2);
    expect(state.timer.intervalId).toBeDefined();

    stopCookingTimer();
    expect(getState().timer).toBeNull();
  });

  it('should tick timer down every second and complete timer', () => {
    startCookingTimer(1, 3); // 60 seconds
    expect(getState().timer.secondsRemaining).toBe(60);

    vi.advanceTimersByTime(2000); // 2 seconds tick
    expect(getState().timer.secondsRemaining).toBe(58);

    vi.advanceTimersByTime(58000); // Ticks to completion
    expect(getState().timer).toBeNull();
  });

  it('should toggle theme from system to light, dark, and back to system', () => {
    // Initial theme is system by default or stored
    localStorage.setItem('family-recipes-theme', 'system');

    // Toggle 1: system -> light
    toggleTheme();
    expect(localStorage.getItem('family-recipes-theme')).toBe('light');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');

    // Toggle 2: light -> dark
    toggleTheme();
    expect(localStorage.getItem('family-recipes-theme')).toBe('dark');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');

    // Toggle 3: dark -> system
    toggleTheme();
    expect(localStorage.getItem('family-recipes-theme')).toBe('system');
    expect(document.documentElement.setAttribute).toHaveBeenCalled();
  });

  it('should convert hex colors to HSL and apply custom accents', () => {
    applyCustomAccent('#367D50'); // green
    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--accent-primary-hsl',
      expect.stringContaining('142')
    ); // 142 deg hue for HSL green

    applyCustomAccent('#f00'); // shorthand red
    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--accent-primary-hsl',
      expect.stringContaining('0')
    ); // 0 deg hue for HSL red
  });
});
