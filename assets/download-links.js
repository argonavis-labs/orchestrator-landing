const STABLE_DOWNLOAD_LINKS_FEED_URL =
  'https://pub-a1d23b8b58f1451e84aa55f4ba5b850d.r2.dev/electron/stable/download-links.json';

const FALLBACK_DOWNLOAD_URLS = Object.freeze({
  mac: 'https://storage.googleapis.com/orchestrator-releases/electron/stable/Orchestrator-arm64.dmg',
  macIntel: 'https://storage.googleapis.com/orchestrator-releases/electron/stable/Orchestrator-x64.dmg',
  windows: 'https://storage.googleapis.com/orchestrator-releases/electron/stable/Orchestrator-x64.exe',
  linux: 'https://storage.googleapis.com/orchestrator-releases/electron/stable/Orchestrator-x86_64.AppImage',
});

const PLATFORM_BY_LABEL = Object.freeze({
  'Mac (Silicon)': 'mac',
  // Legacy label support to avoid breaking older cached HTML/JS.
  Mac: 'mac',
  'Mac (Intel)': 'macIntel',
  Windows: 'windows',
  Linux: 'linux',
});

let resolvedDownloadUrlsPromise;

function knownPlatformLabel(label) {
  return Object.prototype.hasOwnProperty.call(PLATFORM_BY_LABEL, label);
}

function normalizeFeedLinks(payload) {
  const links = payload && typeof payload === 'object' ? payload.links : null;
  if (!links || typeof links !== 'object') {
    return null;
  }

  const mac = typeof links.mac === 'string' ? links.mac : '';
  const macIntel = typeof links.macIntel === 'string' ? links.macIntel : '';
  const windows = typeof links.windows === 'string' ? links.windows : '';
  const linux = typeof links.linux === 'string' ? links.linux : '';

  if (!mac || !macIntel || !windows || !linux) {
    return null;
  }

  return { mac, macIntel, windows, linux };
}

async function resolveDownloadUrls() {
  if (!resolvedDownloadUrlsPromise) {
    resolvedDownloadUrlsPromise = (async () => {
      try {
        const response = await fetch(STABLE_DOWNLOAD_LINKS_FEED_URL, {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`download links feed returned ${response.status}`);
        }
        const payload = await response.json();
        const normalized = normalizeFeedLinks(payload);
        if (normalized) {
          return normalized;
        }
      } catch {
        // Fall through to static defaults.
      }
      return FALLBACK_DOWNLOAD_URLS;
    })();
  }
  return resolvedDownloadUrlsPromise;
}

async function downloadUrlForLabel(label) {
  const platformKey = PLATFORM_BY_LABEL[label];
  if (!platformKey) {
    return null;
  }

  const urls = await resolveDownloadUrls();
  return urls[platformKey] || null;
}

document.addEventListener(
  'click',
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest('a[href="#"]');
    if (!link) {
      return;
    }

    const label = (link.textContent || '').replace(/\s+/g, ' ').trim();
    if (!knownPlatformLabel(label)) {
      return;
    }

    event.preventDefault();

    void downloadUrlForLabel(label).then((url) => {
      if (!url) {
        return;
      }
      window.location.assign(url);
    });
  },
  true,
);
