import express from 'express';
import path from 'path';
import fs from 'fs';
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

// Google Search Console sitemap.xml and robots.txt handler
app.get('/sitemap.xml', (_req, res) => {
  const sitemapPath = fs.existsSync(path.join(distPath, 'sitemap.xml'))
    ? path.join(distPath, 'sitemap.xml')
    : path.join(__dirname, 'public', 'sitemap.xml');
  res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  res.type('application/xml').sendFile(sitemapPath);
});

app.get('/robots.txt', (_req, res) => {
  const robotsPath = fs.existsSync(path.join(distPath, 'robots.txt'))
    ? path.join(distPath, 'robots.txt')
    : path.join(__dirname, 'public', 'robots.txt');
  res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  res.type('text/plain').sendFile(robotsPath);
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
