# Orchestrator Landing Page

Static marketing site for [Orchestrator](https://apps.apple.com/app/orchestrator), a native macOS app for orchestrating Claude Code agents.

## Pages

- **`index.html`** — Landing page
- **`privacy.html`** — Privacy Policy
- **`eula.html`** — End-User License Agreement (EULA)
- **`terms.html`** — Terms of Service
- **`google-privacy-policy.html`** — Google OAuth Privacy Policy
- **`quickbooks-privacy-policy.html`** — QuickBooks OAuth Privacy Policy
- **`quickbooks-data-deletion.html`** — QuickBooks data deletion instructions

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
