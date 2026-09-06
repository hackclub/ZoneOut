import crypto from "node:crypto";
import { readEnv } from "./env.mjs";

// the encryption keys, resolved on first use
const cachedKeys = new Map();

function key(name) {
    const cached = cachedKeys.get(name);
    if (cached) return cached;

    const raw = readEnv(name, { required: false });
    if (!raw) {
        throw new Error(
            `${name} is not set. Generate one with ` +
            "`node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"`, " +
            "then add it to .env.local for local development, or with " +
            `\`vercel env add ${name}\` for a deployment. ` +
            "Paste the value without surrounding quotes."
        );
    }

    const decoded = decodeKey(raw, name);
    cachedKeys.set(name, decoded);
    return decoded;
}

function decodeKey(raw, name) {
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
        `${name} must decode to exactly 32 bytes, as base64 or hex. ` +
        "Generate one with `node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"`."
    );
}

// format
const VERSION = "v1";
const IV_BYTES = 12;

// domain separation
const PURPOSES = new Set(["hackatime-token", "submit-profile", "submit-ref"]);

function aad(purpose, scope) {
    if (!PURPOSES.has(purpose)) {
        throw new Error(`unknown sealing purpose: ${purpose}`);
    }
    return Buffer.from(scope ? `${purpose}|${VERSION}|${scope}` : `${purpose}|${VERSION}`, "utf8");
}

// seal
function seal(plaintext, keyName, purpose, scope) {
    if (typeof plaintext !== "string" || !plaintext) {
        throw new Error("seal requires a non-empty string");
    }

    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv("aes-256-gcm", key(keyName), iv);
    cipher.setAAD(aad(purpose, scope));

    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

// open
function open(sealed, keyName, purpose, scope, { legacy = false } = {}) {
    if (typeof sealed !== "string" || !sealed) return null;

    const parts = sealed.split(".");
    if (parts.length !== 4 || parts[0] !== VERSION) return null;

    let iv, tag, ciphertext;
    try {
        iv = Buffer.from(parts[1], "base64url");
        tag = Buffer.from(parts[2], "base64url");
        ciphertext = Buffer.from(parts[3], "base64url");
    } catch {
        return null;
    }

    if (iv.length !== IV_BYTES || tag.length !== 16) return null;

    const attempts = legacy ? [aad(purpose, scope), null] : [aad(purpose, scope)];

    for (const extra of attempts) {
        try {
            const decipher = crypto.createDecipheriv("aes-256-gcm", key(keyName), iv);
            if (extra) decipher.setAAD(extra);
            decipher.setAuthTag(tag);

            return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
        } catch {
            continue;
        }
    }

    return null;
}

// hackatime access tokens
export function sealToken(plaintext) {
    return seal(plaintext, "HACKATIME_TOKEN_KEY", "hackatime-token");
}

export function openToken(sealed) {
    return open(sealed, "HACKATIME_TOKEN_KEY", "hackatime-token", null, { legacy: true });
}

// submission profile, bound to the row it belongs to
export function sealProfile(plaintext, userId) {
    return seal(plaintext, "PII_KEY", "submit-profile", String(userId));
}

export function openProfile(sealed, userId) {
    return open(sealed, "PII_KEY", "submit-profile", String(userId));
}

// the submission reference carried through the form
export function sealRef(plaintext) {
    return seal(plaintext, "PII_KEY", "submit-ref");
}

export function openRef(sealed) {
    return open(sealed, "PII_KEY", "submit-ref");
}
