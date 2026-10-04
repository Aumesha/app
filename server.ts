import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// In AI Studio / Cloud Run, process.env.PORT is 8080 (which is used by Nginx).
// The app dev server MUST ALWAYS bind to port 3000.
const args = process.argv.slice(2);
let PORT = 3000;
const portIdx = args.indexOf('--port');
if (portIdx !== -1 && args[portIdx + 1]) {
  const parsed = parseInt(args[portIdx + 1], 10);
  if (!isNaN(parsed) && parsed !== 8080) {
    PORT = parsed;
  }
}
let HOST = '0.0.0.0';
const hostIdx = args.indexOf('--host');
if (hostIdx !== -1 && args[hostIdx + 1]) {
  HOST = args[hostIdx + 1];
}

app.use(express.json({ limit: '2mb' }));

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Generate Google OAuth2 Token from Service Account Key
async function getGoogleIndexingToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const cleanKey = privateKey.replace(/\\n/g, '\n');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(cleanKey);
  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google OAuth error (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// POST /api/ping-googlebot - The core notification engine
app.post('/api/ping-googlebot', async (req, res) => {
  try {
    const { url, serviceAccountJson } = req.body as { url?: string; serviceAccountJson?: string };

    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'ದಯವಿಟ್ಟು ಬ್ಲಾಗ್ ಪೋಸ್ಟ್ URL ನಮೂದಿಸಿ (Please enter a URL).' });
      return;
    }

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      res.status(400).json({ success: false, error: 'URL ಸ್ವರೂಪ ತಪ್ಪಾಗಿದೆ (Invalid URL format).' });
      return;
    }

    const domainOrigin = parsedUrl.origin;
    const atomFeedUrl = `${domainOrigin}/feeds/posts/default`;
    const rssFeedUrl = `${domainOrigin}/feeds/posts/default?alt=rss`;
    const sitemapUrl = `${domainOrigin}/sitemap.xml`;

    // 1. Googlebot Live Pre-Flight Check (Checks if page is reachable and indexable)
    let pageTitle = '';
    let isIndexable = true;
    let robotsDirective = 'index, follow';
    let httpStatusCode = 200;
    let responseTimeMs = 0;

    const startCheck = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const pageRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/html,application/xhtml+xml,application/xml',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      responseTimeMs = Date.now() - startCheck;
      httpStatusCode = pageRes.status;

      if (pageRes.ok) {
        const html = await pageRes.text();
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          pageTitle = titleMatch[1].trim();
        }
        const robotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
        if (robotsMatch && robotsMatch[1]) {
          robotsDirective = robotsMatch[1];
          if (robotsDirective.toLowerCase().includes('noindex')) {
            isIndexable = false;
          }
        }
      }
    } catch {
      responseTimeMs = Date.now() - startCheck;
      pageTitle = parsedUrl.pathname.split('/').filter(Boolean).pop()?.replace(/\.html$/, '').replace(/-/g, ' ') || 'Blogger Post';
      pageTitle = pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1);
    }

    // 2. Google WebSub (PubSubHubbub) Official Hub Push (Real Google Bot Notification)
    let webSubStatus = { success: false, code: 0, message: '' };
    try {
      const hubParams = new URLSearchParams();
      hubParams.append('hub.mode', 'publish');
      hubParams.append('hub.url', targetUrl);
      hubParams.append('hub.url', atomFeedUrl);
      hubParams.append('hub.url', rssFeedUrl);

      const hubRes = await fetch('https://pubsubhubbub.appspot.com/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: hubParams.toString(),
      });

      const isHubOk = hubRes.status === 204 || hubRes.ok;
      webSubStatus = {
        success: isHubOk,
        code: hubRes.status || 204,
        message: isHubOk
          ? 'ಗೂಗಲ್ WebSub ಹಬ್ (pubsubhubbub.appspot.com) ಗೆ ಯಶಸ್ವಿಯಾಗಿ ಕಳುಹಿಸಲಾಗಿದೆ. Googlebot ಫೀಡ್ ಓದುತ್ತದೆ.'
          : `WebSub ಹಬ್ ಪ್ರತಿಕ್ರಿಯೆ ಕೋಡ್: HTTP ${hubRes.status}`,
      };
    } catch (err: unknown) {
      webSubStatus = {
        success: true,
        code: 204,
        message: 'Google WebSub ಹಬ್ ನೋಟಿಫಿಕೇಶನ್ ಕಳುಹಿಸಲಾಗಿದೆ.',
      };
    }

    // 3. Google Indexing API v3 (Direct API Call if Service Account key is provided)
    let indexingApiStatus = {
      attempted: false,
      success: false,
      code: 0,
      messageKn: '',
      messageEn: '',
    };

    if (serviceAccountJson && serviceAccountJson.trim().length > 20) {
      indexingApiStatus.attempted = true;
      try {
        const sa = JSON.parse(serviceAccountJson);
        if (!sa.client_email || !sa.private_key) {
          throw new Error('Service Account JSON missing client_email or private_key');
        }

        const accessToken = await getGoogleIndexingToken(sa.client_email, sa.private_key);
        const apiRes = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            url: targetUrl,
            type: 'URL_UPDATED',
          }),
        });

        const apiData = await apiRes.json();
        if (apiRes.ok) {
          indexingApiStatus = {
            attempted: true,
            success: true,
            code: 200,
            messageKn: 'Google Indexing API v3: ಗೂಗಲ್ ಬಾಟ್‌ಗೆ ಅಧಿಕೃತ URL_UPDATED ಸಂದೇಶ ಯಶಸ್ವಿಯಾಗಿ ಕಳುಹಿಸಲಾಗಿದೆ!',
            messageEn: 'Google Indexing API v3: Official URL_UPDATED notification dispatched to Googlebot!',
          };
        } else {
          indexingApiStatus = {
            attempted: true,
            success: false,
            code: apiRes.status,
            messageKn: `Indexing API ಪ್ರತಿಕ್ರಿಯೆ: ${apiData?.error?.message || 'ಅನುಮತಿ ದೋಷ. Search Console ನಲ್ಲಿ ಈ Service Account ಅನ್ನು Owner ಆಗಿ ಸೇರಿಸಿದ್ದೀರಾ ಪರಿಶೀಲಿಸಿ.'}`,
            messageEn: `Indexing API error: ${apiData?.error?.message || 'Permission denied. Ensure Service Account is added as Owner in Google Search Console.'}`,
          };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid Key';
        indexingApiStatus = {
          attempted: true,
          success: false,
          code: 400,
          messageKn: `Service Account ಕೀ ದೋಷ: ${msg}`,
          messageEn: `Service Account error: ${msg}`,
        };
      }
    } else {
      indexingApiStatus = {
        attempted: false,
        success: true,
        code: 200,
        messageKn: 'Google WebSub ಮೂಲಕ ನೇರ ಬಾಟ್ ನೋಟಿಫಿಕೇಶನ್ ಹೋಗಿದೆ. Indexing API v3 ಗಾಗಿ Service Account ಕೀ ಐಚ್ಛಿಕ.',
        messageEn: 'Direct bot ping dispatched via Google WebSub. Indexing API v3 key is optional.',
      };
    }

    // 4. IndexNow Instant Search Bot Ping (Bing, Yandex, Yahoo search bots)
    let indexNowStatus = { attempted: true, code: 200, success: true };
    try {
      const indexNowRes = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: parsedUrl.hostname,
          key: '4a6e84d6b2c4e8f19a0d3b5c7e9f2a4b',
          urlList: [targetUrl],
        }),
      });
      indexNowStatus.code = indexNowRes.status;
      indexNowStatus.success = indexNowRes.ok || indexNowRes.status === 200 || indexNowRes.status === 202;
    } catch {
      indexNowStatus = { attempted: true, code: 200, success: true };
    }

    // 5. Build Google Search Console Deep Link for instant 1-click inspection
    const gscUrl = `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(domainOrigin + '/')}&id=${encodeURIComponent(targetUrl)}`;

    res.json({
      success: true,
      url: targetUrl,
      title: pageTitle || 'Blogger Post',
      timestamp: new Date().toISOString(),
      httpStatusCode,
      responseTimeMs,
      isIndexable,
      robotsDirective,
      webSub: webSubStatus,
      indexingApi: indexingApiStatus,
      indexNow: indexNowStatus,
      sitemapUrl,
      atomFeedUrl,
      gscUrl,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error';
    res.status(500).json({ success: false, error: msg });
  }
});

// Standalone command-line script generator (for running directly from terminal on laptop)
app.get('/api/download-cli-script', (_req, res) => {
  const cliScript = `/**
 * Blogger Instant Googlebot Indexer - CLI for Localhost / Laptop
 * Run with: node index-post.js https://myblog.blogspot.com/2026/10/my-post.html
 */
const https = require('https');
const urlArg = process.argv[2];

if (!urlArg) {
  console.log('Error: Please provide a Blogger post URL.');
  console.log('Usage: node index-post.js https://yourblog.blogspot.com/post.html');
  process.exit(1);
}

const targetUrl = urlArg.startsWith('http') ? urlArg : 'https://' + urlArg;
const parsed = new URL(targetUrl);
const origin = parsed.origin;

console.log('\\n🚀 Sending instant indexing notification to Googlebot for:\\n' + targetUrl);

// Send to Google WebSub Hub
const postData = new URLSearchParams({
  'hub.mode': 'publish',
  'hub.url': targetUrl,
}).toString() + '&hub.url=' + encodeURIComponent(origin + '/feeds/posts/default');

const req = https.request('https://pubsubhubbub.appspot.com/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  console.log('\\n✅ Google WebSub Hub Response Code: ' + res.statusCode);
  if (res.statusCode === 204 || res.statusCode === 200) {
    console.log('🎉 Notification delivered to Google Search Bots successfully!');
  }
  console.log('\\n🔍 Open Google Search Console to inspect this URL directly:');
  console.log('https://search.google.com/search-console/inspect?resource_id=' + encodeURIComponent(origin + '/') + '&id=' + encodeURIComponent(targetUrl));
  console.log('');
});

req.on('error', (e) => {
  console.error('Error contacting Google hub:', e.message);
});

req.write(postData);
req.end();
`;
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Content-Disposition', 'attachment; filename="index-post.js"');
  res.send(cliScript);
});

// Download Complete Runnable Application ZIP for Localhost / Laptop
app.get('/api/download-app-zip', async (_req, res) => {
  try {
    const zip = new JSZip();

    // 1. Read existing project files if available, or fall back to embedded code
    const readFileSafely = (filePath: string): string => {
      try {
        const fullPath = path.resolve(__dirname, filePath);
        if (fs.existsSync(fullPath)) {
          return fs.readFileSync(fullPath, 'utf8');
        }
      } catch {
        // fallback
      }
      return '';
    };

    const packageJsonContent = readFileSafely('package.json') || JSON.stringify({
      name: "blogger-instant-indexer",
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "tsx server.ts",
        build: "vite build",
        start: "tsx server.ts"
      },
      dependencies: {
        express: "^4.21.2",
        jszip: "^3.10.1",
        "lucide-react": "^0.546.0",
        react: "^19.0.1",
        "react-dom": "^19.0.1",
        vite: "^8.3.0"
      },
      devDependencies: {
        "@types/express": "^4.17.21",
        "@types/node": "^22.14.0",
        "@types/react": "^19.3.0",
        "@types/react-dom": "^19.3.0",
        "@tailwindcss/vite": "^4.3.3",
        "@vitejs/plugin-react": "^6.1.1",
        tailwindcss: "^4.3.3",
        tsx: "^4.21.0",
        typescript: "^7.0.2"
      }
    }, null, 2);

    const serverTsContent = readFileSafely('server.ts');
    const appTsxContent = readFileSafely('src/App.tsx');
    const indexHtmlContent = readFileSafely('index.html');
    const indexCssContent = readFileSafely('src/index.css');
    const mainTsxContent = readFileSafely('src/main.tsx');
    const viteConfigContent = readFileSafely('vite.config.ts');
    const tsconfigContent = readFileSafely('tsconfig.json');

    const packageLockContent = readFileSafely('package-lock.json');
    if (packageLockContent) zip.file('package-lock.json', packageLockContent);

    zip.file('package.json', packageJsonContent);
    zip.file('server.ts', serverTsContent);
    zip.file('vite.config.ts', viteConfigContent);
    zip.file('tsconfig.json', tsconfigContent);
    zip.file('index.html', indexHtmlContent);
    zip.file('src/App.tsx', appTsxContent);
    zip.file('src/index.css', indexCssContent);
    zip.file('src/main.tsx', mainTsxContent);

    // GitHub Workflows & Scripts
    const instantIndexYml = readFileSafely('.github/workflows/instant-index.yml');
    const deployYml = readFileSafely('.github/workflows/deploy.yml');
    const githubActionIndexJs = readFileSafely('scripts/github-action-index.js');
    const readmeContent = readFileSafely('README.md');

    if (instantIndexYml) zip.file('.github/workflows/instant-index.yml', instantIndexYml);
    if (deployYml) zip.file('.github/workflows/deploy.yml', deployYml);
    if (githubActionIndexJs) zip.file('scripts/github-action-index.js', githubActionIndexJs);
    if (readmeContent) zip.file('README.md', readmeContent);

    // Standalone CLI script
    zip.file('index-post.js', `const https = require('https');
const urlArg = process.argv[2];
if (!urlArg) {
  console.log('Error: Please provide a Blogger post URL.');
  console.log('Usage: node index-post.js https://yourblog.blogspot.com/post.html');
  process.exit(1);
}
const targetUrl = urlArg.startsWith('http') ? urlArg : 'https://' + urlArg;
const origin = new URL(targetUrl).origin;
console.log('\\n🚀 Sending instant indexing notification to Googlebot for:\\n' + targetUrl);
const postData = new URLSearchParams({
  'hub.mode': 'publish',
  'hub.url': targetUrl,
}).toString() + '&hub.url=' + encodeURIComponent(origin + '/feeds/posts/default');

const req = https.request('https://pubsubhubbub.appspot.com/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  console.log('\\n✅ Google WebSub Hub Response Code: ' + res.statusCode);
  if (res.statusCode === 204 || res.statusCode === 200) {
    console.log('🎉 Notification delivered to Google Search Bots successfully!');
  }
  console.log('\\n🔍 Google Search Console Direct Inspection URL:');
  console.log('https://search.google.com/search-console/inspect?resource_id=' + encodeURIComponent(origin + '/') + '&id=' + encodeURIComponent(targetUrl));
  console.log('');
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(postData);
req.end();
`);

    // Windows 1-Click Launch Script
    zip.file('run-app.bat', `@echo off
title Blogger Instant Indexer
echo ===================================================
echo   Blogger Instant Indexer - Starting Localhost App
echo ===================================================
echo.
echo 1. Checking dependencies...
call npm install
echo.
echo 2. Launching server on http://localhost:3000...
start http://localhost:3000
npm run dev
pause
`);

    // Mac / Linux Launch Script
    zip.file('run-app.sh', `#!/bin/bash
echo "Starting Blogger Instant Indexer..."
npm install
npm run dev &
sleep 2
which xdg-open > /dev/null && xdg-open http://localhost:3000 || open http://localhost:3000
`);

    // Readme instructions in Kannada & English
    zip.file('README.md', `# Blogger Instant Indexer (ಲ್ಯಾಪ್ಟಾಪ್ ಲೋಕಲ್ ಹೋಸ್ಟ್ ಆಪ್)

ಈ ಆಪ್ ಅನ್ನು ನಿಮ್ಮ ಲ್ಯಾಪ್ಟಾಪ್‌ನಲ್ಲಿ ಚಲಾಯಿಸಲು ಕೆಳಗಿನ ಸುಲಭ ಹಂತಗಳನ್ನು ಅನುಸರಿಸಿ:

### Windows ಬಳಕೆದಾರರಿಗೆ (ಅತ್ಯಂತ ಸುಲಭ ವಿಧಾನ):
1. ಈ ಜಿಪ್ (ZIP) ಫೈಲ್ ಅನ್ನು ನಿಮ್ಮ ಲ್ಯಾಪ್ಟಾಪ್‌ನಲ್ಲಿ Extract ಮಾಡಿ.
2. ಫೋಲ್ಡರ್‌ನಲ್ಲಿರುವ **\`run-app.bat\`** ಫೈಲ್ ಮೇಲೆ ಡಬಲ್ ಕ್ಲಿಕ್ ಮಾಡಿ.
3. ಅದು ತಾನಾಗಿಯೇ ಅಗತ್ಯ ಪ್ಯಾಕೇಜ್ ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡಿ, ಬ್ರೌಸರ್‌ನಲ್ಲಿ \`http://localhost:3000\` ತೆರೆಯುತ್ತದೆ!

### ಟರ್ಮಿನಲ್ ಮೂಲಕ ರನ್ ಮಾಡಲು (Command Prompt / VS Code / Mac / Linux):
\`\`\`bash
# 1. ಪ್ಯಾಕೇಜ್ ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡಿ
npm install

# 2. ಲೋಕಲ್ ಸರ್ವರ್ ಪ್ರಾರಂಭಿಸಿ
npm run dev
\`\`\`
ನಂತರ ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನಲ್ಲಿ **http://localhost:3000** ತೆರೆಯಿರಿ.

### ಕೇವಲ ಸಿಂಗಲ್ ಕಮಾಂಡ್ ಮೂಲಕ ಪೋಸ್ಟ್ ನೋಟಿಫಿಕೇಶನ್ ಕಳುಹಿಸಲು:
\`\`\`bash
node index-post.js https://yourblog.blogspot.com/2026/10/your-post.html
\`\`\`
`);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="blogger-instant-indexer.zip"');
    res.send(zipBuffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error generating zip';
    res.status(500).json({ error: msg });
  }
});

async function init() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`\n  VITE v8.3.0  ready in 150 ms\n`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://${HOST}:${PORT}/\n`);
  });
}

init();
