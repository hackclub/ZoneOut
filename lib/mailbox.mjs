// section for the mail every decision sends its owner

export const MAIL_COLUMNS = "title, body, actor_id, author_name, user_id";
export const MAIL_AUTHOR = "ZONEOUT";
export const NAME_SLOT = "{name}";

function block(lines) {
    return lines.filter(line => line !== null && line !== undefined && line !== "").join("\n\n");
}

// section for a review verdict
export function projectMail(status, { remarks = "", fraud = false, wipe = false } = {}) {
    const reason = typeof remarks === "string" ? remarks.trim() : "";

    if (status === "approved") {
        return {
            title: `${NAME_SLOT} was approved!`,
            body: block([
                `Your project **${NAME_SLOT}** has been approved.`,
                reason ? "### REMARKS" : "",
                reason,
                "Your approved hours are on the project page, and anything paid out is already on your balance."
            ])
        };
    }

    return {
        title: `${NAME_SLOT} was rejected`,
        body: block([
            fraud
                ? `Your project **${NAME_SLOT}** has been **permanently rejected**.`
                : `Your project **${NAME_SLOT}** was rejected.`,
            "### REASON",
            reason || "No reason was given.",
            wipe ? "Your balance and every pending order have been cleared." : "",
            fraud ? "" : "Fix what is named above and submit it again when it is ready."
        ])
    };
}

// section for a shop order verdict
export function orderMail(status) {
    if (status === "approved") {
        return {
            title: `${NAME_SLOT} was fulfilled!`,
            body: block([
                `Your order for **${NAME_SLOT}** has been fulfilled.`,
                "Keep an eye on the email and the Slack DMs on your ZoneOut account for the handover."
            ])
        };
    }

    return {
        title: `${NAME_SLOT} order was rejected`,
        body: `Your order for **${NAME_SLOT}** was rejected.`
    };
}
