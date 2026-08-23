import { buildAuthorizeUrl, mintState, resolveRedirectUri, STATE_COOKIE, STATE_MAX_AGE_SECONDS } from "../../lib/oauth.mjs";
import { serializeCookie, appendCookie, isSecureRequest, cookieName } from "../../lib/cookies.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // method
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // signed state, sent as a cookie and a query parameter
    const state = mintState();

    const secure = isSecureRequest(req);
    appendCookie(res, serializeCookie(cookieName(STATE_COOKIE, secure), state, {
        maxAge: STATE_MAX_AGE_SECONDS,
        secure
    }));

    // off to the provider
    res.setHeader("Location", buildAuthorizeUrl(state, resolveRedirectUri(req)));
    return res.status(302).end();
}
