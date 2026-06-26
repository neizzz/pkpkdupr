import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
     res.json({
         status: 'ok',
         message: 'PkpkDupr API is running!',
         timestamp: new Date().toISOString(),
     });
});

// Sample ping endpoint
app.get('/api/ping', (_req, res) => {
     res.json({ message: 'pong' });
});

app.listen(PORT, () => {
     console.log(`🚀 API Server running on http://localhost:${PORT}`);
});
