// section for the login session

import { sign, verify } from "./signing.mjs";
import { serializeCookie, appendCookie, isSecureRequest, cookieName, readCookie, clearCookie } from "./cookies.mjs";

export const SESSION_COOKIE = "zo_session";

export const HINT_COOKIE = "zo_hint";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function mintSession(userId) {
    const payload = `${userId}.${Date.now()}`;
    return `${payload}.${sign("session", payload)}`;
}

export function readSession(req) {
    const raw = readCookie(req, SESSION_COOKIE);
    if (!raw) return null;

    const parts = raw.split(".");
    if (parts.length !== 3) return null;

    const [rawUserId, rawIssuedAt, signature] = parts;
    if (!verify("session", `${rawUserId}.${rawIssuedAt}`, signature)) return null;

    const userId = Number(rawUserId);
    const issuedAt = Number(rawIssuedAt);

    if (!Number.isSafeInteger(userId) || userId < 1) return null;
    if (!Number.isSafeInteger(issuedAt)) return null;

    const ageSeconds = (Date.now() - issuedAt) / 1000;
    if (ageSeconds < 0 || ageSeconds > MAX_AGE_SECONDS) return null;

    return { userId };
}

export function setSessionCookie(req, res, userId) {
    const secure = isSecureRequest(req);

    appendCookie(res, serializeCookie(cookieName(SESSION_COOKIE, secure), mintSession(userId), {
        maxAge: MAX_AGE_SECONDS,
        secure
    }));

    appendCookie(res, serializeCookie(cookieName(HINT_COOKIE, secure), "1", {
        maxAge: MAX_AGE_SECONDS,
        secure,
        httpOnly: false
    }));
}

export function refreshSessionHint(req, res) {
    const secure = isSecureRequest(req);
    appendCookie(res, serializeCookie(cookieName(HINT_COOKIE, secure), "1", {
        maxAge: MAX_AGE_SECONDS,
        secure,
        httpOnly: false
    }));
}

export function clearSessionCookie(req, res) {
    const secure = isSecureRequest(req);
    clearCookie(res, SESSION_COOKIE, { secure });
    clearCookie(res, HINT_COOKIE, { secure });
}
