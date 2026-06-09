// Bill Capture — Cloudflare Worker
// Holds the Google client secret and refresh token securely.
// The browser never sees either of these.
//
// Endpoints:
//   GET  /callback   — OAuth redirect from Google, stores refresh token, sends session to PWA
//   POST /token      — exchange session ID for a fresh Drive access token
//   DELETE /signout  — delete the stored session

export default {
  async fetch(request, env) {
    const url  = new URL(request.url);
    const pwaUrl    = env.PWA_URL;                        // e.g. https://user.github.io/receipt-scanner-app/
    const pwaOrigin = new URL(pwaUrl).origin;             // e.g. https://user.github.io

    const cors = {
      'Access-Control-Allow-Origin':  pwaOrigin,
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const path = url.pathname;

    if (path === '/callback' && request.method === 'GET') {
      return handleCallback(url, env, pwaUrl);
    }
    if (path === '/token' && request.method === 'POST') {
      return handleGetToken(request, env, cors);
    }
    if (path === '/signout' && request.method === 'DELETE') {
      return handleSignout(request, env, cors);
    }

    return new Response('Not found', { status: 404 });
  },
};

// ─── OAuth callback ───────────────────────────────────────────────────────────
async function handleCallback(url, env, pwaUrl) {
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return redirect(pwaUrl, { auth_error: error || 'no_code' });
  }

  // Exchange the code for an access + refresh token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  `${url.origin}/callback`,
      grant_type:    'authorization_code',
    }),
  });

  const tokens = await res.json();

  if (!res.ok || !tokens.refresh_token) {
    return redirect(pwaUrl, { auth_error: tokens.error || 'no_refresh_token' });
  }

  // Store the refresh token in KV under a random session ID (1-year TTL)
  const sessionId = randomHex(32);
  await env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify({ refresh_token: tokens.refresh_token, created_at: Date.now() }),
    { expirationTtl: 60 * 60 * 24 * 365 }
  );

  // Send the user back to the PWA with their session ID
  return redirect(pwaUrl, { session: sessionId, state: state || '' });
}

// ─── Get fresh access token ───────────────────────────────────────────────────
async function handleGetToken(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const { session_id } = body;
  if (!session_id) return json({ error: 'missing_session_id' }, 400, cors);

  const stored = await env.SESSIONS.get(`session:${session_id}`);
  if (!stored) return json({ error: 'session_not_found' }, 401, cors);

  const { refresh_token } = JSON.parse(stored);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token,
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    // Refresh token was revoked — clean up
    await env.SESSIONS.delete(`session:${session_id}`);
    return json({ error: 'refresh_failed' }, 401, cors);
  }

  return json({ access_token: data.access_token, expires_in: data.expires_in }, 200, cors);
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
async function handleSignout(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  if (body.session_id) await env.SESSIONS.delete(`session:${body.session_id}`);
  return json({ ok: true }, 200, cors);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function redirect(base, params) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return Response.redirect(url.toString(), 302);
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}
