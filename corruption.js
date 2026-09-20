(function () {
"use strict";

// section for the corruption assets
var MENU_TRACK = "https://cdn.hackclub.com/01a08bd7-7896-72b9-b3c2-f05140549e0f/entity_escape_aftermath.mp3";
var SCARE_IMAGE = "https://cdn.hackclub.com/01a0b31c-d98f-755a-9a1c-a0d46892d685/goomh.png";
var SCARE_SOUND = "https://cdn.hackclub.com/01a0b320-b96d-7045-b00b-6731e0686c7c/Circuit_jumpscare.mp3";

// section for the corruption schedule
var STATE_KEY = "zoneoutFx";
var CONFIG_KEY = "zoneoutFxCfg";
var CALM_KEY = "zoneoutFxCalm";
var STATE_VERSION = 1;
var CONFIG_STALE_MS = 600000;

var BEAT_MS = 45000;
var BEAT_JITTER = 0.34;
var LEVEL_AT = [0, 0, 60000, 210000];
var MAX_INTENSITY = 5;
var FADE_MS = 900;
var SCARE_MS = 700;
var SCARE_WAIT_MS = 700;
var OPENER_MS = 8000;

var EFFECTS = [
    { id: "border", level: 2, chance: 0.16, cooldown: 0, cap: 1 },
    { id: "node", level: 3, chance: 0.05, cooldown: 0, cap: 1 }
];

var PRESS_EFFECT = { id: "modal", level: 2, chance: 0.08, cooldown: 150000, cap: 2 };
var REOPEN_CHANCE = 0.3;

var host = null;
var state = null;
var config = null;
var beatTimer = null;
var openerTimer = null;
var border = null;
var scareAudio = null;
var primed = false;
var scaring = false;

// section for storage, which throws outright when site data is blocked
function readStore(store, key) {
    try {
        var raw = window[store].getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function writeStore(store, key, value) {
    try {
        window[store].setItem(key, JSON.stringify(value));
    } catch (e) {
    }
}

function loadState() {
    var saved = readStore("sessionStorage", STATE_KEY);
    if (!saved || saved.v !== STATE_VERSION || typeof saved.start !== "number") {
        saved = { v: STATE_VERSION, start: Date.now(), counts: {}, lasts: {} };
    }
    if (!saved.counts) saved.counts = {};
    if (!saved.lasts) saved.lasts = {};
    return saved;
}

function saveState() {
    writeStore("sessionStorage", STATE_KEY, state);
}

// section for the admin knobs, which fail closed when nothing is known
function loadConfig() {
    var saved = readStore("sessionStorage", CONFIG_KEY);
    if (!saved || typeof saved.at !== "number" || Date.now() - saved.at > CONFIG_STALE_MS) {
        return stockConfig();
    }
    return shapeConfig(saved);
}

function stockConfig() {
    return { enabled: false, intensity: 0, beat: BEAT_MS, ramp: 1 };
}

function bounded(value, min, max, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.min(Math.max(number, min), max);
}

function shapeConfig(raw) {
    return {
        enabled: raw.enabled === true,
        intensity: bounded(raw.intensity, 0, MAX_INTENSITY, 0),
        beat: bounded(raw.beat, 5000, 3600000, BEAT_MS),
        ramp: bounded(raw.ramp, 0.05, 20, 1)
    };
}

function publishConfig(payload) {
    var next = payload || {};
    var was = config ? config.beat : null;

    config = shapeConfig({
        enabled: next.fxEnabled,
        intensity: next.fxIntensity,
        beat: Number(next.fxBeatSeconds) * 1000,
        ramp: next.fxLevelScale
    });

    writeStore("sessionStorage", CONFIG_KEY, {
        enabled: config.enabled,
        intensity: config.intensity,
        beat: config.beat,
        ramp: config.ramp,
        at: Date.now()
    });

    // the poll republishes every few seconds, so only a real change may restart the beat
    if (was !== config.beat && beatTimer) schedule();
    openOnce();
}

// section for the reduce-effects preference
function calm() {
    try {
        if (window.localStorage.getItem(CALM_KEY) === "1") return true;
    } catch (e) {
    }
    return false;
}

function stillPrefers() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function setCalm(on) {
    try {
        if (on) window.localStorage.setItem(CALM_KEY, "1");
        else window.localStorage.removeItem(CALM_KEY);
    } catch (e) {
    }
}

// section for the level clock
function level() {
    if (!state) return 0;
    var dwell = Date.now() - state.start;
    var ramp = config ? config.ramp : 1;
    var found = 0;
    for (var i = 1; i < LEVEL_AT.length; i++) {
        if (dwell >= LEVEL_AT[i] * ramp) found = i;
    }
    return found;
}

function intensity() {
    var scale = config ? config.intensity : 0;
    return calm() ? scale * 0.5 : scale;
}

// section for the suppression set
function suppressed() {
    if (!config || !config.enabled || intensity() <= 0) return true;
    if (document.hidden) return true;
    if (!host) return true;
    if (window.zoneoutSettings && window.zoneoutSettings.isOpen()) return true;
    if (window.zoneoutCutscene && window.zoneoutCutscene.isOpen()) return true;
    if (scaring) return true;

    var active = document.activeElement;
    if (active) {
        var tag = active.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    }

    return host.busy();
}

// only one intrusion at a time, the music swap excepted
function occupied() {
    if (!state) return false;
    return (state.counts.border || 0) > 0 || (state.counts.node || 0) > 0;
}

function eligible(effect) {
    if (level() < effect.level) return false;
    if (occupied()) return false;
    if ((state.counts[effect.id] || 0) >= effect.cap) return false;
    var last = state.lasts[effect.id] || 0;
    if (effect.cooldown && Date.now() - last < effect.cooldown) return false;
    return true;
}

function spend(effect) {
    state.counts[effect.id] = (state.counts[effect.id] || 0) + 1;
    state.lasts[effect.id] = Date.now();
    saveState();
}

// section for the beat, which always ticks so a tab hidden at load still corrupts later
function beat() {
    schedule();

    if (level() >= 3) prime();
    if (suppressed()) return;

    for (var i = 0; i < EFFECTS.length; i++) {
        var effect = EFFECTS[i];
        if (!eligible(effect)) continue;
        if (Math.random() >= effect.chance * intensity()) continue;
        if (fire(effect.id)) {
            spend(effect);
            return;
        }
    }
}

function schedule() {
    clearTimeout(beatTimer);
    var period = config ? config.beat : BEAT_MS;
    beatTimer = setTimeout(beat, period + (Math.random() * 2 - 1) * BEAT_JITTER * period);
}

// section for the guaranteed opener, one music swap per session
function openOnce() {
    if (!state || state.opened || openerTimer) return;
    if (!config || !config.enabled || intensity() <= 0) return;

    openerTimer = setTimeout(function () {
        openerTimer = null;
        if (!state || state.opened) return;
        if (!config || !config.enabled || intensity() <= 0) return;
        if (!allows("music") || !swapMusic(false)) return;

        state.opened = true;
        state.counts.music = (state.counts.music || 0) + 1;
        saveState();
    }, OPENER_MS);
}

function fire(id) {
    if (!allows(id)) return false;
    if (id === "border") return showBorder();
    if (id === "node") return host.reveal ? host.reveal() : false;
    return false;
}

// section for the music swap
function ramp(el, to, ms, done) {
    var from = el.volume;
    var start = performance.now();
    var mine = (el.__fxGen || 0) + 1;
    el.__fxGen = mine;

    function settle() {
        if (el.__fxGen !== mine) return;
        el.volume = Math.min(Math.max(to, 0), 1);
        if (done) done();
    }

    function step(now) {
        if (el.__fxGen !== mine) return;
        var progress = Math.min((now - start) / ms, 1);
        el.volume = Math.min(Math.max(from + (to - from) * progress, 0), 1);
        if (progress < 1) requestAnimationFrame(step);
        else settle();
    }

    requestAnimationFrame(step);
    setTimeout(settle, ms + 200);
}

// once the music is wrong it stays wrong, on this page and every sub-page after it
function swapMusic(instant) {
    var bridge = window.zoneoutAudio;
    if (!bridge) return false;

    var main = bridge.main();
    var alt = bridge.alt();
    if (!main || !alt) return false;

    var target = bridge.level();
    if (!bridge.swapped()) {
        bridge.retire();
        bridge.setSwapped(true);
    }

    state.musicSwapped = true;
    saveState();

    if (alt.paused) {
        if (!instant) alt.currentTime = 0;
        alt.volume = 0;
        var playing = alt.play();
        if (playing && playing.catch) playing.catch(function () {});
    }

    if (instant) {
        alt.volume = target;
        main.volume = 0;
        main.pause();
        return true;
    }

    ramp(alt, target, FADE_MS);
    ramp(main, 0, FADE_MS, function () { main.pause(); });
    return true;
}

function restoreMusic() {
    var bridge = window.zoneoutAudio;
    if (!bridge || !bridge.swapped()) return;

    var main = bridge.main();
    var alt = bridge.alt();

    bridge.setSwapped(false);
    state.musicSwapped = false;
    saveState();

    main.volume = 0;
    var playing = main.play();
    if (playing && playing.catch) playing.catch(function () {});

    ramp(main, bridge.level(), FADE_MS);
    ramp(alt, 0, FADE_MS, function () { alt.pause(); });
}

// section for the red border overlay
function showBorder() {
    if (!border) {
        border = document.createElement("div");
        border.className = "fxBorder";
        border.setAttribute("aria-hidden", "true");
        document.body.appendChild(border);
    }

    border.hidden = false;
    var raise = function () { border.classList.add("on"); };
    requestAnimationFrame(raise);
    setTimeout(raise, 60);
    return true;
}

// section for the press-triggered modal
function press() {
    if (!host || typeof host.modal !== "function") return;
    if (suppressed()) return;
    if (!eligible(PRESS_EFFECT)) return;
    if (Math.random() >= PRESS_EFFECT.chance * intensity()) return;

    spend(PRESS_EFFECT);
    host.modal();
}

function revealed() {
    return Boolean(state && (state.counts.node || 0) > 0);
}

function reopens() {
    if (level() < 3) return false;
    if (stillPrefers() || calm()) return false;
    return Math.random() < REOPEN_CHANCE;
}

// section for the jumpscare assets, fetched only once the node can appear
function prime() {
    if (primed) return;
    primed = true;

    var image = new Image();
    image.src = SCARE_IMAGE;

    // detached from the page's audio block on purpose: no volume dock, no fades, no master level
    scareAudio = document.createElement("audio");
    scareAudio.preload = "auto";
    scareAudio.volume = 1;
    scareAudio.src = SCARE_SOUND;
}

function jumpscare() {
    if (scaring) return;
    scaring = true;
    prime();

    clearTimeout(beatTimer);

    var shown = false;
    var done = false;
    var flash = null;

    // the image lands with the first sample, never before it, and holds for exactly SCARE_MS
    function show() {
        if (shown) return;
        shown = true;

        flash = document.createElement("div");
        flash.className = "fxFlash";
        flash.setAttribute("role", "presentation");

        var art = document.createElement("img");
        art.className = "fxFlashImg";
        art.alt = "";
        art.src = SCARE_IMAGE;

        flash.appendChild(art);
        document.body.appendChild(flash);

        setTimeout(finish, SCARE_MS);
    }

    function finish() {
        if (done) return;
        done = true;

        if (flash) flash.remove();
        try { scareAudio.pause(); } catch (e) {}

        try { sessionStorage.setItem("zoneoutFadeIn", "1"); } catch (e) {}
        window.location.replace("/");
    }

    function bail() {
        show();
    }

    scareAudio.currentTime = 0;
    scareAudio.volume = 1;

    scareAudio.addEventListener("error", bail, { once: true });
    scareAudio.addEventListener("playing", show, { once: true });

    var playing = scareAudio.play();
    if (playing && playing.catch) playing.catch(bail);

    // never sit on a dark page waiting for audio that will not arrive
    setTimeout(function () { if (!shown) bail(); }, SCARE_WAIT_MS);
}

// section for the settings row
function mountRow() {
    var api = window.zoneoutSettings;
    if (!api || typeof api.addRow !== "function") return;

    var button = document.createElement("button");
    button.type = "button";
    button.className = "camNode settingsAction";
    button.id = "fxCalmBtn";
    button.setAttribute("role", "switch");

    function paint() {
        var on = calm();
        button.setAttribute("aria-checked", on ? "true" : "false");
        button.textContent = on ? "[X] REDUCED" : "[ ] REDUCED";
    }

    button.addEventListener("click", function () {
        setCalm(!calm());
        paint();
    });

    paint();

    var slot = document.createElement("div");
    slot.className = "settingsSlot";
    slot.appendChild(button);

    api.addRow("Corruption", slot);
}

// section for the page handshake
function register(page) {
    host = page || null;
    if (host && typeof host.busy !== "function") host.busy = function () { return false; };

    if (state.musicSwapped && allows("music")) swapMusic(true);

    schedule();
    openOnce();
}

function allows(id) {
    return !host || !host.effects || host.effects.indexOf(id) !== -1;
}

// section for the admin trigger, which ignores level, caps, cooldowns and suppression
function trigger(id) {
    if (id === "node" || id === "jumpscare") prime();
    if (id === "music") return swapMusic(false);
    if (id === "restore") { restoreMusic(); return true; }
    if (id === "border") return showBorder();
    if (id === "node") return host && host.reveal ? host.reveal() : false;
    if (id === "modal") {
        if (!host || typeof host.modal !== "function") return false;
        host.modal();
        return true;
    }
    if (id === "jumpscare") { jumpscare(); return true; }
    return false;
}

state = loadState();
config = loadConfig();
saveState();

document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && level() >= 3) prime();
});

if (window.zoneoutSettings && window.zoneoutSettings.ready) mountRow();
else document.addEventListener("zoneout:settingsready", mountRow, { once: true });

window.zoneoutCorruption = {
    ready: true,
    register: register,
    publishConfig: publishConfig,
    press: press,
    trigger: trigger,
    reopens: reopens,
    jumpscare: jumpscare,
    restoreMusic: restoreMusic,
    revealed: revealed,
    level: level,
    calm: calm,
    track: MENU_TRACK
};

document.dispatchEvent(new CustomEvent("zoneout:corruptionready"));
})();
