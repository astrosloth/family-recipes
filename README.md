# 🍳 Modern Family Recipes Cookbook

A beautiful, premium, responsive **Markdown-Powered Family Cookbook Web Application** built with Vite, Vanilla JS, and Vanilla CSS. It functions as a Progressive Web App (PWA) with 100% offline kitchen access, incorporates a dynamic client-side **GitHub REST API CMS**, and features a standalone **universal browser extension recipe clipper** to instantly clip recipes from around the web directly to your repository.

---

## ✨ Features

- **📖 Static Reader Mode (Ultra-Fast & Free)**: General visitors (family members) browse a blazing-fast, statically compiled, offline-first book served for free via **GitHub Pages**.
- **✍️ Live GitHub Sync Mode (Zero-Serverless CMS)**: By providing a GitHub Personal Access Token (PAT) securely stored _only_ in your browser's local storage, the app transforms into an interactive visual editor allowing you to create, edit, or delete recipe markdown files directly inside your repo with **instant sync** updates!
- **⚖️ Gourmet Weight Converter**: A chef-grade volume-to-grams conversion engine. Toggle a button to dynamically recalculate volumes (cups, tablespoons) to weights (grams) based on standard densities of baking staples (flour, sugar, butter, etc.).
- **🥞 Dynamic Servings Rescaler**: Instantly adjust serving sizes up or down; ingredient quantities are dynamically multiplied and formatted back into clean fractions (e.g. `1 1/2 cups` or `120g`) in real-time.
- **📱 PWA Standalone & 100% Offline Caching**: Install the app directly to your phone, tablet, or desktop home screen. A custom **Service Worker** (`sw.js`) caches all resources and recipes so the cookbook works perfectly at the grocery store or in low-signal kitchens.
- **⏱️ Focus Cooking Mode with Timers**: A dark, high-contrast, large-typography cooking overlay. It compiles an ingredient prep checklist and highlights steps step-by-step, scanning instructions to auto-trigger inline cooking countdown timers!
- **🛒 Aggregated Shopping List**: Aggregate ingredients across multiple recipes, add custom grocery items, check them off as you shop, and clear lists in bulk.
- **✂️ Universal Recipe Clipper (Browser Extension)**: A modern WebExtension that extracts **Schema.org JSON-LD structured recipe data** from _any_ cooking blog (NYT Cooking, Bon Appétit, Epicurious, serious eats, etc.) and commits it directly to your GitHub repository as a new markdown file in one click!
- **🌐 conforming Schema.org JSON-LD Injections**: The recipe details page dynamically compiles and injects standard culinary structured scripts, optimizing SEO indexing for rich Google snippets and ensuring 100% interoperability with smart displays.
- **🛡️ Bulletproof Fault-Tolerance**: Recipe parsing is executed inside pure Try-Catch blocks. Malformed markdown edits will never crash the site; the app gracefully isolates bad files with Warning badges while keeping the cookbook running.
- **⚡ Action-less Dynamic Live Fallback**: If you run out of GitHub Actions free build minutes for the month, the site dynamically queries unauthenticated public repository commits. If a new commit is detected, the app automatically fetches raw markdown files dynamically in the background, rendering updates instantly for readers without needing a successful GitHub Actions build run!

---

## 🚀 1-Minute Quick Start (Fork & Deploy)

You can host your family cookbook entirely for free in less than a minute:

1. **Fork this Repository**: Click the **Fork** button at the top right of this repository to create a copy under your own GitHub account.
2. **Enable GitHub Pages**:
   - Go to your newly forked repository's **Settings** tab.
   - Click **Pages** in the left sidebar.
   - Under **Build and deployment -> Source**, change the dropdown from "Deploy from a branch" to **"GitHub Actions"**.
3. **Trigger the First Deploy**:
   - Make a simple edit or push a commit to the `main` branch (for example, modifying this README or adding a sample recipe).
   - This triggers the free virtual builder defined in `.github/workflows/deploy.yml`.
   - Your site will be live at `https://<your-username>.github.io/<your-repo-name>/` in under 2 minutes!

---

## 🔑 Connecting Settings & Sync (Author CMS)

To visually write, edit, and clip recipes directly inside the web application:

1. **Generate a GitHub Personal Access Token (PAT)**:
   - Go to your GitHub **Settings -> Developer Settings -> Personal Access Tokens -> Fine-grained tokens**.
   - Click **Generate new token**.
   - Set **Repository access** to **"Only select repositories"** and choose your forked `family-recipes` repository.
   - Under **Permissions**, click **Repository permissions**, find **Contents**, and select **Access: Read and write**.
   - Click **Generate token** and copy the code.
2. **Configure the App**:
   - Open your deployed recipe website and navigate to the **Sync** tab.
   - The app will automatically pre-fill your Username and Repository Name from the URL!
   - Paste your copied Personal Access Token (PAT) and click **Test & Save Config**.
   - You are now connected! A green "Live Sync Connected" indicator will display. You can now visually add, edit, or delete recipes, which commits changes directly back to your repository in seconds!

### 📱 Syncing Secondary Devices (Phone or Tablet)

To configure editing permissions on a phone or tablet without typing out long tokens:

1. Open the **Sync** tab on your primary computer.
2. Click **Generate Secure Setup Link**.
3. Copy the secure link and open it on your secondary device (e.g. text it to your phone).
4. The app will open, display a "Successfully Synchronized!" notification, and **immediately purge all sensitive credentials from the address bar and browser history** for security. Your phone is now fully configured for live recipe editing!

---

## ✂️ Installing the Recipe Clipper Browser Extension

Browse any cooking website and save recipes to your cookbook in one click:

1. **Open Chrome/Edge Extension Settings**:
   - Navigate to `chrome://extensions/` in your browser.
   - Toggle **"Developer Mode"** in the top right corner.
2. **Load the Clipper Extension**:
   - Click **Load unpacked** in the top left.
   - Select the `/extension` directory inside your local cloned repository.
3. **Configure & Use**:
   - Click the Recipe Clipper icon in your browser toolbar.
   - Enter your same GitHub Username, Repository Name, and Personal Access Token (PAT) once in the extension's sync panel and click save.
   - Navigate to any recipe page (e.g. a recipe on _Serious Eats_ or _NYT Cooking_).
   - Click the clipper icon. It will show a visual preview of the extracted ingredients and steps!
   - Modify the title or description if desired, and click **Save to Family Repo**.
   - Done! The recipe is written directly to your GitHub repository and shows up on your cookbook website instantly!

---

## 📝 Recipe Markdown Specification

If you prefer to write recipe markdown `.md` files manually in your code editor, save them flatly inside the `/recipes` directory using this structure:

```markdown
---
title: 'Perfect Chocolate Chip Cookies'
description: 'Crispy on the edges, soft and chewy in the center, and loaded with rich chocolate pools.'
prepTime: '20 mins'
cookTime: '10 mins'
servings: 24
difficulty: 'Easy'
image: 'images/cookies.jpg'
categories: ['Dessert', 'Baking']
tags: ['Cookies', 'Chocolate', 'Sweet', 'Kid-Friendly', 'Family Classic']
---

## Ingredients

- 1 cup butter
- 3/4 cup granulated sugar
- 3/4 cup brown sugar
- 2 eggs
- 2 tsp vanilla extract
- 2 1/4 cups all-purpose flour
- 1 tsp salt
- 1 tsp baking soda
- 2 cups chocolate chips

## Instructions

1. **Cream Butter and Sugars:** In a bowl, cream butter and sugars until smooth.
2. **Add Wet Ingredients:** Whisk in eggs and vanilla.
3. **Fold Dry Ingredients:** Fold in all-purpose flour, baking soda, and salt.
4. **Fold in Chocolate:** Fold in chocolate chips.
5. **Bake:** Scoop dough and bake at 350°F (175°C) for 10 minutes, or until edges are golden-brown.
```

- **Metadata Rules**: Always place broad high-level categories (e.g. `Baking`, `Main Course`, `Breakfast`) in `categories`, and specific attributes in `tags`.
- **Ingredients Formatting**: Start rows with a standard dash `-` followed by a quantity, unit, and item details. The dynamic rescaler will parse these matching culinary units to perform serving and weight conversions.
- **Instructions Formatting**: Number steps as `1.`, `2.`, etc. The Focus Cooking Mode auto-detects time durations (e.g. `10 minutes`, `2 hours`) inside text steps to auto-trigger step countdown timers.

---

## 💻 Technical Stack

- **Core**: HTML5, Vanilla JavaScript (mostly functional architecture with unidirectional data flow and immutable state modifications).
- **Styling**: Vanilla CSS3 (custom properties layout grids, responsive media themes, glassmorphism UI overlays).
- **Tooling**: Vite (raw asset loaders and static bundlers).
- **Libraries**: Marked (browser-safe, zero-dependency Markdown parser).
- **Sync**: GitHub REST API (Cross-Origin Resource Sharing compliant client-side queries).

---

## 📜 License

This project is open-source and free to share, fork, and use for your own family cookbooks! Enjoy cooking! 🍳
