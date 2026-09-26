import {
    deleteProjectForUser,
    setBanState,
    setShadowBan,
    setCompletionGrantAccess,
    BAN_REASON_MAX
} from "./users.mjs";

// error type
export class CommandError extends Error {
    constructor(message) {
        super(message);
        this.name = "CommandError";
    }
}

// id parsing
function readId(raw, field) {
    if (!/^\d+$/.test(raw ?? "")) {
        throw new CommandError(`${field} must be a whole number, got "${raw ?? ""}"`);
    }
    const id = Number(raw);
    if (!Number.isSafeInteger(id) || id < 1) {
        throw new CommandError(`${field} is out of range`);
    }
    return id;
}

// DELETE / BAN / UNBAN / PS / UNPS / ACCESS / HACKATIME UPDATE grammar
export function parseCommand(line) {
    const raw = typeof line === "string" ? line.trim() : "";
    if (!raw) throw new CommandError("empty command");
    if (raw.length > 1000) throw new CommandError("command is too long");

    if (/^HACKATIME\s+UPDATE$/i.test(raw)) {
        return { verb: "HACKATIME", raw };
    }

    const access = raw.match(/^(\d+)\s+ACCESS\s+CG\s+(TRUE|FALSE)$/i);
    if (access) {
        return {
            verb: "ACCESS",
            raw,
            userId: readId(access[1], "user_id"),
            grant: access[2].toLowerCase() === "true"
        };
    }

    const match = raw.match(/^(\S+)\s*([\s\S]*)$/);
    const verb = match[1].toUpperCase();
    const rest = match[2].trim();

    if (verb === "DELETE") {
        const parts = rest.split(/\s+/).filter(Boolean);
        if (parts.length !== 2) {
            throw new CommandError("usage: DELETE <user_id> <project_id>");
        }
        return {
            verb: "DELETE",
            raw,
            userId: readId(parts[0], "user_id"),
            projectId: readId(parts[1], "project_id")
        };
    }

    if (verb === "BAN") {
        const parts = rest.match(/^(\S+)\s+([\s\S]+)$/);
        if (!parts) throw new CommandError("usage: BAN <user_id> <reason>");

        const reason = parts[2].trim().replace(/\s+/g, " ");
        if (!reason) throw new CommandError("a ban needs a reason");
        if (reason.length > BAN_REASON_MAX) {
            throw new CommandError(`the reason must be ${BAN_REASON_MAX} characters or fewer`);
        }
        return { verb: "BAN", raw, userId: readId(parts[1], "user_id"), reason };
    }

    if (verb === "UNBAN") {
        const parts = rest.split(/\s+/).filter(Boolean);
        if (parts.length !== 1) throw new CommandError("usage: UNBAN <user_id>");
        return { verb: "UNBAN", raw, userId: readId(parts[0], "user_id") };
    }

    if (verb === "PS") {
        const parts = rest.split(/\s+/).filter(Boolean);
        if (parts.length !== 1 && parts.length !== 2) {
            throw new CommandError("usage: PS <user_id> [project_id]");
        }
        return {
            verb,
            raw,
            userId: readId(parts[0], "user_id"),
            projectId: parts[1] ? readId(parts[1], "project_id") : null
        };
    }

    if (verb === "UNPS") {
        const parts = rest.split(/\s+/).filter(Boolean);
        if (parts.length !== 1) throw new CommandError("usage: UNPS <user_id>");
        return { verb, raw, userId: readId(parts[0], "user_id") };
    }

    throw new CommandError(
        `unknown command "${match[1]}". ` +
        "Try DELETE, BAN, UNBAN, PS, UNPS, HACKATIME UPDATE or <user_id> ACCESS CG true/false."
    );
}

// application
export async function applyCommand(command, client, actorId = null) {
    if (command.verb === "DELETE") {
        const gone = await deleteProjectForUser(command.userId, command.projectId, client, actorId);
        if (!gone) {
            throw new CommandError(
                `no project ${command.projectId} belonging to user ${command.userId}`
            );
        }
        return `deleted project ${command.projectId} from user ${command.userId}`;
    }

    if (command.verb === "BAN") {
        const user = await setBanState(command.userId, true, command.reason, client, actorId);
        if (!user) throw new CommandError(`no user ${command.userId}`);
        return `banned user ${command.userId}`;
    }

    if (command.verb === "UNBAN") {
        const user = await setBanState(command.userId, false, null, client, actorId);
        if (!user) throw new CommandError(`no user ${command.userId}`);
        return `unbanned user ${command.userId}`;
    }

    if (command.verb === "PS" || command.verb === "UNPS") {
        const on = command.verb === "PS";
        const user = await setShadowBan(command.userId, on, client, actorId, command.projectId ?? null);
        if (!user) throw new CommandError(`no user ${command.userId}`);
        if (on && command.projectId && user.shadow_project_id !== command.projectId) {
            throw new CommandError(`project ${command.projectId} does not belong to user ${command.userId}`);
        }
        return (on ? "shadow banned" : "lifted the shadow ban on") + ` user ${command.userId}`;
    }

    if (command.verb === "ACCESS") {
        const user = await setCompletionGrantAccess(command.userId, command.grant, client, actorId);
        if (!user) throw new CommandError(`no user ${command.userId}`);
        return (command.grant ? "granted" : "revoked") +
               ` completion grant access for user ${command.userId}`;
    }

    throw new CommandError(`unknown command ${command.verb}`);
}
