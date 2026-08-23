export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // method
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    try {
        // open a connection ahead of the login
        const { warmPool } = await import("../lib/db.mjs");
        await warmPool();
    } catch (err) {
        console.warn("warm-up unavailable:", err.message);
    }

    return res.status(204).end();
}
