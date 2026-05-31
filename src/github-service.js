/**
 * --- ISOLATED GITHUB REST API SERVICE ---
 * Clean I/O operations returning promises, isolated from main state management.
 */

// Helper to compile authorization headers
const getHeaders = (token) => ({
  Accept: 'application/vnd.github.v3+json',
  ...(token ? { Authorization: `token ${token}` } : {})
});

/**
 * Validates a GitHub Personal Access Token (PAT) by querying user details.
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export const checkTokenValidity = async (token) => {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: getHeaders(token)
    });
    return res.status === 200;
  } catch (err) {
    console.error('[GitHub Service] Token check failed:', err);
    return false;
  }
};

/**
 * Auto-detects GitHub Owner and Repository from GitHub Pages hostnames.
 * e.g., "https://fmaur.github.io/family-recipes" -> { owner: "fmaur", repo: "family-recipes" }
 * @returns {object|null}
 */
export const autoDetectRepo = () => {
  const host = window.location.hostname;
  const path = window.location.pathname;

  if (host.endsWith('.github.io')) {
    const owner = host.split('.')[0];
    // Split path to find repository segment (filtering out empty elements)
    const pathParts = path.split('/').filter((p) => p.length > 0);
    const repo = pathParts[0] || '';

    if (owner && repo) {
      console.log(`[GitHub Service] Auto-detected repo: ${owner}/${repo}`);
      return { owner, repo };
    }
  }
  return null;
};

/**
 * Dynamically queries the list of recipe markdown files in `/recipes`.
 * @param {object} config - { owner, repo, branch, token }
 * @returns {Promise<array>} - List of file descriptors
 */
export const fetchRecipeFiles = async (config) => {
  const { owner, repo, branch = 'main', token } = config;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/recipes?ref=${branch}`;

  try {
    const res = await fetch(url, { headers: getHeaders(token) });
    if (res.status !== 200) {
      throw new Error(`GitHub directory read failed with status ${res.status}`);
    }
    const files = await res.json();

    // Filter to only return markdown files
    return files.filter((f) => f.type === 'file' && f.name.endsWith('.md'));
  } catch (err) {
    console.error('[GitHub Service] Fetch recipe files list failed:', err);
    throw err;
  }
};

/**
 * Fetches the raw content of a single recipe markdown file.
 * Automatically handles public raw CDN falling back to authenticated REST endpoint.
 * @param {object} config - { owner, repo, branch, token }
 * @param {string} filePath - Path in repository (e.g. "recipes/lasagna.md")
 * @returns {Promise<string>} - Markdown raw text
 */
export const fetchRawFile = async (config, filePath) => {
  const { owner, repo, branch = 'main', token } = config;

  // Use unauthenticated raw CDN URL if no token is active to avoid CORS and load faster
  const cdnUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;

  try {
    if (!token) {
      const res = await fetch(cdnUrl);
      if (res.status === 200) return await res.text();
    }

    // Authenticated REST fallback (supports private repos or rate limit avoidance)
    const restUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
    const res = await fetch(restUrl, { headers: getHeaders(token) });
    if (res.status !== 200) {
      throw new Error(`Fetch raw file failed with status ${res.status}`);
    }
    const data = await res.json();

    // Decode base64 file content (UTF-8 safe conversion)
    return decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
  } catch (err) {
    console.error(`[GitHub Service] Raw fetch failed for ${filePath}:`, err);
    throw err;
  }
};

/**
 * Commits (creates or updates) a recipe markdown file in the repository.
 * @param {object} config - { owner, repo, branch, token }
 * @param {string} fileName - e.g. "lasagna.md"
 * @param {string} mdContent - Raw markdown text to write
 * @param {string|null} sha - Current SHA of the file (required for updates)
 * @returns {Promise<object>} - Commited file status
 */
export const commitRecipeFile = async (config, fileName, mdContent, sha = null) => {
  const { owner, repo, branch = 'main', token } = config;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/recipes/${fileName}`;

  try {
    let activeSha = sha;

    // If updating but no SHA was provided, fetch the file's current SHA first
    if (!activeSha) {
      try {
        const getUrl = `${url}?ref=${branch}`;
        const getRes = await fetch(getUrl, { headers: getHeaders(token) });
        if (getRes.status === 200) {
          const fileData = await getRes.json();
          activeSha = fileData.sha;
        }
      } catch (e) {
        console.log('[GitHub Service] File is new, proceeding without SHA');
      }
    }

    // UTF-8 safe Base64 encoder
    const utf8Content = unescape(encodeURIComponent(mdContent));
    const base64Content = btoa(utf8Content);

    const body = {
      message: `Recipe Update: ${fileName.replace(/\.md$/, '').replace(/-/g, ' ')}`,
      content: base64Content,
      branch,
      ...(activeSha ? { sha: activeSha } : {})
    };

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...getHeaders(token),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (res.status !== 200 && res.status !== 201) {
      const errorDetail = await res.json().catch(() => ({}));
      throw new Error(errorDetail.message || `Commit failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error('[GitHub Service] Commit failed:', err);
    throw err;
  }
};

/**
 * Commits a binary image file (already encoded in Base64) to the repository.
 * @param {object} config - { owner, repo, branch, token }
 * @param {string} fileName - e.g. "rolls-12345.jpg"
 * @param {string} base64Data - Raw Base64 string of the image (without data URL prefix)
 * @returns {Promise<object>} - Committed file status
 */
export const commitImageFile = async (config, fileName, base64Data) => {
  const { owner, repo, branch = 'main', token } = config;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/recipes/images/${fileName}`;

  try {
    let sha = null;
    try {
      const getRes = await fetch(`${url}?ref=${branch}`, { headers: getHeaders(token) });
      if (getRes.status === 200) {
        const fileData = await getRes.json();
        sha = fileData.sha;
      }
    } catch {}

    const body = {
      message: `Upload Recipe Image: ${fileName}`,
      content: base64Data,
      branch,
      ...(sha ? { sha } : {})
    };

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...getHeaders(token),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (res.status !== 200 && res.status !== 201) {
      const errorDetail = await res.json().catch(() => ({}));
      throw new Error(errorDetail.message || `Image upload failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error('[GitHub Service] Image upload failed:', err);
    throw err;
  }
};

/**
 * Deletes a recipe file from the repository.
 * @param {object} config - { owner, repo, branch, token }
 * @param {string} fileName - e.g. "lasagna.md"
 * @param {string} sha - Current SHA of the file (strictly required for deletion)
 * @returns {Promise<boolean>}
 */
export const deleteRecipeFile = async (config, fileName, sha) => {
  const { owner, repo, branch = 'main', token } = config;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/recipes/${fileName}`;

  try {
    let activeSha = sha;

    // Fetch SHA if missing
    if (!activeSha) {
      const getRes = await fetch(`${url}?ref=${branch}`, { headers: getHeaders(token) });
      if (getRes.status === 200) {
        const fileData = await getRes.json();
        activeSha = fileData.sha;
      } else {
        throw new Error('Could not retrieve file SHA to delete');
      }
    }

    const body = {
      message: `Delete Recipe: ${fileName.replace(/\.md$/, '').replace(/-/g, ' ')}`,
      sha: activeSha,
      branch
    };

    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...getHeaders(token),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (res.status !== 200) {
      throw new Error(`Delete file failed with status ${res.status}`);
    }
    return true;
  } catch (err) {
    console.error('[GitHub Service] Delete failed:', err);
    throw err;
  }
};

/**
 * Fetch the latest commit SHA of the repository (unauthenticated public API).
 * Used by PWA static modes to detect if the repo has newer recipes than the built bundle.
 * @param {string} owner
 * @param {string} repo
 * @param {string} branch
 * @returns {Promise<string|null>} - Commit SHA string
 */
export const getLatestCommitSha = async (owner, repo, branch = 'main') => {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&per_page=1`;
  try {
    const res = await fetch(url);
    if (res.status === 200) {
      const data = await res.json();
      return data[0]?.sha || null;
    }
    return null;
  } catch (err) {
    console.warn('[GitHub Service] Public commit SHA lookup failed:', err);
    return null;
  }
};

/**
 * Generates a private, secure shareable quick configuration sync setup link.
 * @param {object} config - { owner, repo, branch, token }
 * @returns {string} - Full config URL
 */
export const generateQuickConfigLink = (config) => {
  const { owner, repo, branch = 'main', token } = config;
  const baseUrl = window.location.origin + window.location.pathname;

  // Encode the PAT in simple Base64 to avoid raw token copy-paste indexing
  const encToken = token ? btoa(token) : '';
  const hash = `#settings?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}&sync=${encToken}`;
  return baseUrl + hash;
};

/**
 * Parses URL hash for Quick-Config setup parameters.
 * Instantly saves configuration to localStorage, purges browser history, and triggers toast callback.
 *
 * @param {function} toastCallback - Callback to display toast notifications
 * @returns {object|null} - Configuration object if parsed, or null
 */
export const parseQuickConfigLink = (toastCallback) => {
  const hash = window.location.hash;
  if (!hash.startsWith('#settings?')) return null;

  try {
    const searchParams = new URLSearchParams(hash.slice(10));
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const branch = searchParams.get('branch') || 'main';
    const sync = searchParams.get('sync');

    if (owner && repo) {
      const token = sync ? atob(sync) : '';

      const config = { owner, repo, branch, token };
      localStorage.setItem('family-recipes-git-config', JSON.stringify(config));

      if (toastCallback) {
        toastCallback('GitHub Sync successfully configured from setup link!', 'success');
      }

      // Top-Tier Security: Purge sensitive parameters from history and URL bar immediately!
      const cleanUrl = window.location.origin + window.location.pathname + '#settings';
      window.history.replaceState(null, '', cleanUrl);

      return config;
    }
  } catch (e) {
    console.error('[GitHub Service] Parsing setup link failed:', e);
    if (toastCallback) {
      toastCallback('Failed to configure from link: invalid encoding', 'error');
    }
  }
  return null;
};
