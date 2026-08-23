import { requireUser } from "../../lib/guard.mjs";
import { createSuggestion } from "../../lib/shop.mjs";
import { ValidationError } from "../../lib/users.mjs";
import { readJsonBody, BadRequest } from "../../lib/body.mjs";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    // method
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "method not allowed" });
    }

    // session
    const user = await requireUser(req, res);
    if (!user) return;

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

    try {
        const suggestion = await createSuggestion(user.user_id, body.itemName, body.reason);
        return res.status(200).json({ ok: true, suggestionId: suggestion.suggestionId });
    } catch (err) {
        if (err instanceof ValidationError) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        console.error("suggestion failed:", err.message);
        return res.status(503).json({ ok: false, error: "the shop could not reach ZoneOut" });
    }
}
