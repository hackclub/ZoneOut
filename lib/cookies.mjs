// section for cookie reading and writing

export function parseCookies(req) {
    const header = req.headers?.cookie;
    if (!header) return {};

    const out = {};
    for (const part of header.split(";")) {
        const eq = part.indexOf("=");
        if (eq < 1) continue;
        const name = part.slice(0, eq).trim();
        if (!name) continue;
        try {
            out[name] = decodeURIComponent(part.slice(eq + 1).trim());
        } catch {
            out[name] = part.slice(eq + 1).trim();
        }
    }
    return out;
}

export function isSecureRequest(req) {
    const headers = req?.headers ?? {};

    const forwarded = headers["x-forwarded-proto"];
    const proto = (Array.isArray(forwarded) ? forwarded[0] : forwarded);
    if (typeof proto === "string" && proto) {
        return proto.split(",")[0].trim().toLowerCase() === "https";
    }

    if (req?.socket?.encrypted) return true;

    const rawHost = Array.isArray(headers.host) ? headers.host[0] : headers.host;
    const hostname = typeof rawHost === "string" ? rawHost.split(",")[0].trim().split(":")[0] : "";
    return !(hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1");
}

export function serializeCookie(name, value, { maxAge, path = "/", sameSite = "Lax", httpOnly = true, secure = true } = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];

    if (httpOnly) parts.push("HttpOnly");
    if (secure) parts.push("Secure");
    if (maxAge !== undefined) {
        parts.push(`Max-Age=${maxAge}`);
        parts.push(`Expires=${new Date(Date.now() + maxAge * 1000).toUTCString()}`);
    }

    return parts.join("; ");
}

export function cookieName(base, secure) {
    return secure ? `__Host-${base}` : base;
}

export function readCookie(req, base) {
    const jar = parseCookies(req);
    return jar[`__Host-${base}`] ?? jar[base];
}

export function clearCookie(res, base, { secure }) {
    appendCookie(res, serializeCookie(base, "", { maxAge: 0, secure }));
    if (secure) {
        appendCookie(res, serializeCookie(`__Host-${base}`, "", { maxAge: 0, secure }));
    }
}

export function appendCookie(res, cookie) {
    const existing = res.getHeader("Set-Cookie");
    if (!existing) return res.setHeader("Set-Cookie", [cookie]);
    return res.setHeader("Set-Cookie", [].concat(existing, cookie));
}
