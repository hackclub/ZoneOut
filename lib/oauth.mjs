// section for Hack Club Auth

import { sign, verify, randomToken } from "./signing.mjs";
import { readEnv } from "./env.mjs";

const AUTHORIZE_URL = "https://auth.hackclub.com/oauth/authorize";
const TOKEN_URL = "https://auth.hackclub.com/oauth/token";

const USERINFO_URL = "https://auth.hackclub.com/oauth/userinfo";
const IDENTITY_URL = "https://auth.hackclub.com/api/v1/me";

const PROVIDER_TIMEOUT_MS = 8_000;
const HEDGE_AFTER_MS = 1_500;

const SCOPES = "openid profile email name slack_id";

const STATE_TTL_MS = 10 * 60 * 1000;

export const STATE_COOKIE = "zo_oauth_state";
export const STATE_MAX_AGE_SECONDS = STATE_TTL_MS / 1000;

const clientId = readEnv("HC_CLIENT_ID");
const clientSecret = readEnv("HC_CLIENT_SECRET");

// section for redirect URIs
function parseRedirectUris() {
    const raw = readEnv("HC_REDIRECT_URIS", { required: false })
             ?? readEnv("HC_REDIRECT_URI", { required: false });

    if (!raw) {
        throw new Error(
            "HC_REDIRECT_URIS is not set. Add a comma separated list of every " +
            "callback URL registered for this app, for example " +
            "http://localhost:3000/api/auth/callback,https://example.com/api/auth/callback " +
            "Paste the value without surrounding quotes."
        );
    }

    const uris = raw.split(",").map(part => part.trim()).filter(Boolean);
    if (!uris.length) throw new Error("HC_REDIRECT_URIS contains no usable entries.");

    for (const uri of uris) {
        let parsed;
        try {
            parsed = new URL(uri);
        } catch {
            throw new Error(`HC_REDIRECT_URIS contains an entry that is not a valid URL: ${uri}`);
        }
        if (parsed.protocol !== "https:" && !isLoopback(parsed.hostname)) {
            throw new Error(`HC_REDIRECT_URIS entry must use https outside localhost: ${uri}`);
        }
    }

    return uris;
}

function isLoopback(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export const REDIRECT_URIS = Object.freeze(parseRedirectUris());

function firstHeader(value) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== "string") return "";
    return raw.split(",")[0].trim();
}

function requestOrigin(req) {
    const headers = req?.headers ?? {};

    const host = firstHeader(headers["x-forwarded-host"]) || firstHeader(headers.host);
    if (!host) return null;

    const proto = firstHeader(headers["x-forwarded-proto"])
               || (isLoopback(host.split(":")[0]) ? "http" : "https");

    return `${proto}://${host}`.toLowerCase();
}

function originOf(uri) {
    return new URL(uri).origin.toLowerCase();
}

export function resolveRedirectUri(req) {
    const origin = requestOrigin(req);

    if (origin) {
        const match = REDIRECT_URIS.find(uri => originOf(uri) === origin);
        if (match) return match;
        console.warn(
            `no HC_REDIRECT_URIS entry for origin ${origin}; falling back to ${REDIRECT_URIS[0]}. ` +
            "Add this origin's callback to HC_REDIRECT_URIS and to the Developer Apps portal."
        );
    }

    return REDIRECT_URIS[0];
}

export function redirectUriMatchesHost(req) {
    const origin = requestOrigin(req);
    if (!origin) return false;
    return REDIRECT_URIS.some(uri => originOf(uri) === origin);
}

// section for the OAuth state
export function mintState() {
    const payload = `${randomToken(16)}.${Date.now()}`;
    return `${payload}.${sign("oauth-state", payload)}`;
}

export function verifyState(fromCookie, fromQuery) {
    if (typeof fromCookie !== "string" || typeof fromQuery !== "string") return false;
    if (!fromCookie || fromCookie !== fromQuery) return false;

    const parts = fromCookie.split(".");
    if (parts.length !== 3) return false;

    const [nonce, issuedAt, signature] = parts;
    if (!verify("oauth-state", `${nonce}.${issuedAt}`, signature)) return false;

    const age = Date.now() - Number(issuedAt);
    return Number.isSafeInteger(Number(issuedAt)) && age >= 0 && age <= STATE_TTL_MS;
}

export function buildAuthorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES,
        state
    });
    return `${AUTHORIZE_URL}?${params}`;
}

async function readOrThrow(response, what) {
    if (!response.ok) {
        const body = await response.text().catch(() => "<unreadable>");
        console.error(`${what} failed: HTTP ${response.status}`, body.slice(0, 500));
        throw new Error(`${what} failed with status ${response.status}`);
    }
    return response.json();
}

// section for the token exchange
export async function exchangeCode(code, redirectUri) {
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code,
            grant_type: "authorization_code"
        }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    });

    const token = await readOrThrow(response, "token exchange");
    if (!token.access_token) throw new Error("token exchange returned no access_token");
    return token;
}

// section for the identity lookup
function normaliseIdentity(body) {
    const identity = body?.identity ?? body ?? {};

    const composed = [identity.first_name ?? identity.given_name,
                      identity.last_name ?? identity.family_name]
        .filter(Boolean).join(" ").trim();

    const named = typeof identity.name === "string" ? identity.name.trim() : "";

    return {
        email: identity.primary_email ?? identity.email ?? null,
        slackId: identity.slack_id ?? null,
        name: named || composed || null
    };
}

function getJson(url, accessToken) {
    return fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    });
}

async function attemptIdentity(url, accessToken, label) {
    try {
        const response = await getJson(url, accessToken);

        if (!response.ok) {
            const body = await response.text().catch(() => "<unreadable>");
            console.warn(`${label} failed: HTTP ${response.status}`, body.slice(0, 500));
            return null;
        }

        const profile = normaliseIdentity(await response.json());
        if (!profile.email) {
            console.warn(`${label} returned no email`);
            return null;
        }
        return profile;
    } catch (err) {
        console.warn(`${label} unreachable:`, err.message);
        return null;
    }
}

export async function fetchIdentity(accessToken) {
    let hedged = null;
    const startHedge = () => (hedged ??= attemptIdentity(IDENTITY_URL, accessToken, "api/v1/me"));

    const primary = attemptIdentity(USERINFO_URL, accessToken, "oauth/userinfo");
    const hedgeTimer = setTimeout(startHedge, HEDGE_AFTER_MS);

    let profile;
    try {
        profile = await primary;
    } finally {
        clearTimeout(hedgeTimer);
    }

    profile ??= await startHedge();

    if (!profile) throw new Error("identity lookup returned no usable profile");
    return profile;
}
