/**
 * --- RECIPE CLIPPER BACKGROUND ENGINE ---
 * Standard WebExtension service worker thread.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Recipe Clipper Extension] Loaded and ready to clip delicious meals!');
});
