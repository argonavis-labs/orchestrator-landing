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

function normalizedPathname() {
  const pathname = window.location.pathname || '';
  if (pathname === '/') {
    return '/';
  }
  return pathname.replace(/\/+$/, '');
}

function isDownloadPage() {
  return normalizedPathname() === '/download';
}

function emitTrackingEvent(eventName, payload) {
  if (!eventName || typeof eventName !== 'string') {
    return;
  }

  if (typeof window.orchestratorTrack === 'function') {
    window.orchestratorTrack(eventName, payload);
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...payload });

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, payload || {});
  }
}

function knownPlatformLabelForLink(link) {
  const datasetLabel = link.getAttribute('data-download-label');
  if (datasetLabel && knownPlatformLabel(datasetLabel)) {
    return datasetLabel;
  }

  const label = (link.textContent || '').replace(/\s+/g, ' ').trim();
  if (knownPlatformLabel(label)) {
    return label;
  }

  return null;
}

if (isDownloadPage()) {
  emitTrackingEvent('download_page_view', {
    source_page: normalizedPathname(),
    funnel_step: 'download_page',
  });
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

    const label = knownPlatformLabelForLink(link);
    if (!label) {
      return;
    }

    event.preventDefault();

    void downloadUrlForLabel(label).then((url) => {
      if (!url) {
        return;
      }

      const platform = PLATFORM_BY_LABEL[label];
      const trackingPayload = {
        platform,
        platform_label: label,
        source_page: normalizedPathname(),
        funnel_step: 'platform_selected',
      };

      if (typeof window.orchestratorTrackAndNavigate === 'function') {
        window.orchestratorTrackAndNavigate('download_platform_selected', trackingPayload, url);
        return;
      }

      emitTrackingEvent('download_platform_selected', trackingPayload);
      window.location.assign(url);
    });
  },
  true,
);
