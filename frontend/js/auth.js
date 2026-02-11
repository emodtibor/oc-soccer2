import { api } from "./api.js";

const GOOGLE_CLIENT_ID = window.APP_CONFIG.GOOGLE_CLIENT_ID;

export async function getAuthState() {
  try {
    const response = await api.authMe();
    return {
      isAuthenticated: Boolean(response.isAuthenticated),
      user: response.user ?? null,
      allowedEmail: response.allowedEmail ?? null,
    };
  } catch (err) {
    console.error(err);
    return {
      isAuthenticated: false,
      user: null,
      allowedEmail: null,
    };
  }
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

  if (!GOOGLE_CLIENT_ID) {
    const info = document.createElement("span");
    info.className = "small";
    info.textContent = "A Google bejelentkezéshez hiányzik a GOOGLE_CLIENT_ID beállítás.";
    container.appendChild(info);
    return;
  }

  if (!window.google?.accounts?.id) {
    const info = document.createElement("span");
    info.className = "small";
    info.textContent = "Google bejelentkezés betöltése folyamatban…";
    container.appendChild(info);
    return;
  }

  const btnWrap = document.createElement("div");
  container.appendChild(btnWrap);

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: async (response) => {
      if (!response.credential) return;
      try {
        await api.authWithGoogle(response.credential);
        await onAuthChanged();
      } catch (err) {
        console.error(err);
        alert("Nincs jogosultságod belépni.");
      }
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  window.google.accounts.id.renderButton(btnWrap, {
    theme: "outline",
    size: "medium",
    text: "signin_with",
    shape: "pill",
  });
}
