import { resolveAdmin } from "../../lib/guard.mjs";
import { ADMIN_PAGE, NOT_FOUND_PAGE } from "../../lib/adminPage.mjs";

// html response
function sendHtml(res, status, html) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(status);
    return res.end(html);
}

// this page's own security policy
const ADMIN_CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'"
].join("; ");

export default async function handler(req, res) {
    // headers
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");

    res.setHeader("Content-Security-Policy", ADMIN_CSP);
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");

    res.setHeader("Referrer-Policy", "no-referrer");

    // method
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return sendHtml(res, 404, NOT_FOUND_PAGE);
    }

    // admin gate, 404 for everyone else
    const admin = await resolveAdmin(req);
    if (!admin) return sendHtml(res, 404, NOT_FOUND_PAGE);

    return sendHtml(res, 200, ADMIN_PAGE);
}
