/**
 * --- SYNCHRONIZATION & GITHUB CMS SETTINGS COMPONENT ---
 * Configures localStorage credentials, tests connections, handles auto-detection,
 * and compiles secure multi-device quick configuration links.
 */

import { getState, updateState, showToast } from '../state-store';
import { checkTokenValidity, autoDetectRepo, generateQuickConfigLink } from '../github-service';

/**
 * Renders the Settings and Sync panel.
 * @param {HTMLElement} container
 */
export const renderSyncSettings = (container) => {
  const { githubConfig } = getState();

  const isConnected = githubConfig && githubConfig.token;
  const activeOwner = githubConfig?.owner || '';
  const activeRepo = githubConfig?.repo || '';
  const activeBranch = githubConfig?.branch || 'main';
  const activeToken = githubConfig?.token || '';

  // 1. Render layout
  container.innerHTML = `
    <div class="container">
      <div class="settings-pane">
        <h1 class="settings-title">
          <i class="fa-solid fa-cloud-arrow-up" style="color: hsl(var(--accent-primary-hsl)); margin-right: 12px;"></i>
          GitHub Live Sync
        </h1>
        
        <!-- Status Indicator -->
        <div class="status-badge-box">
          <div class="status-indicator ${isConnected ? 'connected' : ''}"></div>
          <span class="status-text" style="color: ${isConnected ? 'hsl(var(--accent-secondary-hsl))' : 'hsl(var(--text-secondary-hsl))'};">
            ${isConnected ? 'Live Sync Connected' : 'Local / Reader Mode Active'}
          </span>
        </div>
        
        <p class="settings-help" style="margin-bottom: 24px;">
          Configure a secure connection to your GitHub repository to visually add, edit, or delete recipe markdown files directly from the browser for free. 
          Family members visiting your site will automatically load cached static recipes, avoiding rate limit thresholds.
        </p>
        
        <!-- Setup Form -->
        <form id="git-sync-form" style="display: flex; flex-direction: column; gap: 20px;">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">GitHub Username / Owner</label>
              <input type="text" id="git-owner" class="form-input" placeholder="e.g. fmaur" value="${activeOwner}" required />
            </div>
            
            <div class="form-group">
              <label class="form-label">Repository Name</label>
              <input type="text" id="git-repo" class="form-input" placeholder="e.g. family-recipes" value="${activeRepo}" required />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Repository Branch</label>
              <input type="text" id="git-branch" class="form-input" placeholder="main" value="${activeBranch}" required />
            </div>
            
            <div class="form-group">
              <label class="form-label">Personal Access Token (PAT)</label>
              <input type="password" id="git-token" class="form-input" placeholder="ghp_xxx or github_pat_xxx" value="${activeToken}" required />
            </div>
          </div>
          
          <!-- Actions footer -->
          <div style="display: flex; gap: 16px; margin-top: 12px; justify-content: flex-end;">
            ${
              isConnected
                ? `
              <button type="button" class="btn btn-secondary btn-danger" id="btn-disconnect-sync">
                <i class="fa-solid fa-power-off"></i> Disconnect Sync
              </button>
            `
                : `
              <button type="button" class="btn btn-secondary" id="btn-detect-repo">
                <i class="fa-solid fa-wand-magic-sparkles"></i> Auto-Detect URL
              </button>
            `
            }
            <button type="submit" class="btn btn-primary" id="btn-submit-connection">
              <i class="fa-solid fa-circle-check"></i> Test & Save Config
            </button>
          </div>
        </form>
        
        <!-- Multi-Device Sync Generator -->
        ${
          isConnected
            ? `
          <div class="quick-link-box">
            <h4><i class="fa-solid fa-mobile-screen-button" style="color: hsl(var(--accent-primary-hsl)); margin-right: 8px;"></i> Sync New Devices (Phone/Tablet)</h4>
            <p class="settings-help">
              Generate a secure, private setup link to instantly configure editing capabilities on a second device in one tap, bypassing manual token input!
            </p>
            <div style="margin-top: 16px;">
              <button class="btn btn-secondary" id="btn-generate-quicklink">
                <i class="fa-solid fa-link"></i> Generate Secure Setup Link
              </button>
            </div>
            
            <div class="quick-link-input-group hidden" id="quick-link-drawer">
              <input type="text" id="quick-link-input" class="form-input" readonly />
              <button class="btn btn-primary" id="btn-copy-quicklink" style="padding: 10px 16px;"><i class="fa-solid fa-copy"></i> Copy</button>
            </div>
          </div>
        `
            : ''
        }

        <!-- Cookbook Personalization Box -->
        <div class="quick-link-box" style="margin-top: 24px;">
          <h4><i class="fa-solid fa-palette" style="color: hsl(var(--accent-primary-hsl)); margin-right: 8px;"></i> Cookbook Personalization</h4>
          <p class="settings-help">
            Customize the cookbook title and brand accent color. Changes are saved immediately on this device. 
            ${isConnected ? 'If connected, changes can also be committed to GitHub so all your visitors see your custom theme!' : 'Connect Live Sync to publish your theme to GitHub Pages!'}
          </p>
          
          <form id="customizer-form" style="display: flex; flex-direction: column; gap: 16px; margin-top: 16px;">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Cookbook Header Title</label>
                <input type="text" id="custom-app-title" class="form-input" placeholder="Our Family Recipes" value="${getState().appTitle || 'Our Family Recipes'}" required />
              </div>
              
              <div class="form-group">
                <label class="form-label">Theme Accent Color</label>
                <div style="display: flex; gap: 10px; align-items: center;">
                  <input type="color" id="custom-accent-color" class="form-input" style="width: 60px; height: 46px; padding: 4px; cursor: pointer; border-radius: 8px; border: 1px solid hsl(var(--border-color-hsl));" value="${getState().accentColor || '#D97706'}" />
                  <input type="text" id="custom-accent-hex" class="form-input" style="flex: 1;" placeholder="#D97706" value="${getState().accentColor || '#D97706'}" required pattern="^#[0-9A-Fa-f]{6}$" />
                </div>
              </div>
            </div>
            
            <!-- Swatches for Curated Premium Colors -->
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; margin-bottom: 8px;">Curated Gourmet Color Palettes</label>
              <div class="swatches-row" style="display: flex; gap: 12px; flex-wrap: wrap;">
                <div class="swatch-btn" data-color="#D97706" title="Warm Amber (Default)" style="width: 32px; height: 32px; background: #D97706; border-radius: 50%; cursor: pointer; border: 2px solid white; box-shadow: 0 0 0 1px #DCD7CD;"></div>
                <div class="swatch-btn" data-color="#15803D" title="Sage Emerald" style="width: 32px; height: 32px; background: #15803D; border-radius: 50%; cursor: pointer; border: 2px solid white; box-shadow: 0 0 0 1px #DCD7CD;"></div>
                <div class="swatch-btn" data-color="#BE123C" title="Cozy Rose" style="width: 32px; height: 32px; background: #BE123C; border-radius: 50%; cursor: pointer; border: 2px solid white; box-shadow: 0 0 0 1px #DCD7CD;"></div>
                <div class="swatch-btn" data-color="#7C3AED" title="Amethyst Purple" style="width: 32px; height: 32px; background: #7C3AED; border-radius: 50%; cursor: pointer; border: 2px solid white; box-shadow: 0 0 0 1px #DCD7CD;"></div>
                <div class="swatch-btn" data-color="#B45309" title="Earth Ochre" style="width: 32px; height: 32px; background: #B45309; border-radius: 50%; cursor: pointer; border: 2px solid white; box-shadow: 0 0 0 1px #DCD7CD;"></div>
                <div class="swatch-btn" data-color="#475569" title="Obsidian Slate" style="width: 32px; height: 32px; background: #475569; border-radius: 50%; cursor: pointer; border: 2px solid white; box-shadow: 0 0 0 1px #DCD7CD;"></div>
              </div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px;">
              <button type="submit" class="btn btn-primary" id="btn-save-personalization">
                <i class="fa-solid fa-floppy-disk"></i> Save & Sync Theme
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // --- ATTACH EVENT HANDLERS (COMPLEX PROMISE CHAINING) ---

  // Auto-Detect repository details from URL bar
  const detectBtn = document.getElementById('btn-detect-repo');
  if (detectBtn) {
    detectBtn.addEventListener('click', () => {
      const detected = autoDetectRepo();
      if (detected) {
        document.getElementById('git-owner').value = detected.owner;
        document.getElementById('git-repo').value = detected.repo;
        showToast('Repository owner and name auto-detected from hostname!', 'success');
      } else {
        showToast(
          'Auto-detection works only when hosted on github.io. Please fill fields manually!',
          'info'
        );
      }
    });
  }

  // Submit and test Connection
  document.getElementById('git-sync-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const owner = document.getElementById('git-owner').value.trim();
    const repo = document.getElementById('git-repo').value.trim();
    const branch = document.getElementById('git-branch').value.trim() || 'main';
    const token = document.getElementById('git-token').value.trim();

    if (!owner || !repo || !token) {
      showToast('Please fill out all synchronization fields!', 'error');
      return;
    }

    showToast('Testing Personal Access Token...', 'info');
    document.getElementById('btn-submit-connection').disabled = true;

    // Call async validator
    const isValid = await checkTokenValidity(token);

    document.getElementById('btn-submit-connection').disabled = false;

    if (isValid) {
      const config = { owner, repo, branch, token };

      // Update global engine state immutably!
      updateState({ githubConfig: config });
      showToast('Connection verified successfully! Configuration saved.', 'success');

      // Triggers dynamic data listings fetch immediately!
      import('../main').then((m) => m.initializeRecipes());

      // Re-render settings panel
      renderSyncSettings(container);
    } else {
      showToast('Token verification failed: invalid credentials or rate limits', 'error');

      const detailsAlert = `
        <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:2500; display:flex; align-items:center; justify-content:center; padding:20px;">
          <div class="settings-pane" style="max-width:540px; background:hsl(var(--bg-primary-hsl));">
            <h3 style="font-family:var(--font-serif); font-size:24px; margin-bottom:12px; color:hsl(var(--accent-tertiary-hsl));"><i class="fa-solid fa-triangle-exclamation"></i> Sync Test Failed</h3>
            <p style="font-size:14px; color:hsl(var(--text-secondary-hsl)); line-height:1.5; margin-bottom:20px;">
              The provided token could not connect. Please check:
              <br><br>
              1. **Token Syntax**: Ensure it doesn't contain leading or trailing spaces.
              <br>
              2. **Permissions**: If using a modern <b>Fine-grained Token</b>, verify that you assigned read/write permissions to **Contents** for this specific repository.
              <br>
              3. **Scope**: If using a **Classic Token**, make sure the **repo** scope is checked.
            </p>
            <button class="btn btn-primary" id="btn-close-error-modal" style="width:100%; justify-content:center;">Understood, let me fix it</button>
          </div>
        </div>
      `;

      const modalWrapper = document.createElement('div');
      modalWrapper.innerHTML = detailsAlert;
      document.body.appendChild(modalWrapper);

      document.getElementById('btn-close-error-modal').addEventListener('click', () => {
        modalWrapper.remove();
      });
    }
  });

  // Disconnect Synchronization Wipes
  const disconnectBtn = document.getElementById('btn-disconnect-sync');
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      const confirmText =
        'Are you sure you want to disconnect from GitHub? This clears all credentials on this device and returns the app to Reader Mode.';
      if (!window.confirm(confirmText)) return;

      // Wipe localStorage and config
      updateState({ githubConfig: null });
      localStorage.removeItem('family-recipes-git-config');

      showToast('Successfully disconnected from GitHub repository.', 'success');

      // Re-load static local bundle immediately!
      import('../main').then((m) => m.initializeRecipes());

      // Re-render settings panel
      renderSyncSettings(container);
    });
  }

  // Generate Ephemeral Quick Config Sync Setup Links
  const generateBtn = document.getElementById('btn-generate-quicklink');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      const link = generateQuickConfigLink(githubConfig);

      const drawer = document.getElementById('quick-link-drawer');
      const input = document.getElementById('quick-link-input');

      input.value = link;
      drawer.classList.remove('hidden');
      generateBtn.classList.add('hidden');

      showToast('Setup link successfully generated!', 'success');
    });
  }

  // Copy Setup Link to Clipboard
  const copyBtn = document.getElementById('btn-copy-quicklink');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const input = document.getElementById('quick-link-input');
      navigator.clipboard.writeText(input.value);
      showToast('Setup link copied to clipboard! Keep this link private.', 'info');
    });
  }

  // --- COOKBOOK PERSONALIZATION EVENT HANDLERS ---

  // Custom Color Predefined swatches select handler
  document.querySelectorAll('.swatch-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const color = e.currentTarget.getAttribute('data-color');
      const picker = document.getElementById('custom-accent-color');
      const hexInput = document.getElementById('custom-accent-hex');
      if (picker) picker.value = color;
      if (hexInput) hexInput.value = color;

      // Dynamic live HSL theme preview
      import('../state-store').then((m) => m.applyCustomAccent(color));
    });
  });

  // Color Picker & Hex Code input bidirectional synchronization
  const colorPicker = document.getElementById('custom-accent-color');
  const hexInput = document.getElementById('custom-accent-hex');
  if (colorPicker && hexInput) {
    colorPicker.addEventListener('input', (e) => {
      const color = e.target.value.toUpperCase();
      hexInput.value = color;
      import('../state-store').then((m) => m.applyCustomAccent(color));
    });
    hexInput.addEventListener('input', (e) => {
      const color = e.target.value;
      if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        colorPicker.value = color;
        import('../state-store').then((m) => m.applyCustomAccent(color));
      }
    });
  }

  // Form Submission personalization saver
  const customizerForm = document.getElementById('customizer-form');
  if (customizerForm) {
    customizerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newTitle = document.getElementById('custom-app-title').value.trim();
      const newColor = document.getElementById('custom-accent-hex').value.trim().toUpperCase();

      if (newTitle.length === 0) {
        showToast('Please specify a cookbook title!', 'error');
        return;
      }

      showToast('Saving personalization...', 'info');

      // Update state dynamically and trigger localStorage persistence
      updateState({ appTitle: newTitle, accentColor: newColor });

      if (isConnected) {
        try {
          showToast('Syncing theme configuration to GitHub...', 'info');
          const configObj = { appTitle: newTitle, accentColor: newColor };
          const { commitRecipeFile } = await import('../github-service');

          await commitRecipeFile(githubConfig, 'config.json', JSON.stringify(configObj, null, 2));
          showToast('Theme synchronized and published to GitHub successfully!', 'success');
        } catch (err) {
          showToast(`Sync Failed: ${err.message}`, 'error');
        }
      } else {
        showToast('Theme saved locally! Connect Live Sync to publish it.', 'success');
      }

      // Force a redraw of the app shell header logo
      import('../main').then((m) => m.initializeRecipes());
    });
  }
};
