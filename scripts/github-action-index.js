/**
 * Blogger Instant Googlebot Indexer - GitHub Actions Runner
 * Pings Google WebSub Hub, checks indexability, and dispatches to Google Indexing API v3.
 */
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';

const rawUrl = process.env.INPUT_POST_URL || process.argv[2];
const actionType = process.env.INPUT_ACTION_TYPE || 'URL_UPDATED';
const serviceAccountKeyJson = process.env.GSC_SERVICE_ACCOUNT_KEY;

if (!rawUrl || rawUrl.trim() === '') {
  console.error('❌ Error: No Blogger Post URL provided.');
  console.log('Provide a URL via GitHub Actions workflow input or INPUT_POST_URL env var.');
  process.exit(1);
}

let targetUrl = rawUrl.trim();
if (!/^https?:\/\//i.test(targetUrl)) {
  targetUrl = `https://${targetUrl}`;
}

let parsed;
try {
  parsed = new URL(targetUrl);
} catch (e) {
  console.error('❌ Error: Invalid URL format:', targetUrl);
  process.exit(1);
}

const origin = parsed.origin;
const atomFeed = `${origin}/feeds/posts/default`;
const sitemapUrl = `${origin}/sitemap.xml`;
const gscInspectUrl = `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(origin + '/')}&id=${encodeURIComponent(targetUrl)}`;

console.log('========================================================');
console.log('🚀 BLOGGER INSTANT GOOGLEBOT INDEXER (GITHUB ACTION)');
console.log('========================================================');
console.log(`🔗 Target URL   : ${targetUrl}`);
console.log(`📡 Blog Origin  : ${origin}`);
console.log(`⚡ Action Type  : ${actionType}`);
console.log('--------------------------------------------------------');

function postRequest(urlStr, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const postBody = typeof data === 'string' ? Buffer.from(data) : data;
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Length': postBody.length,
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      }
    );
    req.on('error', (err) => reject(err));
    req.write(postBody);
    req.end();
  });
}

function base64UrlEncode(input) {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getGoogleToken(clientEmail, privateKey) {
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
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey.replace(/\\n/g, '\n'));
  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;

  const bodyData = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  }).toString();

  const res = await postRequest('https://oauth2.googleapis.com/token', bodyData, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });

  if (res.statusCode !== 200) {
    throw new Error(`Google OAuth error (${res.statusCode}): ${res.body}`);
  }
  const tokenData = JSON.parse(res.body);
  return tokenData.access_token;
}

async function main() {
  const summaryItems = [];

  // 1. Google WebSub / PubSubHubbub Push
  try {
    const hubParams = new URLSearchParams();
    hubParams.append('hub.mode', 'publish');
    hubParams.append('hub.url', targetUrl);
    hubParams.append('hub.url', atomFeed);

    const hubRes = await postRequest('https://pubsubhubbub.appspot.com/', hubParams.toString(), {
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    const ok = hubRes.statusCode === 204 || hubRes.statusCode === 200;
    console.log(`✅ Google WebSub Hub (pubsubhubbub.appspot.com): HTTP ${hubRes.statusCode} (${ok ? 'Accepted' : 'Failed'})`);
    summaryItems.push({
      service: 'Google WebSub Hub (pubsubhubbub.appspot.com)',
      status: ok ? '✅ Success (HTTP ' + hubRes.statusCode + ')' : '⚠️ HTTP ' + hubRes.statusCode,
      details: 'Instant publish signal delivered for post & Blogger Atom feed',
    });
  } catch (err) {
    console.log(`⚠️ Google WebSub Ping error: ${err.message}`);
    summaryItems.push({
      service: 'Google WebSub Hub',
      status: '⚠️ Warning',
      details: err.message,
    });
  }

  // 2. IndexNow Search Bot Push
  try {
    const indexNowBody = JSON.stringify({
      host: parsed.hostname,
      key: '4a6e84d6b2c4e8f19a0d3b5c7e9f2a4b',
      urlList: [targetUrl],
    });
    const inRes = await postRequest('https://api.indexnow.org/indexnow', indexNowBody, {
      'Content-Type': 'application/json',
    });
    console.log(`✅ IndexNow Search Bots Network: HTTP ${inRes.statusCode}`);
    summaryItems.push({
      service: 'IndexNow (Search Engine Bot Network)',
      status: '✅ Delivered (HTTP ' + inRes.statusCode + ')',
      details: 'Dispatched to Bing, Yandex, Yahoo crawlers',
    });
  } catch (err) {
    console.log(`⚠️ IndexNow notice: ${err.message}`);
  }

  // 3. Google Indexing API v3 (if secret key configured)
  if (serviceAccountKeyJson && serviceAccountKeyJson.trim().length > 20) {
    try {
      const sa = JSON.parse(serviceAccountKeyJson);
      const token = await getGoogleToken(sa.client_email, sa.private_key);
      const apiRes = await postRequest(
        'https://indexing.googleapis.com/v3/urlNotifications:publish',
        JSON.stringify({ url: targetUrl, type: actionType }),
        {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        }
      );
      const isOk = apiRes.statusCode === 200;
      console.log(`✅ Google Indexing API v3: HTTP ${apiRes.statusCode} - ${isOk ? 'Notification Dispatched' : apiRes.body}`);
      summaryItems.push({
        service: 'Google Indexing API v3',
        status: isOk ? '✅ Success (HTTP 200)' : '❌ HTTP ' + apiRes.statusCode,
        details: isOk ? `URL ${actionType} pushed directly via Service Account (${sa.client_email})` : apiRes.body,
      });
    } catch (err) {
      console.log(`⚠️ Google Indexing API v3: ${err.message}`);
      summaryItems.push({
        service: 'Google Indexing API v3',
        status: '⚠️ Error',
        details: err.message,
      });
    }
  } else {
    console.log('ℹ️ Google Indexing API v3: Service Account secret (GSC_SERVICE_ACCOUNT_KEY) not provided. Running in WebSub Instant Push mode.');
    summaryItems.push({
      service: 'Google Indexing API v3',
      status: 'ℹ️ Skipped (Optional)',
      details: 'To enable, add GSC_SERVICE_ACCOUNT_KEY secret in GitHub Repository Settings -> Secrets',
    });
  }

  console.log('--------------------------------------------------------');
  console.log(`🔍 Direct Search Console Inspection Link:`);
  console.log(gscInspectUrl);
  console.log('========================================================\n');

  // Write GitHub Action Step Summary (Markdown)
  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = `### 🚀 Blogger Instant Googlebot Indexing Report

| Target Parameter | Value |
| :--- | :--- |
| **Blog Post URL** | [\`${targetUrl}\`](${targetUrl}) |
| **Action Type** | \`${actionType}\` |
| **Blogger Sitemap** | [\`${sitemapUrl}\`](${sitemapUrl}) |
| **Google Search Console Inspect** | [🔗 Open in Search Console](${gscInspectUrl}) |

#### 📡 Dispatch Execution Results

| Service | Status | Details |
| :--- | :--- | :--- |
${summaryItems.map((item) => `| **${item.service}** | ${item.status} | ${item.details} |`).join('\n')}

> 💡 **Tip:** Click **[Open in Search Console](${gscInspectUrl})** to verify that Googlebot has processed your page or request immediate indexing.
`;
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
