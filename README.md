# Orchestrator Landing Page

Static marketing site for [Orchestrator](https://apps.apple.com/app/orchestrator), a native macOS app for orchestrating Claude Code agents.

## Pages

- **`index.html`** — Landing page
- **`privacy.html`** — Privacy Policy
- **`terms.html`** — Terms of Service
- **`google-privacy-policy.html`** — Google OAuth Privacy Policy

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
