import { sign, verify, randomToken } from "./signing.mjs";
import { readEnv, hasEnv } from "./env.mjs";
import { seal, open } from "./secretbox.mjs";
import { query } from "./db.mjs";
import { ValidationError, normaliseHackatimeProject, findHackatimeLinkOwner } from "./users.mjs";
import { HACKATIME_SINCE } from "../catalog.js";

// provider endpoints
const AUTHORIZE_URL = "https://hackatime.hackclub.com/oauth/authorize";
const TOKEN_URL = "https://hackatime.hackclub.com/oauth/token";
const REVOKE_URL = "https://hackatime.hackclub.com/oauth/revoke";

const IDENTITY_URL = "https://hackatime.hackclub.com/api/v1/authenticated/me";
const STATS_URL = "https://hackatime.hackclub.com/api/v1/users/my/stats";

// timeouts
const PROVIDER_TIMEOUT_MS = 8_000;

// scopes, state and client credentials
const SCOPES = "profile read";

const STATE_TTL_MS = 10 * 60 * 1000;

export const STATE_COOKIE = "zo_ht_state";
export const STATE_MAX_AGE_SECONDS = STATE_TTL_MS / 1000;

// the oauth credentials, resolved on first use for the same reason the key is
let cachedClient = null;

function client() {
    if (cachedClient) return cachedClient;
    cachedClient = {
        id: readEnv("HACKATIME_CLIENT_ID"),
        secret: readEnv("HACKATIME_CLIENT_SECRET")
    };
    return cachedClient;
}

// the registered callback list
function parseRedirectUris() {
    const raw = readEnv("HACKATIME_REDIRECT_URIS", { required: false })
             ?? readEnv("HACKATIME_REDIRECT_URI", { required: false });

    if (!raw) {
        throw new Error(
            "HACKATIME_REDIRECT_URIS is not set. Add a comma separated list of every " +
            "callback URL registered for this app, for example " +
            "http://localhost:3000/api/hackatime/callback,https://example.com/api/hackatime/callback " +
            "Paste the value without surrounding quotes."
        );
    }

    const uris = raw.split(",").map(part => part.trim()).filter(Boolean);
    if (!uris.length) throw new Error("HACKATIME_REDIRECT_URIS contains no usable entries.");

    for (const uri of uris) {
        let parsed;
        try {
            parsed = new URL(uri);
        } catch {
            throw new Error(`HACKATIME_REDIRECT_URIS contains an entry that is not a valid URL: ${uri}`);
        }
        if (parsed.protocol !== "https:" && !isLoopback(parsed.hostname)) {
            throw new Error(`HACKATIME_REDIRECT_URIS entry must use https outside localhost: ${uri}`);
        }
    }

    return uris;
}

function isLoopback(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

let cachedRedirectUris = null;

function redirectUris() {
    if (!cachedRedirectUris) cachedRedirectUris = Object.freeze(parseRedirectUris());
    return cachedRedirectUris;
}

// is the integration configured
export function isConfigured() {
    return hasEnv("HACKATIME_CLIENT_ID")
        && hasEnv("HACKATIME_CLIENT_SECRET")
        && hasEnv("HACKATIME_TOKEN_KEY");
}

// request origin
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

// pick the callback for this host
export function resolveRedirectUri(req) {
    const origin = requestOrigin(req);

    const uris = redirectUris();

    if (origin) {
        const match = uris.find(uri => originOf(uri) === origin);
        if (match) return match;
        console.warn(
            `no HACKATIME_REDIRECT_URIS entry for origin ${origin}; falling back to ${uris[0]}. ` +
            "Add this callback to HACKATIME_REDIRECT_URIS and to the Hackatime OAuth app."
        );
    }

    return uris[0];
}

// signed state, bound to the session it was minted for
export function mintState(userId) {
    const payload = `${userId}.${randomToken(16)}.${Date.now()}`;
    return `${payload}.${sign("hackatime-state", payload)}`;
}

export function verifyState(fromCookie, fromQuery, sessionUserId) {
    if (typeof fromCookie !== "string" || typeof fromQuery !== "string") return false;
    if (!fromCookie || fromCookie !== fromQuery) return false;

    const parts = fromCookie.split(".");
    if (parts.length !== 4) return false;

    const [rawUserId, nonce, issuedAt, signature] = parts;
    if (!verify("hackatime-state", `${rawUserId}.${nonce}.${issuedAt}`, signature)) return false;

    const stateUserId = Number(rawUserId);
    if (!Number.isSafeInteger(stateUserId) || stateUserId !== Number(sessionUserId)) return false;

    const age = Date.now() - Number(issuedAt);
    return Number.isSafeInteger(Number(issuedAt)) && age >= 0 && age <= STATE_TTL_MS;
}

// authorize url
export function buildAuthorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
        client_id: client().id,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES,
        state
    });
    return `${AUTHORIZE_URL}?${params}`;
}

// provider responses
async function readOrThrow(response, what) {
    if (!response.ok) {
        const body = await response.text().catch(() => "<unreadable>");
        console.error(`${what} failed: HTTP ${response.status}`, body.slice(0, 500));
        throw new Error(`${what} failed with status ${response.status}`);
    }
    return response.json();
}

// token exchange
export async function exchangeCode(code, redirectUri) {
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
        },
        body: new URLSearchParams({
            client_id: client().id,
            client_secret: client().secret,
            redirect_uri: redirectUri,
            code,
            grant_type: "authorization_code"
        }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    });

    const token = await readOrThrow(response, "hackatime token exchange");
    if (!token.access_token) throw new Error("hackatime token exchange returned no access_token");
    return token;
}

// revoke
export async function revokeToken(accessToken) {
    await fetch(REVOKE_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
        },
        body: new URLSearchParams({
            client_id: client().id,
            client_secret: client().secret,
            token: accessToken
        }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    });
}

// profile, reduced to the one field we store
export async function fetchHackatimeIdentity(accessToken) {
    const response = await fetch(IDENTITY_URL, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    });

    const body = await readOrThrow(response, "hackatime identity lookup");

    const id = Number(body?.id);
    if (!Number.isSafeInteger(id) || id < 1) {
        throw new Error("hackatime identity lookup returned no usable id");
    }

    return { hackatimeUserId: id };
}

// project hours since the event started
export async function fetchProjectStats(accessToken) {
    const params = new URLSearchParams({
        features: "projects",
        limit: "100",
        start_date: `${HACKATIME_SINCE}T00:00:00Z`,
        end_date: new Date().toISOString()
    });

    const response = await fetch(`${STATS_URL}?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    });

    const body = await readOrThrow(response, "hackatime stats lookup");

    const projects = Array.isArray(body?.data?.projects) ? body.data.projects : [];

    return projects
        .map(project => ({
            name: typeof project?.name === "string" ? project.name.trim() : "",
            hours: Math.round((Number(project?.total_seconds) || 0) / 36) / 100
        }))
        .filter(project => project.name);
}

// stored link
export async function readToken(userId) {
    const { rows } = await query(
        "SELECT hackatime_token FROM users WHERE user_id = $1",
        [userId]
    );
    if (!rows[0]?.hackatime_token) return null;
    return open(rows[0].hackatime_token);
}

export async function storeLink(userId, hackatimeUserId, accessToken) {
    const { rows } = await query(
        `UPDATE users SET
             hackatime_user_id   = $2,
             hackatime_token     = $3,
             hackatime_linked_at = now(),
             hackatime_synced_at = NULL,
             updated_at          = now()
         WHERE user_id = $1
         RETURNING user_id, hackatime_user_id`,
        [userId, hackatimeUserId, seal(accessToken)]
    );
    return rows[0] ?? null;
}

export async function clearLink(userId) {
    const { rows } = await query(
        `UPDATE users SET
             hackatime_user_id   = NULL,
             hackatime_token     = NULL,
             hackatime_linked_at = NULL,
             hackatime_synced_at = NULL,
             updated_at          = now()
         WHERE user_id = $1
         RETURNING user_id`,
        [userId]
    );
    return rows[0] ?? null;
}

// one statement settles every linked project
export async function writeProjectHours(userId, pairs) {
    const names = pairs.map(pair => pair.name);
    const hours = pairs.map(pair => pair.hours);

    const { rows } = await query(
        `WITH incoming AS (
             SELECT unnest($2::text[]) AS name, unnest($3::numeric[]) AS hours
         ), settled AS (
             UPDATE projects p SET
                 hackatime_hours     = COALESCE((SELECT i.hours FROM incoming i WHERE i.name = p.hackatime_project), 0),
                 hackatime_synced_at = now()
             WHERE p.user_id = $1 AND p.hackatime_project IS NOT NULL
             RETURNING p.project_id, p.hackatime_hours
         ), stamped AS (
             UPDATE users SET hackatime_synced_at = now() WHERE user_id = $1
             RETURNING user_id
         )
         SELECT project_id, hackatime_hours::float8 AS hackatime_hours FROM settled`,
        [userId, names, hours]
    );
    return rows;
}

// a link is only accepted if the provider agrees the project exists
export async function resolveProjectLink(user, requested, excludeProjectId = null) {
    const wanted = normaliseHackatimeProject(requested);
    if (!wanted) return { hackatimeProject: null, hackatimeHours: 0 };

    if (!user?.hackatime_user_id) {
        throw new ValidationError("Connect Hackatime before linking a project.");
    }

    const token = await readToken(user.user_id);
    if (!token) {
        throw new ValidationError("Connect Hackatime before linking a project.");
    }

    const projects = await fetchProjectStats(token);
    const match = projects.find(project => project.name.toLowerCase() === wanted.toLowerCase());

    if (!match) {
        throw new ValidationError(`No Hackatime project named "${wanted}" has time logged since ${HACKATIME_SINCE}.`);
    }

    // one hackatime project belongs to one zoneout project
    const claimed = await findHackatimeLinkOwner(user.user_id, match.name, excludeProjectId);
    if (claimed) {
        throw new ValidationError(`"${match.name}" is already linked to your project "${claimed.name}".`);
    }

    return { hackatimeProject: match.name, hackatimeHours: match.hours };
}

// the polling floor
export const SYNC_FLOOR_MS = 60 * 1000;

export function syncedRecently(user) {
    if (!user?.hackatime_synced_at) return false;
    return Date.now() - new Date(user.hackatime_synced_at).getTime() < SYNC_FLOOR_MS;
}
