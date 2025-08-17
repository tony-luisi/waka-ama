# Development Setup

## API Keys Setup

For development, you need to create a `.env.local` file with your API keys.

### 1. Create `.env.local` (not tracked by git)
```bash
# Copy this to .env.local in your project root
NIWA_API_KEY=yWcExmYHoto0wFcQC6hIwSZtSv0oSeGy
OPENWEATHER_API_KEY=e897cab153a2616dff2c7e0563c8e50e
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start development server
```bash
npm run dev
```

## Setting up on a new machine

1. Clone the repository
```bash
git clone https://github.com/tony-luisi/waka-ama.git
cd waka-ama
```

2. Copy API keys from your password manager or previous setup
3. Create `.env.local` file with the keys above
4. Run `npm install && npm run dev`

## Security Notes

- ✅ `.env.local` is gitignored - won't be committed
- ✅ Production keys are stored securely in Vercel
- ✅ API keys are never exposed to the browser
- 💡 Store keys in your password manager for easy access

## Sharing with team

If you need to share this project:
1. Share the repository (without keys)
2. Share API keys securely via password manager or encrypted message
3. Each person creates their own `.env.local` file