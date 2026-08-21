// section for GET /api/auth/me

import { readSession, clearSessionCookie, refreshSessionHint } from "../../lib/session.mjs";
import { getUserWithProjects } from "../../lib/users.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    const session = readSession(req);

    if (!session) {
        clearSessionCookie(req, res);
        return res.status(401).json({ ok: false, error: "not authenticated" });
    }

    try {
        const user = await getUserWithProjects(session.userId);

        if (!user) {
            clearSessionCookie(req, res);
            return res.status(401).json({ ok: false, error: "not authenticated" });
        }

        refreshSessionHint(req, res);

        return res.status(200).json({
            ok: true,
            user: {
                userId: user.user_id,
                email: user.email,
                slackId: user.slack_id,
                name: user.name,
                status: user.status
            },
            projects: user.projects.map(p => ({
                projectId: p.project_id,
                createdAt: p.created_at
            }))
        });
    } catch (err) {
        console.error("session lookup failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
