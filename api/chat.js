// Vercel serverless proxy: browser ← Vercel ← Dify API (streaming mode)
// Streams chunks as they arrive from Dify so the browser sees live progress.
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // disable nginx buffering

  try {
    const difyRes = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DIFY_API_KEY}`,
      },
      body: JSON.stringify({
        inputs: {},
        query: req.body.query,
        response_mode: 'streaming',
        user: 'proxy-user',
      }),
    });

    if (!difyRes.ok) {
      const errText = await difyRes.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(difyRes.status).json({ error: `Dify API ${difyRes.status}: ${errText.substring(0, 200)}` });
    }

    // Pipe the SSE stream through
    const reader = difyRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();

  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: err.message });
  }
}
