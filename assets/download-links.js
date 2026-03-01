const RELEASE_DOWNLOAD_BASE = 'https://storage.googleapis.com/orchestrator-releases/electron/stable';

function knownPlatformLabel(label) {
  return label === 'Mac' || label === 'Mac (Intel)' || label === 'Windows' || label === 'Linux';
}

async function resolveMacAssetName(label) {
  if (label === 'Mac (Intel)') {
    return 'Orchestrator-x64.dmg';
  }

  try {
    if (navigator.userAgentData?.getHighEntropyValues) {
      const values = await navigator.userAgentData.getHighEntropyValues(['architecture']);
      const arch = (values?.architecture || '').toLowerCase();
      if (arch.includes('arm')) {
        return 'Orchestrator-arm64.dmg';
      }
      if (arch.includes('x86') || arch.includes('64')) {
        return 'Orchestrator-x64.dmg';
      }
    }
  } catch {
    // Ignore UA hints failures and fall through to user-agent sniffing.
  }

  const userAgent = (navigator.userAgent || '').toLowerCase();
  if (userAgent.includes('arm64') || userAgent.includes('aarch64') || userAgent.includes('apple silicon')) {
    return 'Orchestrator-arm64.dmg';
  }
  if (userAgent.includes('intel') || userAgent.includes('x86_64') || userAgent.includes('x64')) {
    return 'Orchestrator-x64.dmg';
  }

  // Default modern Macs to Apple Silicon.
  return 'Orchestrator-arm64.dmg';
}

async function downloadUrlForLabel(label) {
  if (label === 'Windows') {
    return `${RELEASE_DOWNLOAD_BASE}/Orchestrator-x64.exe`;
  }
  if (label === 'Linux') {
    return `${RELEASE_DOWNLOAD_BASE}/Orchestrator-x86_64.AppImage`;
  }
  if (label === 'Mac' || label === 'Mac (Intel)') {
    const assetName = await resolveMacAssetName(label);
    return `${RELEASE_DOWNLOAD_BASE}/${assetName}`;
  }
  return null;
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
