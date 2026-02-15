const crypto = require("crypto");

const SESSION_COOKIE_NAME = "oc_soccer_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 nap
const ALLOWED_EMAILS = ["emod.tibor@gmail.com", "piros.gabor@gmail.com"];
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10; // 10 perc

const sessions = new Map();
const oauthStates = new Map();

function parseCookies(cookieHeader = "") {
  const out = {};
  cookieHeader.split(";").forEach(part => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return;
    out[rawKey] = decodeURIComponent(rest.join("="));
  });
  return out;
}

function createSession(user) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  sessions.set(sessionId, {
    user,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return sessionId;
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { sessionId, ...session };
}

function clearSession(sessionId) {
  sessions.delete(sessionId);
}

function setSessionCookie(res, sessionId) {
  const isSecure = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isSecure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  const isSecure = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isSecure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

async function verifyGoogleIdToken(idToken) {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  if (!response.ok) {
    throw new Error("Érvénytelen Google token.");
  }
  const payload = await response.json();
  const configuredClientId = process.env.GOOGLE_CLIENT_ID;
  if (configuredClientId && payload.aud !== configuredClientId) {
    throw new Error("A token kliensazonosítója érvénytelen.");
  }
  if (payload.email_verified !== "true") {
    throw new Error("A Google email nincs hitelesítve.");
  }
  const normalizedAllowedEmails = ALLOWED_EMAILS.map(email => email.toLowerCase());
  if (!payload.email || !normalizedAllowedEmails.includes(payload.email.toLowerCase())) {
    throw new Error("Nincs jogosultságod belépni.");
  }
  return {
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture || null,
  };
}

function getPublicBaseUrl(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = forwardedProto ? String(forwardedProto).split(",")[0].trim() : req.protocol;
  return `${proto}://${req.get("host")}`;
}

function getDefaultRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const baseUrl = getPublicBaseUrl(req);
  const callbackBasePath = process.env.GOOGLE_AUTH_BASE_PATH || "/api";
  const normalizedBasePath = callbackBasePath === "/"
    ? ""
    : `/${String(callbackBasePath).replace(/^\/+|\/+$/g, "")}`;
  return `${baseUrl}${normalizedBasePath}/auth/google/callback`;
}

function createOAuthState(returnTo) {
  const state = crypto.randomBytes(20).toString("hex");
  oauthStates.set(state, {
    returnTo,
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
  });
  return state;
}

function consumeOAuthState(state) {
  const record = oauthStates.get(state);
  if (!record) return null;
  oauthStates.delete(state);
  if (record.expiresAt < Date.now()) return null;
  return record;
}

function buildGoogleAuthUrl(req, returnTo) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("Hiányzik a GOOGLE_CLIENT_ID backend beállítás.");
  }
  const redirectUri = getDefaultRedirectUri(req);
  const state = createOAuthState(returnTo);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCodeForIdToken(req, code) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Hiányzik a GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET backend beállítás.");
  }
  const redirectUri = getDefaultRedirectUri(req);
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (text.includes("invalid_client")) {
      throw new Error("Google invalid_client: ellenőrizd, hogy a GOOGLE_CLIENT_ID és GOOGLE_CLIENT_SECRET ugyanahhoz a Web OAuth klienshez tartozik.");
    }
    if (text.includes("redirect_uri_mismatch")) {
      throw new Error(`Google redirect_uri_mismatch: állítsd a Google Console-ban és env-ben ugyanarra a callback URL-re. Várt callback: ${redirectUri}`);
    }
    throw new Error(`Sikertelen Google token csere: ${text || response.status}`);
  }
  const payload = await response.json();
  if (!payload.id_token) {
    throw new Error("A Google token válasz nem tartalmaz id_token értéket.");
  }
  return payload.id_token;
}

function attachAuth(req, _res, next) {
  const session = getSession(req);
  req.auth = {
    isAuthenticated: Boolean(session?.user),
    sessionId: session?.sessionId ?? null,
    user: session?.user ?? null,
  };
  next();
}

function requireWriteAuth(req, res, next) {
  const isReadOnlyMethod = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
  if (isReadOnlyMethod) return next();
  if (req.path.startsWith("/auth/")) return next();
  if (req.auth?.isAuthenticated) return next();
  return res.status(401).json({ error: "Bejelentkezés szükséges." });
}

module.exports = {
  ALLOWED_EMAILS,
  attachAuth,
  clearSession,
  clearSessionCookie,
  buildGoogleAuthUrl,
  consumeOAuthState,
  createSession,
  exchangeCodeForIdToken,
  getDefaultRedirectUri,
  requireWriteAuth,
  setSessionCookie,
  verifyGoogleIdToken,
};
