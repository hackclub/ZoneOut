import { readSession } from "../../lib/session.mjs";
import { requireUser, refuseReadOnly } from "../../lib/guard.mjs";
import { getProjectWithViewer, updateProjectForUser, deleteProjectForUser, updateProjectAsAdmin, deleteProjectAsAdmin, ValidationError } from "../../lib/users.mjs";
import { isAdminEmail } from "../../lib/admin.mjs";
import { resolveProjectLink } from "../../lib/hackatime.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";
import { limited } from "../../lib/ratelimit.mjs";

// response shape, the hackatime name is for the owner and administrators only
function present(project, ownerName, showLink = true, showOwnerId = false, showReview = false) {
    return {
        projectId: project.project_id,
        ownerName: ownerName ?? project.owner_name ?? null,
        ownerSlackId: showOwnerId ? (project.owner_slack_id ?? null) : null,
        name: project.name,
        description: project.description,
        repoUrl: project.repo_url,
        demoUrl: project.demo_url,
        hackatimeLinked: Boolean(project.hackatime_project),
        hackatimeProject: showLink ? (project.hackatime_project ?? null) : null,
        hackatimeHours: project.hackatime_hours ?? 0,
        approvedHours: project.approved_hours ?? 0,
        creditedHours: project.credited_hours ?? 0,
        judgedHours: project.judged_hours ?? 0,
        eventHours: showLink ? (project.event_hours ?? null) : null,
        eventDeducted: showLink ? (project.event_deducted ?? 0) : null,
        onLeaderboard: showLink ? (project.owner_on_board ?? null) : null,
        roundSettled: Boolean(project.round_settled),
        roundLocked: Boolean(project.round_locked),
        submissions: showReview ? (project.submissions ?? []) : null,
        previousRound: showReview ? (project.previous_round ?? null) : null,
        ownerBalanceHours: showReview ? (project.owner_balance_hours ?? 0) : null,
        ownerPendingOrders: showReview ? (project.owner_pending_orders ?? 0) : null,
        ownerShadowBanned: showReview ? Boolean(project.owner_shadow_banned) : null,
        reviewStatus: project.review_status ?? "draft",
        fraudRejected: Boolean(project.fraud_rejected),
        reviewRemarks: project.review_remarks ?? null,
        reviewedAt: project.reviewed_at ?? null,
        submittedAt: project.submitted_at ?? null,
        submittedHours: project.submitted_hours ?? 0,
        createdAt: project.created_at,
        updatedAt: project.updated_at
    };
}

// id parsing
function readProjectId(raw) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!/^\d+$/.test(value ?? "")) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id >= 1 ? id : null;
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // method
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "PATCH" && req.method !== "DELETE") {
        res.setHeader("Allow", "GET, HEAD, PATCH, DELETE");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    const projectId = readProjectId(req.query?.id);
    if (projectId === null) {
        return res.status(404).json({ ok: false, error: "not found" });
    }

    if (req.method === "PATCH") return edit(req, res, projectId);
    if (req.method === "DELETE") return remove(req, res, projectId);

    try {
        // public read, the viewer resolved in the same statement
        const session = readSession(req);
        const project = await getProjectWithViewer(projectId, session?.userId ?? null);

        if (!project) {
            return res.status(404).json({ ok: false, error: "not found" });
        }

        const mine = Boolean(session) && session.userId === project.user_id;
        const owns = mine && !project.viewer_shadow;
        const admin = Boolean(session) && !project.viewer_banned && !project.viewer_shadow
                   && isAdminEmail(project.viewer_email);

        return res.status(200).json({
            ok: true,
            project: present(project, null, mine || admin, admin, admin),
            canEdit: owns || admin,
            canReview: admin,
            adminOverride: admin && !owns,
            signedIn: Boolean(session)
        });
    } catch (err) {
        console.error("project lookup failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// PATCH, owner or administrator
async function edit(req, res, projectId) {
    const user = await requireUser(req, res);
    if (!user) return;
    if (refuseReadOnly(user, res)) return;

    // rate limit
    if (await limited(res, "project-write", user.user_id, 40, 60)) return;

    let body;
    try {
        body = await readJsonBody(req);
    } catch (err) {
        if (err instanceof BadRequest) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        throw err;
    }

    const fields = {
        name: body.name,
        description: body.description,
        repoUrl: body.repoUrl,
        demoUrl: body.demoUrl
    };

    try {
        // the provider decides whether the link is real, not the form
        const link = await resolveProjectLink(user, body.hackatimeProject, projectId);

        let project = await updateProjectForUser(projectId, user.user_id, {
            ...fields,
            hackatimeProject: link.hackatimeProject,
            hackatimeHours: link.hackatimeHours
        });
        let ownerName = user.name;

        if (!project && isAdminEmail(user.email)) {
            project = await updateProjectAsAdmin(projectId, fields);
            ownerName = null;
        }

        if (!project) {
            return res.status(404).json({ ok: false, error: "not found" });
        }

        return res.status(200).json({ ok: true, project: present(project, ownerName), canEdit: true });
    } catch (err) {
        if (err instanceof ValidationError) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        console.error("project update failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// DELETE, owner or administrator
async function remove(req, res, projectId) {
    const user = await requireUser(req, res);
    if (!user) return;
    if (refuseReadOnly(user, res)) return;

    // rate limit
    if (await limited(res, "project-write", user.user_id, 40, 60)) return;

    try {
        let deleted = await deleteProjectForUser(user.user_id, projectId);

        if (!deleted && isAdminEmail(user.email)) {
            deleted = await deleteProjectAsAdmin(projectId, user.user_id);
        }

        if (!deleted) {
            return res.status(404).json({ ok: false, error: "not found" });
        }

        return res.status(200).json({ ok: true, projectId });
    } catch (err) {
        console.error("project delete failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
