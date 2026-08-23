import crypto from "node:crypto";
import { readEnv } from "./env.mjs";

// the shared secret
const secret = readEnv("SESSION_SECRET", { required: false });

if (!secret) {
    throw new Error(
        "SESSION_SECRET is not set. Add it to .env.local for local development, " +
        "or with `vercel env add SESSION_SECRET` for a deployment. " +
        "Paste the value without surrounding quotes."
    );
}

if (secret.length < 32) {
    throw new Error("SESSION_SECRET is too short: it must be at least 32 characters.");
}

// domain separation
const PURPOSES = new Set(["session", "oauth-state"]);

function message(purpose, payload) {
    if (!PURPOSES.has(purpose)) {
        throw new Error(`unknown signing purpose: ${purpose}`);
    }
    return `${purpose}|${payload}`;
}

// sign and verify
export function sign(purpose, payload) {
    return crypto.createHmac("sha256", secret).update(message(purpose, payload)).digest("base64url");
}

export function verify(purpose, payload, signature) {
    if (typeof signature !== "string" || !signature) return false;

    const expected = Buffer.from(sign(purpose, payload));
    const supplied = Buffer.from(signature);
    if (expected.length !== supplied.length) return false;

    return crypto.timingSafeEqual(expected, supplied);
}

// nonces
export function randomToken(bytes = 16) {
    return crypto.randomBytes(bytes).toString("base64url");
}
