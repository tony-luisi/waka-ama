# Deployment Guide - Waka Ama Conditions

## Deploy to Vercel (Free)

### 1. Prepare your repository
```bash
git add .
git commit -m "Setup Vercel deployment structure"
git push origin main
```

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click "New Project" 
3. Import your `waka-ama` repository
4. Vercel will auto-detect it's a Vite project - no configuration needed!
5. Click "Deploy"

### 3. Add Environment Variables
After deployment, in your Vercel dashboard:
1. Go to your project → Settings → Environment Variables
2. Add these variables:
   - `NIWA_API_KEY` = `yWcExmYHoto0wFcQC6hIwSZtSv0oSeGy`
   - `OPENWEATHER_API_KEY` = `e897cab153a2616dff2c7e0563c8e50e`
3. Redeploy to pick up the new environment variables

### 4. Your site is live! 🎉
- Vercel will give you a URL like `https://waka-ama-xxx.vercel.app`
- Every push to `main` branch will auto-deploy
- API keys are secure on the server

## How it works
- **Frontend**: Static Vite build served from CDN
- **API**: Serverless functions in `/api` folder proxy external APIs
- **Security**: API keys stored as environment variables, never exposed to browser
- **Cost**: 100% free on Vercel

## Local Development
```bash
npm run dev
```
Continues to work with direct API calls using hardcoded keys (for development only).