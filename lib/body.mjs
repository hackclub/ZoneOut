const MAX_BODY_BYTES = 64 * 1024;

// error type
export class BadRequest extends Error {
    constructor(message) {
        super(message);
        this.name = "BadRequest";
    }
}

// JSON body, capped at MAX_BODY_BYTES
export async function readJsonBody(req) {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
        return req.body;
    }

    let raw = req.body;

    if (Buffer.isBuffer(raw)) {
        raw = raw.toString("utf8");
    } else if (typeof raw !== "string") {
        raw = await readStream(req);
    }

    if (!raw || !raw.trim()) return {};

    try {
        const parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new BadRequest("expected a JSON object");
        }
        return parsed;
    } catch (err) {
        if (err instanceof BadRequest) throw err;
        throw new BadRequest("malformed JSON body");
    }
}

// stream reader
function readStream(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];

        req.on("data", chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new BadRequest("request body is too large"));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}
