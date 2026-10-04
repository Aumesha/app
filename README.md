# 🚀 Blogger Instant Googlebot Indexer & SEO Console

> ಬ್ಲಾಗರ್ (Blogger) ಪೋಸ್ಟ್‌ಗಳನ್ನು ಗೂಗಲ್ ಸರ್ಚ್ ಬಾಟ್‌ಗಳಿಗೆ ಇನ್ಸ್ಟಂಟ್ ಆಗಿ ಇಂಡೆಕ್ಸ್ ಮಾಡಲು ಮತ್ತು ಕಸ್ಟಮ್ robots.txt / ಸೈಟ್‌ಮ್ಯಾಪ್ ತಯಾರಿಸಲು ಸಂಪೂರ್ಣ ಅಪ್ಲಿಕೇಶನ್ ಹಾಗೂ GitHub Actions ವರ್ಕ್‌ಫ್ಲೋ.

---

## ⚡ GitHub Actions ವರ್ಕ್‌ಫ್ಲೋಗಳು (Included Workflows)

ಈ ಪ್ರಾಜೆಕ್ಟ್‌ನಲ್ಲಿ **2 ಪ್ರಮುಖ GitHub Actions ವರ್ಕ್‌ಫ್ಲೋಗಳು** ಸಿದ್ಧವಾಗಿವೆ:

### 1. `instant-index.yml` — ಗೂಗಲ್ ಬಾಟ್‌ಗೆ ನೇರ ನೋಟಿಫಿಕೇಶನ್
- GitHub ನ **Actions** ಟ್ಯಾಬ್‌ಗೆ ಹೋಗಿ **"Blogger Instant Googlebot Indexer"** ಆಯ್ಕೆಮಾಡಿ.
- **"Run workflow"** ಕ್ಲಿಕ್ ಮಾಡಿ ನಿಮ್ಮ ಹೊಸ ಬ್ಲಾಗ್ ಪೋಸ್ಟ್ ಲಿಂಕ್ (URL) ಹಾಕಿ ರನ್ ಮಾಡಿ!
- GitHub ವರ್ಕ್‌ಫ್ಲೋ ರನ್ ಆಗಿ:
  - ಗೂಗಲ್‌ನ ಅಧಿಕೃತ **WebSub Hub** (`pubsubhubbub.appspot.com`) ಗೆ ನೋಟಿಫಿಕೇಶನ್ ಕಳುಹಿಸುತ್ತದೆ (HTTP 204).
  - **IndexNow** ಸರ್ಚ್ ಬಾಟ್‌ಗಳಿಗೆ ಸಿಗ್ನಲ್ ನೀಡುತ್ತದೆ.
  - ಗೂಗಲ್ ಇಂಡೆಕ್ಸಿಂಗ್ API v3 ಕರೆ ಮಾಡುತ್ತದೆ.
  - GitHub Actions ರನ್ ಪೇಜ್‌ನಲ್ಲಿ ಪೂರ್ಣ ವರದಿ ಮತ್ತು Search Console ನೇರ ಲಿಂಕ್ ನೀಡುತ್ತದೆ.

### 2. `deploy.yml` — ಸ್ವಯಂಚಾಲಿತ ಬಿಲ್ಡ್ ಮತ್ತು GitHub Pages ನಿಯೋಜನೆ
- ನೀವು ಈ ಕೋಡ್ ಅನ್ನು GitHub ಗೆ ಪುಶ್ ಮಾಡಿದ ತಕ್ಷಣ ಆಟೋಮ್ಯಾಟಿಕ್ ಆಗಿ ಬಿಲ್ಡ್ ಪರೀಕ್ಷೆ ನಡೆಸಿ **GitHub Pages** ಅಥವಾ ಯಾವುದೇ ಹೋಸ್ಟಿಂಗ್‌ಗೆ ಆಪ್ ಅನ್ನು ನಿಯೋಜಿಸುತ್ತದೆ.

---

## 📦 ಈ ಪ್ರಾಜೆಕ್ಟ್ ಅನ್ನು ನಿಮ್ಮ GitHub ಗೆ ಪುಶ್ ಮಾಡುವ ಹಂತಗಳು (Push to GitHub)

ನಿಮ್ಮ ಕಂಪ್ಯೂಟರ್ ಟರ್ಮಿನಲ್ (Git Bash / VS Code / Command Prompt) ನಲ್ಲಿ:

```bash
# 1. Git ಪ್ರಾರಂಭಿಸಿ
git init

# 2. ಎಲ್ಲಾ ಫೈಲ್‌ಗಳನ್ನು ಸೇರಿಸಿ
git add .

# 3. ಮೊದಲ ಕಮಿಟ್ ಮಾಡಿ
git commit -m "feat: Blogger Instant Indexer with GitHub Actions Workflows"

# 4. ಮುಖ್ಯ ಬ್ರಾಂಚ್ ಅನ್ನು main ಎಂದು ಸೆಟ್ ಮಾಡಿ
git branch -M main

# 5. ನಿಮ್ಮ GitHub ರೆಪೊಸಿಟರಿ ಲಿಂಕ್ ಜೋಡಿಸಿ (YOUR_USERNAME ಬದಲಾಯಿಸಿ)
git remote add origin https://github.com/YOUR_USERNAME/blogger-indexer.git

# 6. GitHub ಗೆ ಪುಶ್ ಮಾಡಿ!
git push -u origin main
```

---

## 🔑 ಐಚ್ಛಿಕ: Google Indexing API v3 ಸೀಕ್ರೆಟ್ ಸೇರಿಸುವುದು (GitHub Secret)
ನೀವು Google Cloud Service Account JSON ಕೀ ಹೊಂದಿದ್ದರೆ:
1. GitHub ರೆಪೊಸಿಟರಿ **Settings** → **Secrets and variables** → **Actions** ಗೆ ಹೋಗಿ.
2. **"New repository secret"** ಕ್ಲಿಕ್ ಮಾಡಿ.
3. Name: `GSC_SERVICE_ACCOUNT_KEY`
4. Value: ನಿಮ್ಮ Service Account ನ ಸಂಪೂರ್ಣ JSON ಕೀಯನ್ನು ಪೇಸ್ಟ್ ಮಾಡಿ ಸೇವ್ ಮಾಡಿ.

---

## 💻 ಲೋಕಲ್ ಆಗಿ ರನ್ ಮಾಡಲು (Local Development):
```bash
npm install
npm run dev
# Browser: http://localhost:3000
```
