// Vercel Edge Function proxy: browser ← Vercel ← Dify API (streaming mode)
// Edge runtime: ~30s timeout on Hobby, ~60s on Pro
// Supports two Chatflows: default (topic) and groupbuy (快团团)
export const runtime = 'edge';

export default async function handler(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Pick API key based on chatflow type
  const isGroupBuy = body.chatflow === 'groupbuy';
  const apiKey = isGroupBuy
    ? (process.env.DIFY_GROUPBUY_API_KEY || process.env.DIFY_API_KEY)
    : process.env.DIFY_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'DIFY_API_KEY not configured on server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    // Use AbortController so we don't hang if Dify is slow
    // Edge runtime has limited time — abort our fetch before the runtime kills us
    const abortController = new AbortController();
    const timeoutMs = 25000; // 25s — leave 5s buffer before Edge kills us at ~30s
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    const difyRes = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: {},
        query: body.query,
        response_mode: 'streaming',
        user: 'proxy-user',
      }),
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    if (!difyRes.ok) {
      const errText = await difyRes.text();
      return new Response(JSON.stringify({ error: `Dify API ${difyRes.status}: ${errText.substring(0, 200)}` }), {
        status: difyRes.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Pipe the SSE stream through as a streaming Response
    return new Response(difyRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    // AbortError → Dify was too slow, tell frontend to fall back to direct call
    if (err.name === 'AbortError') {
      return new Response(JSON.stringify({ error: 'Dify upstream timeout — try direct API call' }), {
        status: 504,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
