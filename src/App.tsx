import React, { useState } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Key,
  Copy,
  Check,
  RefreshCw,
  Download,
  FileCode,
  FileText,
  Sliders,
  Sparkles,
  Github,
  GitBranch,
  Play,
  Terminal,
} from 'lucide-react';

interface NotificationResult {
  success: boolean;
  url: string;
  title: string;
  timestamp: string;
  httpStatusCode: number;
  responseTimeMs: number;
  isIndexable: boolean;
  robotsDirective: string;
  webSub: { success: boolean; code: number; message: string };
  indexingApi: { attempted: boolean; success: boolean; code: number; messageKn: string; messageEn: string };
  indexNow: { attempted: boolean; code: number; success: boolean };
  sitemapUrl: string;
  atomFeedUrl: string;
  gscUrl: string;
}

export default function App() {
  const [lang, setLang] = useState<'kn' | 'en'>('kn');
  const [activeTab, setActiveTab] = useState<'indexer' | 'github-workflows' | 'robots-generator' | 'api-key'>('indexer');

  // Instant Indexer states
  const [postUrl, setPostUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<NotificationResult | null>(null);

  // Custom robots.txt & Sitemap generator state
  const [blogDomainInput, setBlogDomainInput] = useState('https://myblog.blogspot.com');
  const [copiedRobots, setCopiedRobots] = useState(false);
  const [copiedSitemapIdx, setCopiedSitemapIdx] = useState<number | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // GitHub Workflow tab copy states
  const [copiedIndexWorkflow, setCopiedIndexWorkflow] = useState(false);
  const [copiedDeployWorkflow, setCopiedDeployWorkflow] = useState(false);
  const [copiedGitCommands, setCopiedGitCommands] = useState(false);

  // Optional Service Account Key
  const [serviceAccountJson, setServiceAccountJson] = useState<string>(() => {
    try {
      return localStorage.getItem('blogger_sa_key') || '';
    } catch {
      return '';
    }
  });

  // Calculate clean origin for robots & sitemaps
  const cleanOrigin = (() => {
    try {
      let val = blogDomainInput.trim();
      if (!val) return 'https://yourblog.blogspot.com';
      if (!/^https?:\/\//i.test(val)) val = `https://${val}`;
      return new URL(val).origin;
    } catch {
      return 'https://yourblog.blogspot.com';
    }
  })();

  // Generate perfect Blogger robots.txt
  const generatedRobotsTxt = `User-agent: Mediapartners-Google
Disallow:

User-agent: *
Disallow: /search
Allow: /

Sitemap: ${cleanOrigin}/sitemap.xml
Sitemap: ${cleanOrigin}/atom.xml?redirect=false&start-index=1&max-results=500
Sitemap: ${cleanOrigin}/feeds/posts/default?alt=rss`;

  // Sitemaps list
  const sitemapList = [
    {
      name: 'Primary XML Sitemap',
      path: 'sitemap.xml',
      fullUrl: `${cleanOrigin}/sitemap.xml`,
      descKn: 'ಗೂಗಲ್ ಸರ್ಚ್ ಕನ್ಸೋಲ್‌ಗಾಗಿ ಮುಖ್ಯ XML ಸೈಟ್‌ಮ್ಯಾಪ್',
      descEn: 'Primary XML sitemap recognized by modern Googlebot',
    },
    {
      name: 'Blogger High-Capacity Atom Sitemap (1-500 Posts)',
      path: 'atom.xml?redirect=false&start-index=1&max-results=500',
      fullUrl: `${cleanOrigin}/atom.xml?redirect=false&start-index=1&max-results=500`,
      descKn: 'ಮೊದಲ 500 ಬ್ಲಾಗ್ ಪೋಸ್ಟ್‌ಗಳನ್ನು ಪೂರ್ಣವಾಗಿ ಇಂಡೆಕ್ಸ್ ಮಾಡಲು',
      descEn: 'Indexes up to first 500 published posts in full depth',
    },
    {
      name: 'Blogger RSS Feed Sitemap',
      path: 'feeds/posts/default?alt=rss',
      fullUrl: `${cleanOrigin}/feeds/posts/default?alt=rss`,
      descKn: 'ಇತ್ತೀಚಿನ ಪೋಸ್ಟ್‌ಗಳ ತ್ವರಿತ ಅಪ್‌ಡೇಟ್‌ಗಾಗಿ RSS ಫೀಡ್',
      descEn: 'RSS feed sitemap for instant post updates',
    },
    {
      name: 'Extended Sitemap (501-1000 Posts)',
      path: 'atom.xml?redirect=false&start-index=501&max-results=500',
      fullUrl: `${cleanOrigin}/atom.xml?redirect=false&start-index=501&max-results=500`,
      descKn: 'ನಿಮ್ಮ ಬ್ಲಾಗ್‌ನಲ್ಲಿ 500 ಕ್ಕಿಂತ ಹೆಚ್ಚು ಪೋಸ್ಟ್‌ಗಳಿದ್ದರೆ',
      descEn: 'For blogs with more than 500 published posts',
    },
  ];

  // GitHub Actions Workflow 1: Instant Indexer YAML
  const instantIndexWorkflowYaml = `name: Blogger Instant Googlebot Indexer

on:
  workflow_dispatch:
    inputs:
      post_url:
        description: 'Blogger Post URL (ಬ್ಲಾಗ್ ಪೋಸ್ಟ್ ಲಿಂಕ್)'
        required: true
        type: string
        default: 'https://yourblog.blogspot.com/2026/10/your-post.html'
      action_type:
        description: 'Action Type'
        required: true
        type: choice
        options:
          - URL_UPDATED
          - URL_DELETED
        default: 'URL_UPDATED'
  schedule:
    # Daily automatic check at 06:00 UTC
    - cron: '0 6 * * *'

jobs:
  index_post:
    name: Ping Googlebot & WebSub Hub
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run Instant Indexer Script
        env:
          INPUT_POST_URL: \${{ github.event.inputs.post_url }}
          INPUT_ACTION_TYPE: \${{ github.event.inputs.action_type || 'URL_UPDATED' }}
          GSC_SERVICE_ACCOUNT_KEY: \${{ secrets.GSC_SERVICE_ACCOUNT_KEY }}
        run: |
          node scripts/github-action-index.js
`;

  // GitHub Actions Workflow 2: Deploy & Build App YAML
  const deployWorkflowYaml = `name: Build and Deploy Blogger Indexer App

on:
  push:
    branches:
      - main
      - master
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: false

jobs:
  build:
    name: Build & Test Application
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Dependencies
        run: npm install --legacy-peer-deps --no-audit --no-fund

      - name: Type Check & Lint
        run: npm run lint

      - name: Build Web Application
        run: npm run build

      - name: Upload Pages Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    name: Deploy to GitHub Pages
    needs: build
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;

  const gitPushCommands = `# 1. Git ಪ್ರಾರಂಭಿಸಿ (Initialize Git)
git init

# 2. ಎಲ್ಲಾ ಫೈಲ್‌ಗಳು ಮತ್ತು ವರ್ಕ್‌ಫ್ಲೋಗಳನ್ನು ಸೇರಿಸಿ
git add .

# 3. ಮೊದಲ ಕಮಿಟ್ ಮಾಡಿ (Commit)
git commit -m "feat: Blogger Instant Indexer with GitHub Actions Workflows"

# 4. ಮುಖ್ಯ ಬ್ರಾಂಚ್ ಅನ್ನು main ಎಂದು ಸೆಟ್ ಮಾಡಿ
git branch -M main

# 5. ನಿಮ್ಮ GitHub ರೆಪೊಸಿಟರಿ ಲಿಂಕ್ ಜೋಡಿಸಿ (YOUR_USERNAME ಬದಲಾಯಿಸಿ)
git remote add origin https://github.com/YOUR_USERNAME/blogger-indexer.git

# 6. GitHub ಗೆ ಪುಶ್ ಮಾಡಿ!
git push -u origin main`;

  const handleSendNotification = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!postUrl.trim()) {
      setErrorMsg(
        lang === 'kn'
          ? 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಬ್ಲಾಗ್ ಪೋಸ್ಟ್ ಲಿಂಕ್ (URL) ಅನ್ನು ನಮೂದಿಸಿ.'
          : 'Please enter your Blogger post URL.'
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/ping-googlebot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: postUrl.trim(),
          serviceAccountJson: serviceAccountJson.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'ದೋಷ ಸಂಭವಿಸಿದೆ. URL ಪರಿಶೀಲಿಸಿ.');
      } else {
        setResult(data);
      }
    } catch {
      setErrorMsg(
        lang === 'kn'
          ? 'ಸರ್ವರ್ ಸಂಪರ್ಕ ವಿಫಲವಾಗಿದೆ. ನೆಟ್‌ವರ್ಕ್ ಪರಿಶೀಲಿಸಿ.'
          : 'Network error contacting server.'
      );
    } finally {
      setLoading(false);
    }
  };

  const copyRobotsCode = () => {
    navigator.clipboard.writeText(generatedRobotsTxt);
    setCopiedRobots(true);
    setTimeout(() => setCopiedRobots(false), 2000);
  };

  const downloadRobotsFile = () => {
    const blob = new Blob([generatedRobotsTxt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'robots.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const copySitemap = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSitemapIdx(idx);
    setTimeout(() => setCopiedSitemapIdx(null), 1800);
  };

  // 1-Click Complete Project ZIP download including .github/workflows
  const handleDownloadAppZip = async () => {
    setDownloadingZip(true);
    try {
      const res = await fetch('/api/download-app-zip');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'blogger-instant-indexer.zip';
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore
    } finally {
      setDownloadingZip(false);
    }
  };

  const sampleUrl = 'https://kannadatechguide.blogspot.com/2026/10/how-to-index-blogger-posts.html';

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              B
            </div>
            <span className="text-xl font-bold tracking-tight text-blue-600">
              Blogger Instant Indexer
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Direct GitHub Workflows Button */}
            <button
              onClick={() => setActiveTab('github-workflows')}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Github className="w-3.5 h-3.5" />
              <span>{lang === 'kn' ? 'GitHub ವರ್ಕ್‌ಫ್ಲೋಗಳು' : 'GitHub Workflows'}</span>
            </button>

            <button
              onClick={() => setLang((l) => (l === 'kn' ? 'en' : 'kn'))}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              {lang === 'kn' ? 'ಕನ್ನಡ / English' : 'English / ಕನ್ನಡ'}
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-6 sm:gap-8 text-sm font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab('indexer')}
            className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'indexer'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>{lang === 'kn' ? 'ಇನ್ಸ್ಟಂಟ್ ಇಂಡೆಕ್ಸರ್' : 'Instant Indexer'}</span>
          </button>

          <button
            onClick={() => setActiveTab('github-workflows')}
            className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'github-workflows'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>
              {lang === 'kn'
                ? 'GitHub Actions ವರ್ಕ್‌ಫ್ಲೋಗಳು'
                : 'GitHub Actions Workflows'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('robots-generator')}
            className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'robots-generator'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>
              {lang === 'kn'
                ? 'ಕಸ್ಟಮ್ ರೋಬೋಟ್ ಟಿಎಕ್ಸ್ಟಿ & ಸೈಟ್‌ಮ್ಯಾಪ್'
                : 'Custom robots.txt & Sitemaps'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('api-key')}
            className={`py-3.5 border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'api-key'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>
              {lang === 'kn'
                ? 'Google API Key (ಐಚ್ಛಿಕ)'
                : 'Google API Key (Optional)'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Tab 1: Instant Indexer */}
        {activeTab === 'indexer' && (
          <div className="space-y-6">
            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-5 text-sm text-blue-900 leading-relaxed">
              <div className="font-semibold text-blue-950 flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                <span>
                  {lang === 'kn'
                    ? 'ಹೊಸ ಪೋಸ್ಟ್ ಲಿಂಕ್ ಹಾಕಿ "ಗೂಗಲ್ ಬಾಟ್‌ಗೆ ಕಳುಹಿಸಿ" ಒತ್ತಿ'
                    : 'Paste post link and click "Send Notification to Googlebot"'}
                </span>
              </div>
              <p>
                {lang === 'kn'
                  ? 'ಇಲ್ಲಿ ನಿಮ್ಮ ಬ್ಲಾಗ್ ಪೋಸ್ಟ್ URL ಹಾಕಿದ ತಕ್ಷಣ, ಗೂಗಲ್‌ನ ಅಧಿಕೃತ WebSub ಹಬ್ (pubsubhubbub.appspot.com) ಮತ್ತು ಸರ್ಚ್ ಬಾಟ್‌ಗಳಿಗೆ ತಕ್ಷಣವೇ ಪಬ್ಲಿಷ್ ನೋಟಿಫಿಕೇಶನ್ ಹೋಗುತ್ತದೆ.'
                  : 'Instantly dispatches a live HTTP publish notification to Google’s WebSub Hub (pubsubhubbub.appspot.com) and search engine crawlers.'}
              </p>
            </div>

            {/* Input Box */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs space-y-5">
              <div>
                <label
                  htmlFor="blog-url-input"
                  className="block text-sm font-semibold text-slate-900 mb-2"
                >
                  {lang === 'kn'
                    ? 'ನಿಮ್ಮ ಬ್ಲಾಗ್ ಪೋಸ್ಟ್‌ನ ಲಿಂಕ್ (Blogger Post URL) ಇಲ್ಲಿ ಹಾಕಿ:'
                    : 'Enter your Blogger Post URL:'}
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    id="blog-url-input"
                    type="url"
                    value={postUrl}
                    onChange={(e) => setPostUrl(e.target.value)}
                    placeholder="https://yourblog.blogspot.com/2026/10/your-post.html"
                    className="flex-1 px-4 py-3 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    onClick={() => handleSendNotification()}
                    disabled={loading}
                    className="px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{lang === 'kn' ? 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...' : 'Sending...'}</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>
                          {lang === 'kn'
                            ? 'ಗೂಗಲ್ ಬಾಟ್‌ಗೆ ಕಳುಹಿಸಿ · Send'
                            : 'Send Notification to Googlebot'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Sample link helper */}
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1">
                <span>
                  {lang === 'kn' ? 'ಉದಾಹರಣೆ ಲಿಂಕ್ ಪರೀಕ್ಷಿಸಲು:' : 'To test with sample URL:'}
                  <button
                    onClick={() => setPostUrl(sampleUrl)}
                    className="ml-2 text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    {lang === 'kn' ? 'ಉದಾಹರಣೆ ಲಿಂಕ್ ಹಾಕಿ' : 'Insert Sample Blogger URL'}
                  </button>
                </span>
                <span className="font-mono">Google WebSub + Googlebot Fetch</span>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Notification Results */}
            {result && (
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden shadow-xs">
                <div className="p-6 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {lang === 'kn'
                          ? 'ಗೂಗಲ್ ಬಾಟ್‌ಗಳಿಗೆ ನೋಟಿಫಿಕೇಶನ್ ಯಶಸ್ವಿಯಾಗಿ ತಲುಪಿದೆ!'
                          : 'Notification delivered to Googlebot successfully!'}
                      </span>
                    </div>
                    <h2 className="text-base font-semibold text-slate-900">{result.title}</h2>
                    <p className="text-xs font-mono text-slate-600 break-all">{result.url}</p>
                  </div>

                  <a
                    href={result.gscUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <span>
                      {lang === 'kn'
                        ? 'Google Search Console ನಲ್ಲಿ ನೋಡಿ (Inspect)'
                        : 'Open in Search Console'}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Google WebSub Hub (pubsubhubbub)</span>
                        </span>
                        <span className="text-xs font-mono text-emerald-700 font-semibold">
                          HTTP {result.webSub.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {result.webSub.message}
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Googlebot Pre-Flight Check</span>
                        </span>
                        <span className="text-xs font-mono text-slate-700">
                          {result.responseTimeMs} ms
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {result.isIndexable
                          ? lang === 'kn'
                            ? 'ಪುಟ ಸಕ್ರಿಯವಾಗಿದೆ. ಯಾವುದೇ noindex ತಡೆಯಿಲ್ಲ. ಗೂಗಲ್ ಬಾಟ್ ಇಂಡೆಕ್ಸ್ ಮಾಡಲು ಸಿದ್ಧವಿದೆ.'
                            : 'Page is reachable and indexable (No noindex blockage).'
                          : lang === 'kn'
                            ? 'ಎಚ್ಚರಿಕೆ: ಈ ಪುಟದಲ್ಲಿ noindex ಟ್ಯಾಗ್ ಕಂಡುಬಂದಿದೆ.'
                            : 'Warning: noindex tag detected.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: GitHub Actions Workflows (User's primary request) */}
        {activeTab === 'github-workflows' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-blue-600 mb-1">
                    {lang === 'kn' ? 'GITHUB ACTIONS WORKFLOWS · 100% READY' : 'GITHUB ACTIONS CI/CD'}
                  </p>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Github className="w-6 h-6 text-slate-900" />
                    <span>
                      {lang === 'kn'
                        ? 'GitHub ವರ್ಕ್‌ಫ್ಲೋ ಸೆಟಪ್ (ನೇರವಾಗಿ GitHub ನಲ್ಲೇ ರನ್ ಮಾಡಿ)'
                        : 'GitHub Actions Workflows Setup'}
                    </span>
                  </h2>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    {lang === 'kn'
                      ? 'ನೀವು ಕೇಳಿದಂತೆ, ನಿಮ್ಮ ಲ್ಯಾಪ್ಟಾಪ್ ಆಪ್ ಬದಲಿಗೆ ನೇರವಾಗಿ GitHub ಗೆ ಹಾಕಿ, GitHub Actions ಮೂಲಕವೇ ಯಾವುದೇ ಪೋಸ್ಟ್ ಅನ್ನು ಆಟೋಮ್ಯಾಟಿಕ್ ಆಗಿ ಇಂಡೆಕ್ಸ್ ಮಾಡಲು ಹಾಗೂ ಆಪ್ ಅನ್ನು ನಿಯೋಜಿಸಲು ಈ 2 ವರ್ಕ್‌ಫ್ಲೋಗಳನ್ನು ಸಿದ್ಧಪಡಿಸಲಾಗಿದೆ.'
                      : 'Configured with two automated GitHub Actions workflows for cloud indexing and deployment.'}
                  </p>
                </div>

                <button
                  onClick={handleDownloadAppZip}
                  disabled={downloadingZip}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {downloadingZip ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>
                    {lang === 'kn'
                      ? 'GitHub ರೆಪೊಸಿಟರಿ ಫೈಲ್‌ಗಳು (.ZIP)'
                      : 'Download Repo ZIP'}
                  </span>
                </button>
              </div>

              {/* Step 1: Push to GitHub Commands */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-600" />
                    <span>
                      {lang === 'kn'
                        ? '1. ಈ ಕೋಡ್ ಅನ್ನು ನಿಮ್ಮ GitHub ರೆಪೊಸಿಟರಿಗೆ ಪುಶ್ ಮಾಡುವ ಕಮಾಂಡ್‌ಗಳು:'
                        : '1. Push this project to your GitHub Repository:'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(gitPushCommands);
                      setCopiedGitCommands(true);
                      setTimeout(() => setCopiedGitCommands(false), 2000);
                    }}
                    className="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedGitCommands ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{lang === 'kn' ? 'ಕಮಾಂಡ್ ಕಾಪಿ ಮಾಡಿ' : 'Copy Commands'}</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 bg-slate-900 text-emerald-400 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                  {gitPushCommands}
                </pre>
              </div>

              {/* Workflow 1: Instant Indexer Workflow */}
              <div className="space-y-3 border-t border-slate-200 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                      <Play className="w-4 h-4 text-emerald-600" />
                      <span>
                        {lang === 'kn'
                          ? 'ವರ್ಕ್‌ಫ್ಲೋ 1: .github/workflows/instant-index.yml'
                          : 'Workflow 1: .github/workflows/instant-index.yml'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lang === 'kn'
                        ? 'GitHub Actions UI ನಲ್ಲಿ "Run workflow" ಒತ್ತಿ ಬ್ಲಾಗ್ ಪೋಸ್ಟ್ URL ಹಾಕಿದರೆ ತಕ್ಷಣ ಗೂಗಲ್ ಬಾಟ್‌ಗೆ ನೋಟಿಫಿಕೇಶನ್ ಹೋಗುತ್ತದೆ.'
                        : 'Triggered via GitHub Actions "Run workflow" or cron schedule.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(instantIndexWorkflowYaml);
                      setCopiedIndexWorkflow(true);
                      setTimeout(() => setCopiedIndexWorkflow(false), 2000);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedIndexWorkflow ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{lang === 'kn' ? 'YAML ಕಾಪಿ ಮಾಡಿ' : 'Copy YAML'}</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 bg-slate-900 text-blue-300 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 max-h-72">
                  {instantIndexWorkflowYaml}
                </pre>
              </div>

              {/* Workflow 2: Deploy Workflow */}
              <div className="space-y-3 border-t border-slate-200 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-purple-600" />
                      <span>
                        {lang === 'kn'
                          ? 'ವರ್ಕ್‌ಫ್ಲೋ 2: .github/workflows/deploy.yml'
                          : 'Workflow 2: .github/workflows/deploy.yml'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lang === 'kn'
                        ? 'GitHub ಗೆ ಪುಶ್ ಮಾಡಿದ ತಕ್ಷಣ ಆಟೋಮ್ಯಾಟಿಕ್ ಬಿಲ್ಡ್ ಮತ್ತು GitHub Pages ಗೆ ನಿಯೋಜನೆ ಮಾಡುತ್ತದೆ.'
                        : 'Automatically builds and deploys to GitHub Pages upon git push.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(deployWorkflowYaml);
                      setCopiedDeployWorkflow(true);
                      setTimeout(() => setCopiedDeployWorkflow(false), 2000);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedDeployWorkflow ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{lang === 'kn' ? 'YAML ಕಾಪಿ ಮಾಡಿ' : 'Copy YAML'}</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 bg-slate-900 text-purple-300 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 max-h-72">
                  {deployWorkflowYaml}
                </pre>
              </div>

              {/* How to run in GitHub Actions */}
              <div className="p-5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3 text-xs text-slate-800">
                <div className="font-bold text-sm text-blue-950 flex items-center gap-2">
                  <Play className="w-4 h-4 text-blue-600" />
                  <span>
                    {lang === 'kn'
                      ? 'GitHub ನಲ್ಲಿ ನೇರವಾಗಿ ಪೋಸ್ಟ್ ಇಂಡೆಕ್ಸ್ ರನ್ ಮಾಡುವುದು ಹೇಗೆ?'
                      : 'How to run Instant Indexing on GitHub:'}
                  </span>
                </div>
                <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                  <li>
                    ನಿಮ್ಮ GitHub ರೆಪೊಸಿಟರಿಗೆ ಹೋಗಿ ಮೇಲ್ಭಾಗದಲ್ಲಿರುವ <strong>Actions</strong> ಟ್ಯಾಬ್ ಕ್ಲಿಕ್ ಮಾಡಿ.
                  </li>
                  <li>
                    ಎಡಭಾಗದ ಪಟ್ಟಿಯಲ್ಲಿ <strong>"Blogger Instant Googlebot Indexer"</strong> ಆಯ್ಕೆಮಾಡಿ.
                  </li>
                  <li>
                    ಬಲಭಾಗದಲ್ಲಿ <strong>"Run workflow"</strong> ನೀಲಿ ಬಟನ್ ಮೇಲೆ ಕ್ಲಿಕ್ ಮಾಡಿ.
                  </li>
                  <li>
                    ಅಲ್ಲಿ ನಿಮ್ಮ ಹೊಸ ಬ್ಲಾಗರ್ ಪೋಸ್ಟ್‌ನ ಲಿಂಕ್ (URL) ಹಾಕಿ <strong>"Run workflow"</strong> ಒತ್ತಿ!
                  </li>
                  <li>
                    GitHub ನ ಕ್ಲೌಡ್ ಸರ್ವರ್ ತಕ್ಷಣವೇ ರನ್ ಆಗಿ ಗೂಗಲ್ ಬಾಟ್‌ಗಳಿಗೆ ನೋಟಿಫಿಕೇಶನ್ ಕಳುಹಿಸುತ್ತದೆ ಮತ್ತು ವಿವರವಾದ ವರದಿ ನೀಡುತ್ತದೆ!
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Custom robots.txt & Sitemap Generator for Blogger */}
        {activeTab === 'robots-generator' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 shadow-xs">
              <div>
                <p className="text-xs font-semibold text-blue-600 mb-1">
                  {lang === 'kn'
                    ? 'ಬ್ಲಾಗರ್ ಕಸ್ಟಮ್ SEO ಜನರೇಟರ್ · 100% READY'
                    : 'BLOGGER CUSTOM SEO GENERATOR'}
                </p>
                <h2 className="text-xl font-bold text-slate-900">
                  {lang === 'kn'
                    ? 'ಬ್ಲಾಗರ್ Custom robots.txt, ಹೆಡರ್ ಟ್ಯಾಗ್ಸ್ ಮತ್ತು ಸೈಟ್‌ಮ್ಯಾಪ್ ಜನರೇಟರ್'
                    : 'Blogger Custom robots.txt, Header Tags & Sitemaps Generator'}
                </h2>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  {lang === 'kn'
                    ? 'ನಿಮ್ಮ ಬ್ಲಾಗ್ ವೆಬ್‌ಸೈಟ್‌ನ ವಿಳಾಸವನ್ನು ಕೆಳಗೆ ಹಾಕಿ. ನಿಮ್ಮ ಬ್ಲಾಗ್‌ಗೆ ಬೇಕಾದ ಪೂರ್ಣ Custom robots.txt, Custom robots header tags, ಮತ್ತು Search Console ಸೈಟ್‌ಮ್ಯಾಪ್‌ಗಳು ತಾನಾಗಿಯೇ ಸಿದ್ಧವಾಗಿ ಬರುತ್ತವೆ. ನೀವು ನೇರವಾಗಿ ಕಾಪಿ ಮಾಡಿ ನಿಮ್ಮ ಬ್ಲಾಗರ್‌ನಲ್ಲಿ ಪೇಸ್ಟ್ ಮಾಡಬಹುದು!'
                    : 'Enter your Blogger website URL below. It automatically generates the complete custom robots.txt, custom robots header tags, and Google Search Console sitemaps.'}
                </p>
              </div>

              {/* URL Input */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label htmlFor="blog-domain-input" className="block text-xs font-semibold text-slate-700">
                  {lang === 'kn'
                    ? 'ನಿಮ್ಮ ಬ್ಲಾಗರ್ ಸೈಟ್ ವಿಳಾಸ (Blogger Website URL):'
                    : 'Your Blogger Website URL:'}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="blog-domain-input"
                    type="text"
                    value={blogDomainInput}
                    onChange={(e) => setBlogDomainInput(e.target.value)}
                    placeholder="https://yourblog.blogspot.com"
                    className="flex-1 px-4 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    onClick={() => setBlogDomainInput('https://kannadatechworld.blogspot.com')}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {lang === 'kn' ? 'ಉದಾಹರಣೆ ಡೊಮೇನ್' : 'Sample Domain'}
                  </button>
                </div>
              </div>

              {/* Part 1: Generated Custom robots.txt */}
              <div className="space-y-3 border-t border-slate-200 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>
                        {lang === 'kn'
                          ? '1. ನಿಮ್ಮ ಬ್ಲಾಗ್‌ಗೆ ರೆಡಿಯಾದ Custom robots.txt ಕೋಡ್'
                          : '1. Generated Custom robots.txt for Blogger'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lang === 'kn'
                        ? 'Google AdSense (Mediapartners-Google), ಸರ್ಚ್ ತಡೆ, ಮತ್ತು ಎಲ್ಲಾ ಸೈಟ್‌ಮ್ಯಾಪ್‌ಗಳನ್ನು ಒಳಗೊಂಡಿದೆ.'
                        : 'Includes AdSense crawlers, duplicate search block, and dynamic sitemaps.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyRobotsCode}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedRobots ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{lang === 'kn' ? 'ಕೋಡ್ ಕಾಪಿ ಮಾಡಿ' : 'Copy robots.txt'}</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={downloadRobotsFile}
                      className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{lang === 'kn' ? 'ಫೈಲ್ ಡೌನ್‌ಲೋಡ್' : 'Download .txt'}</span>
                    </button>
                  </div>
                </div>

                <pre className="p-4 bg-slate-900 text-emerald-400 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                  {generatedRobotsTxt}
                </pre>
              </div>

              {/* Part 2: Custom robots header tags Settings */}
              <div className="space-y-4 border-t border-slate-200 pt-6">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-600" />
                    <span>
                      {lang === 'kn'
                        ? '2. Blogger Custom robots header tags ಸೆಟ್ಟಿಂಗ್ಸ್ (ಯಾವ ಸ್ವಿಚ್ ಆನ್ ಮಾಡಬೇಕು?)'
                        : '2. Blogger Custom robots header tags Settings (Exact Switches)'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lang === 'kn'
                      ? 'ಬ್ಲಾಗರ್ ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ "Custom robots header tags" ಆನ್ ಮಾಡಿ, ಈ ಕೆಳಗಿನಂತೆ ಸ್ವಿಚ್‌ಗಳನ್ನು ಆನ್ ಮಾಡಿ:'
                      : 'In Blogger Settings → Enable custom robots header tags, toggle these exact switches:'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Home Page Tags */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-semibold text-xs text-slate-900 flex items-center justify-between">
                      <span>Home page tags (ಮುಖಪುಟ)</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between p-1.5 bg-emerald-50 text-emerald-800 rounded font-medium">
                        <span>all</span>
                        <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">ON</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-emerald-50 text-emerald-800 rounded font-medium">
                        <span>noodp</span>
                        <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">ON</span>
                      </div>
                      <div className="text-[11px] text-slate-500 italic pt-1">
                        {lang === 'kn' ? 'ಉಳಿದ ಎಲ್ಲಾ ಸ್ವಿಚ್‌ಗಳನ್ನು OFF ಮಾಡಿ.' : 'Leave all other switches OFF.'}
                      </div>
                    </div>
                  </div>

                  {/* Archive & Search Page Tags */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-semibold text-xs text-slate-900 flex items-center justify-between">
                      <span>Archive & search tags (ಆರ್ಕೈವ್/ಸರ್ಚ್)</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between p-1.5 bg-amber-50 text-amber-900 rounded font-medium">
                        <span>noindex</span>
                        <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.5 rounded">ON</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-amber-50 text-amber-900 rounded font-medium">
                        <span>noodp</span>
                        <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.5 rounded">ON</span>
                      </div>
                      <div className="text-[11px] text-slate-500 italic pt-1">
                        {lang === 'kn'
                          ? 'ಡುಪ್ಲಿಕೇಟ್ ಸರ್ಚ್ ಪುಟಗಳನ್ನು ತಡೆಯಲು noindex ಆನ್ ಇರಲಿ.'
                          : 'Prevents duplicate search pages from indexing.'}
                      </div>
                    </div>
                  </div>

                  {/* Post & Page Tags */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-semibold text-xs text-slate-900 flex items-center justify-between">
                      <span>Post and page tags (ಪೋಸ್ಟ್‌ಗಳು)</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between p-1.5 bg-emerald-50 text-emerald-800 rounded font-medium">
                        <span>all</span>
                        <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">ON</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-emerald-50 text-emerald-800 rounded font-medium">
                        <span>noodp</span>
                        <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">ON</span>
                      </div>
                      <div className="text-[11px] text-slate-500 italic pt-1">
                        {lang === 'kn' ? 'ಎಲ್ಲಾ ಪೋಸ್ಟ್‌ಗಳು ಗೂಗಲ್‌ನಲ್ಲಿ ಬರುತ್ತವೆ.' : 'Ensures all posts are indexed properly.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Part 3: Sitemaps to Submit in Google Search Console */}
              <div className="space-y-4 border-t border-slate-200 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>
                        {lang === 'kn'
                          ? '3. Google Search Console ನಲ್ಲಿ ಸಬ್ಮಿಟ್ ಮಾಡಬೇಕಾದ ಸೈಟ್‌ಮ್ಯಾಪ್‌ಗಳು'
                          : '3. Sitemaps to Submit in Google Search Console'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lang === 'kn'
                        ? 'Google Search Console → Sitemaps ಗೆ ಹೋಗಿ ಈ ಲಿಂಕ್‌ಗಳನ್ನು ಒಂದೊಂದಾಗಿ ಹಾಕಿ "Submit" ಒತ್ತಿ.'
                        : 'Submit these exact paths in Google Search Console Sitemaps tool.'}
                    </p>
                  </div>

                  <a
                    href="https://search.google.com/search-console/sitemaps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>GSC Sitemaps ತೆರೆಯಿರಿ</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="space-y-3">
                  {sitemapList.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-900">{item.name}</div>
                        <div className="font-mono text-xs text-blue-700 font-semibold break-all">
                          {item.path}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {lang === 'kn' ? item.descKn : item.descEn}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => copySitemap(idx, item.path)}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          {copiedSitemapIdx === idx ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>{lang === 'kn' ? 'ಪಾತ್ ಕಾಪಿ' : 'Copy Path'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Optional API Key */}
        {activeTab === 'api-key' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5 shadow-xs">
              <div>
                <p className="text-xs font-semibold text-blue-600 mb-1">OPTIONAL SETUP</p>
                <h2 className="text-xl font-bold text-slate-900">
                  {lang === 'kn'
                    ? 'Google Cloud Service Account JSON Key (ಐಚ್ಛಿಕ)'
                    : 'Google Cloud Service Account JSON Key (Optional)'}
                </h2>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  {lang === 'kn'
                    ? 'ಸೂಚನೆ: ನೀವು ಯಾವುದೇ ಕೀ ಹಾಕದೆಯೂ WebSub Hub ಮೂಲಕ ಗೂಗಲ್ ಬಾಟ್‌ಗಳಿಗೆ ನೇರವಾಗಿ ನೋಟಿಫಿಕೇಶನ್ ಹೋಗುತ್ತದೆ. ಒಂದು ವೇಳೆ ನೀವು Google Search Console ನ ಅಧಿಕೃತ Indexing API v3 ಕೋಟಾ ಬಳಸಲು ಬಯಸಿದರೆ ನಿಮ್ಮ Service Account JSON ಕೀಯನ್ನು ಕೆಳಗೆ ಪೇಸ್ಟ್ ಮಾಡಿ (ಅಥವಾ GitHub Secrets ನಲ್ಲಿ GSC_SERVICE_ACCOUNT_KEY ಆಗಿ ಸೇರಿಸಿ).'
                    : 'Note: Instant notifications work out-of-the-box via Google WebSub Hub without any key. If you also want to use the official Google Indexing API v3 quota, paste your Service Account JSON key below or in GitHub Secrets.'}
                </p>
              </div>

              <div>
                <label htmlFor="sa-key-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Service Account JSON:
                </label>
                <textarea
                  id="sa-key-input"
                  rows={6}
                  value={serviceAccountJson}
                  onChange={(e) => {
                    setServiceAccountJson(e.target.value);
                    try {
                      if (e.target.value) {
                        localStorage.setItem('blogger_sa_key', e.target.value);
                      } else {
                        localStorage.removeItem('blogger_sa_key');
                      }
                    } catch {
                      // ignore
                    }
                  }}
                  placeholder={`{\n  "type": "service_account",\n  "project_id": "...",\n  "client_email": "...@...iam.gserviceaccount.com",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n..."\n}`}
                  className="w-full p-3.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {serviceAccountJson
                    ? '✅ Key saved in browser local storage.'
                    : 'No key set — running in Google WebSub mode.'}
                </span>
                {serviceAccountJson && (
                  <button
                    onClick={() => {
                      setServiceAccountJson('');
                      localStorage.removeItem('blogger_sa_key');
                    }}
                    className="text-red-600 hover:underline cursor-pointer"
                  >
                    {lang === 'kn' ? 'ಕೀ ಅಳಿಸಿ (Clear Key)' : 'Clear Key'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-5 text-center text-xs text-slate-500">
        Blogger Instant Indexer · Built for fast Google Search indexing, Custom robots.txt & GitHub Actions Workflows
      </footer>
    </div>
  );
}
