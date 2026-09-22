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

// Serve static assets from dist
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

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
