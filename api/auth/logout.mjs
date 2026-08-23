import { clearSessionCookie } from "../../lib/session.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // method
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // clear the session
    clearSessionCookie(req, res);
    return res.status(204).end();
}
