const crypto = require("crypto");

const SESSION_COOKIE_NAME = "oc_soccer_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 nap
const ALLOWED_EMAIL = "emod.tibor@gmail.com";

const sessions = new Map();

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
  if (!payload.email || payload.email.toLowerCase() !== ALLOWED_EMAIL) {
    throw new Error("Nincs jogosultságod belépni.");
  }
  return {
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture || null,
  };
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
  ALLOWED_EMAIL,
  attachAuth,
  clearSession,
  clearSessionCookie,
  createSession,
  requireWriteAuth,
  setSessionCookie,
  verifyGoogleIdToken,
};
