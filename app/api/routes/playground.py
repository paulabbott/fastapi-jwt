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
    </style>
  </head>
  <body>
    <h1>FastAPI JWT Playground</h1>
    <p class="muted">Use this page to register/login and call protected endpoints.</p>

    <div class="row">
      <label for="username">Username</label>
      <input id="username" placeholder="testuser" />
    </div>

    <div class="row">
      <label for="password">Password</label>
      <input id="password" type="password" placeholder="testpass123" />
    </div>

    <div class="row">
      <button id="registerBtn">Register</button>
      <button id="loginBtn">Login</button>
      <button id="usersBtn">List users</button>
      <button id="protectedBtn">Call /protected</button>
      <button id="clearBtn">Clear token</button>
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

      async function postJson(url, payload) {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        return { status: res.status, data };
      }

      document.getElementById("registerBtn").addEventListener("click", async () => {
        const result = await postJson("/auth/register", credentialsPayload());
        if (result.data.access_token) {
          tokenEl.value = result.data.access_token;
          refreshDecodedFromToken();
        }
        log("POST /auth/register", result);
      });

      document.getElementById("loginBtn").addEventListener("click", async () => {
        const result = await postJson("/auth/login", credentialsPayload());
        if (result.data.access_token) {
          tokenEl.value = result.data.access_token;
          refreshDecodedFromToken();
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
