import { exchangeCode, fetchHackatimeIdentity, resolveRedirectUri, verifyState, storeLink, STATE_COOKIE } from "../../lib/hackatime.mjs";
import { isSecureRequest, readCookie, clearCookie } from "../../lib/cookies.mjs";
import { readSession } from "../../lib/session.mjs";
import { warmPool } from "../../lib/db.mjs";

// redirect helper
function redirect(res, location) {
    res.setHeader("Location", location);
    return res.status(302).end();
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    const secure = isSecureRequest(req);

    // state cookie is consumed once
    const cookieState = readCookie(req, STATE_COOKIE);
    clearCookie(res, STATE_COOKIE, { secure });

    // the session that started the flow has to be the one finishing it
    const session = readSession(req);
    if (!session) return redirect(res, "/");

    // method
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    const { code, state, error } = req.query ?? {};

    if (error) {
        console.warn("hackatime declined:", String(error).slice(0, 100));
        return redirect(res, "/home?ht=denied");
    }

    if (!verifyState(cookieState, state, session.userId)) {
        console.warn("hackatime callback rejected: state did not verify");
        return redirect(res, "/home?ht=state");
    }

    if (typeof code !== "string" || !code) {
        console.warn("hackatime callback rejected: no authorization code");
        return redirect(res, "/home?ht=failed");
    }

    // wake the database while we talk to the provider
    warmPool();

    // token exchange and identity
    let token;
    let identity;
    try {
        token = await exchangeCode(code, resolveRedirectUri(req));
        identity = await fetchHackatimeIdentity(token.access_token);
    } catch (err) {
        console.error("hackatime exchange failed:", err.message);
        return redirect(res, "/home?ht=failed");
    }

    // store the link
    try {
        const linked = await storeLink(session.userId, identity.hackatimeUserId, token.access_token);
        if (!linked) return redirect(res, "/home?ht=failed");
    } catch (err) {
        console.error("could not store hackatime link:", err.message);
        return redirect(res, "/home?ht=failed");
    }

    return redirect(res, "/home?ht=linked");
}
