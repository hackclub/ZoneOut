import { readSession, clearSessionCookie, refreshSessionHint } from "../../lib/session.mjs";
import { getUserWithProjects } from "../../lib/users.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // method
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // session
    const session = readSession(req);

    if (!session) {
        clearSessionCookie(req, res);
        return res.status(401).json({ ok: false, error: "not authenticated" });
    }

    try {
        // user and projects in one query
        const user = await getUserWithProjects(session.userId);

        if (!user) {
            clearSessionCookie(req, res);
            return res.status(401).json({ ok: false, error: "not authenticated" });
        }

        // bans
        if (user.is_banned) {
            return res.status(403).json({
                ok: false,
                error: "banned",
                reason: user.ban_reason || "No reason was given."
            });
        }

        // hint cookie for the menu label
        refreshSessionHint(req, res);

        return res.status(200).json({
            ok: true,
            user: {
                userId: user.user_id,
                email: user.email,
                slackId: user.slack_id,
                name: user.name,
                status: user.status,

                balanceHours: user.balance_hours,
                hackatimeLinked: Boolean(user.hackatime_user_id)
            },
            projects: user.projects.map(p => ({
                projectId: p.project_id,
                name: p.name,
                description: p.description,
                repoUrl: p.repo_url,
                demoUrl: p.demo_url,
                hackatimeProject: p.hackatime_project ?? null,
                hackatimeHours: p.hackatime_hours ?? 0,
                createdAt: p.created_at,
                updatedAt: p.updated_at
            }))
        });
    } catch (err) {
        console.error("session lookup failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
