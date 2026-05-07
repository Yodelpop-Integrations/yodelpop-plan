# Yodelpop Plan

HubSpot scoping tool that pulls live products from your HubSpot account, builds estimates, generates scope narratives, and pushes deals back to HubSpot.

## Live at
`plan.yodelpop.com`

## How it works
- Loads all products live from HubSpot on every page open
- No hardcoded products — update HubSpot, app updates automatically
- Generates AI scope narratives via Claude API
- Pushes deals + line items back to HubSpot

## Deploy to DigitalOcean

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/yodelpop-plan.git
git push -u origin main
```

### 2. Create app in DigitalOcean
1. Go to DigitalOcean App Platform
2. Click **Create App**
3. Connect your GitHub repo
4. DigitalOcean will detect it as a React app
5. Build command: `npm install && npm run build`
6. Output directory: `build`
7. Deploy

### 3. Add custom domain
1. In DO App settings → **Domains** → Add `plan.yodelpop.com`
2. Copy the DO app URL (e.g. `your-app.ondigitalocean.app`)
3. In GoDaddy DNS for yodelpop.com, add:
   - Type: `CNAME`
   - Name: `blueprint`
   - Value: `your-app.ondigitalocean.app`
   - TTL: 1 hour
4. Wait 5–15 min for SSL to provision

### 4. Environment variables
No environment variables needed — the Anthropic API key is handled by the Claude.ai artifact system in development. For production deployment, you will need to add your Anthropic API key:

In DigitalOcean App → Settings → Environment Variables:
```
REACT_APP_ANTHROPIC_API_KEY=your_key_here
```

And update the fetch calls in `src/App.jsx` to use:
```js
headers: {
  "Content-Type": "application/json",
  "x-api-key": process.env.REACT_APP_ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01"
}
```

## Local development
```bash
npm install
npm start
```

## Tech stack
- React 18
- Anthropic Claude API (claude-sonnet-4-20250514)
- HubSpot MCP connector
- DigitalOcean App Platform (static site)
