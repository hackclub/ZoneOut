// section for GET /api/auth/callback

import { exchangeCode, fetchIdentity, resolveRedirectUri, verifyState, STATE_COOKIE } from "../../lib/oauth.mjs";
import { isSecureRequest, readCookie, clearCookie } from "../../lib/cookies.mjs";
import { setSessionCookie } from "../../lib/session.mjs";
import { upsertUser } from "../../lib/users.mjs";
import { warmPool } from "../../lib/db.mjs";

function redirect(res, location) {
    res.setHeader("Location", location);
    return res.status(302).end();
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    const { code, state, error } = req.query ?? {};

    clearCookie(res, STATE_COOKIE, { secure: isSecureRequest(req) });

    if (error) {
        console.warn("hack club auth declined:", String(error).slice(0, 100));
        return redirect(res, "/?auth=denied");
    }

    if (!verifyState(readCookie(req, STATE_COOKIE), state)) {
        console.warn("hack club auth callback rejected: state did not verify");
        return redirect(res, "/?auth=state");
    }

    if (typeof code !== "string" || !code) {
        console.warn("hack club auth callback rejected: no authorization code");
        return redirect(res, "/?auth=failed");
    }

    warmPool();

    let profile;
    try {
        const token = await exchangeCode(code, resolveRedirectUri(req));
        profile = await fetchIdentity(token.access_token);
    } catch (err) {
        console.error("hack club auth exchange failed:", err.message);
        return redirect(res, "/?auth=failed");
    }

    if (!profile.email) {
        console.error("hack club auth returned no primary_email; cannot upsert");
        return redirect(res, "/?auth=noemail");
    }

    let user;
    try {
        user = await upsertUser({
            email: profile.email,
            slackId: profile.slackId,
            name: profile.name,
            status: "verified"
        });
    } catch (err) {
        console.error("could not store hack club user:", err.message);
        return redirect(res, "/?auth=failed");
    }

    setSessionCookie(req, res, user.user_id);
    return redirect(res, "/home");
}
