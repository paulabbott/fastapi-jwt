from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["playground"])


@router.get("/playground", response_class=HTMLResponse)
def jwt_playground() -> str:
    return """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>JWT Playground</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; }
      h1 { margin-bottom: 0.5rem; }
      .row { margin-bottom: 0.75rem; }
      input, button, textarea { font-size: 1rem; padding: 0.5rem; }
      input { width: 100%; box-sizing: border-box; }
      button { cursor: pointer; margin-right: 0.5rem; }
      textarea { width: 100%; min-height: 170px; box-sizing: border-box; }
      .muted { color: #666; font-size: 0.95rem; }
      .two-col { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
      @media (min-width: 800px) {
        .two-col { grid-template-columns: 1fr 1fr; }
      }
      .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.65rem; }
      .actions > button { margin-right: 0; }
      .create-user-group {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem 0.5rem;
        padding: 0.2rem 0.55rem 0.2rem 0.45rem;
        border: 1px solid #ccc;
        border-radius: 6px;
        background: #f8f8f8;
      }
      .create-user-group label {
        font-size: 0.9rem;
        font-weight: 600;
        color: #333;
        margin: 0;
        white-space: nowrap;
      }
      .create-user-group select {
        font-size: 1rem;
        padding: 0.45rem 0.35rem;
        min-width: 10.5rem;
      }
      .create-user-group button { margin-right: 0; }
      .playground-links { margin-top: -0.35rem; margin-bottom: 1rem; font-size: 0.95rem; }
      .playground-links a { color: #0b57d0; }
      .playground-links a:visited { color: #5c2d91; }
    </style>
  </head>
  <body>
    <h1>FastAPI JWT Playground</h1>
    <p class="muted">No public registration. Use <code>POST /auth/bootstrap</code> once (empty user store) to create the first <code>super_admin</code> and the <strong>Global Admin</strong> group, then log in. Further users need <code>POST /auth/admin/users</code> with a <code>super_admin</code> JWT and a valid <code>group</code> id (use <code>GET /auth/admin/groups</code>).</p>
    <p class="muted playground-links"><a href="/static/v7.html">Survey Builder v7</a> — static demo served from <code>/static/</code> for manual testing alongside this page.</p>

    <div class="row">
      <label for="username">Username (email)</label>
      <input id="username" placeholder="you@example.com" />
    </div>

    <div class="row">
      <label for="password">Password</label>
      <input id="password" type="password" placeholder="testpass123" />
    </div>

    <div class="row actions">
      <button id="bootstrapBtn" type="button">Bootstrap first super_admin</button>
      <button id="loginBtn" type="button">Login</button>
      <span class="create-user-group" title="Uses JWT in the box below; must be super_admin">
        <label for="newUserRole">Role</label>
        <select id="newUserRole">
          <option value="super_admin">super_admin</option>
          <option value="survey_creator" selected>survey_creator</option>
          <option value="survey_runner">survey_runner</option>
        </select>
        <label for="newUserGroup">Group</label>
        <select id="newUserGroup" title="Load with a super_admin JWT (login first)">
          <option value="">(load groups)</option>
        </select>
        <button id="loadGroupsBtn" type="button">Load groups</button>
        <button id="adminCreateBtn" type="button">Create user</button>
      </span>
      <button id="usersBtn" type="button">List users</button>
      <button id="protectedBtn" type="button">Call /protected</button>
      <button id="clearBtn" type="button">Clear token</button>
    </div>

    <div class="row two-col">
      <div>
        <label for="token">JWT token</label>
        <textarea id="token" placeholder="Token will appear here"></textarea>
      </div>
      <div>
        <label for="decoded">Decoded JWT payload</label>
        <textarea id="decoded" readonly></textarea>
      </div>
    </div>

    <div class="row">
      <label for="output">Output</label>
      <textarea id="output" readonly></textarea>
    </div>

    <script>
      const usernameEl = document.getElementById("username");
      const passwordEl = document.getElementById("password");
      const tokenEl = document.getElementById("token");
      const outputEl = document.getElementById("output");
      const decodedEl = document.getElementById("decoded");

      const TOKEN_KEY = "jwt_playground_token";
      tokenEl.value = localStorage.getItem(TOKEN_KEY) || "";

      function log(title, data) {
        const body = typeof data === "string" ? data : JSON.stringify(data, null, 2);
        outputEl.value = `${title}\\n${body}`;
      }

      function credentialsPayload() {
        return {
          username: usernameEl.value.trim(),
          password: passwordEl.value
        };
      }

      function decodeJwtPayload(token) {
        const parts = token.split(".");
        if (parts.length !== 3) {
          throw new Error("Token format is invalid");
        }

        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padLength = (4 - (base64.length % 4)) % 4;
        const padded = base64 + "=".repeat(padLength);
        const json = atob(padded);
        return JSON.parse(json);
      }

      function refreshDecodedFromToken() {
        const token = tokenEl.value.trim();
        if (!token) {
          decodedEl.value = "";
          localStorage.removeItem(TOKEN_KEY);
          return;
        }

        localStorage.setItem(TOKEN_KEY, token);
        try {
          const payload = decodeJwtPayload(token);
          decodedEl.value = JSON.stringify(payload, null, 2);
        } catch (error) {
          decodedEl.value = `Unable to decode token: ${error.message}`;
        }
      }

      async function postJson(url, payload, extraHeaders) {
        const headers = { "Content-Type": "application/json", ...(extraHeaders || {}) };
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        return { status: res.status, data };
      }

      document.getElementById("bootstrapBtn").addEventListener("click", async () => {
        const result = await postJson("/auth/bootstrap", credentialsPayload(), {});
        log("POST /auth/bootstrap", result);
      });

      async function loadGroupsIntoSelect(selectEl) {
        const token = tokenEl.value.trim();
        if (!token) {
          log("GET /auth/admin/groups", { status: 0, data: "Set a JWT token first" });
          return;
        }
        const res = await fetch("/auth/admin/groups", {
          headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json().catch(() => ({}));
        log("GET /auth/admin/groups", { status: res.status, data });
        if (!res.ok) return;
        const list = data.groups || [];
        selectEl.innerHTML = list.length
          ? list.map((c) => `<option value="${String(c.id).replace(/"/g, "&quot;")}">${String(c.name).replace(/</g, "&lt;")}</option>`).join("")
          : '<option value="">(no groups)</option>';
      }

      document.getElementById("loadGroupsBtn").addEventListener("click", async () => {
        await loadGroupsIntoSelect(document.getElementById("newUserGroup"));
      });

      document.getElementById("adminCreateBtn").addEventListener("click", async () => {
        const token = tokenEl.value.trim();
        const role = document.getElementById("newUserRole").value;
        const groupId = document.getElementById("newUserGroup").value;
        if (!groupId) {
          log("POST /auth/admin/users", { status: 0, data: "Pick a group (use Load groups)" });
          return;
        }
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const result = await postJson(
          "/auth/admin/users",
          { username: usernameEl.value.trim(), password: passwordEl.value, role, group: groupId },
          headers
        );
        log("POST /auth/admin/users", result);
      });

      document.getElementById("loginBtn").addEventListener("click", async () => {
        const result = await postJson("/auth/login", credentialsPayload(), {});
        if (result.data.access_token) {
          tokenEl.value = result.data.access_token;
          refreshDecodedFromToken();
          void loadGroupsIntoSelect(document.getElementById("newUserGroup"));
        }
        log("POST /auth/login", result);
      });

      document.getElementById("protectedBtn").addEventListener("click", async () => {
        const token = tokenEl.value.trim();
        const res = await fetch("/protected", {
          headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        const data = await res.json().catch(() => ({}));
        log("GET /protected", { status: res.status, data });
      });

      document.getElementById("usersBtn").addEventListener("click", async () => {
        const token = tokenEl.value.trim();
        const res = await fetch("/auth/users", {
          headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        const data = await res.json().catch(() => ({}));
        log("GET /auth/users", { status: res.status, data });
      });

      document.getElementById("clearBtn").addEventListener("click", () => {
        tokenEl.value = "";
        decodedEl.value = "";
        localStorage.removeItem(TOKEN_KEY);
      });

      tokenEl.addEventListener("input", refreshDecodedFromToken);
      refreshDecodedFromToken();
    </script>
  </body>
</html>
"""
