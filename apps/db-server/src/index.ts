import express from 'express';

const app = express();
const port = 5001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'DB Server is running' });
});

app.listen(port, () => {
  console.log(`[DB-SERVER] Listening at http://localhost:${port}`);
});
