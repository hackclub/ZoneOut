(function () {
"use strict";

// section for the cutscene replay
var VIDEO_URL = "https://user-cdn.hackclub-assets.com/01a08b30-7fec-707c-941c-4fae1a0282e2/entityevent.mp4";
var FADE_MS = 400;
var RETRY_MS = 4000;
var BAIL_MS = 20000;

var scrim = null;
var video = null;
var closeBtn = null;
var waiting = null;
var retryTimer = 0;
var active = false;
var inertSnapshot = null;
var scrollLock = "";
var returnFocus = null;
var bailTimer = 0;
var paused = [];

function build() {
    if (scrim) return;

    scrim = document.createElement("div");
    scrim.className = "replayScrim";
    scrim.id = "replayScrim";
    scrim.setAttribute("role", "dialog");
    scrim.setAttribute("aria-modal", "true");
    scrim.setAttribute("aria-label", "Cutscene");
    scrim.hidden = true;

    video = document.createElement("video");
    video.className = "replayVideo";
    video.playsInline = true;
    video.preload = "none";
    video.setAttribute("disableremoteplayback", "");

    var source = document.createElement("source");
    source.src = VIDEO_URL;
    source.type = "video/mp4";
    video.appendChild(source);

    waiting = document.createElement("div");
    waiting.className = "replayWaiting";
    waiting.textContent = "LOADING";
    waiting.hidden = true;

    closeBtn = document.createElement("button");
    closeBtn.className = "replayClose";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close the cutscene");
    closeBtn.textContent = "SKIP";

    scrim.appendChild(video);
    scrim.appendChild(waiting);
    scrim.appendChild(closeBtn);
    document.body.appendChild(scrim);

    closeBtn.addEventListener("click", function () { close("skip"); });
    video.addEventListener("ended", function () { close("ended"); });
    video.addEventListener("error", function () { close("error"); });

    video.addEventListener("progress", armBail);
    video.addEventListener("loadedmetadata", armBail);

    video.addEventListener("playing", function () {
        clearTimeout(bailTimer);
        clearTimeout(retryTimer);
        waiting.hidden = true;
    });
}

// the clip is fetched cold, so the bail only fires once the download has genuinely stalled
function armBail() {
    if (!isOpen()) return;

    clearTimeout(bailTimer);
    bailTimer = setTimeout(function () {
        if (video.readyState < 2) close("error");
    }, BAIL_MS);
}

function kick() {
    if (!isOpen() || video.readyState >= 2) return;

    if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) video.load();

    var again = video.play();
    if (again && again.catch) again.catch(function () {});

    retryTimer = setTimeout(kick, RETRY_MS);
}

function isOpen() {
    return active;
}

// nothing else decodes while the cutscene is on screen
function hushClips() {
    paused = [];
    var clips = document.querySelectorAll("video");

    for (var i = 0; i < clips.length; i++) {
        if (clips[i] === video || clips[i].paused) continue;
        clips[i].pause();
        paused.push(clips[i]);
    }
}

function wakeClips() {
    for (var i = 0; i < paused.length; i++) {
        var playing = paused[i].play();
        if (playing && playing.catch) playing.catch(function () {});
    }
    paused = [];
}

function setInertBehind(on) {
    var kids = Array.prototype.slice.call(document.body.children);
    var i;

    if (on) {
        inertSnapshot = kids.map(function (child) { return child.inert; });
        for (i = 0; i < kids.length; i++) {
            if (kids[i] !== scrim && kids[i].tagName !== "SCRIPT") kids[i].inert = true;
        }
        return;
    }

    if (!inertSnapshot) return;

    for (i = 0; i < kids.length; i++) {
        if (kids[i] !== scrim && kids[i].tagName !== "SCRIPT" && i < inertSnapshot.length) {
            kids[i].inert = inertSnapshot[i];
        }
    }

    inertSnapshot = null;
}

function play() {
    build();
    if (active) return;

    active = true;
    returnFocus = document.activeElement;

    scrim.hidden = false;
    void scrim.offsetHeight;

    var raise = function () { scrim.classList.add("show"); };
    requestAnimationFrame(raise);
    setTimeout(raise, 60);

    scrollLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    setInertBehind(true);
    hushClips();

    video.preload = "auto";
    video.muted = false;
    video.volume = 1;
    if (video.readyState === 0) video.load();
    if (video.currentTime > 0.05) video.currentTime = 0;

    waiting.hidden = video.readyState >= 2;

    var started = video.play();
    if (started && started.catch) started.catch(function () {});

    closeBtn.focus({ preventScroll: true });

    armBail();
    retryTimer = setTimeout(kick, RETRY_MS);
}

function close(reason) {
    if (!active) return;

    active = false;
    clearTimeout(bailTimer);
    clearTimeout(retryTimer);
    waiting.hidden = true;
    video.pause();

    scrim.classList.remove("show");
    setInertBehind(false);
    document.body.style.overflow = scrollLock;
    wakeClips();

    setTimeout(function () {
        if (!active) scrim.hidden = true;
    }, FADE_MS);

    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;

    if (reason !== "error") {
        document.dispatchEvent(new CustomEvent("zoneout:cutsceneend", { detail: { reason: reason || "skip" } }));
    }
}

// the cutscene owns the keyboard while it is up
document.addEventListener("keydown", function (e) {
    if (!isOpen()) return;

    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        close("skip");
    }

    e.stopPropagation();
}, true);

document.addEventListener("visibilitychange", function () {
    if (!isOpen()) return;

    if (document.visibilityState === "visible") {
        var playing = video.play();
        if (playing && playing.catch) playing.catch(function () {});
    } else {
        video.pause();
    }
});

// section for the settings row
function mountRow() {
    var api = window.zoneoutSettings;
    if (!api || typeof api.addRow !== "function") return;

    var button = document.createElement("button");
    button.className = "camNode settingsAction";
    button.type = "button";
    button.id = "replayCutsceneBtn";
    button.textContent = "PLAY CUTSCENE";

    button.addEventListener("click", function () {
        api.close();
        setTimeout(play, 260);
    });

    var wrap = document.createElement("div");
    wrap.className = "settingsSlot";
    wrap.appendChild(button);

    api.addRow("Cutscene", wrap);
}

if (window.zoneoutSettings && window.zoneoutSettings.ready) mountRow();
else document.addEventListener("zoneout:settingsready", mountRow, { once: true });

window.zoneoutCutscene = { play: play, close: close, isOpen: isOpen };
})();
