# FastAPI JWT

## Static files and pages

- Put static HTML pages in `app/static/` (example: `app/static/index.html`).
- Put CSS/JS/images in `app/static/css/`, `app/static/js/`, and `app/static/img/`.
- Static assets are served under `/static` by `app/main.py`.

## Browser auth (static pages)

Static demos use the **simplest** pattern: call `POST /auth/login`, then keep the returned JWT in **`sessionStorage`** and send `Authorization: Bearer …` on follow-up requests (see `app/static/js/auth-client.js` and `window.JwtStaticAuth`).

This layout **presumes the static pages and the API share the same origin** (same scheme, host, and port—for example everything at `http://127.0.0.1:8000`). That keeps login and other `fetch` calls **same-origin**, so you do not need CORS for the demos in this repo. If you **split** the UI and API onto different origins, the browser will block cross-origin requests unless you add **CORS middleware** on FastAPI (and any other cross-origin rules you need), or put a **reverse proxy** in front so the browser still sees a single origin.

**Why not HttpOnly cookies here:** cookies avoid JavaScript reading the token (better vs some XSS scenarios) but need CSRF-aware flows and more server/browser tuning. This repo intentionally stays on **Bearer + `sessionStorage`** until you choose to harden.

**Tradeoff:** any XSS on the same origin could read `sessionStorage` and steal the token. Mitigate with CSP, careful inline scripts, HTTPS in production, and eventually migrating to HttpOnly cookies if you need stricter browser session semantics.

## Users and auth

- **User store (file-backed):** accounts are persisted as JSON at **`USERS_STORE_PATH`** (default: **`data/users.json`**). Each entry is `username → { "password", "role", "group" }` where **`password`** is a **bcrypt** hash (cost factor 12). **`group`** is an opaque tenant id (new groups use **NanoID**; the value must exist as a key in the groups file). Override paths for tests or environments as needed. Survey data in this repo remains in-memory unless you extend it similarly.
- **Groups store (file-backed):** **`GROUPS_STORE_PATH`** (default: **`data/groups.json`**) maps **group id → `{ "name", "is_super_admin_group" }`**. Exactly one row from bootstrap is created with **`is_super_admin_group`: `true`** (the **Global Admin** group). Rows from **`POST /auth/admin/groups`** have **`is_super_admin_group`: `false`**. Display names are not embedded in staff JWTs; tokens carry **`group`** (the id) only (see `create_access_token` in `app/core/security.py`).
- **No public registration.** While the user store is empty, **`POST /auth/bootstrap`** (body: `username`, `password`) creates a **Global Admin** group if the groups store is empty, then the **first** account as **`super_admin`** tied to that group. Response includes **`group`**. After any user exists, bootstrap returns **403**.
- **`POST /auth/admin/users`** (body: `username`, `password`, `role`, **`group`**) creates additional accounts. Requires **`super_admin`** JWT. **`group`** must exist as a key in **`data/groups.json`** (or your **`GROUPS_STORE_PATH`**).
- **`GET /auth/admin/groups`** / **`POST /auth/admin/groups`** — **`super_admin`** JWT only; list all tenant groups or create one (`POST` body: `{ "name" }`, returns `{ "id", "name", "is_super_admin_group": false }`).
- **`role`** for new users is one of **`super_admin`**, **`survey_creator`**, **`survey_runner`**. (Survey participants are not user records.)
- **`GET /auth/super-admins`** — **`super_admin`** JWT only; returns **`{ "super_admins": [ "<username>", … ] }`** for **the same `group` as the caller’s JWT** (not cross-tenant).
- **`GET /auth/users`** — any authenticated staff JWT; lists usernames in the **same `group`** as the token.
- **`GET /auth/groups/{group_id}/users`** — any authenticated staff JWT; returns **`{ "users": [ { "username", "role" }, … ] }`** for that group. Allowed only if **`group_id`** matches the caller’s JWT **`group`**, or the caller’s role is **`super_admin`**. Unknown **`group_id`** → **404**.
- **`DELETE /auth/admin/users/{username}`** — **`super_admin`** JWT only; removes a user **in your group**. You cannot delete yourself or the **last `super_admin` in that group**.

## Survey API (playground)

- **Contract (TypeScript client):** `contracts/surveyApi.ts` — intended for a real SurveyBuilder-style frontend; kept in-repo as the source of truth for paths and payloads.
- **In-memory implementation:** Survey REST routes use a dedicated **`SURVEY_API_BEARER_TOKEN`**: every request must send **`Authorization: Bearer`** with that same secret string. This is **not** the app login JWT (the server rejects app JWTs on survey routes with **401** “Invalid survey API token”).
- **Browser UI:** [http://127.0.0.1:8000/survey-playground](http://127.0.0.1:8000/survey-playground) — uses `/static/js/survey-api-playground.js`. Paste the configured survey bearer token there. App users (bootstrap / admin-created) are only for **`/auth/*`** and **`/protected`** in this demo.

