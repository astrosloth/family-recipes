/**
 * --- SYNCHRONIZATION & GITHUB CMS SETTINGS COMPONENT ---
 * Configures localStorage credentials, tests connections, handles auto-detection,
 * and compiles secure multi-device quick configuration links.
 */

import { getState, updateState, showToast } from '../state-store';
import { checkTokenValidity, autoDetectRepo, generateQuickConfigLink } from '../github-service';
import { STAPLE_DENSITIES } from '../recipe-converter';

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

        <!-- Ingredient Densities Manager -->
        <div class="quick-link-box" style="margin-top: 24px;">
          <h4><i class="fa-solid fa-weight-hanging" style="color: hsl(var(--accent-primary-hsl)); margin-right: 8px;"></i> Ingredient Densities Manager</h4>
          <p class="settings-help">
            Define or override the weight (in grams) for 1 cup, 1 tablespoon, and 1 teaspoon of any ingredient. 
            Custom definitions take precedence over built-in values, and will be used instantly for volume-to-weight scaling!
          </p>
          
          <!-- Add/Edit form -->
          <form id="density-form" style="display: flex; flex-direction: column; gap: 16px; margin-top: 16px; padding: 16px; background: hsl(var(--bg-primary-hsl)); border-radius: var(--border-radius-sm); border: 1px solid hsl(var(--border-color-hsl));">
            <h5 style="margin: 0; font-family: var(--font-serif); font-size: 15px; color: hsl(var(--text-primary-hsl));" id="density-form-title">Add / Edit Custom Density</h5>
            
            <div class="form-group">
              <label class="form-label">Ingredient Name</label>
              <input type="text" id="density-name" class="form-input" placeholder="e.g. almond flour, coconut flour" required />
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">1 Cup weight (g)</label>
                <input type="number" id="density-cup" class="form-input" placeholder="e.g. 120" step="0.1" required />
              </div>
              <div class="form-group">
                <label class="form-label">1 Tbsp weight (g) <span style="font-size: 10px; opacity: 0.7;">(auto-filled)</span></label>
                <input type="number" id="density-tbsp" class="form-input" placeholder="e.g. 7.5" step="0.01" required />
              </div>
              <div class="form-group">
                <label class="form-label">1 Tsp weight (g) <span style="font-size: 10px; opacity: 0.7;">(auto-filled)</span></label>
                <input type="number" id="density-tsp" class="form-input" placeholder="e.g. 2.5" step="0.01" required />
              </div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end; align-items: center;">
              <button type="button" class="btn btn-secondary" id="btn-clear-density-form" style="padding: 8px 16px; font-size: 12px; width: auto;">Clear</button>
              <button type="submit" class="btn btn-primary" id="btn-save-density" style="padding: 8px 16px; font-size: 12px; width: auto;">
                <i class="fa-solid fa-circle-plus"></i> Save Density
              </button>
            </div>
          </form>
          
          <!-- List of custom densities -->
          <div style="margin-top: 20px;">
            <h5 style="margin: 0 0 10px 0; font-family: var(--font-serif); font-size: 15px; color: hsl(var(--text-primary-hsl));">Your Custom Densities & Overrides</h5>
            
            <div id="custom-densities-list" style="display: flex; flex-direction: column; gap: 8px;">
              ${
                Object.keys(getState().customDensities || {}).length === 0
                  ? `
                <div style="padding: 16px; background: rgba(0, 0, 0, 0.02); border-radius: var(--border-radius-sm); border: 1px dashed hsl(var(--border-color-hsl)); text-align: center; color: hsl(var(--text-secondary-hsl)); font-size: 13.5px;">
                  No custom ingredient densities defined yet. Create one or select a built-in staple below to override it!
                </div>
              `
                  : `
                <div style="overflow-x: auto;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                    <thead>
                      <tr style="border-bottom: 2px solid hsl(var(--border-color-hsl)); color: hsl(var(--text-secondary-hsl));">
                        <th style="padding: 8px 4px;">Ingredient</th>
                        <th style="padding: 8px 4px;">1 Cup</th>
                        <th style="padding: 8px 4px;">1 Tbsp</th>
                        <th style="padding: 8px 4px;">1 Tsp</th>
                        <th style="padding: 8px 4px; text-align: right;">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${Object.entries(getState().customDensities || {})
                        .map(
                          ([name, data]) => `
                        <tr style="border-bottom: 1px solid hsl(var(--border-color-hsl)); color: hsl(var(--text-primary-hsl));">
                          <td style="padding: 8px 4px; font-weight: 600;">${name}</td>
                          <td style="padding: 8px 4px;">${data.cup}g</td>
                          <td style="padding: 8px 4px;">${data.tbsp}g</td>
                          <td style="padding: 8px 4px;">${data.tsp}g</td>
                          <td style="padding: 8px 4px; text-align: right;">
                            <button class="icon-button edit-density-btn" data-edit-density="${name}" title="Edit Density" style="color: hsl(var(--accent-primary-hsl)); border: none; background: transparent; cursor: pointer; padding: 4px; font-size: 14px;"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button class="icon-button delete-density-btn" data-delete-density="${name}" title="Delete Density" style="color: hsl(var(--accent-tertiary-hsl)); border: none; background: transparent; cursor: pointer; padding: 4px; font-size: 14px;"><i class="fa-solid fa-trash-can"></i></button>
                          </td>
                        </tr>
                      `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
              }
            </div>
          </div>

          <!-- Built-in Staples Reference list -->
          <div style="margin-top: 24px; border-top: 1px solid hsl(var(--border-color-hsl)); padding-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" id="toggle-built-in-ref">
              <h5 style="margin: 0; font-family: var(--font-serif); font-size: 15px; color: hsl(var(--text-primary-hsl));">
                <i class="fa-solid fa-book" style="margin-right: 6px; opacity: 0.7;"></i> Built-in Reference Database
              </h5>
              <span id="built-in-toggle-icon" style="font-size: 12px; color: hsl(var(--text-secondary-hsl));"><i class="fa-solid fa-chevron-down"></i> Expand</span>
            </div>
            
            <div id="built-in-densities-container" class="hidden" style="margin-top: 16px; overflow-x: auto; max-height: 250px; overflow-y: auto; border: 1px solid hsl(var(--border-color-hsl)); border-radius: var(--border-radius-sm); padding: 8px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; text-align: left;">
                <thead>
                  <tr style="border-bottom: 2px solid hsl(var(--border-color-hsl)); color: hsl(var(--text-secondary-hsl));">
                    <th style="padding: 6px 4px;">Ingredient</th>
                    <th style="padding: 6px 4px;">1 Cup</th>
                    <th style="padding: 6px 4px;">1 Tbsp</th>
                    <th style="padding: 6px 4px;">1 Tsp</th>
                    <th style="padding: 6px 4px; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(STAPLE_DENSITIES)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(
                      ([name, data]) => `
                    <tr style="border-bottom: 1px solid hsl(var(--border-color-hsl)); color: hsl(var(--text-primary-hsl));">
                      <td style="padding: 6px 4px; font-weight: 500;">${name}</td>
                      <td style="padding: 6px 4px;">${data.cup}g</td>
                      <td style="padding: 6px 4px;">${data.tbsp}g</td>
                      <td style="padding: 6px 4px;">${data.tsp}g</td>
                      <td style="padding: 6px 4px; text-align: right;">
                        <button class="btn btn-secondary override-density-btn" data-override-density="${name}" style="padding: 4px 8px; font-size: 11px; width: auto; display: inline-flex;">Override</button>
                      </td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
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
          const configObj = {
            appTitle: newTitle,
            accentColor: newColor,
            customDensities: getState().customDensities || {}
          };
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

  // --- INGREDIENT DENSITIES MANAGER EVENT HANDLERS ---

  const densityForm = document.getElementById('density-form');
  if (densityForm) {
    const nameInput = document.getElementById('density-name');
    const cupInput = document.getElementById('density-cup');
    const tbspInput = document.getElementById('density-tbsp');
    const tspInput = document.getElementById('density-tsp');
    const formTitle = document.getElementById('density-form-title');

    // Auto-calculate Tbsp and Tsp when Cup is typed (1 Cup = 16 Tbsp = 48 Tsp)
    cupInput.addEventListener('input', (e) => {
      const cupVal = parseFloat(e.target.value);
      if (!isNaN(cupVal) && cupVal > 0) {
        tbspInput.value = (Math.round((cupVal / 16) * 100) / 100).toString();
        tspInput.value = (Math.round((cupVal / 48) * 100) / 100).toString();
      } else {
        tbspInput.value = '';
        tspInput.value = '';
      }
    });

    // Handle Form Submission (Add/Edit Density)
    densityForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameInput.value.trim().toLowerCase();
      const cup = parseFloat(cupInput.value);
      const tbsp = parseFloat(tbspInput.value);
      const tsp = parseFloat(tspInput.value);

      if (!name || isNaN(cup) || isNaN(tbsp) || isNaN(tsp)) {
        showToast('Please fill out all density values!', 'error');
        return;
      }

      showToast('Saving custom density...', 'info');

      // Update densities immutably
      const { customDensities } = getState();
      const updatedDensities = {
        ...customDensities,
        [name]: { cup, tbsp, tsp }
      };

      updateState({ customDensities: updatedDensities });

      // Sync to GitHub if connected
      if (isConnected) {
        try {
          showToast('Syncing densities to GitHub...', 'info');
          const configObj = {
            appTitle: getState().appTitle,
            accentColor: getState().accentColor,
            customDensities: updatedDensities
          };
          const { commitRecipeFile } = await import('../github-service');
          await commitRecipeFile(githubConfig, 'config.json', JSON.stringify(configObj, null, 2));
          showToast('Densities synchronized to GitHub successfully!', 'success');
        } catch (err) {
          showToast(`GitHub Sync Failed: ${err.message}`, 'error');
        }
      } else {
        showToast('Density saved locally!', 'success');
      }

      // Re-render settings panel to redraw the table
      renderSyncSettings(container);
    });

    // Handle Form Clear
    document.getElementById('btn-clear-density-form').addEventListener('click', () => {
      nameInput.value = '';
      cupInput.value = '';
      tbspInput.value = '';
      tspInput.value = '';
      formTitle.innerText = 'Add / Edit Custom Density';
      nameInput.disabled = false;
      showToast('Form cleared', 'info');
    });

    // Handle Edit Custom Density
    document.querySelectorAll('[data-edit-density]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const name = e.currentTarget.getAttribute('data-edit-density');
        const { customDensities } = getState();
        const data = customDensities[name];

        if (data) {
          nameInput.value = name;
          nameInput.disabled = true; // Lock name during edits
          cupInput.value = data.cup;
          tbspInput.value = data.tbsp;
          tspInput.value = data.tsp;
          formTitle.innerText = `Edit Custom Density: "${name}"`;
          cupInput.focus();
          showToast(`Editing "${name}" density...`, 'info');
        }
      });
    });

    // Handle Delete Custom Density
    document.querySelectorAll('[data-delete-density]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const name = e.currentTarget.getAttribute('data-delete-density');
        if (
          !window.confirm(
            `Are you sure you want to delete the custom density override for "${name}"?`
          )
        )
          return;

        showToast('Deleting custom density...', 'info');

        const { customDensities } = getState();
        const updatedDensities = { ...customDensities };
        delete updatedDensities[name];

        updateState({ customDensities: updatedDensities });

        // Sync to GitHub if connected
        if (isConnected) {
          try {
            showToast('Syncing changes to GitHub...', 'info');
            const configObj = {
              appTitle: getState().appTitle,
              accentColor: getState().accentColor,
              customDensities: updatedDensities
            };
            const { commitRecipeFile } = await import('../github-service');
            await commitRecipeFile(githubConfig, 'config.json', JSON.stringify(configObj, null, 2));
            showToast('Deleted and synced successfully!', 'success');
          } catch (err) {
            showToast(`GitHub Sync Failed: ${err.message}`, 'error');
          }
        } else {
          showToast('Density deleted locally!', 'success');
        }

        // Re-render settings panel to redraw the table
        renderSyncSettings(container);
      });
    });

    // Handle Override Built-in Reference Density
    document.querySelectorAll('[data-override-density]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const name = e.currentTarget.getAttribute('data-override-density');
        const data = STAPLE_DENSITIES[name];

        if (data) {
          nameInput.value = name;
          nameInput.disabled = true; // Lock name since we are overriding a built-in staple
          cupInput.value = data.cup;
          tbspInput.value = data.tbsp;
          tspInput.value = data.tsp;
          formTitle.innerText = `Override Staple Density: "${name}"`;
          cupInput.focus();

          // Scroll up smoothly to the form
          densityForm.scrollIntoView({ behavior: 'smooth' });
          showToast(`Loaded built-in values for "${name}" to override!`, 'info');
        }
      });
    });

    // Handle Toggle Built-in reference accordion
    const toggleHeader = document.getElementById('toggle-built-in-ref');
    const containerRef = document.getElementById('built-in-densities-container');
    const toggleIcon = document.getElementById('built-in-toggle-icon');

    if (toggleHeader && containerRef && toggleIcon) {
      toggleHeader.addEventListener('click', () => {
        const isCollapsed = containerRef.classList.contains('hidden');
        if (isCollapsed) {
          containerRef.classList.remove('hidden');
          toggleIcon.innerHTML = '<i class="fa-solid fa-chevron-up"></i> Collapse';
        } else {
          containerRef.classList.add('hidden');
          toggleIcon.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Expand';
        }
      });
    }
  }
};
