// Vercel Serverless Function - Dify API 代理
export default async function handler(req, res) {
  // 只允许 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DIFY_API_KEY}`,
      },
      body: JSON.stringify({
        inputs: {},
        query: req.body.query,
        response_mode: 'blocking',
        user: 'xiaohongshu-editor',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    return res.status(200).json({ answer: data.answer });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
