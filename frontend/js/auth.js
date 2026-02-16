import { api } from "./api.js";

const API_URL = window.APP_CONFIG.API_URL;

export async function getAuthState() {
  try {
    const response = await api.authMe();
    return {
      isAuthenticated: Boolean(response.isAuthenticated),
      user: response.user ?? null,
      allowedEmails: response.allowedEmails ?? [],
    };
  } catch (err) {
    console.error(err);
    return {
      isAuthenticated: false,
      user: null,
      allowedEmails: [],
    };
  }
}

function resolveApiPath(pathname) {
  if (/^https?:\/\//.test(API_URL)) return `${API_URL}${pathname}`;
  const normalizedBase = API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL;
  return `${normalizedBase}${pathname}`;
}

export function renderAuthControls(container, authState, onAuthChanged) {
  container.className = "auth-controls";
  container.innerHTML = "";

  if (authState.isAuthenticated) {
    const wrap = document.createElement("div");
    wrap.className = "auth-user";
    const avatar = authState.user?.picture
      ? `<img src="${authState.user.picture}" alt="avatar" />`
      : "";
    wrap.innerHTML = `${avatar}<span>${authState.user?.name || authState.user?.email || "Bejelentkezve"}</span>`;

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.textContent = "Kijelentkezés";
    logoutBtn.onclick = async () => {
      await api.logout();
      await onAuthChanged();
    };

    container.appendChild(wrap);
    container.appendChild(logoutBtn);
    return;
  }

  const loginBtn = document.createElement("button");
  loginBtn.type = "button";
  loginBtn.className = "primary";
  loginBtn.textContent = "Bejelentkezés Google-lel";
  loginBtn.onclick = () => {
    const returnTo = window.location.href;
    const authStartUrl = `${resolveApiPath("/auth/google/start")}?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.assign(authStartUrl);
  };

  container.appendChild(loginBtn);
}