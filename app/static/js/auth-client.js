/**
 * Minimal same-origin JWT helper for static pages: login via JSON, store token in sessionStorage,
 * attach Bearer on authFetch. See README for security notes (vs HttpOnly cookies).
 */
(function () {
  var STORAGE_KEY = "fastapi_jwt_session";

  function formatError(data) {
    if (!data) return "Login failed";
    var d = data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d))
      return d
        .map(function (e) {
          return e.msg || JSON.stringify(e);
        })
        .join("; ");
    return "Login failed";
  }

  async function login(username, password) {
    var res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: String(username).trim(), password: password }),
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (res.ok && data.access_token) {
      sessionStorage.setItem(STORAGE_KEY, data.access_token);
      return { ok: true };
    }
    return { ok: false, status: res.status, message: formatError(data) };
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function getToken() {
    return sessionStorage.getItem(STORAGE_KEY) || "";
  }

  /** Decode JWT payload (client-side only; for UI gating). Same shape as FastAPI: sub, role, group, exp. */
  function decodeJwtPayload(token) {
    if (!token) return null;
    try {
      var parts = String(token).split(".");
      if (parts.length !== 3) return null;
      var base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      var pad = (4 - (base64.length % 4)) % 4;
      var json = atob(base64 + "=".repeat(pad));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function getSessionPayload() {
    return decodeJwtPayload(getToken());
  }

  function getSessionRole() {
    var p = getSessionPayload();
    return p && p.role ? String(p.role) : null;
  }

  function getSessionGroup() {
    var p = getSessionPayload();
    return p && p.group ? String(p.group) : null;
  }

  async function authFetch(url, options) {
    var opts = options || {};
    var headers = new Headers(opts.headers || {});
    var token = getToken();
    if (token) headers.set("Authorization", "Bearer " + token);
    return fetch(url, Object.assign({}, opts, { headers: headers }));
  }

  window.JwtStaticAuth = {
    login: login,
    logout: logout,
    getToken: getToken,
    authFetch: authFetch,
    decodeJwtPayload: decodeJwtPayload,
    getSessionPayload: getSessionPayload,
    getSessionRole: getSessionRole,
    getSessionGroup: getSessionGroup,
  };
})();
