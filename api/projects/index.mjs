import { requireUser } from "../../lib/guard.mjs";
import { createProject, listProjectsForUser, ValidationError } from "../../lib/users.mjs";
import { resolveProjectLink } from "../../lib/hackatime.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";

// response shape
function present(project) {
    return {
        projectId: project.project_id,
        ownerName: project.owner_name ?? null,
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

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // method
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") {
        res.setHeader("Allow", "GET, HEAD, POST");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // session
    const user = await requireUser(req, res);
    if (!user) return;

    // list
    if (req.method !== "POST") {
        try {
            const projects = await listProjectsForUser(user.user_id);
            return res.status(200).json({ ok: true, projects: projects.map(present) });
        } catch (err) {
            console.error("project list failed:", err.message);
            return res.status(503).json({ ok: false, error: "database unreachable" });
        }
    }

    // create
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
        // the provider decides whether the link is real, not the form
        const link = await resolveProjectLink(user, body.hackatimeProject);

        const project = await createProject(user.user_id, {
            name: body.name,
            description: body.description,
            repoUrl: body.repoUrl,
            demoUrl: body.demoUrl,
            hackatimeProject: link.hackatimeProject,
            hackatimeHours: link.hackatimeHours
        });

        return res.status(201).json({ ok: true, project: present(project) });
    } catch (err) {
        if (err instanceof ValidationError) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        console.error("project create failed:", err.message);
        return res.status(503).json({ ok: false, error: "database unreachable" });
    }
}
