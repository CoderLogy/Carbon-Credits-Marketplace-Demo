import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupDb } from './db';
import { routes } from './routes';

dotenv.config({ path: '../.env' });

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', routes);

const PORT = process.env.PORT || 3001;

async function start() {
  await setupDb();
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

start();
