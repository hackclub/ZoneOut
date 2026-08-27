import { requireUser } from "../../lib/guard.mjs";
import { readToken, fetchProjectStats } from "../../lib/hackatime.mjs";
import { listHackatimeLinks } from "../../lib/users.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // session
    const user = await requireUser(req, res);
    if (!user) return;

    // method
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    if (!user.hackatime_user_id) {
        return res.status(200).json({ ok: true, linked: false, projects: [] });
    }

    try {
        const token = await readToken(user.user_id);
        if (!token) {
            return res.status(200).json({ ok: true, linked: false, projects: [] });
        }

        const [projects, links] = await Promise.all([
            fetchProjectStats(token),
            listHackatimeLinks(user.user_id)
        ]);

        // which zoneout project already holds each name
        const held = new Map(
            links.map(row => [row.hackatime_project.toLowerCase(), row])
        );

        const annotated = projects.map(project => {
            const owner = held.get(project.name.toLowerCase());
            return {
                ...project,
                linkedTo: owner ? { projectId: owner.project_id, name: owner.name } : null
            };
        });

        return res.status(200).json({ ok: true, linked: true, projects: annotated });
    } catch (err) {
        console.error("hackatime project list failed:", err.message);
        return res.status(503).json({ ok: false, error: "hackatime unreachable" });
    }
}
