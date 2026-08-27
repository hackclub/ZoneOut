import { readSession } from "../../lib/session.mjs";
import { requireUser, resolveAdmin } from "../../lib/guard.mjs";
import { getProjectById, updateProjectForUser, deleteProjectForUser, updateProjectAsAdmin, deleteProjectAsAdmin, ValidationError } from "../../lib/users.mjs";
import { isAdminEmail } from "../../lib/admin.mjs";
import { resolveProjectLink } from "../../lib/hackatime.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";

// response shape
function present(project, ownerName) {
    return {
        projectId: project.project_id,
        ownerName: ownerName ?? project.owner_name ?? null,
        name: project.name,
        description: project.description,
        repoUrl: project.repo_url,
        demoUrl: project.demo_url,
        hackatimeProject: project.hackatime_project ?? null,
        hackatimeHours: project.hackatime_hours ?? 0,
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
        // public read
        const project = await getProjectById(projectId);
        if (!project) {
            return res.status(404).json({ ok: false, error: "not found" });
        }

        const session = readSession(req);
        const owns = Boolean(session) && session.userId === project.user_id;
        const isAdmin = Boolean(session) && !owns && Boolean(await resolveAdmin(req));

        return res.status(200).json({
            ok: true,
            project: present(project),
            canEdit: owns || isAdmin,
            isAdmin,
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

    try {
        let deleted = await deleteProjectForUser(user.user_id, projectId);

        if (!deleted && isAdminEmail(user.email)) {
            deleted = await deleteProjectAsAdmin(projectId);
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
