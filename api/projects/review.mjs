import { requireAdmin, sameOrigin } from "../../lib/guard.mjs";
import { setProjectReview, setReviewRemarks, queueProjectForReview, updateApprovedHours, shadowBanProjectOwner, ValidationError } from "../../lib/users.mjs";
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
        approvedHours: project.approved_hours ?? 0,
        creditedHours: project.credited_hours ?? 0,
        judgedHours: project.judged_hours ?? 0,
        roundSettled: Boolean(project.round_settled),
        roundLocked: Boolean(project.round_locked),
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

    // shadow ban the owner
    if (body.decision === "shadow") {
        try {
            const owner = await shadowBanProjectOwner(projectId, admin.user_id);
            if (!owner) return res.status(404).json({ ok: false, error: "not found" });
            return res.status(200).json({ ok: true, shadowBanned: true });
        } catch (err) {
            console.error("shadow ban failed:", err.message);
            return res.status(503).json({ ok: false, error: "database unreachable" });
        }
    }

    const queueing = body.decision === "queue";
    const editing  = body.decision === "remarks";
    const updating = body.decision === "update";
    const fraud    = body.decision === "fraud";
    const wipe     = fraud && body.wipe === true;

    const status = body.decision === "approve" ? "approved"
                 : body.decision === "reject"  ? "rejected"
                 : fraud                       ? "rejected"
                 : null;

    if (!status && !queueing && !editing && !updating) {
        return res.status(400).json({ ok: false, error: "A review is either approved or rejected." });
    }

    try {
        const project = queueing
            ? await queueProjectForReview(projectId, admin.user_id)
            : editing
            ? await setReviewRemarks(projectId, body.remarks, admin.user_id)
            : updating
            ? await updateApprovedHours(projectId, body.approvedHours, body.remarks, admin.user_id)
            : await setProjectReview(projectId, status, body.remarks, admin.user_id, null, {
                  approvedHours: body.approvedHours,
                  payoutHours: body.payoutHours,
                  fraud: fraud,
                  wipe: wipe,
                  extraRemarks: body.remarks
              });

        if (!project) {
            return res.status(404).json({ ok: false, error: "not found" });
        }

        return res.status(200).json({
            ok: true,
            project: present(project),
            balanceHours: project.balance_hours ?? null,
            awardedHours: Number(project.awarded_hours) || 0,
            priorApproved: project.prior_approved ?? null,
            hoursDelta: project.hours_delta ?? null,
            seizedOrders: Number(project.seized_orders) || 0,
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
