// section for GET /api/warm

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    try {
        const { warmPool } = await import("../lib/db.mjs");
        await warmPool();
    } catch (err) {
        console.warn("warm-up unavailable:", err.message);
    }

    return res.status(204).end();
}
