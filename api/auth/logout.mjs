// section for POST /api/auth/logout

import { clearSessionCookie } from "../../lib/session.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    clearSessionCookie(req, res);
    return res.status(204).end();
}
