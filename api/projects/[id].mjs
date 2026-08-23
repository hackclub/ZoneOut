import { readSession } from "../../lib/session.mjs";
import { requireUser } from "../../lib/guard.mjs";
import { getProjectById, updateProjectForUser, ValidationError } from "../../lib/users.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";

// response shape
function present(project) {
    return {
        projectId: project.project_id,
        name: project.name,
        description: project.description,
        repoUrl: project.repo_url,
        demoUrl: project.demo_url,
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
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "PATCH") {
        res.setHeader("Allow", "GET, HEAD, PATCH");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    const projectId = readProjectId(req.query?.id);
    if (projectId === null) {
        return res.status(404).json({ ok: false, error: "not found" });
    }

    if (req.method === "PATCH") return edit(req, res, projectId);

    try {
        // public read
        const project = await getProjectById(projectId);
        if (!project) {
            return res.status(404).json({ ok: false, error: "not found" });
        }

        const session = readSession(req);
        const canEdit = Boolean(session) && session.userId === project.user_id;

        return res.status(200).json({ ok: true, project: present(project), canEdit });
    } catch (err) {
        console.error("project lookup failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}

// PATCH, owner only
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

    try {
        const project = await updateProjectForUser(projectId, user.user_id, {
            name: body.name,
            description: body.description,
            repoUrl: body.repoUrl,
            demoUrl: body.demoUrl
        });

        if (!project) {
            return res.status(404).json({ ok: false, error: "not found" });
        }

        return res.status(200).json({ ok: true, project: present(project), canEdit: true });
    } catch (err) {
        if (err instanceof ValidationError) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        console.error("project update failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
