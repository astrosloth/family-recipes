/**
 * --- UNIVERSAL RECIPE CLIPPER POPUP CONTROLLER ---
 * Injects content scrapers, displays visual recipe previews, Normalizes markdown,
 * and commits Base64 raw files directly to repositories using the GitHub REST API.
 */

let scrapedRecipe = null;
let gitConfig = null;

// --- DYNAMIC PREVIEW COMPILER ---
const compileMarkdown = (recipe) => {
  const yaml = [
    '---',
    `title: "${recipe.title.replace(/"/g, '\\"')}"`,
    `description: "${recipe.description.replace(/"/g, '\\"')}"`,
    `prepTime: "${recipe.prepTime}"`,
    `cookTime: "${recipe.cookTime}"`,
    `servings: ${recipe.servings}`,
    `difficulty: "Easy"`,
    `image: "${recipe.image || 'images/placeholder.jpg'}"`,
    `categories: ${JSON.stringify(recipe.categories)}`,
    `tags: ${JSON.stringify(recipe.tags.filter((t) => t.trim().length > 0))}`,
    '---',
    ''
  ].join('\n');

  const ingredientsText = [
    '## Ingredients',
    ...recipe.ingredients.map((ing) => `- ${ing.trim()}`),
    ''
  ].join('\n');

  const instructionsText = [
    '## Instructions',
    ...recipe.instructions.map((step, idx) => `${idx + 1}. ${step.trim()}`),
    ''
  ].join('\n');

  return `${yaml}\n${ingredientsText}\n${instructionsText}`;
};

// --- API IO WRAPPERS ---
const showStatus = (message, type = 'info') => {
  const banner = document.getElementById('status-banner');
  banner.className = `status-box status-${type}`;
  banner.innerText = message;
  banner.classList.remove('hidden');
};

const hideStatus = () => {
  document.getElementById('status-banner').classList.add('hidden');
};

const showPanel = (panelId) => {
  ['panel-loading', 'panel-config', 'panel-clipper'].forEach((id) => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(panelId).classList.remove('hidden');
};

// --- SCRAPING INJECTOR ENGINE ---
const triggerScrapePipeline = () => {
  showPanel('panel-loading');
  hideStatus();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.id) {
      showStatus('Could not locate active browser tab', 'error');
      showPanel('panel-clipper');
      return;
    }

    const url = activeTab.url || '';

    // Guard against internal system pages (extensions cannot run scripts on these)
    if (
      url.startsWith('chrome://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('https://chrome.google.com/') ||
      url.startsWith('https://microsoftedge.microsoft.com/')
    ) {
      showStatus('Clipping is not supported on internal browser settings or store pages.', 'error');
      showPanel('panel-clipper');
      return;
    }

    // Secure approach: Always inject content.js first to ensure it is active and listening!
    chrome.scripting
      .executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      })
      .then(() => {
        // Tiny delay to let the listener establish, then send message
        setTimeout(() => {
          chrome.tabs
            .sendMessage(activeTab.id, { action: 'scrapeRecipe' })
            .then((response) => {
              handleScrapeResponse(response);
            })
            .catch((err) => {
              console.warn('[Recipe Clipper] Message channel error:', err.message || err);
              showStatus(
                'Failed to scan page. Try refreshing the tab and clipping again!',
                'error'
              );
              showPanel('panel-clipper');
            });
        }, 150);
      })
      .catch((err) => {
        console.warn('[Recipe Clipper] Script injection restricted:', err);
        showStatus(
          'Clipping is restricted on this domain (e.g. system page or security sandbox).',
          'error'
        );
        showPanel('panel-clipper');
      });
  });
};

const handleScrapeResponse = (response) => {
  if (!response) {
    showStatus('Scraping query timed out or failed.', 'error');
    showPanel('panel-clipper');
    return;
  }

  if (!response.success) {
    showStatus(
      response.error || 'Could not find standard recipe structured data on this site.',
      'error'
    );
    showPanel('panel-clipper');
    return;
  }

  scrapedRecipe = response;

  // Fill Preview Elements
  document.getElementById('prev-title-header').innerText = scrapedRecipe.title;
  document.getElementById('prev-meta-domain').innerText = `Source: ${scrapedRecipe.sourceDomain}`;
  document.getElementById('stat-ingredients').innerText =
    `${scrapedRecipe.ingredients.length} ingredients`;
  document.getElementById('stat-steps').innerText = `${scrapedRecipe.instructions.length} steps`;

  // Pre-fill editable input details
  document.getElementById('clip-title').value = scrapedRecipe.title;
  document.getElementById('clip-desc').value = scrapedRecipe.description;

  // Premium Fallback scrape notice toast
  if (scrapedRecipe.isFallbackScrape) {
    showStatus(
      'No JSON-LD metadata found. Compiled recipe using fallback layout parsing.',
      'success'
    );
  } else {
    showStatus('Recipe metadata scanned successfully!', 'success');
  }

  showPanel('panel-clipper');
};

// --- MASTER CONTROLLER INIT ---
document.addEventListener('DOMContentLoaded', () => {
  // Load configuration credentials from local extension sync storage
  chrome.storage.local.get(['gitConfig'], (result) => {
    gitConfig = result.gitConfig;

    if (!gitConfig || !gitConfig.token) {
      showPanel('panel-config');

      // Auto-prefill owner/repo if tabs match pages
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0]?.url || '';
        if (url.includes('.github.io/')) {
          try {
            const host = new URL(url).hostname;
            const path = new URL(url).pathname;
            const owner = host.split('.')[0];
            const repo = path.split('/').filter((p) => p.length > 0)[0] || '';
            if (owner && repo) {
              document.getElementById('cfg-owner').value = owner;
              document.getElementById('cfg-repo').value = repo;
            }
          } catch {}
        }
      });
    } else {
      triggerScrapePipeline();
    }
  });

  // Save sync configs
  document.getElementById('btn-save-cfg').addEventListener('click', () => {
    const owner = document.getElementById('cfg-owner').value.trim();
    const repo = document.getElementById('cfg-repo').value.trim();
    const branch = document.getElementById('cfg-branch').value.trim() || 'main';
    const token = document.getElementById('cfg-token').value.trim();

    if (!owner || !repo || !token) {
      showStatus('Please fill out all authorization fields!', 'error');
      return;
    }

    // Quick test token
    showStatus('Verifying token validity...', 'info');

    fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${token}`
      }
    })
      .then((res) => {
        if (res.status === 200) {
          gitConfig = { owner, repo, branch, token };
          chrome.storage.local.set({ gitConfig }, () => {
            showStatus('Connected successfully!', 'success');
            setTimeout(() => {
              triggerScrapePipeline();
            }, 1000);
          });
        } else {
          showStatus('Verification failed: invalid token or permissions', 'error');
        }
      })
      .catch((err) => {
        showStatus(`Connection failed: ${err.message}`, 'error');
      });
  });

  // Reconfigure sync panel toggler
  document.getElementById('btn-change-sync').addEventListener('click', () => {
    if (gitConfig) {
      document.getElementById('cfg-owner').value = gitConfig.owner;
      document.getElementById('cfg-repo').value = gitConfig.repo;
      document.getElementById('cfg-branch').value = gitConfig.branch;
      document.getElementById('cfg-token').value = gitConfig.token;
    }
    showPanel('panel-config');
  });

  // CLIP AND SAVE RECIPE DIRECT PUT COMMITS
  document.getElementById('btn-clip-recipe').addEventListener('click', async () => {
    if (!scrapedRecipe || !gitConfig) return;

    const customTitle = document.getElementById('clip-title').value.trim();
    const customDesc = document.getElementById('clip-desc').value.trim();

    if (customTitle.length === 0) {
      showStatus('Please specify a recipe title!', 'error');
      return;
    }

    // Merge updates immutably
    const finalizedRecipe = {
      ...scrapedRecipe,
      title: customTitle,
      description: customDesc
    };

    const filename = `${customTitle
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')}.md`;
    const markdownContent = compileMarkdown(finalizedRecipe);

    showStatus('Saving file in your repository...', 'info');
    document.getElementById('btn-clip-recipe').disabled = true;

    const url = `https://api.github.com/repos/${gitConfig.owner}/${gitConfig.repo}/contents/recipes/${filename}`;
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${gitConfig.token}`
    };

    try {
      // 1. Check if file already exists to get its SHA (updating)
      let sha = null;
      try {
        const checkRes = await fetch(`${url}?ref=${gitConfig.branch}`, { headers });
        if (checkRes.status === 200) {
          const fileInfo = await checkRes.json();
          sha = fileInfo.sha;
        }
      } catch {}

      // 2. Base64 safe encoder
      const utf8Content = unescape(encodeURIComponent(markdownContent));
      const base64Content = btoa(utf8Content);

      const body = {
        message: `Clip Recipe: ${customTitle}`,
        content: base64Content,
        branch: gitConfig.branch,
        ...(sha ? { sha } : {})
      };

      // 3. PUT call
      const commitRes = await fetch(url, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      document.getElementById('btn-clip-recipe').disabled = false;

      if (commitRes.status === 200 || commitRes.status === 201) {
        showStatus('Recipe successfully clipped and sync-saved!', 'success');

        // Render happy completion banner
        const btnBox = document.getElementById('panel-clipper');
        btnBox.innerHTML = `
          <div style="text-align: center; padding: 20px 0;">
            <svg width="48" height="48" viewBox="0 0 512 512" fill="#15803D" style="margin-bottom: 12px;">
              <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/>
            </svg>
            <h4 style="margin-bottom: 6px;">Successfully Saved!</h4>
            <p style="font-size:12px; color: var(--text-secondary); margin-bottom: 16px;">
              Your new recipe <b>${filename}</b> is saved live in your family cookbook branch!
            </p>
            <button class="btn btn-secondary" id="btn-open-cookbook">Open Live Cookbook</button>
          </div>
        `;

        document.getElementById('btn-open-cookbook').addEventListener('click', () => {
          const liveUrl = `https://${gitConfig.owner}.github.io/${gitConfig.repo}/`;
          chrome.tabs.create({ url: liveUrl });
        });
      } else {
        const errDetails = await commitRes.json().catch(() => ({}));
        showStatus(`Save failed: ${errDetails.message || commitRes.status}`, 'error');
      }
    } catch (err) {
      document.getElementById('btn-clip-recipe').disabled = false;
      showStatus(`Commit failed: ${err.message}`, 'error');
    }
  });
});
