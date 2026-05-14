# Security notes

This document captures known security considerations for this codebase, including the participant invite email PoC (`POST /invite/send-participant-emails` and related static UI).

## 1. Authenticated outbound email as an “open relay” (high for production)

Any user who satisfies **`require_invite_email_staff`** (`super_admin`, `survey_creator`, `survey_runner`) can ask the server to send mail to **up to 50 arbitrary recipient addresses** per request. The backend does **not** verify that those addresses belong to a tenant, deployment, or consent list.

**Risks:** abuse of the configured email provider (spam, cost, domain/sender reputation), or use of a **compromised staff account** as a bulk mailer.

**Hardening ideas:** per-user or per-tenant rate limits; allowlists; server-side invite records only (no arbitrary recipient lists from the client); audit logging; tighter role split (e.g. only certain roles may send, or approval workflows).

## 2. Weak coupling between sender identity and “what” is sent

The invite send handler does not enforce that the JWT’s **`group` / `sub`** (or similar) matches a specific survey or deployment. In principle, one staff identity could trigger sends that are not tied to an authorized resource.

**Risks:** cross-tenant-style abuse if staff accounts are issued broadly.

**Hardening ideas:** tie every send to **server-created invite rows** (e.g. from the surveys API), and authorize on **resource id + tenant/group**.

## 3. Long-running “wait for all” requests (availability)

The send path **waits** until all provider calls for the batch complete (with pacing between calls). Large batches and many concurrent callers can **tie up application workers** and hurt availability.

**Hardening ideas:** queue and worker processing; stricter batch caps; per-user or per-IP concurrency limits.

## 4. Secrets returned to the browser

Successful responses can include **`sent[].link`** (magic URLs). The static UI merges these into `localStorage` for the demo. That increases exposure: **XSS on the same origin**, malicious browser extensions, or shoulder-surfing could capture links or API responses.

**Hardening ideas:** prefer **HttpOnly** session cookies for web auth (see tradeoffs in `app/static/js/auth-client.js`); strict **CSP**; once links are fully server-managed, avoid returning long-lived secrets to the client when not necessary.

## 5. Error detail leakage

Failed sends populate **`failed[].detail`** from the provider’s HTTP response. Provider messages can be verbose or implementation-specific.

**Hardening ideas:** return **generic** messages to clients in production; log full provider responses **server-side only**.

## 6. Positive controls already in place

- **Provider API keys** stay on the server (environment / config), not in static JavaScript.
- Invite **HTML** uses escaping for OTP and link text to reduce HTML injection in the email body.
- **Authentication** for the send route is enforced server-side via JWT and the staff user store, not only client-side UI checks.
- PoC **magic link tokens** are generated with **`secrets`** (non-sequential, hard to guess).

## 7. JWT in `sessionStorage` (broader app pattern)

Staff auth uses a JWT stored in **`sessionStorage`** and attached via `authFetch`. Any **XSS** on the origin can steal the token and call privileged endpoints—including invite send.

This is a **general** risk for the staff UI, not unique to invite email, but the new endpoint is another high-value action a stolen token can invoke.

**Hardening ideas:** CSP, sanitization, minimizing inline scripts; consider cookie-based sessions with **HttpOnly** + **SameSite** for browser clients if threat model requires it.

---

*This file is descriptive, not a guarantee of completeness or compliance. Threat models and controls should be reviewed for production deployments.*
