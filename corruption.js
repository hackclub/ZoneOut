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
var MAX_GLITCH = 5;

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
    if (typeof saved.glitchAt !== "number") saved.glitchAt = Math.random() * GLITCH_WINDOW_MS;
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
    return { enabled: false, intensity: 0, beat: BEAT_MS, ramp: 1, meter: 0, glitch: 0 };
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
        ramp: bounded(raw.ramp, 0.05, 20, 1),
        meter: bounded(raw.meter, 0, 100, 0),
        glitch: bounded(raw.glitch, 0, MAX_GLITCH, 0)
    };
}

function publishConfig(payload) {
    var next = payload || {};
    var was = config ? config.beat : null;

    config = shapeConfig({
        enabled: next.fxEnabled,
        intensity: next.fxIntensity,
        beat: Number(next.fxBeatSeconds) * 1000,
        ramp: next.fxLevelScale,
        meter: next.corruptionPercent,
        glitch: next.fxGlitch
    });

    writeStore("sessionStorage", CONFIG_KEY, {
        enabled: config.enabled,
        intensity: config.intensity,
        beat: config.beat,
        ramp: config.ramp,
        meter: config.meter,
        glitch: config.glitch,
        at: Date.now()
    });

    // the poll republishes every few seconds, so only a real change may restart the beat
    if (was !== config.beat && beatTimer) schedule();
    openOnce();
    glitchWake();
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

// section for glitch mode, scaled by the corruption meter
var GLITCH_FLOOR = 0.03;
var GLITCH_TICK_MS = 250;
var GLITCH_SCAN_MS = 1500;
var GLITCH_BURST_MS = 12000;
var GLITCH_BURST_LEVEL = 2.4;
var GLITCH_WINDOW_MS = 30000;
var GLITCH_EPISODE_MS = 12000;
var GLITCH_CHANCE = 0.5;
var SWEEP_GAP_MS = 7000;
var SWELL_MS = 700;
var FILTER_MAX = 8;
var FILTER_GAP_MS = 80;
var SWELL_STEPS = [[0, 0.55], [140, 1], [380, 0.45], [SWELL_MS, 0]];
var GLITCH_SKIP = "script,style,link,meta,noscript,template,br,video,audio,source,iframe,canvas,"
    + ".fxFlash,.fxFlash *,.fxBorder,.sigRoll,.sigTear";
var GLITCH_PARTS = "button,a,h1,h2,h3,h4,h5,h6,p,li,label,img,svg,input,textarea,select,"
    + "th,td,dt,dd,summary,figcaption,[role=button],[role=switch],.camNode";

var glitch = {
    timer: null,
    frame: 0,
    sweeps: [],
    parts: null,
    partsAt: 0,
    nextSweep: 0,
    burstUntil: 0,
    episodeUntil: 0,
    roll: null,
    text: false,
    textNext: 0,
    swellGen: 0,
    shadow: "",
    rollOpacity: "",
    touched: new Map()
};

function glitchStrength() {
    var now = Date.now();
    if (now < glitch.burstUntil) return calm() ? GLITCH_BURST_LEVEL * 0.5 : GLITCH_BURST_LEVEL;
    return now < glitch.episodeUntil ? meterStrength() : 0;
}

function meterStrength() {
    if (!config || !config.enabled || !host || !allows("glitch")) return 0;
    if (typeof host.viewer !== "function" || !host.viewer()) return 0;
    var level = (config.meter / 100) * config.glitch;
    return calm() ? level * 0.5 : level;
}

function glitchQuiet() {
    if (document.hidden || scaring) return true;
    if (window.zoneoutCutscene && window.zoneoutCutscene.isOpen()) return true;
    if (document.querySelector(".screenVeil.on")) return true;
    return Boolean(host && typeof host.quiet === "function" && host.quiet());
}

function glitchWake() {
    if (glitch.timer) return;
    glitch.nextSweep = Date.now() + 1500;
    glitchTick();
}

// section for the one roll inside the first thirty seconds
function glitchDue(now) {
    if (state.glitchSpent) return;
    var dwell = now - state.start;
    if (dwell < state.glitchAt) return;
    if (dwell > GLITCH_WINDOW_MS) {
        state.glitchSpent = true;
        saveState();
        return;
    }
    if (glitchQuiet() || meterStrength() < GLITCH_FLOOR) return;

    state.glitchSpent = true;
    saveState();
    if (Math.random() >= Math.min(GLITCH_CHANCE * config.glitch, 1)) return;
    glitch.episodeUntil = now + GLITCH_EPISODE_MS;
    glitch.nextSweep = now;
}

function glitchTick() {
    glitch.timer = setTimeout(glitchTick, GLITCH_TICK_MS);
    glitchDue(Date.now());

    var level = glitchStrength();
    var shown = glitchQuiet() ? 0 : level;
    paintRoll(shown);
    paintText(shown);
    if (shown < GLITCH_FLOOR) return;

    var now = Date.now();
    if (now >= glitch.nextSweep) {
        spawnSweep(level);
        glitch.nextSweep = now + SWEEP_GAP_MS / (0.35 + Math.min(level, MAX_GLITCH)) * (0.5 + Math.random());
    }
}

// section for the rolling bar across the whole screen
function paintRoll(level) {
    var show = level >= GLITCH_FLOOR && !stillPrefers();
    if (!show && !glitch.roll) return;

    if (!glitch.roll) {
        glitch.roll = document.createElement("div");
        glitch.roll.className = "sigRoll";
        glitch.roll.setAttribute("aria-hidden", "true");
        document.body.appendChild(glitch.roll);
    }

    var opacity = show ? Math.min(0.25 + level * 0.3, 1).toFixed(2) : "0";
    if (opacity === glitch.rollOpacity) return;
    glitch.rollOpacity = opacity;
    glitch.roll.hidden = !show;
    glitch.roll.style.opacity = opacity;
}

// section for the standing text split, swelling now and then
function paintText(level) {
    var root = document.documentElement;
    if (level < GLITCH_FLOOR) {
        if (glitch.text) {
            root.classList.remove("sigText");
            document.body.style.textShadow = "";
            glitch.shadow = "";
            glitch.swellGen++;
        }
        glitch.text = false;
        return;
    }

    var now = Date.now();
    var t = 1.2 + Math.min(level, 3) * 2;
    if (!glitch.text) {
        root.classList.add("sigText");
        glitch.text = true;
        writePose(restPose(t));
        glitch.textNext = now + 1500;
    }
    if (now < glitch.textNext) return;

    var swell = !stillPrefers();
    if (swell) swellText(t);
    else writePose(restPose(t));
    glitch.textNext = now + SWELL_MS + (1500 + Math.random() * 2500) / (0.5 + Math.min(level, 3));
}

function restPose(t) {
    return [t * 0.7, 0, -t * 0.7, 0, 0, t * 0.25];
}

function peakPose(t) {
    function jolt(scale) { return (0.6 + Math.random() * 1.4) * scale; }
    var side = Math.random() < 0.5 ? -1 : 1;
    return [
        jolt(t) * side, (Math.random() - 0.5) * t * 0.6,
        -jolt(t) * side, (Math.random() - 0.5) * t * 0.6,
        (Math.random() - 0.5) * t, jolt(t * 0.5) * (Math.random() < 0.5 ? -1 : 1)
    ];
}

function mixPose(a, b, k) {
    return a.map(function (v, i) { return v + (b[i] - v) * k; });
}

function swellText(t) {
    var rest = restPose(t);
    var peak = peakPose(t);
    var gen = ++glitch.swellGen;
    SWELL_STEPS.forEach(function (step) {
        setTimeout(function () {
            if (gen !== glitch.swellGen || !glitch.text) return;
            writePose(mixPose(rest, peak, step[1]));
        }, step[0]);
    });
}

function writePose(p) {
    function px(v) { return v.toFixed(1) + "px"; }
    var shadow = px(p[0]) + " " + px(p[1]) + " rgba(var(--sigA),0.7), "
        + px(p[2]) + " " + px(p[3]) + " rgba(var(--sigB),0.7), "
        + px(p[4]) + " " + px(p[5]) + " rgba(var(--sigC),0.45)";
    if (shadow === glitch.shadow) return;
    glitch.shadow = shadow;
    document.body.style.textShadow = shadow;
}

// section for the parts that can glitch, outermost first
function ownText(el) {
    for (var node = el.firstChild; node; node = node.nextSibling) {
        if (node.nodeType === 3 && node.nodeValue.trim()) return true;
    }
    return false;
}

function typing(el) {
    var active = document.activeElement;
    if (!active || !el.contains(active)) return false;
    var tag = active.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable;
}

function glitchParts() {
    var now = Date.now();
    if (glitch.parts && now - glitch.partsAt < GLITCH_SCAN_MS) return glitch.parts;

    var picked = [];
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var big = vw * vh * 0.45;
    var scroll = window.scrollY;
    var F = NodeFilter;

    var scope = document.querySelector(".modalScrim.show") || document.body;
    var walker = document.createTreeWalker(scope, F.SHOW_ELEMENT, { acceptNode: function (el) {
        if (el.hidden || el.matches(GLITCH_SKIP)) return F.FILTER_REJECT;
        if (!el.getClientRects().length && getComputedStyle(el).display !== "contents") return F.FILTER_REJECT;
        if (!el.matches(GLITCH_PARTS) && !ownText(el)) return F.FILTER_SKIP;

        var rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return F.FILTER_SKIP;
        if (rect.bottom < -40 || rect.top > vh + 40 || rect.right < 0 || rect.left > vw) return F.FILTER_SKIP;
        if (rect.width * rect.height > big) return F.FILTER_SKIP;
        if (typing(el)) return F.FILTER_SKIP;

        var kept = glitch.touched.get(el);
        var base = kept ? null : getComputedStyle(el).filter;
        picked.push({
            el: el,
            top: rect.top + scroll,
            bottom: rect.bottom + scroll,
            phase: Math.random() * Math.PI * 2,
            base: kept ? kept.base : (base && base !== "none" ? base + " " : "")
        });
        return F.FILTER_REJECT;
    } });
    while (walker.nextNode()) {}

    glitch.parts = picked;
    glitch.partsAt = now;
    return picked;
}

// section for the tracking sweep, the only thing that distorts a component
function spawnSweep(level) {
    var parts = glitchParts();
    if (!parts.length) return;

    var strength = Math.min(level, 3);
    var tear = document.createElement("div");
    tear.className = "sigTear";
    tear.setAttribute("aria-hidden", "true");
    document.body.appendChild(tear);

    var ms = 1500 + Math.random() * 1300 - strength * 150;
    glitch.sweeps.push({
        parts: parts,
        tear: tear,
        start: performance.now(),
        ms: ms,
        half: 70 + Math.random() * 90 + strength * 24,
        amp: 5 + strength * 9,
        chroma: 2 + strength * 2.4,
        dir: Math.random() < 0.5 ? -1 : 1,
        down: Math.random() < 0.8
    });

    if (!glitch.frame) glitch.frame = requestAnimationFrame(glitchFrame);
    setTimeout(glitchSettle, ms + 120);
}

// section for the frame loop, with a timer beside it for a hidden tab
function glitchSettle() {
    var now = performance.now();
    glitch.sweeps = glitch.sweeps.filter(function (sweep) {
        if (now - sweep.start < sweep.ms) return true;
        sweep.tear.remove();
        return false;
    });
    if (!glitch.sweeps.length) glitchRelease(new Map());
}

function smooth(p) {
    return 0.5 - Math.cos(Math.PI * p) / 2;
}

function glitchFrame(now) {
    glitch.frame = 0;
    var hits = new Map();
    var vh = window.innerHeight;
    var scroll = window.scrollY;
    var secs = now / 1000;

    glitch.sweeps = glitch.sweeps.filter(function (sweep) {
        var p = (now - sweep.start) / sweep.ms;
        if (p >= 1) { sweep.tear.remove(); return false; }

        var eased = smooth(p);
        var from = -sweep.half * 1.5;
        var to = vh + sweep.half * 1.5;
        var y = sweep.down ? from + (to - from) * eased : to - (to - from) * eased;

        sweep.tear.style.transform = "translateY(" + y.toFixed(1) + "px)";
        sweep.tear.style.opacity = String(Math.sin(Math.PI * p));

        for (var i = 0; i < sweep.parts.length; i++) {
            var part = sweep.parts[i];
            var top = part.top - scroll;
            var bottom = part.bottom - scroll;
            var gap = Math.max(0, top - y, y - bottom);
            var weight = Math.exp(-(gap * gap) / (sweep.half * sweep.half));
            if (weight < 0.03) continue;

            var mid = (top + bottom) / 2;
            var wave = 0.5 * sweep.dir
                + 0.35 * Math.sin(mid * 0.035 + secs * 5.2 + part.phase * 0.3)
                + 0.15 * Math.sin(mid * 0.21 + secs * 17 + part.phase);
            addHit(hits, part, sweep.amp * weight * wave,
                weight * Math.sin(secs * 9 + part.phase) * 2, sweep.chroma * weight);
        }
        return true;
    });

    var ranked = [];
    hits.forEach(function (hit) { ranked.push(hit.chroma); });
    var cut = ranked.length > FILTER_MAX ? ranked.sort(function (a, b) { return b - a; })[FILTER_MAX - 1] : 0;
    hits.forEach(function (hit, el) {
        if (hit.chroma < cut) hit.chroma = 0;
        paintHit(el, hit, now);
    });
    glitchRelease(hits);

    if (glitch.sweeps.length) glitch.frame = requestAnimationFrame(glitchFrame);
}

function addHit(hits, part, x, y, chroma) {
    var hit = hits.get(part.el);
    if (!hit) { hits.set(part.el, { x: x, y: y, chroma: chroma, base: part.base }); return; }
    hit.x += x;
    hit.y += y;
    hit.chroma = Math.max(hit.chroma, chroma);
}

// section for writing a part and handing it back untouched
function paintHit(el, hit, now) {
    var kept = glitch.touched.get(el);
    if (!kept) {
        kept = {
            translate: el.style.translate,
            scale: el.style.scale,
            filter: el.style.filter,
            will: el.style.willChange,
            base: hit.base,
            chroma: -1,
            filterAt: 0
        };
        glitch.touched.set(el, kept);
        el.style.willChange = "translate, scale, filter";
    }

    var still = stillPrefers();
    var c = still ? Math.min(hit.chroma, 1.2) : hit.chroma;
    el.style.translate = still ? "0px 0px" : hit.x.toFixed(2) + "px " + hit.y.toFixed(2) + "px";
    el.style.scale = still ? kept.scale : (1 + c * 0.012).toFixed(3) + " " + (1 - c * 0.004).toFixed(3);

    c = c < 0.4 ? 0 : Math.round(c * 2) / 2;
    if (c === kept.chroma) return;
    if (c && kept.chroma > 0 && now - kept.filterAt < FILTER_GAP_MS) return;
    kept.chroma = c;
    kept.filterAt = now;
    if (!c) {
        el.style.filter = kept.filter;
        return;
    }

    var alpha = Math.min(0.35 + c * 0.1, 0.9).toFixed(2);
    el.style.filter = kept.base
        + "drop-shadow(" + c.toFixed(2) + "px 0 0 rgba(var(--sigA)," + alpha + ")) "
        + "drop-shadow(" + (-c).toFixed(2) + "px 0 0 rgba(var(--sigB)," + alpha + ")) "
        + "drop-shadow(0 " + (c * 0.6).toFixed(2) + "px 0 rgba(var(--sigC)," + alpha + ")) "
        + "hue-rotate(" + Math.round(c * 18) + "deg) saturate(" + (1 + c * 0.3).toFixed(2) + ") "
        + "contrast(" + (1 + c * 0.06).toFixed(2) + ")";
}

function glitchRelease(hits) {
    glitch.touched.forEach(function (kept, el) {
        if (hits.has(el)) return;
        el.style.translate = kept.translate;
        el.style.scale = kept.scale;
        el.style.filter = kept.filter;
        el.style.willChange = kept.will;
        glitch.touched.delete(el);
    });
}

// section for the admin burst, which ignores the meter and the kill switch
function glitchBurst() {
    glitch.burstUntil = Date.now() + GLITCH_BURST_MS;
    clearTimeout(glitch.timer);
    glitch.nextSweep = 0;
    glitchTick();
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
    glitchWake();
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
    if (id === "glitch") { glitchBurst(); return true; }
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
