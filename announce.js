// shared announcement markup renderer, used by /home and /admin
(function () {
"use strict";

// section for the inline marks
var INLINE = [
    { re: /\*\*([^*]+)\*\*/,      tag: "strong" },
    { re: /__([^_]+)__/,          tag: "u" },
    { re: /~~([^~]+)~~/,          tag: "s" },
    { re: /`([^`]+)`/,            tag: "code", cls: "annCode" },
    { re: /\*([^*\n]+)\*/,        tag: "em" },
    { re: /_([^_\n]+)_/,          tag: "em" }
];

var LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/;

function safeHref(url) {
    return /^https?:\/\//i.test(url) ? url : null;
}

// the innermost match wins, so **bold** is never eaten by *italic*
function firstMark(text) {
    var best = null;

    var link = LINK.exec(text);
    if (link) best = { at: link.index, len: link[0].length, label: link[1], href: link[2], link: true };

    for (var i = 0; i < INLINE.length; i++) {
        var hit = INLINE[i].re.exec(text);
        if (!hit) continue;
        if (best && hit.index >= best.at) continue;
        best = { at: hit.index, len: hit[0].length, label: hit[1],
                 tag: INLINE[i].tag, cls: INLINE[i].cls };
    }

    return best;
}

function inline(target, text) {
    var rest = String(text);

    while (rest) {
        var mark = firstMark(rest);
        if (!mark) break;

        if (mark.at > 0) target.appendChild(document.createTextNode(rest.slice(0, mark.at)));

        if (mark.link) {
            var href = safeHref(mark.href);
            if (href) {
                var a = document.createElement("a");
                a.href = href;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                inline(a, mark.label);
                target.appendChild(a);
            } else {
                target.appendChild(document.createTextNode(mark.label));
            }
        } else {
            var el = document.createElement(mark.tag);
            if (mark.cls) el.className = mark.cls;
            if (mark.tag === "code") el.textContent = mark.label; else inline(el, mark.label);
            target.appendChild(el);
        }

        rest = rest.slice(mark.at + mark.len);
    }

    if (rest) target.appendChild(document.createTextNode(rest));
}

function block(tag, cls, text) {
    var el = document.createElement(tag);
    el.className = cls;
    inline(el, text);
    return el;
}

// a single newline is a line break, the way it is typed
function paragraphBlock(lines) {
    var el = document.createElement("p");
    el.className = "annP";

    for (var i = 0; i < lines.length; i++) {
        if (i > 0) el.appendChild(document.createElement("br"));
        inline(el, lines[i]);
    }

    return el;
}

function render(text, target) {
    target.textContent = "";

    var lines = String(text == null ? "" : text).replace(/\r\n/g, "\n").split("\n");
    var paragraph = [];
    var list = null;

    function flushParagraph() {
        if (!paragraph.length) return;
        target.appendChild(paragraphBlock(paragraph));
        paragraph = [];
    }

    function flushList() {
        list = null;
    }

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();

        if (!line) { flushParagraph(); flushList(); continue; }

        if (/^(---|___|\*\*\*)$/.test(line)) {
            flushParagraph();
            flushList();
            var hr = document.createElement("hr");
            hr.className = "annHr";
            target.appendChild(hr);
            continue;
        }

        if (/^###\s+/.test(line)) {
            flushParagraph(); flushList();
            target.appendChild(block("h4", "annH3", line.replace(/^###\s+/, "")));
            continue;
        }

        if (/^##\s+/.test(line)) {
            flushParagraph(); flushList();
            target.appendChild(block("h3", "annH2", line.replace(/^##\s+/, "")));
            continue;
        }

        if (/^#\s+/.test(line)) {
            flushParagraph(); flushList();
            target.appendChild(block("h2", "annH1", line.replace(/^#\s+/, "")));
            continue;
        }

        if (/^>\s?/.test(line)) {
            flushParagraph(); flushList();
            target.appendChild(block("blockquote", "annQuote", line.replace(/^>\s?/, "")));
            continue;
        }

        if (/^[-*]\s+/.test(line)) {
            flushParagraph();
            if (!list || list.tagName !== "UL") {
                list = document.createElement("ul");
                list.className = "annList";
                target.appendChild(list);
            }
            list.appendChild(block("li", "annItem", line.replace(/^[-*]\s+/, "")));
            continue;
        }

        if (/^\d+[.)]\s+/.test(line)) {
            flushParagraph();
            if (!list || list.tagName !== "OL") {
                list = document.createElement("ol");
                list.className = "annList";
                target.appendChild(list);
            }
            list.appendChild(block("li", "annItem", line.replace(/^\d+[.)]\s+/, "")));
            continue;
        }

        flushList();
        paragraph.push(line);
    }

    flushParagraph();
    return target;
}

// section for the collapsed preview line
function summary(text, max) {
    var limit = max || 140;
    var lines = String(text == null ? "" : text).replace(/\r\n/g, "\n").split("\n");

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        if (/^(---|___|\*\*\*)$/.test(line)) continue;

        line = line.replace(/^#{1,3}\s+/, "").replace(/^>\s?/, "").replace(/^[-*]\s+/, "")
                   .replace(/^\d+[.)]\s+/, "");

        var holder = document.createElement("div");
        inline(holder, line);
        var plain = holder.textContent.trim();
        if (!plain) continue;

        return plain.length > limit ? plain.slice(0, limit - 1).trimEnd() + "…" : plain;
    }

    return "";
}

window.zoneoutAnnounce = { render: render, summary: summary };
})();
