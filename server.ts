import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiApp from './api/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Mount API router
app.use('/api', apiApp);

// Google Search Console HTML verification handler
app.get('/googlee771107603824512.html', (_req, res) => {
  res.type('text/html').send('google-site-verification: googlee771107603824512.html');
});

// Serve static assets from dist and public
const distPath = path.join(__dirname, 'dist');
const publicPath = path.join(__dirname, 'public');
app.use(express.static(distPath));
app.use(express.static(publicPath));

// Route /app and /app/* to app/index.html
app.get('/app', (_req, res) => {
  res.sendFile(path.join(distPath, 'app', 'index.html'));
});
app.get('/app/*', (_req, res) => {
  res.sendFile(path.join(distPath, 'app', 'index.html'));
});

// Default route for landing page
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Shopee Flash Sale Manager running on port ${PORT}`);
});

export default app;
