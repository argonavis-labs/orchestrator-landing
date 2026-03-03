(function () {
  const DEFAULT_CONFIG = Object.freeze({
    gaMeasurementId: '',
    gtmContainerId: '',
    googleAdsId: '',
    googleAdsConversions: Object.freeze({}),
  });

  const rawConfig =
    typeof window.ORCHESTRATOR_ANALYTICS_CONFIG === 'object' &&
    window.ORCHESTRATOR_ANALYTICS_CONFIG !== null
      ? window.ORCHESTRATOR_ANALYTICS_CONFIG
      : DEFAULT_CONFIG;

  const gaMeasurementId = String(rawConfig.gaMeasurementId || '').trim();
  const gtmContainerId = String(rawConfig.gtmContainerId || '').trim();
  const googleAdsId = String(rawConfig.googleAdsId || '').trim();
  const googleAdsConversions =
    rawConfig.googleAdsConversions && typeof rawConfig.googleAdsConversions === 'object'
      ? rawConfig.googleAdsConversions
      : DEFAULT_CONFIG.googleAdsConversions;
  const hasGaMeasurementId =
    /^G-[A-Z0-9]+$/.test(gaMeasurementId) && gaMeasurementId !== 'G-XXXXXXXXXX';
  const hasGtmContainerId =
    /^GTM-[A-Z0-9]+$/.test(gtmContainerId) && gtmContainerId !== 'GTM-XXXXXXX';
  const hasGoogleAdsId = /^AW-\d+$/.test(googleAdsId) && googleAdsId !== 'AW-XXXXXXXXXX';
  const hasAnyGtagTarget = hasGaMeasurementId || hasGoogleAdsId;

  window.dataLayer = window.dataLayer || [];

  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }

  function loadScript(src) {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  }

  if (hasGtmContainerId) {
    window.dataLayer.push({
      'gtm.start': Date.now(),
      event: 'gtm.js',
    });
    loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmContainerId)}`);
  }

  if (hasAnyGtagTarget) {
    // Prefer loading gtag.js with the Ads ID so Google Ads tag detection works reliably,
    // then configure both GA4 and Ads destinations below.
    const gtagId = hasGoogleAdsId ? googleAdsId : gaMeasurementId;
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gtagId)}`);
    window.gtag('js', new Date());
  }

  if (hasGaMeasurementId) {
    window.gtag('config', gaMeasurementId, {
      send_page_view: true,
    });
  }

  if (hasGoogleAdsId) {
    window.gtag('config', googleAdsId);
  }

  function googleAdsSendToForEvent(eventName) {
    const sendTo = googleAdsConversions[eventName];
    if (typeof sendTo !== 'string') {
      return null;
    }
    const trimmed = sendTo.trim();
    if (!trimmed || /X{3,}/.test(trimmed) || !trimmed.startsWith('AW-')) {
      return null;
    }
    return trimmed;
  }

  function trackGoogleAdsConversion(eventName, payload, eventCallback) {
    if (!hasGoogleAdsId || typeof window.gtag !== 'function') {
      return false;
    }

    const sendTo = googleAdsSendToForEvent(eventName);
    if (!sendTo) {
      return false;
    }

    const conversionPayload = {
      ...(payload || {}),
      send_to: sendTo,
      transport_type: 'beacon',
    };

    if (typeof eventCallback === 'function') {
      conversionPayload.event_callback = eventCallback;
    }

    window.gtag('event', 'conversion', conversionPayload);
    return true;
  }

  function track(eventName, eventParams) {
    if (!eventName || typeof eventName !== 'string') {
      return;
    }

    const payload = eventParams && typeof eventParams === 'object' ? eventParams : {};
    window.dataLayer.push({ event: eventName, ...payload });

    if (hasGaMeasurementId) {
      window.gtag('event', eventName, payload);
    }

    trackGoogleAdsConversion(eventName, payload);
  }

  function trackAndNavigate(eventName, eventParams, destination) {
    if (!destination || typeof destination !== 'string') {
      track(eventName, eventParams);
      return;
    }

    let didNavigate = false;
    const navigate = function navigate() {
      if (didNavigate) {
        return;
      }
      didNavigate = true;
      window.location.assign(destination);
    };

    const payload = eventParams && typeof eventParams === 'object' ? eventParams : {};
    window.dataLayer.push({ event: eventName, ...payload, destination });

    let hasAsyncTracking = false;

    if (hasGaMeasurementId) {
      hasAsyncTracking = true;
      window.gtag('event', eventName, {
        ...payload,
        destination,
        transport_type: 'beacon',
        event_callback: navigate,
      });
    }

    if (trackGoogleAdsConversion(eventName, payload, navigate)) {
      hasAsyncTracking = true;
    }

    window.setTimeout(navigate, hasAsyncTracking ? 400 : 0);
  }

  window.orchestratorTrack = track;
  window.orchestratorTrackAndNavigate = trackAndNavigate;

  if (!hasGaMeasurementId || !hasGtmContainerId || !hasGoogleAdsId) {
    console.info(
      'Analytics config incomplete. Set gaMeasurementId, gtmContainerId, and googleAdsId in /assets/analytics-config.js to enable full tracking.',
    );
  }
})();
