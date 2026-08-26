// shared settings panel: the gear, the dialog and the theme picker
(function () {
"use strict";

var THEMES = [
    { id: "default",   label: "Default" },
    { id: "bw",        label: "Black n White" },
    { id: "fnaf",      label: "Black n White (FNAF)" },
    { id: "halloween", label: "Halloween" }
];

var META = { bw: "#0a0a0a", fnaf: "#000000", halloween: "#080402", "default": "#000000" };
var STORE_KEY = "zoneoutTheme";
var CLOSE_MS = 240;

// storage
function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {  }
}

function currentTheme() {
    var id = read(STORE_KEY);
    for (var i = 0; i < THEMES.length; i++) {
        if (THEMES[i].id === id) return id;
    }
    return "default";
}

function labelFor(id) {
    for (var i = 0; i < THEMES.length; i++) {
        if (THEMES[i].id === id) return THEMES[i].label;
    }
    return THEMES[0].label;
}

// click sound
function playClick() {
    var el = document.getElementById("uiClick");
    if (!el) return;

    var level = Number(read("zoneoutVolume"));
    if (!Number.isFinite(level) || level < 0 || level > 100) level = 35;

    try {
        el.currentTime = 0;
        el.volume = (level / 100) * 0.35;
        var p = el.play();
        if (p && p.catch) p.catch(function () {  });
    } catch (e) {  }
}

// gear icon
var GEAR_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="3.1"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 ' +
    '1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 ' +
    '1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 ' +
    '4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 ' +
    '0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 ' +
    '2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
    '</svg>';

// injected markup
var gear = document.createElement("button");
gear.className = "settingsGear";
gear.id = "settingsGear";
gear.type = "button";
gear.setAttribute("aria-haspopup", "dialog");
gear.setAttribute("aria-expanded", "false");
gear.setAttribute("aria-label", "Settings");
gear.innerHTML = GEAR_ICON;

var scrim = document.createElement("div");
scrim.className = "modalScrim";
scrim.id = "settingsModal";
scrim.hidden = true;

var card = document.createElement("div");
card.className = "modalCard settingsCard";
card.setAttribute("role", "dialog");
card.setAttribute("aria-modal", "true");
card.setAttribute("aria-labelledby", "settingsTitle");

var closeBtn = document.createElement("button");
closeBtn.className = "modalClose";
closeBtn.type = "button";
closeBtn.setAttribute("aria-label", "Close");
closeBtn.textContent = "×";

var title = document.createElement("div");
title.className = "settingsTitle";
title.id = "settingsTitle";
title.textContent = "SETTINGS";

var row = document.createElement("div");
row.className = "settingsRow";

var label = document.createElement("span");
label.className = "settingsLabel";
label.textContent = "Theme";

var arrow = document.createElement("span");
arrow.className = "settingsArrow";
arrow.textContent = "--->";

var wrap = document.createElement("div");
wrap.className = "themeWrap";

var themeBtn = document.createElement("button");
themeBtn.className = "camNode themeBtn";
themeBtn.type = "button";
themeBtn.setAttribute("aria-haspopup", "listbox");
themeBtn.setAttribute("aria-expanded", "false");
themeBtn.textContent = labelFor(currentTheme());

var menu = document.createElement("div");
menu.className = "themeMenu";
menu.setAttribute("role", "listbox");
menu.setAttribute("aria-label", "Theme");
menu.hidden = true;

wrap.appendChild(themeBtn);
wrap.appendChild(menu);
row.appendChild(label);
row.appendChild(arrow);
row.appendChild(wrap);
card.appendChild(closeBtn);
card.appendChild(title);
card.appendChild(row);
scrim.appendChild(card);

document.body.appendChild(gear);
document.body.appendChild(scrim);

// applying a theme
function applyTheme(id) {
    var root = document.documentElement;

    if (id === "default") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", id);

    write(STORE_KEY, id);

    var meta = document.querySelector("meta[name=\"theme-color\"]");
    if (meta) meta.content = META[id] || META["default"];

    themeBtn.textContent = labelFor(id);
    document.dispatchEvent(new CustomEvent("zoneout:themechange", { detail: { theme: id } }));
}

// the theme listbox
function menuOpen() {
    return !menu.hidden;
}

function buildMenu() {
    var active = currentTheme();
    menu.replaceChildren();

    THEMES.forEach(function (theme) {
        var option = document.createElement("button");
        option.className = "themeOption";
        option.type = "button";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", theme.id === active ? "true" : "false");
        option.textContent = theme.label;

        option.addEventListener("click", function () {
            playClick();
            applyTheme(theme.id);
            closeMenu(true);
        });

        menu.appendChild(option);
    });
}

function openMenu() {
    buildMenu();
    menu.hidden = false;
    themeBtn.setAttribute("aria-expanded", "true");

    var first = menu.querySelector("[aria-selected=\"true\"]") || menu.firstElementChild;
    if (first) first.focus();
}

function closeMenu(refocus) {
    if (menu.hidden) return;
    menu.hidden = true;
    themeBtn.setAttribute("aria-expanded", "false");
    if (refocus) themeBtn.focus();
}

function stepMenu(delta) {
    var options = Array.prototype.slice.call(menu.children);
    if (!options.length) return;

    var at = options.indexOf(document.activeElement);
    var next = at === -1
        ? (delta > 0 ? 0 : options.length - 1)
        : (at + delta + options.length) % options.length;

    options[next].focus();
}

function focusMenuEnd(last) {
    var options = Array.prototype.slice.call(menu.children);
    if (!options.length) return;
    options[last ? options.length - 1 : 0].focus();
}

// the dialog
var returnFocus = null;
var savedOverflow = "";
var inertSnapshot = null;

function isOpen() {
    return scrim.classList.contains("show");
}

function setInertBehind(on) {
    var kids = Array.prototype.slice.call(document.body.children);

    if (on) {
        inertSnapshot = kids.map(function (child) { return child.inert; });
        kids.forEach(function (child) {
            if (child !== scrim && child.tagName !== "SCRIPT") child.inert = true;
        });
        return;
    }

    if (!inertSnapshot) return;

    kids.forEach(function (child, i) {
        if (child !== scrim && child.tagName !== "SCRIPT" && i < inertSnapshot.length) {
            child.inert = inertSnapshot[i];
        }
    });
    inertSnapshot = null;
}

function open() {
    if (isOpen()) return;

    returnFocus = document.activeElement;
    themeBtn.textContent = labelFor(currentTheme());

    scrim.hidden = false;
    requestAnimationFrame(function () { scrim.classList.add("show"); });

    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    setInertBehind(true);
    gear.setAttribute("aria-expanded", "true");
    themeBtn.focus();
}

function close() {
    if (!isOpen()) return;

    closeMenu(false);
    scrim.classList.remove("show");
    setInertBehind(false);
    document.body.style.overflow = savedOverflow;
    gear.setAttribute("aria-expanded", "false");

    setTimeout(function () {
        if (!isOpen()) scrim.hidden = true;
    }, CLOSE_MS);

    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
}

gear.addEventListener("click", function () {
    playClick();
    open();
});

closeBtn.addEventListener("click", function () {
    playClick();
    close();
});

scrim.addEventListener("mousedown", function (e) {
    if (e.target === scrim) close();
});

themeBtn.addEventListener("click", function () {
    playClick();
    if (menuOpen()) closeMenu(true); else openMenu();
});

document.addEventListener("mousedown", function (e) {
    if (menuOpen() && !wrap.contains(e.target)) closeMenu(false);
});

// key containment
document.addEventListener("keydown", function (e) {
    if (!isOpen()) return;

    if (menuOpen()) {
        if (e.key === "ArrowDown") { e.preventDefault(); stepMenu(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); stepMenu(-1); }
        else if (e.key === "Home") { e.preventDefault(); focusMenuEnd(false); }
        else if (e.key === "End") { e.preventDefault(); focusMenuEnd(true); }
        else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (document.activeElement && document.activeElement.click) document.activeElement.click();
        } else if (e.key === "Escape") {
            e.preventDefault();
            closeMenu(true);
        }
        e.stopPropagation();
        return;
    }

    if (e.key === "Escape") {
        e.preventDefault();
        close();
    } else if (document.activeElement === themeBtn && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        openMenu();
    }

    e.stopPropagation();
}, true);

window.zoneoutSettings = {
    isOpen: isOpen,
    open: open,
    close: close,
    theme: currentTheme,
    apply: applyTheme
};
})();
