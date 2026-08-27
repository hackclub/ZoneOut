import crypto from "node:crypto";
import { readEnv } from "./env.mjs";

// the encryption key, resolved on first use so importing this never breaks an
// unrelated route on a deployment where hackatime is not configured yet
let cachedKey = null;

function key() {
    if (cachedKey) return cachedKey;

    const raw = readEnv("HACKATIME_TOKEN_KEY", { required: false });
    if (!raw) {
        throw new Error(
            "HACKATIME_TOKEN_KEY is not set. Generate one with " +
            "`node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"`, " +
            "then add it to .env.local for local development, or with " +
            "`vercel env add HACKATIME_TOKEN_KEY` for a deployment. " +
            "Paste the value without surrounding quotes."
        );
    }

    cachedKey = decodeKey(raw);
    return cachedKey;
}

function decodeKey(raw) {
    for (const encoding of ["base64", "hex"]) {
        let bytes;
        try {
            bytes = Buffer.from(raw, encoding);
        } catch {
            continue;
        }
        if (bytes.length === 32) return bytes;
    }

    throw new Error(
        "HACKATIME_TOKEN_KEY must decode to exactly 32 bytes, as base64 or hex. " +
        "Generate one with `node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"`."
    );
}

// format
const VERSION = "v1";
const IV_BYTES = 12;

// seal
export function seal(plaintext) {
    if (typeof plaintext !== "string" || !plaintext) {
        throw new Error("seal requires a non-empty string");
    }

    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);

    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

// open
export function open(sealed) {
    if (typeof sealed !== "string" || !sealed) return null;

    const parts = sealed.split(".");
    if (parts.length !== 4 || parts[0] !== VERSION) return null;

    try {
        const iv = Buffer.from(parts[1], "base64url");
        const tag = Buffer.from(parts[2], "base64url");
        const ciphertext = Buffer.from(parts[3], "base64url");

        if (iv.length !== IV_BYTES || tag.length !== 16) return null;

        const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
        decipher.setAuthTag(tag);

        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
        return null;
    }
}
