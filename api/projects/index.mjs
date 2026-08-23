import { requireUser } from "../../lib/guard.mjs";
import { createProject, listProjectsForUser, ValidationError } from "../../lib/users.mjs";
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
        const project = await createProject(user.user_id, {
            name: body.name,
            description: body.description,
            repoUrl: body.repoUrl,
            demoUrl: body.demoUrl
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
