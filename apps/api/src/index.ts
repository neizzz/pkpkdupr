import cors from "cors";
import express from "express";
import { PlayerStatus } from "@pkpkdupr/shared/player";
import type { VerifyPlayerQrTokenRequest } from "@pkpkdupr/shared/qr";
import { decodeToken } from "./config/jwt";
import {
  getMetricsContentType,
  getMetricsSnapshot,
  metricsMiddleware,
} from "./monitoring/metrics";
import { MatchRepository } from "./repositories/MatchRepository";
import { AuthService } from "./services/AuthService";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", getMetricsContentType());
  res.end(await getMetricsSnapshot());
});

app.use(metricsMiddleware);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "PkpkDupr API is running!",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/ping", (_req, res) => {
  res.json({ message: "pong" });
});

const authService = new AuthService();
const matchRepository = new MatchRepository();
const playerStatuses: PlayerStatus[] = ["active", "inactive"];

const getAuthPayload = (req: express.Request, res: express.Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "토큰이 필요합니다." });
    return null;
  }
  const token = header.split(" ")[1];
  const decoded = decodeToken(token);
  if (!decoded) {
    res.status(403).json({ error: "유효하지 않거나 만료된 토큰입니다." });
    return null;
  }
  return decoded;
};

const requireAdmin = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "토큰이 필요합니다." });
  }
  const token = header.split(" ")[1];
  const decoded = decodeToken(token);
  if (!decoded) {
    return res.status(403).json({ error: "유효하지 않거나 만료된 토큰입니다." });
  }
  if (!decoded.isAdmin) {
    return res.status(403).json({ error: "관리자 권한이 필요합니다." });
  }
  next();
};

app.post("/api/register", async (req, res) => {
  try {
    const { username, password, gender } = req.body;
    if (!username || !password || !gender) {
      return res
        .status(400)
        .json({ error: "username, password, gender는 필수입니다." });
    }
    const player = await authService.register({ username, password, gender });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username과 password는 필수입니다." });
    }
    const result = await authService.login(username, password);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/me", async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "토큰이 필요합니다." });
    }
    const token = header.split(" ")[1];
    const decoded = decodeToken(token);
    if (!decoded) {
      return res.status(403).json({ error: "유효하지 않거나 만료된 토큰입니다." });
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

app.get("/api/players", async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "토큰이 필요합니다." });
    }
    const token = header.split(" ")[1];
    const decoded = decodeToken(token);
    if (!decoded) {
      return res.status(403).json({ error: "유효하지 않거나 만료된 토큰입니다." });
    }

    const players = await authService.getPublicPlayers();
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/player-qr-token", async (req, res) => {
  try {
    const decoded = getAuthPayload(req, res);
    if (!decoded) {
      return;
    }

    const result = await authService.createPlayerQrToken(decoded.playerId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/player-qr-token/verify", async (req, res) => {
  try {
    if (!getAuthPayload(req, res)) {
      return;
    }

    const { payload } = req.body as VerifyPlayerQrTokenRequest;
    if (!payload) {
      return res.status(400).json({ error: "payload는 필수입니다." });
    }

    const result = await authService.verifyPlayerQrToken(payload);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get("/api/matches", async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "토큰이 필요합니다." });
    }
    const token = header.split(" ")[1];
    const decoded = decodeToken(token);
    if (!decoded) {
      return res.status(403).json({ error: "유효하지 않거나 만료된 토큰입니다." });
    }

    const page = Number(req.query.page ?? 0);
    const limit = Number(req.query.limit ?? 20);
    const playerId = typeof req.query.playerId === "string" ? req.query.playerId : undefined;

    const result = playerId
      ? await matchRepository.findByPlayerId(playerId, page, limit)
      : await matchRepository.findAll(page, limit);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/change-password", async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "토큰이 필요합니다." });
    }
    const token = header.split(" ")[1];
    const decoded = decodeToken(token);
    if (!decoded) {
      return res.status(403).json({ error: "유효하지 않거나 만료된 토큰입니다." });
    }
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "비밀번호는 6자 이상이어야 합니다." });
    }
    await authService.changePassword(decoded.playerId, newPassword);
    res.json({ message: "비밀번호가 변경되었습니다." });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/admin/players", requireAdmin, async (_req, res) => {
  try {
    const players = await authService.getAllPlayers();
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/admin/player-creation-logs", requireAdmin, async (_req, res) => {
  try {
    const logs = await authService.getPlayerCreationLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/admin/player-status-logs", requireAdmin, async (_req, res) => {
  try {
    const logs = await authService.getPlayerStatusLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.patch("/api/admin/players/:playerId/status", requireAdmin, async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "토큰이 필요합니다." });
    }

    const token = header.split(" ")[1];
    const decoded = decodeToken(token);
    if (!decoded) {
      return res.status(403).json({ error: "유효하지 않거나 만료된 토큰입니다." });
    }

    const { status } = req.body as { status?: PlayerStatus };
    if (!status || !playerStatuses.includes(status)) {
      return res
        .status(400)
        .json({ error: "status는 active 또는 inactive 여야 합니다." });
    }

    const result = await authService.updatePlayerStatus(
      req.params.playerId,
      status,
      decoded.playerId,
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/admin/register", requireAdmin, async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "토큰이 필요합니다." });
    }
    const token = header.split(" ")[1];
    const decoded = decodeToken(token);
    if (!decoded) {
      return res.status(403).json({ error: "유효하지 않거나 만료된 토큰입니다." });
    }

    const { username, password, gender } = req.body;
    if (!username || !password || !gender) {
      return res
        .status(400)
        .json({ error: "username, password, gender는 필수입니다." });
    }
    const player = await authService.registerAdmin(
      { username, password, gender },
      decoded.playerId,
    );
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

(app as any).listen(PORT, async () => {
  await authService.initAdmin();
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`👤 Admin 계정 자동 생성 (admin / admin123)`);
});
