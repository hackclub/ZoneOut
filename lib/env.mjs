// section for reading environment variables

function unquote(value) {
    const trimmed = value.trim();
    if (trimmed.length < 2) return trimmed;

    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' || first === "'") && first === last) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}

export function readEnv(name, { required = true } = {}) {
    const raw = process.env[name];
    const value = typeof raw === "string" ? unquote(raw) : "";

    if (!value) {
        if (!required) return undefined;
        throw new Error(
            `${name} is not set. Add it to .env.local for local development, ` +
            `or with \`vercel env add ${name}\` for a deployment. ` +
            `Paste the value without surrounding quotes.`
        );
    }
    return value;
}

export function hasEnv(name) {
    return readEnv(name, { required: false }) !== undefined;
}
