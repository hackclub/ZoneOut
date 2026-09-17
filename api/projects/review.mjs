import { requireAdmin, sameOrigin } from "../../lib/guard.mjs";
import { setProjectReview, queueProjectForReview, ValidationError } from "../../lib/users.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";

// response shape, the same fields the project page already reads
function present(project) {
    return {
        projectId: project.project_id,
        ownerName: project.owner_name ?? null,
        name: project.name,
        description: project.description,
        repoUrl: project.repo_url,
        demoUrl: project.demo_url,
        hackatimeLinked: Boolean(project.hackatime_project),
        hackatimeProject: project.hackatime_project ?? null,
        hackatimeHours: project.hackatime_hours ?? 0,
        reviewStatus: project.review_status ?? "draft",
        reviewRemarks: project.review_remarks ?? null,
        reviewedAt: project.reviewed_at ?? null,
        submittedAt: project.submitted_at ?? null,
        submittedHours: project.submitted_hours ?? 0,
        createdAt: project.created_at,
        updatedAt: project.updated_at
    };
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");

    // admin gate, before the method check
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    // method
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // origin
    if (!sameOrigin(req)) {
        return res.status(403).json({ ok: false, error: "bad origin" });
    }

    // request body
    let body;
    try {
        body = await readJsonBody(req);
    } catch (err) {
        if (err instanceof BadRequest) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        throw err;
    }

    const projectId = Number(body.projectId);
    if (!Number.isSafeInteger(projectId) || projectId < 1) {
        return res.status(404).json({ ok: false, error: "not found" });
    }

    const queueing = body.decision === "queue";

    const status = body.decision === "approve" ? "approved"
                 : body.decision === "reject"  ? "rejected"
                 : null;

    if (!status && !queueing) {
        return res.status(400).json({ ok: false, error: "A review is either approved or rejected." });
    }

    try {
        const project = queueing
            ? await queueProjectForReview(projectId, admin.user_id)
            : await setProjectReview(projectId, status, body.remarks, admin.user_id);

        if (!project) {
            return res.status(404).json({ ok: false, error: "not found" });
        }

        return res.status(200).json({
            ok: true,
            project: present(project),
            canEdit: true,
            canReview: true
        });
    } catch (err) {
        if (err instanceof ValidationError) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        console.error("project review failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
