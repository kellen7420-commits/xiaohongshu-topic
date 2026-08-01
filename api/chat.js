// Vercel serverless proxy: browser ← Vercel ← Dify API (blocking mode)
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
  res.setHeader('Content-Type', 'application/json');

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
        response_mode: 'blocking',
        user: 'proxy-user',
      }),
    });

    if (!difyRes.ok) {
      const errText = await difyRes.text();
      return res.status(difyRes.status).json({ error: `Dify API ${difyRes.status}: ${errText.substring(0, 200)}` });
    }

    const data = await difyRes.json();
    return res.status(200).json({ answer: data.answer || '' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
