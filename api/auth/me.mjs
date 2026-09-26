import { readSession, clearSessionCookie, refreshSessionHint } from "../../lib/session.mjs";
import { getUserWithProjects } from "../../lib/users.mjs";
import { isAdminEmail } from "../../lib/admin.mjs";

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
                region: user.region ?? null,
                hackatimeLinked: Boolean(user.hackatime_user_id),
                submitProfile: Boolean(user.submit_profile_on),
                eventJoined: Boolean(user.event_joined),
                readOnly: Boolean(user.shadow_banned),
                isAdmin: isAdminEmail(user.email) && !user.shadow_banned
            },
            projects: user.projects.map(p => ({
                projectId: p.project_id,
                name: p.name,
                description: p.description,
                repoUrl: p.repo_url,
                demoUrl: p.demo_url,
                hackatimeProject: p.hackatime_project ?? null,
                hackatimeHours: p.hackatime_hours ?? 0,
                reviewStatus: p.review_status ?? "draft",
                fraudRejected: Boolean(p.fraud_rejected),
                approvedHours: p.approved_hours ?? 0,
                creditedHours: p.credited_hours ?? 0,
                judgedHours: p.judged_hours ?? 0,
                roundSettled: Boolean(p.round_settled),
                roundLocked: Boolean(p.round_locked),
                reviewRemarks: p.review_remarks ?? null,
                reviewedAt: p.reviewed_at ?? null,
                submittedAt: p.submitted_at ?? null,
                submittedHours: p.submitted_hours ?? 0,
                createdAt: p.created_at,
                updatedAt: p.updated_at
            }))
        });
    } catch (err) {
        console.error("session lookup failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
