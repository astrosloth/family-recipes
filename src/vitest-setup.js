// Global localStorage & window mocks for Node.js test environments
const store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => {
    store[key] = String(value);
  },
  removeItem: (key) => {
    delete store[key];
  },
  clear: () => {
    for (const key in store) delete store[key];
  }
};

// Mock document globals if missing
if (typeof document === 'undefined') {
  global.document = {
    title: '',
    documentElement: {
      style: {
        setProperty: () => {},
        getPropertyValue: () => ''
      }
    },
    head: {
      appendChild: () => {}
    },
    createElement: () => ({
      id: '',
      type: '',
      innerHTML: ''
    }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

// Mock browser globals if missing
if (typeof window === 'undefined') {
  global.window = {
    localStorage: global.localStorage,
    location: { hash: '' },
    document: global.document
  };
}
