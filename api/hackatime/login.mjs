import { buildAuthorizeUrl, mintState, resolveRedirectUri, STATE_COOKIE, STATE_MAX_AGE_SECONDS } from "../../lib/hackatime.mjs";
import { serializeCookie, appendCookie, isSecureRequest, cookieName } from "../../lib/cookies.mjs";
import { readSession } from "../../lib/session.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // a hackatime account is linked to an existing zoneout account, never instead of one
    const session = readSession(req);
    if (!session) {
        res.setHeader("Location", "/");
        return res.status(302).end();
    }

    // method
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // signed state, bound to this session, sent as a cookie and a query parameter
    const state = mintState(session.userId);

    const secure = isSecureRequest(req);
    appendCookie(res, serializeCookie(cookieName(STATE_COOKIE, secure), state, {
        maxAge: STATE_MAX_AGE_SECONDS,
        secure
    }));

    // off to the provider
    res.setHeader("Location", buildAuthorizeUrl(state, resolveRedirectUri(req)));
    return res.status(302).end();
}
