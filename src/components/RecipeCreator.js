/**
 * --- VISUAL RECIPE CREATOR & COMPILER ---
 * Rich form supporting creation and updates. Formulates correct YAML frontmatter,
 * runs tabbed markdown code previews, and triggers Base64 downloads or live Git commits.
 */

import { getState, showToast } from '../state-store';
import { commitRecipeFile, commitImageFile } from '../github-service';
import { formatQuantity } from '../recipe-parser';

// Local template helper states to track rows during editing session
let formState = {
  id: '',
  title: '',
  description: '',
  prepTime: '20 mins',
  cookTime: '30 mins',
  servings: 4,
  difficulty: 'Easy',
  image: 'images/placeholder.jpg',
  categories: ['Main Course'],
  tags: [],
  ingredients: [{ quantity: 1, unit: 'cup', name: '' }],
  instructions: [{ step: 1, text: '' }],
  notes: [],
  activeTab: 'edit', // 'edit' or 'preview'
  originalSha: null
};

/**
 * Compiles visual form parameters into standardized Markdown content with YAML frontmatter.
 * @returns {string} - Markdown text
 */
const compileMarkdown = () => {
  const yaml = [
    '---',
    `title: "${formState.title.replace(/"/g, '\\"')}"`,
    `description: "${formState.description.replace(/"/g, '\\"')}"`,
    `prepTime: "${formState.prepTime}"`,
    `cookTime: "${formState.cookTime}"`,
    `servings: ${formState.servings}`,
    `difficulty: "${formState.difficulty}"`,
    `image: "${formState.image}"`,
    `categories: ${JSON.stringify(formState.categories)}`,
    `tags: ${JSON.stringify(formState.tags.filter((t) => t.trim().length > 0))}`,
    '---',
    ''
  ].join('\n');

  const ingredientsText = [
    '## Ingredients',
    ...formState.ingredients
      .filter((ing) => ing.name.trim().length > 0)
      .map((ing) => {
        const qtyStr = ing.quantity ? `${formatQuantity(Number(ing.quantity))} ` : '';
        const unitStr = ing.unit ? `${ing.unit.trim()} ` : '';
        return `- ${qtyStr}${unitStr}${ing.name.trim()}`;
      }),
    ''
  ].join('\n');

  const instructionsText = [
    '## Instructions',
    ...formState.instructions
      .filter((step) => step.text.trim().length > 0)
      .map((step, idx) => `${idx + 1}. ${step.text.trim()}`),
    ''
  ].join('\n');

  const activeNotes = formState.notes
    ? formState.notes.filter((n) => n.text && n.text.trim().length > 0)
    : [];
  const notesText =
    activeNotes.length > 0
      ? ['## Notes', ...activeNotes.map((n) => `- ${n.text.trim()}`), ''].join('\n')
      : '';

  return `${yaml}\n${ingredientsText}\n${instructionsText}${notesText ? `\n${notesText}` : ''}`;
};

/**
 * Triggers an in-browser file download for the compiled markdown.
 * @param {string} filename
 * @param {string} text
 */
const triggerFileDownload = (filename, text) => {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/markdown;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

/**
 * Renders the recipe creator or editor form.
 * @param {HTMLElement} container
 */
export const renderRecipeCreator = (container) => {
  const { recipes, activeRecipeId, githubConfig } = getState();
  const hash = window.location.hash;

  // Detect if we are editing an existing recipe or creating a new one
  const isEditMode = hash.includes('?id=');

  // If editing but recipes list hasn't loaded yet on direct reload, show beautiful loader
  if (isEditMode && recipes.length === 0) {
    container.innerHTML = `
      <div class="container" style="padding: 40px 16px; text-align: center;">
        <div class="spinner" style="margin: 0 auto 16px auto; width: 32px; height: 32px; border: 4px solid hsl(var(--border-color-hsl)); border-top: 4px solid hsl(var(--accent-primary-hsl)); border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <p style="color: hsl(var(--text-secondary-hsl)); font-family: var(--font-sans); font-size: 14px;">Loading recipe data...</p>
      </div>
    `;
    return;
  }

  // Synchronize formState once when transitioning into Edit Mode
  if (isEditMode && activeRecipeId && formState.id !== activeRecipeId) {
    const editTarget = recipes.find((r) => r.id === activeRecipeId);
    if (editTarget && editTarget.success) {
      formState = {
        id: editTarget.id,
        title: editTarget.title,
        description: editTarget.description,
        prepTime: editTarget.prepTime,
        cookTime: editTarget.cookTime,
        servings: editTarget.servings,
        difficulty: editTarget.difficulty,
        image:
          editTarget.rawContent.match(/image:\s*["']?([\w./-]+)["']?/)?.[1] ||
          'images/placeholder.jpg',
        categories: editTarget.categories,
        tags: editTarget.tags,
        // Match structure of inputs
        ingredients: editTarget.ingredients.map((i) => ({
          quantity: i.quantity || '',
          unit: i.unit || '',
          name: i.name || ''
        })),
        instructions: editTarget.instructions.map((s) => ({
          step: s.step,
          text: s.text
        })),
        notes: editTarget.notes ? editTarget.notes.map((n) => ({ text: n })) : [],
        activeTab: 'edit',
        originalSha: null // Fetched live upon commit
      };
    }
  } else if (!isEditMode && formState.id !== '') {
    // Reset to blank values for fresh creation
    formState = {
      id: '',
      title: '',
      description: '',
      prepTime: '20 mins',
      cookTime: '30 mins',
      servings: 4,
      difficulty: 'Easy',
      image: 'images/placeholder.jpg',
      categories: ['Main Course'],
      tags: [],
      ingredients: [{ quantity: 1, unit: 'cup', name: '' }],
      instructions: [{ step: 1, text: '' }],
      notes: [],
      activeTab: 'edit',
      originalSha: null
    };
  }

  const isAuthorized = githubConfig && githubConfig.token;

  container.innerHTML = `
    <div class="container">
      <div class="creator-pane">
        <h1 class="creator-title">
          <i class="fa-solid fa-file-pen" style="color: hsl(var(--accent-primary-hsl)); margin-right: 12px;"></i>
          ${isEditMode ? `Edit Recipe: ${formState.title}` : 'Add Family Recipe'}
        </h1>
        
        <!-- Tab Switches (Live Markdown Code Previews!) -->
        <div class="editor-tabs">
          <span class="editor-tab ${formState.activeTab === 'edit' ? 'active' : ''}" id="tab-edit-mode">Form Editor</span>
          <span class="editor-tab ${formState.activeTab === 'preview' ? 'active' : ''}" id="tab-preview-mode">Markdown Code Preview</span>
        </div>
        
        <!-- Markdown Code Preview Tab -->
        <div class="editor-preview-pane ${formState.activeTab === 'preview' ? '' : 'hidden'}" id="preview-panel">
          <pre><code id="markdown-raw-code"></code></pre>
        </div>
        
        <!-- Form Editor Tab -->
        <form id="recipe-editor-form" class="${formState.activeTab === 'edit' ? '' : 'hidden'}">
          <!-- Metadata Rows -->
          <div class="form-group">
            <label class="form-label">Recipe Title</label>
            <input type="text" id="recipe-title" class="form-input" placeholder="Grandma's Cinnamon Rolls" value="${formState.title}" required />
          </div>
          
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea id="recipe-desc" class="form-input" style="height: 100px; resize: vertical;" placeholder="A soft, buttery rolled dough spiced with cinnamon and topped with rich glaze..." required>${formState.description}</textarea>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Prep Time</label>
              <input type="text" id="recipe-prep" class="form-input" placeholder="30 mins" value="${formState.prepTime}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Cook Time</label>
              <input type="text" id="recipe-cook" class="form-input" placeholder="45 mins" value="${formState.cookTime}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Servings</label>
              <input type="number" id="recipe-servings" class="form-input" value="${formState.servings}" min="1" required />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Difficulty</label>
              <select id="recipe-difficulty" class="form-input">
                <option value="Easy" ${formState.difficulty === 'Easy' ? 'selected' : ''}>Easy</option>
                <option value="Medium" ${formState.difficulty === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="Hard" ${formState.difficulty === 'Hard' ? 'selected' : ''}>Hard</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Local Image path (relative in repo)</label>
              <div class="image-upload-wrapper" style="display: flex; gap: 8px;">
                <input type="text" id="recipe-image" class="form-input" placeholder="images/rolls.jpg" value="${formState.image}" required style="flex: 1;" />
                <button type="button" class="btn btn-secondary" id="btn-upload-image" title="Upload Photo or Take Camera Snap" style="padding: 12px 14px;">
                  <i class="fa-solid fa-camera"></i>
                </button>
                <button type="button" class="btn btn-secondary" id="btn-pull-image" title="Pull & Save Image from URL" style="padding: 12px 14px;">
                  <i class="fa-solid fa-cloud-arrow-down"></i>
                </button>
                <input type="file" id="image-file-input" accept="image/*" class="hidden" />
              </div>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">High-Level Category</label>
              <select id="recipe-category" class="form-input">
                <option value="Breakfast" ${formState.categories[0] === 'Breakfast' ? 'selected' : ''}>Breakfast</option>
                <option value="Main Course" ${formState.categories[0] === 'Main Course' ? 'selected' : ''}>Main Course</option>
                <option value="Dessert" ${formState.categories[0] === 'Dessert' ? 'selected' : ''}>Dessert</option>
                <option value="Baking" ${formState.categories[0] === 'Baking' ? 'selected' : ''}>Baking</option>
                <option value="Appetizer" ${formState.categories[0] === 'Appetizer' ? 'selected' : ''}>Appetizer</option>
                <option value="Other" ${formState.categories[0] === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Cross-Cutting Tags (comma separated)</label>
              <input type="text" id="recipe-tags" class="form-input" placeholder="Sweet, Cinnamon, Baking, Weekend" value="${formState.tags.join(', ')}" />
            </div>
          </div>
          
          <!-- Ingredients Dynamic List builder -->
          <div class="dynamic-list-builder">
            <div class="list-builder-header">
              <h4 class="list-builder-title">Ingredients List</h4>
              <button type="button" class="btn btn-secondary" id="btn-add-ingredient" style="padding: 6px 12px; font-size: 12px;">
                <i class="fa-solid fa-plus"></i> Add Row
              </button>
            </div>
            
            <div id="ingredients-rows-container">
              ${formState.ingredients
                .map(
                  (ing, idx) => `
                <div class="builder-item-row" data-ing-row="${idx}">
                  <input type="text" class="form-input ing-qty" style="flex: 0.5;" placeholder="1 1/2" value="${ing.quantity}" />
                  <input type="text" class="form-input ing-unit" style="flex: 0.7;" placeholder="cup" value="${ing.unit}" />
                  <input type="text" class="form-input ing-name" style="flex: 2;" placeholder="all-purpose flour" value="${ing.name}" required />
                  <button type="button" class="remove-row-btn" data-rem-ing="${idx}"><i class="fa-solid fa-trash-can"></i></button>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
          
          <!-- Instructions Dynamic List builder -->
          <div class="dynamic-list-builder">
            <div class="list-builder-header">
              <h4 class="list-builder-title">Directions Step-by-Step</h4>
              <button type="button" class="btn btn-secondary" id="btn-add-step" style="padding: 6px 12px; font-size: 12px;">
                <i class="fa-solid fa-plus"></i> Add Step
              </button>
            </div>
            
            <div id="steps-rows-container">
              ${formState.instructions
                .map(
                  (step, idx) => `
                <div class="builder-item-row" data-step-row="${idx}" style="align-items: flex-start;">
                  <span style="font-family: var(--font-serif); font-weight:700; font-size:16px; margin-top:10px; width:20px;">${step.step}.</span>
                  <textarea class="form-input step-text-area" style="flex: 1; height: 60px; resize: vertical;" placeholder="Whisk the warm water, yeast, and sugar in a bowl..." required>${step.text}</textarea>
                  <button type="button" class="remove-row-btn" data-rem-step="${idx}" style="margin-top:10px;"><i class="fa-solid fa-trash-can"></i></button>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
          
          <!-- Notes Dynamic List builder -->
          <div class="dynamic-list-builder">
            <div class="list-builder-header">
              <h4 class="list-builder-title">Recipe Notes & Cooking Tips</h4>
              <button type="button" class="btn btn-secondary" id="btn-add-note" style="padding: 6px 12px; font-size: 12px;">
                <i class="fa-solid fa-plus"></i> Add Note
              </button>
            </div>
            
            <div id="notes-rows-container">
              ${formState.notes
                .map(
                  (note, idx) => `
                <div class="builder-item-row" data-note-row="${idx}">
                  <input type="text" class="form-input note-text" style="flex: 1;" placeholder="e.g. Sub margarine for butter if vegan-friendly..." value="${note.text}" required />
                  <button type="button" class="remove-row-btn" data-rem-note="${idx}"><i class="fa-solid fa-trash-can"></i></button>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        </form>
        
        <!-- Action Footer -->
        <div style="display: flex; justify-content: flex-end; gap: 16px; margin-top: 32px; border-top: 1px solid hsl(var(--border-color-hsl)); padding-top: 24px;">
          <button class="btn btn-secondary" id="btn-cancel-create">Cancel</button>
          <button class="btn btn-primary" id="btn-submit-save">
            ${isAuthorized ? '<i class="fa-solid fa-cloud-arrow-up"></i> Sync to GitHub' : '<i class="fa-solid fa-circle-down"></i> Export Markdown'}
          </button>
        </div>
      </div>
    </div>
  `;

  // --- ATTACH EVENT HANDLERS (DYNAMIC & IMMUTABLE SYNCING) ---

  // Capture form inputs live into formState local record
  const syncFormFields = () => {
    if (formState.activeTab !== 'edit') return;

    formState.title = document.getElementById('recipe-title')?.value || '';
    formState.description = document.getElementById('recipe-desc')?.value || '';
    formState.prepTime = document.getElementById('recipe-prep')?.value || '';
    formState.cookTime = document.getElementById('recipe-cook')?.value || '';
    formState.servings = Number(document.getElementById('recipe-servings')?.value) || 4;
    formState.difficulty = document.getElementById('recipe-difficulty')?.value || 'Easy';
    formState.image = document.getElementById('recipe-image')?.value || 'images/placeholder.jpg';
    formState.categories = [document.getElementById('recipe-category')?.value || 'Main Course'];

    const tagsInput = document.getElementById('recipe-tags')?.value || '';
    formState.tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Sync ingredients rows
    document.querySelectorAll('[data-ing-row]').forEach((row) => {
      const idx = Number(row.getAttribute('data-ing-row'));
      if (formState.ingredients[idx]) {
        formState.ingredients[idx] = {
          quantity: row.querySelector('.ing-qty').value,
          unit: row.querySelector('.ing-unit').value.toLowerCase().trim(),
          name: row.querySelector('.ing-name').value
        };
      }
    });

    // Sync instructions rows
    document.querySelectorAll('[data-step-row]').forEach((row) => {
      const idx = Number(row.getAttribute('data-step-row'));
      if (formState.instructions[idx]) {
        formState.instructions[idx] = {
          step: idx + 1,
          text: row.querySelector('.step-text-area').value
        };
      }
    });

    // Sync notes rows
    document.querySelectorAll('[data-note-row]').forEach((row) => {
      const idx = Number(row.getAttribute('data-note-row'));
      if (formState.notes[idx]) {
        formState.notes[idx] = {
          text: row.querySelector('.note-text').value
        };
      }
    });
  };

  // Tab selections (Form vs Preview)
  document.getElementById('tab-edit-mode').addEventListener('click', () => {
    syncFormFields();
    formState.activeTab = 'edit';
    renderRecipeCreator(container);
  });

  document.getElementById('tab-preview-mode').addEventListener('click', () => {
    syncFormFields();
    formState.activeTab = 'preview';
    renderRecipeCreator(container);

    // Fill the compiled preview pre
    document.getElementById('markdown-raw-code').innerText = compileMarkdown();
  });

  // Image Upload / Camera Snap handler
  const uploadBtn = document.getElementById('btn-upload-image');
  const fileInput = document.getElementById('image-file-input');

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file!', 'error');
        return;
      }

      if (!isAuthorized) {
        showToast(
          'Image upload requires Live GitHub Sync. Please connect your GitHub account!',
          'warning'
        );
        return;
      }

      showToast('Processing photo...', 'info');

      try {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const dataUrl = reader.result;
            const base64Data = dataUrl.split(',')[1];

            // Generate unique structured filename
            const cleanTitle = (formState.title || 'recipe')
              .toLowerCase()
              .trim()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, '');
            const fileExt = file.name.split('.').pop() || 'jpg';
            const generatedFileName = `${cleanTitle}-${Date.now()}.${fileExt}`;

            showToast('Uploading photo to your GitHub repository...', 'info');

            await commitImageFile(githubConfig, generatedFileName, base64Data);

            const finalPath = `images/${generatedFileName}`;
            formState.image = finalPath;
            const imageInput = document.getElementById('recipe-image');
            if (imageInput) {
              imageInput.value = finalPath;
            }

            showToast('Photo uploaded and committed to GitHub successfully!', 'success');
            renderRecipeCreator(container);
          } catch (uploadErr) {
            showToast(`Upload failed: ${uploadErr.message}`, 'error');
          }
        };

        reader.readAsDataURL(file);
      } catch (err) {
        showToast(`Failed to read file: ${err.message}`, 'error');
      }
    });
  }

  // Pull Image from external URL handler
  const pullBtn = document.getElementById('btn-pull-image');
  if (pullBtn) {
    pullBtn.addEventListener('click', async () => {
      const imageUrl = prompt(
        'Enter the external HTTP/HTTPS image URL to download and save inside your cookbook repository:'
      );
      if (!imageUrl) return;

      const trimmedUrl = imageUrl.trim();
      if (trimmedUrl.length === 0) return;

      if (!isAuthorized) {
        showToast(
          'Image pull requires Live GitHub Sync. Please connect your GitHub account!',
          'warning'
        );
        return;
      }

      // Handle direct data:image URLs without fetching
      if (trimmedUrl.startsWith('data:image/')) {
        showToast('Processing data URL image...', 'info');
        try {
          const parts = trimmedUrl.split(',');
          if (parts.length < 2) {
            throw new Error('Invalid Data URL format');
          }
          const meta = parts[0];
          const base64Data = parts[1];

          // Try to extract file extension from mime type (e.g., "data:image/png;base64")
          const mimeMatch = meta.match(/data:image\/([a-zA-Z0-9+]+);/);
          const fileExt = mimeMatch ? mimeMatch[1] : 'jpg';
          const safeExt = fileExt === 'svg+xml' ? 'svg' : fileExt;

          const cleanTitle = (formState.title || 'recipe')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
          const generatedFileName = `${cleanTitle}-data-${Date.now()}.${safeExt}`;

          showToast('Uploading data image to your GitHub repository...', 'info');

          await commitImageFile(githubConfig, generatedFileName, base64Data);

          const finalPath = `images/${generatedFileName}`;
          formState.image = finalPath;
          const imageInput = document.getElementById('recipe-image');
          if (imageInput) {
            imageInput.value = finalPath;
          }

          showToast('Data URL image successfully parsed, saved, and synced offline!', 'success');
          renderRecipeCreator(container);
          return;
        } catch (dataUrlErr) {
          showToast(`Failed to parse data URL: ${dataUrlErr.message}`, 'error');
          return;
        }
      }

      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        showToast('Please enter a valid HTTP, HTTPS, or data:image URL!', 'error');
        return;
      }

      showToast('Downloading external image...', 'info');

      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(trimmedUrl)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch image (HTTP ${response.status})`);
        }

        const blob = await response.blob();
        showToast('Processing photo...', 'info');

        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const dataUrl = reader.result;
            const base64Data = dataUrl.split(',')[1];

            // Generate filename from URL path
            let origFileName = 'downloaded-image.jpg';
            try {
              const urlObj = new URL(trimmedUrl);
              const pathPart = urlObj.pathname.split('/').pop();
              if (pathPart && pathPart.includes('.')) {
                origFileName = pathPart;
              }
            } catch {}

            const fileExt = origFileName.split('.').pop() || 'jpg';
            const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(
              fileExt.toLowerCase()
            )
              ? fileExt
              : 'jpg';

            const cleanTitle = (formState.title || 'recipe')
              .toLowerCase()
              .trim()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, '');
            const generatedFileName = `${cleanTitle}-pulled-${Date.now()}.${safeExt}`;

            showToast('Uploading pulled image to your GitHub repository...', 'info');

            await commitImageFile(githubConfig, generatedFileName, base64Data);

            const finalPath = `images/${generatedFileName}`;
            formState.image = finalPath;
            const imageInput = document.getElementById('recipe-image');
            if (imageInput) {
              imageInput.value = finalPath;
            }

            showToast('External image successfully pulled, saved, and synced offline!', 'success');
            renderRecipeCreator(container);
          } catch (uploadErr) {
            showToast(`Upload failed: ${uploadErr.message}`, 'error');
          }
        };

        reader.readAsDataURL(blob);
      } catch (err) {
        showToast(
          `Failed to pull image: ${err.message}. Check the URL or try a different one.`,
          'error'
        );
      }
    });
  }

  // Dynamic Row Appenders: Add Ingredient Row
  document.getElementById('btn-add-ingredient').addEventListener('click', () => {
    syncFormFields();
    formState.ingredients = [...formState.ingredients, { quantity: '', unit: '', name: '' }];
    renderRecipeCreator(container);
  });

  // Dynamic Row Appenders: Add Step Row
  document.getElementById('btn-add-step').addEventListener('click', () => {
    syncFormFields();
    const nextStep = formState.instructions.length + 1;
    formState.instructions = [...formState.instructions, { step: nextStep, text: '' }];
    renderRecipeCreator(container);
  });

  // Dynamic Row Removers: Remove Ingredient
  document.querySelectorAll('[data-rem-ing]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      syncFormFields();
      const idx = Number(e.currentTarget.getAttribute('data-rem-ing'));
      formState.ingredients = formState.ingredients.filter((_, i) => i !== idx);
      renderRecipeCreator(container);
    });
  });

  // Dynamic Row Removers: Remove Step
  document.querySelectorAll('[data-rem-step]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      syncFormFields();
      const idx = Number(e.currentTarget.getAttribute('data-rem-step'));
      const remainingSteps = formState.instructions.filter((_, i) => i !== idx);
      // Re-index steps
      formState.instructions = remainingSteps.map((step, index) => ({
        step: index + 1,
        text: step.text
      }));
      renderRecipeCreator(container);
    });
  });

  // Dynamic Row Appenders: Add Note Row
  document.getElementById('btn-add-note').addEventListener('click', () => {
    syncFormFields();
    formState.notes = [...formState.notes, { text: '' }];
    renderRecipeCreator(container);
  });

  // Dynamic Row Removers: Remove Note Row
  document.querySelectorAll('[data-rem-note]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      syncFormFields();
      const idx = Number(e.currentTarget.getAttribute('data-rem-note'));
      formState.notes = formState.notes.filter((_, i) => i !== idx);
      renderRecipeCreator(container);
    });
  });

  // Cancel Creator/Editor
  document.getElementById('btn-cancel-create').addEventListener('click', () => {
    window.location.hash = isEditMode ? `#recipe?id=${formState.id}` : '#home';
  });

  // Submitter Actions: Sync live to GitHub or Download .md exports!
  document.getElementById('btn-submit-save').addEventListener('click', async (e) => {
    e.preventDefault();
    syncFormFields();

    // Quick validation checks
    if (formState.title.trim().length === 0) {
      showToast('Please specify a recipe title!', 'error');
      return;
    }

    const markdownOutput = compileMarkdown();
    const filename = `${formState.title
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')}.md`;

    if (isAuthorized) {
      // Live Authorized GitHubPUT committing!
      try {
        showToast('Saving recipe to GitHub repository...', 'info');

        await commitRecipeFile(githubConfig, filename, markdownOutput, formState.originalSha);

        showToast('Recipe committed successfully! GitHub Actions build triggered.', 'success');

        // Trigger a full dynamic data refetch in state!
        import('../main').then((m) => m.initializeRecipes());

        // Router back to cookbook
        window.location.hash = '#home';
      } catch (err) {
        showToast(`Sync Failed: ${err.message}`, 'error');
      }
    } else {
      // Local Download / Copy fallback for Reader Mode!
      triggerFileDownload(filename, markdownOutput);
      showToast('Markdown file successfully generated and downloaded!', 'success');

      // Copy to clipboard also
      navigator.clipboard.writeText(markdownOutput);
      showToast('Markdown code copied to clipboard!', 'info');

      const instructionsOverlay = `
        <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:2500; display:flex; align-items:center; justify-content:center; padding:20px;">
          <div class="settings-pane" style="max-width:540px; background:hsl(var(--bg-primary-hsl));">
            <h3 style="font-family:var(--font-serif); font-size:24px; margin-bottom:12px; color:hsl(var(--accent-primary-hsl));">Recipe Exported!</h3>
            <p style="font-size:14px; color:hsl(var(--text-secondary-hsl)); line-height:1.5; margin-bottom:20px;">
              Your recipe <b>${filename}</b> has been downloaded and copied to your clipboard. 
              <br><br>
              To see it live in your cookbook, connect your GitHub repository under the <b>"Sync"</b> tab! This will allow you to save recipes directly to your website in one tap.
            </p>
            <button class="btn btn-primary" id="btn-close-export-modal" style="width:100%; justify-content:center;">Got it, thanks!</button>
          </div>
        </div>
      `;

      const modalWrapper = document.createElement('div');
      modalWrapper.innerHTML = instructionsOverlay;
      document.body.appendChild(modalWrapper);

      document.getElementById('btn-close-export-modal').addEventListener('click', () => {
        modalWrapper.remove();
        window.location.hash = '#home';
      });
    }
  });
};
