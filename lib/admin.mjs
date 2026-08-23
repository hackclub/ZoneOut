import { readEnv } from "./env.mjs";

// the administrator allowlist, parsed once at import
const ADMIN_EMAILS = new Set(
    (readEnv("ADMIN_EMAILS", { required: false }) ?? "")
        .split(",")
        .map(entry => entry.trim().toLowerCase())
        .filter(Boolean)
);

if (ADMIN_EMAILS.size === 0) {
    console.warn(
        "ADMIN_EMAILS is not set, so /admin is closed to everyone. " +
        "Add a comma separated list of administrator email addresses."
    );
}

// membership
export function isAdminEmail(email) {
    if (typeof email !== "string" || !email) return false;
    return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

export function hasAdmins() {
    return ADMIN_EMAILS.size > 0;
}
