# Rise From Nothing
> Idle incremental game — Version 1: Foundation MVP

## Play Locally
Just open `index.html` in any browser. No build step, no dependencies.  
Or use VS Code's Live Server extension for auto-reload during development.

---

## GitHub Setup + VS Code Remote

### Step 1 — Create the GitHub Repo

1. Go to **https://github.com/new**
2. Repository name: `rise-from-nothing`
3. Set to **Private** (or Public — your call)
4. **Do NOT** initialize with README, .gitignore, or license (you already have files)
5. Click **Create repository**
6. Copy the repo URL — it will look like:  
   `https://github.com/YOUR_USERNAME/rise-from-nothing.git`

---

### Step 2 — Initialize Git & Push from Your Machine

Open a terminal in your project folder and run these commands one by one:

```bash
# Initialize git
git init

# Stage all files
git add .

# First commit
git commit -m "feat: Version 1 Foundation MVP"

# Point to your GitHub repo (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/rise-from-nothing.git

# Push to GitHub
git branch -M main
git push -u origin main
```

If prompted for credentials, use your GitHub username and a **Personal Access Token** (not your password).  
Generate one at: **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**  
Scopes needed: `repo`

---

### Step 3 — Open in VS Code

**Option A — Open local folder (simplest)**
```bash
# From terminal, inside the project folder:
code .
```

**Option B — Clone fresh from GitHub into VS Code**
1. Open VS Code
2. Press `Ctrl+Shift+P` → type `Git: Clone`
3. Paste your repo URL
4. Choose where to save it locally
5. Click "Open" when prompted

---

### Step 4 — Recommended VS Code Extensions

Install these for the best dev experience:

| Extension | Why |
|-----------|-----|
| **Live Server** (Ritwick Dey) | Right-click `index.html` → Open with Live Server. Auto-reloads on save. |
| **GitLens** | See git blame, history inline |
| **Prettier** | Auto-format JS/CSS/HTML |
| **GitHub Copilot** *(optional)* | AI code suggestions |

---

### Step 5 — Daily Workflow

```bash
# Pull latest changes before working
git pull

# After making changes
git add .
git commit -m "feat/fix/chore: short description"
git push
```

---

## File Structure

```
rise-from-nothing/
├── index.html          ← Entry point
├── css/
│   └── style.css       ← All styles (dark urban theme)
├── js/
│   ├── data.js         ← Game constants (jobs, businesses)
│   ├── save.js         ← localStorage save/load + offline earnings
│   ├── ui.js           ← DOM rendering & floating text
│   └── game.js         ← Game state, logic, timers
└── README.md
```

---

## Version 1 — Acceptance Criteria

- [x] Player can earn Capital (tap actions)
- [x] Player can unlock all 3 jobs (Beggar → Street Sweeper → Garbage Collector)
- [x] Player can purchase Food Cart (₱5,000)
- [x] Player can purchase Small Store (₱25,000)
- [x] Progress saves to localStorage
- [x] Progress loads on reload
- [x] Offline earnings calculated on load
- [x] Mobile-first responsive design

---

## Version Roadmap

See `VERSION_ROADMAP.md` for the full 9-version plan.  
Next: **Version 2 — Automation Expansion** (Employee system, passive income)