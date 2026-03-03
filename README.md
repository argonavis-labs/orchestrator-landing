# Orchestrator Landing Page

Static marketing site for [Orchestrator](https://apps.apple.com/app/orchestrator), a native macOS app for orchestrating Claude Code agents.

## Pages

- **`index.html`** — Landing page
- **`download/index.html`** — Download selection page
- **`privacy.html`** — Privacy Policy
- **`eula.html`** — End-User License Agreement (EULA)
- **`terms.html`** — Terms of Service
- **`google-privacy-policy.html`** — Google OAuth Privacy Policy
- **`quickbooks-privacy-policy.html`** — QuickBooks OAuth Privacy Policy
- **`quickbooks-data-deletion.html`** — QuickBooks data deletion instructions

## Analytics Configuration

GA4 and GTM are configured in `assets/analytics-config.js`.

Set:

- `gaMeasurementId` (format `G-...`)
- `gtmContainerId` (format `GTM-...`)
- `googleAdsId` (format `AW-...`)
- `googleAdsConversions` event map (`event_name -> AW-.../...`)

Funnel events emitted by the site:

- `download_intent` (homepage CTA click)
- `download_page_view` (`/download` page view)
- `download_platform_selected` (platform link click)

## SEO and Ads Ops Checklist

Code-level SEO and tracking defaults in this repo now include:

- `robots.txt` and `sitemap.xml`
- Canonical URLs on homepage and download page
- Open Graph + Twitter metadata
- JSON-LD structured data (`SoftwareApplication`, `Organization`, `WebSite`)
- GA4 + GTM + Google Ads conversion wiring

Recommended account/platform configuration:

- Google Ads: enable **Auto-tagging**
- Google Ads: keep `download_platform_selected` as **Primary** conversion
- Google Ads: keep `download_intent` as **Secondary** conversion
- GA4: link property to Google Ads account
- Search Console: submit `https://orchest.org/sitemap.xml`
- DNS: add `www.orchest.org` record + redirect to apex if you want `www` robots checks to pass

## Google Ads API Bootstrap

Default GCP project for this repo is stored in `.gcloud-project` (`orchestrator-483621`).
Scripts in `scripts/google-ads/` will use that automatically unless you pass a project id explicitly.

Use this helper to enable required APIs and create Secret Manager placeholders:

```bash
./scripts/google-ads/bootstrap.sh
```

Create a 24-hour Search campaign focused on download conversions (default budget: USD 1000/day):

```bash
python3 -m pip install google-ads
./scripts/google-ads/create_24h_download_campaign.sh orchestrator-483621 1000
```

Required populated secrets in project `orchestrator-483621`:

- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (optional when not using MCC)
- `GOOGLE_ADS_CUSTOMER_ID`

## Development

No build step required. Serve locally with any static file server:

```bash
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000).

## Tech Stack

- HTML5 + CSS3 (no frameworks)
- CSS custom properties for light/dark theme
- iA Writer Quattro font with system fallbacks
- Responsive design (mobile breakpoint at 600px)

## Deployment (GitHub -> Cloud Run)

Pushes to `main` can auto-deploy through [`.github/workflows/deploy-cloud-run.yml`](.github/workflows/deploy-cloud-run.yml).

### 1) Create deploy service account in GCP

```bash
PROJECT_ID="orchestrator-483621"
DEPLOYER_SA="github-deployer"
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"

gcloud iam service-accounts create "${DEPLOYER_SA}" \
  --project "${PROJECT_ID}" \
  --display-name "GitHub deployer"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role "roles/run.admin"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role "roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role "roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role "roles/storage.admin"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role "roles/serviceusage.serviceUsageConsumer"

gcloud iam service-accounts add-iam-policy-binding \
  "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --project "${PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role "roles/iam.serviceAccountUser"
```

### 2) Create key and add GitHub secrets

```bash
gcloud iam service-accounts keys create gcp-sa-key.json \
  --project "${PROJECT_ID}" \
  --iam-account "${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
```

In `argonavis-labs/orchestrator-landing` GitHub repo settings, add:

- `GCP_SA_KEY`: full JSON contents of `gcp-sa-key.json`

The workflow is pinned to:

- project `orchestrator-483621`
- region `us-central1`
- Cloud Run service `orchest-landing`

### 3) Push to `main`

Any push to `main` will run the workflow and deploy this repository to Cloud Run.
