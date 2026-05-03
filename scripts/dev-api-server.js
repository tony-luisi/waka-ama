/**
 * Local development API server.
 * Runs the Vercel serverless functions locally so the frontend can test
 * against real API proxies (including OpenAI synthesis).
 *
 * Usage: node scripts/dev-api-server.js
 * Then in another terminal: npm run dev
 */

import http from 'http';
import { URL } from 'url';

// Import the Vercel API functions
import niwaTides from '../api/niwa-tides.js';
import weather from '../api/weather.js';
import forecastSynthesis from '../api/forecast-synthesis.js';

const PORT = process.env.API_PORT || 3001;

const routes = {
  '/api/niwa-tides': niwaTides,
  '/api/weather': weather,
  '/api/forecast-synthesis': forecastSynthesis,
};

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const handler = routes[pathname];

  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', path: pathname }));
    return;
  }

  // Build Vercel-style req object
  const vercelReq = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: Object.fromEntries(url.searchParams),
    body: null,
  };

  // Parse body for POST requests
  if (req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyStr = Buffer.concat(chunks).toString('utf-8');
    try {
      vercelReq.body = JSON.parse(bodyStr);
    } catch {
      vercelReq.body = bodyStr;
    }
  }

  // Build Vercel-style res object with polyfills
  const vercelRes = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
      res.setHeader(name, value);
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      if (!res.headersSent) {
        res.writeHead(this.statusCode, { 'Content-Type': 'application/json', ...this.headers });
      }
      res.end(JSON.stringify(data));
    },
    end(data) {
      if (!res.headersSent) {
        res.writeHead(this.statusCode, this.headers);
      }
      res.end(data);
    },
  };

  try {
    await handler(vercelReq, vercelRes);
  } catch (err) {
    console.error(`Error in ${pathname}:`, err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error', message: err.message }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Dev API server running at http://localhost:${PORT}`);
  console.log('   Endpoints:');
  console.log('     - GET  /api/niwa-tides');
  console.log('     - GET  /api/weather');
  console.log('     - POST /api/forecast-synthesis');
  console.log('');
  console.log('   In another terminal, run: npm run dev');
});
