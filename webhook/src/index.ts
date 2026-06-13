import express from 'express';
import crypto from 'crypto';

interface AlertConfig {
  url: string;
  secret?: string;
  events: ('FAIL' | 'PAUSED' | 'SLASHED')[];
}

interface AlertPayload {
  event: string;
  agent: string;
  txHash: string;
  reason: string;
  timestamp: number;
  chainId: number;
  blockNumber?: number;
  pauseAgentUrl?: string;
}

const app = express();
app.use(express.json());

const configs: Map<string, AlertConfig> = new Map();

app.post('/register', (req, res) => {
  const { id, url, secret, events } = req.body;
  configs.set(id, { url, secret, events });
  res.json({ ok: true });
});

app.post('/alert', async (req, res) => {
  const payload: AlertPayload = req.body;
  const results: Record<string, number> = {};
  
  for (const [id, config] of configs) {
    if (!config.events.includes(payload.event as any)) continue;
    try {
      const body = JSON.stringify({
        ...payload,
        pauseAgentUrl: `https://chiron.agent/pause/${payload.agent}?event=${payload.event}`,
      });
      const signature = config.secret
        ? crypto.createHmac('sha256', config.secret).update(body).digest('hex')
        : '';
      const res = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Chiron-Signature': signature },
        body,
      });
      results[id] = res.status;
    } catch { results[id] = 0; }
  }
  res.json({ delivered: Object.keys(results).length, results });
});

const PORT = parseInt(process.env.PORT || '3457');
app.listen(PORT, () => console.log(`Webhook service on :${PORT}`));
