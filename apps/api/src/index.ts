import express from 'express';
import cors from 'cors';
import { decodeToken } from './config/jwt';
import { AuthService } from './services/AuthService';

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

const authService = new AuthService();

app.post('/api/register', async (req, res) => {
    try {
        const { username, password, gender } = req.body;
        if (!username || !password || !gender) {
            return res.status(400).json({ error: 'username, password, gender는 필수입니다.' });
        }
        const player = await authService.register({ username, password, gender });
        res.json(player);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'username과 password는 필수입니다.' });
        }
        const result = await authService.login(username, password);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.get('/api/me', async (req, res) => {
    try {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            return res.status(401).json({ error: '토큰이 필요합니다.' });
        }
        const token = header.split(' ')[1];
        const decoded = decodeToken(token);
        if (!decoded) {
            return res.status(403).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
        }
        const player = await authService.getPlayerById(decoded.playerId);
        if (!player) {
            return res.json({ playerId: decoded.playerId });
        }
        res.json(player);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

app.listen(PORT, () => {
     console.log(`🚀 API Server running on http://localhost:${PORT}`);
});
