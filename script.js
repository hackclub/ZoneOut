// menu state
const options = document.querySelectorAll(".option");
let index = 1;

let screen = "warning";

// timings and paths
const INFO_PATH = "/info";
const INTRO_MS = 4000;
const MENU_FADE_MS = 4000;
const DOCK_SLIDE_MS = 3200;
const VEIL_MS = 450;

// localStorage wrapper
const store = {
    get(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {}
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {}
    }
};

// selection
function updateSelection() {
    options.forEach(opt => opt.classList.remove("active", "selector"));
    options[index].classList.add("active", "selector");
}

// elements
const uiClick = document.getElementById("uiClick");
const warningScreen = document.getElementById("warningScreen");
const warningProceed = document.getElementById("warningProceed");
const warningQuit = document.getElementById("warningQuit");
const introSequence = document.getElementById("introSequence");
const volumeSlider = document.getElementById("masterVolume");
const volumeValue = document.getElementById("volumeValue");
const loadingScreen = document.getElementById("loadingScreen");
const loadingText = document.getElementById("loadingText");
const learnPage = document.getElementById("learnPage");
const learnOption = document.getElementById("learn");
const loginOption = document.getElementById("login");
const backBtn = document.getElementById("backBtn");
const screenVeil = document.getElementById("screenVeil");
const toast = document.getElementById("toast");
const menuAudio = document.getElementById("bgAudio");
const faqAudio = document.getElementById("faqAudio");
const faqContainer = document.querySelector(".faqContainer");
const learnBgVideo = document.querySelector(".learnBgVideo");
const heroVideo = document.getElementById("heroVideo");
const cutscene = document.getElementById("cutscene");
const cutsceneVideo = document.getElementById("cutsceneVideo");
const cutsceneFill = document.getElementById("cutsceneFill");
const cutscenePress = document.getElementById("cutscenePress");
const eventSting = document.getElementById("eventSting");
const eventPress = document.getElementById("eventPress");
const faqNodes = Array.from(document.querySelectorAll(".faqNode"));
const faqToggles = Array.from(document.querySelectorAll(".faqToggle"));
let loadingTimer = null;
let loadingDotsTimer = null;
let faqIndex = 0;
let pushedInfo = false;

// volume
const savedVolume = store.get("zoneoutVolume");
if (savedVolume !== null) {
    const level = Number(savedVolume);
    if (Number.isFinite(level) && level >= 0 && level <= 100) {
        volumeSlider.value = String(level);
    }
}

let masterVolume = Number(volumeSlider.value) / 100;

let audioBlocked = false;
let userInteracted = false;

function currentTrack() {
    return screen === "faq" ? faqAudio : menuAudio;
}

function syncVolumeDisplay() {
    volumeValue.textContent = `${Math.round(masterVolume * 100)}%`;
}

function applyMasterVolume() {
    uiClick.volume = Math.max(masterVolume * 0.35, 0);

    const active = currentTrack();
    cancelFade(active);
    active.volume = masterVolume;

    syncVolumeDisplay();
}

// media priming
function prime(mediaEl) {
    if (!mediaEl || mediaEl.dataset.primed) return;

    mediaEl.dataset.primed = "1";
    mediaEl.preload = "auto";

    if (mediaEl.readyState === 0) mediaEl.load();
}

function primeNoticeArt() {
    document.querySelectorAll(".noticeFig[data-src]").forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute("data-src");
    });
}

function primeMenuMedia() {
    prime(heroVideo);
    prime(menuAudio);

    if (store.get(NOTICE_KEY) === "true") return;

    prime(eventSting);
    prime(eventPress);
    primeNoticeArt();
}

// first-run keys
const FIRST_RUN_KEYS = ["zoneoutWarningAccepted", "zoneoutLearnClicked",
                        "zoneoutLoginClicked", "zoneoutEyeClicked",
                        "zoneoutNoticeDismissed", "zoneoutCutsceneWatched"];

// auth notices
const AUTH_MESSAGES = {
    denied:  "Sign-in cancelled.",
    state:   "That link expired. Try signing in again.",
    noemail: "Hack Club sent no email address back.",
    failed:  "Sign-in failed. Try again in a moment."
};

let pendingAuthNotice = null;

// session hint cookie
const HINT_COOKIE = /(?:^|;\s*)(?:__Host-)?zo_hint=1(?:\s*;|$)/;

let sessionVerified = false;

function forgetSessionHint() {
    const attrs = "Max-Age=0; Path=/; SameSite=Lax";
    document.cookie = `zo_hint=; ${attrs}`;
    if (location.protocol === "https:") {
        document.cookie = `__Host-zo_hint=; ${attrs}; Secure`;
    }
}

// url tidying and ?reset
function tidyUrl() {
    let path = location.pathname.replace(/index\.html$/, "");
    if (path === "") path = "/";

    let search = location.search;

    if (/(^|[?&])reset(=|&|$)/.test(search)) {
        FIRST_RUN_KEYS.forEach(k => store.remove(k));
        search = "";
    }

    const auth = new URLSearchParams(search).get("auth");
    if (auth !== null) {
        pendingAuthNotice = AUTH_MESSAGES[auth] ?? AUTH_MESSAGES.failed;
        const params = new URLSearchParams(search);
        params.delete("auth");
        const rest = params.toString();
        search = rest ? `?${rest}` : "";
    }

    if (path !== location.pathname || search !== location.search) {
        history.replaceState(history.state, "", path + search + location.hash);
    }
}

function flushAuthNotice() {
    if (!pendingAuthNotice) return;
    const message = pendingAuthNotice;
    pendingAuthNotice = null;

    setTimeout(() => showToast(message), VEIL_MS);
}

tidyUrl();

try {
    if (sessionStorage.getItem("zoneoutFadeIn")) {
        sessionStorage.removeItem("zoneoutFadeIn");
        screenVeil.style.transition = "none";
        screenVeil.classList.add("on");
        void screenVeil.offsetWidth;
        screenVeil.style.transition = "";
        requestAnimationFrame(() => screenVeil.classList.remove("on"));
    }
} catch (e) {}

// menu label follows a verified session only
function applySessionLabel() {
    loginOption.textContent = sessionVerified ? "Go to Dashboard" : "Login";
}

applySessionLabel();

if (HINT_COOKIE.test(document.cookie)) {
    fetch("/api/auth/me", { credentials: "same-origin" })
        .then(response => {
            if (response.ok) {
                sessionVerified = true;
                applySessionLabel();
                return;
            }

            if (response.status === 403) {
                window.location.replace("/ban");
                return;
            }

            if (response.status === 401 || response.status === 404) {
                forgetSessionHint();
            }
        })
        .catch(() => {});
}

// backend warm-up
let warmed = false;

function warmBackend() {
    if (warmed) return;
    warmed = true;

    try {
        fetch("/api/warm", { method: "GET", keepalive: true, credentials: "omit" }).catch(() => {});
    } catch (e) {}
}

// first-run pointers
function updatePointers() {
    const learnDone = !!store.get("zoneoutLearnClicked");
    const loginDone = !!store.get("zoneoutLoginClicked");

    learnOption.classList.toggle("firstVisit", !learnDone);
    learnOption.classList.toggle("pointed", !learnDone);
    loginOption.classList.toggle("pointed", learnDone && !loginDone);
}

function retireLearnGlow() {
    store.set("zoneoutLearnClicked", "true");
    updatePointers();
}

function retireLoginPointer() {
    store.set("zoneoutLoginClicked", "true");
    updatePointers();
}

updatePointers();

// click sound
function playClick() {
    uiClick.currentTime = 0;
    uiClick.volume = Math.max(masterVolume * 0.35, 0);
    uiClick.play().catch(() => {});
}

// audio fades
const fadeFrames = new WeakMap();

function clampVolume(level) {
    return Math.min(Math.max(level, 0), 1);
}

function cancelFade(audioEl) {
    const live = fadeFrames.get(audioEl);
    if (!live) return;

    if (live.frame) cancelAnimationFrame(live.frame);
    if (live.timer) clearTimeout(live.timer);
    fadeFrames.delete(audioEl);
}

function fadeAudio(audioEl, from, to, duration, onDone) {
    cancelFade(audioEl);

    const start = performance.now();
    const target = clampVolume(to);
    const live = { frame: 0, timer: 0 };
    fadeFrames.set(audioEl, live);

    function settle() {
        cancelFade(audioEl);
        audioEl.volume = target;
        if (onDone) onDone();
    }

    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        audioEl.volume = clampVolume(from + (to - from) * progress);

        if (progress < 1) {
            live.frame = requestAnimationFrame(step);
        } else {
            settle();
        }
    }

    live.timer = setTimeout(settle, duration + 250);
    live.frame = requestAnimationFrame(step);
}

function startTrack(audioEl) {
    const attempt = audioEl.play();

    if (attempt && typeof attempt.then === "function") {
        attempt.then(() => {
            audioBlocked = false;
        }).catch(() => {
            audioBlocked = true;
        });
    }
}

// tracks
function playMenuMusic() {
    prime(menuAudio);

    cancelFade(faqAudio);
    faqAudio.pause();
    faqAudio.currentTime = 0;
    faqAudio.volume = 0;

    menuAudio.currentTime = 0;
    menuAudio.volume = 0;

    startTrack(menuAudio);

    fadeAudio(menuAudio, 0, masterVolume, MENU_FADE_MS);
}

function playFaqMusic() {
    prime(faqAudio);

    faqAudio.currentTime = 0;
    faqAudio.volume = 0;
    startTrack(faqAudio);

    fadeAudio(menuAudio, menuAudio.volume, 0, 500, () => {
        menuAudio.pause();
        menuAudio.currentTime = 0;
    });

    fadeAudio(faqAudio, 0, masterVolume, 600);
}

// autoplay recovery
function resumeAudio() {
    if (screen === "warning" || screen === "intro") return;
    if (cutsceneOpen()) return;

    const active = currentTrack();

    if (active.paused) {
        if (active === faqAudio) {
            playFaqMusic();
        } else {
            playMenuMusic();
        }
        return;
    }

    if (audioBlocked) {
        audioBlocked = false;
        cancelFade(active);
        active.volume = masterVolume;
    }
}

// hero clip
let cutscenePlanned = false;

function playHero() {
    if (!heroVideo) return;
    if (cutscenePlanned || cutsceneOpen()) return;

    prime(heroVideo);
    heroVideo.play().catch(() => {});
}

// screen changes
function isInfoPath() {
    return location.pathname.replace(/\/+$/, "").endsWith(INFO_PATH);
}

function goToFaq({ music = true } = {}) {
    learnPage.classList.remove("fadeOut");
    learnPage.classList.add("active");
    screen = "faq";
    setFaqFocus(0);

    if (learnBgVideo) learnBgVideo.play().catch(() => {});

    if (heroVideo) heroVideo.pause();

    if (music) playFaqMusic();
}

function goToMenu({ animate = true, music = true } = {}) {
    screen = "menu";
    clearFaqFocus();
    flushAuthNotice();

    if (!animate) {
        learnPage.classList.remove("active", "fadeOut");
        if (learnBgVideo) learnBgVideo.pause();
        playHero();
        if (music) playMenuMusic();
        return;
    }

    screenVeil.classList.add("on");
    learnPage.classList.add("fadeOut");

    setTimeout(() => {
        learnPage.classList.remove("active", "fadeOut");

        if (learnBgVideo) learnBgVideo.pause();
        playHero();
        if (music) playMenuMusic();
        requestAnimationFrame(() => screenVeil.classList.remove("on"));
    }, VEIL_MS);
}

function leaveFaq() {
    if (pushedInfo) {
        pushedInfo = false;
        history.back();
        return;
    }

    history.replaceState({ screen: "menu" }, "", "/");
    goToMenu();
}

// routing
let dockReleased = false;

// volume dock
function releaseDock() {
    if (dockReleased) return;
    dockReleased = true;

    const root = document.documentElement;
    root.classList.add("dockSlide");
    void root.offsetWidth;

    const drop = () => {
        root.classList.remove("dockHidden");
        setTimeout(() => root.classList.remove("dockSlide"), DOCK_SLIDE_MS + 200);
    };

    requestAnimationFrame(drop);
    setTimeout(drop, 60);
}

// main menu notice
const NOTICE_KEY = "zoneoutNoticeDismissed";
const NOTICE_DELAY_MS = 700;
const NOTICE_SLIDE_MS = 600;
const NOTICE_STING_MS = 180;
const NOTICE_STING_GRACE_MS = 1200;

let noticeReturnFocus = null;
let inertSnapshot = null;
let noticeScrollLock = "";

function noticeOpen() {
    return noticeScrim.classList.contains("show");
}

function setInertBehind(on, keep) {
    const kids = Array.from(document.body.children);

    if (on) {
        inertSnapshot = kids.map(child => child.inert);
        kids.forEach(child => {
            if (child !== keep && child.tagName !== "SCRIPT") child.inert = true;
        });
        return;
    }

    if (!inertSnapshot) return;

    kids.forEach((child, i) => {
        if (child !== keep && child.tagName !== "SCRIPT" && i < inertSnapshot.length) {
            child.inert = inertSnapshot[i];
        }
    });

    inertSnapshot = null;
}

// event sounds
function playEventSound(audioEl) {
    audioEl.currentTime = 0;
    audioEl.volume = 1;
    audioEl.play().catch(() => {});
}

function playEventSoundAt(audioEl, delay, grace) {
    prime(audioEl);

    let due = false;
    let fired = false;
    let capTimer = 0;

    const fire = () => {
        if (fired) return;
        fired = true;

        clearTimeout(capTimer);
        audioEl.removeEventListener("canplaythrough", attempt);
        playEventSound(audioEl);
    };

    function attempt() {
        if (due && audioEl.readyState >= 3) fire();
    }

    capTimer = setTimeout(fire, delay + grace);
    setTimeout(() => { due = true; attempt(); }, delay);
    audioEl.addEventListener("canplaythrough", attempt);
}

function openNotice(options) {
    if (noticeOpen()) return;

    noticeForced = Boolean(options && options.forced);

    noticeReturnFocus = document.activeElement;
    noticeScrim.hidden = false;
    void noticeScrim.offsetHeight;
    noticeScrim.classList.add("show");

    noticeScrollLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    setInertBehind(true, noticeScrim);
    noticeDismiss.focus({ preventScroll: true });

    playEventSoundAt(eventSting, NOTICE_STING_MS, NOTICE_STING_GRACE_MS);
}

function closeNotice() {
    if (!noticeOpen()) return;

    noticeForced = false;
    playEventSound(eventPress);
    store.set(NOTICE_KEY, "true");

    noticeScrim.classList.remove("show");
    setInertBehind(false, noticeScrim);
    document.body.style.overflow = noticeScrollLock;

    setTimeout(() => {
        if (!noticeOpen()) noticeScrim.hidden = true;
    }, NOTICE_SLIDE_MS);

    if (noticeReturnFocus && document.contains(noticeReturnFocus)) noticeReturnFocus.focus();
    noticeReturnFocus = null;
}

let noticeForced = false;
let noticeShown = false;

function maybeShowNotice() {
    if (noticeShown || store.get(NOTICE_KEY) === "true") return;

    noticeShown = true;
    setTimeout(() => {
        if (screen === "menu") openNotice();
    }, NOTICE_DELAY_MS);
}

noticeDismiss.addEventListener("click", leaveForEvents);

function leaveForEvents() {
    if (!noticeOpen()) return;

    playEventSound(eventPress);
    store.set(NOTICE_KEY, "true");

    try {
        sessionStorage.setItem("zoneoutEventsOpen", "1");
        sessionStorage.setItem("zoneoutFadeIn", "1");
    } catch (e) {}

    noticeForced = false;
    screenVeil.classList.add("on");

    if (!sessionVerified) warmBackend();

    setTimeout(() => {
        window.location.href = sessionVerified ? "/home" : "/api/auth/login";
    }, VEIL_MS);
}

noticeScrim.addEventListener("mousedown", (e) => {
    if (noticeForced || e.target !== noticeScrim) return;
    closeNotice();
});

document.addEventListener("keydown", (e) => {
    if (!noticeOpen()) return;

    if (e.key === "Escape" && !noticeForced) {
        e.preventDefault();
        closeNotice();
    }

    e.stopPropagation();
}, true);

// entity breakout cutscene
const CUTSCENE_KEY = "zoneoutCutsceneWatched";
const CUTSCENE_FADE_MS = 800;
const CUTSCENE_RETRY_MS = 4000;
const CUTSCENE_BAIL_MS = 20000;

let cutsceneHeld = true;
let cutsceneStarted = false;
let cutsceneEnded = false;
let cutsceneRetryTimer = 0;
let cutsceneBailTimer = 0;
let cutsceneScrollLock = "";

function cutsceneOpen() {
    return cutsceneStarted && !cutscene.hidden;
}

function cutsceneWatched() {
    return store.get(CUTSCENE_KEY) === "true";
}

// press prompt
function stillPreferred() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function movePress() {
    if (stillPreferred()) return;

    cutscenePress.style.left = `${12 + Math.random() * 76}%`;
    cutscenePress.style.top = `${18 + Math.random() * 64}%`;
}

// blurred backdrop
const fillCtx = cutsceneFill.getContext("2d", { alpha: false });
const FILL_INTERVAL_MS = 66;

let fillFrame = 0;
let fillVideoFrame = 0;
let fillLast = 0;

function stopFill() {
    if (fillFrame) cancelAnimationFrame(fillFrame);
    if (fillVideoFrame && cutsceneVideo.cancelVideoFrameCallback) {
        cutsceneVideo.cancelVideoFrameCallback(fillVideoFrame);
    }

    fillFrame = 0;
    fillVideoFrame = 0;
}

function paintFill(now) {
    if (cutsceneHeld || cutsceneEnded) return;

    const stamp = now || performance.now();

    if (stamp - fillLast >= FILL_INTERVAL_MS && cutsceneVideo.readyState >= 2) {
        fillLast = stamp;
        fillCtx.drawImage(cutsceneVideo, 0, 0, cutsceneFill.width, cutsceneFill.height);
    }

    if (cutsceneVideo.requestVideoFrameCallback) {
        fillVideoFrame = cutsceneVideo.requestVideoFrameCallback(paintFill);
    } else {
        fillFrame = requestAnimationFrame(paintFill);
    }
}

// a phone refuses sound until it trusts the gesture, so a silent roll beats none
function playCutsceneVideo() {
    cutsceneVideo.play().catch((err) => {
        if (err && err.name !== "NotAllowedError") return;

        cutsceneVideo.muted = true;
        cutsceneVideo.play().catch(() => {});
    });
}

function unmuteCutscene() {
    if (!cutsceneVideo.muted || cutsceneEnded || cutsceneHeld) return;

    cutsceneVideo.muted = false;
    cutsceneVideo.volume = 1;
}

function kickCutsceneVideo() {
    if (!cutsceneStarted || cutsceneEnded || cutsceneHeld) return;
    if (cutsceneVideo.readyState >= 2) return;

    if (cutsceneVideo.networkState === HTMLMediaElement.NETWORK_EMPTY) cutsceneVideo.load();

    playCutsceneVideo();
}

function startCutscene({ instant = false } = {}) {
    if (cutsceneStarted) return;
    cutsceneStarted = true;

    cutscene.hidden = false;

    // with no black already standing, fading in would show the menu through it
    if (instant) {
        cutscene.classList.add("instant", "show");
        void cutscene.offsetHeight;
        cutscene.classList.remove("instant");
    } else {
        const raise = () => cutscene.classList.add("show");
        requestAnimationFrame(raise);
        setTimeout(raise, 60);
    }

    cutsceneScrollLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setInertBehind(true, cutscene);

    if (heroVideo) heroVideo.pause();
    prime(cutsceneVideo);

    movePress();
    cutscenePress.focus({ preventScroll: true });
}

function releaseCutscene() {
    if (!cutsceneStarted || cutsceneEnded || !cutsceneHeld) return;

    cutsceneHeld = false;
    cutscenePress.hidden = true;
    userInteracted = true;

    cutscene.classList.add("rolling");

    cutsceneVideo.muted = false;
    cutsceneVideo.volume = 1;
    if (cutsceneVideo.currentTime > 0.05) cutsceneVideo.currentTime = 0;
    playCutsceneVideo();
    paintFill();

    cutsceneRetryTimer = setTimeout(kickCutsceneVideo, CUTSCENE_RETRY_MS);
    cutsceneBailTimer = setTimeout(() => {
        if (cutsceneVideo.readyState < 2 || cutsceneVideo.paused) endCutscene();
    }, CUTSCENE_BAIL_MS);
}

function endCutscene() {
    if (!cutsceneStarted || cutsceneEnded) return;
    cutsceneEnded = true;

    clearTimeout(cutsceneRetryTimer);
    clearTimeout(cutsceneBailTimer);
    stopFill();
    store.set(CUTSCENE_KEY, "true");
    primeMenuMedia();

    cutscene.classList.remove("show");

    setTimeout(() => {
        cutsceneVideo.pause();
        cutscene.hidden = true;
        cutscene.classList.remove("rolling");
        setInertBehind(false, cutscene);
        document.body.style.overflow = cutsceneScrollLock;

        cutscenePlanned = false;
        releaseDock();
        playHero();
        playMenuMusic();
        openNotice({ forced: true });
    }, CUTSCENE_FADE_MS);
}

cutscenePress.addEventListener("animationiteration", movePress);

cutsceneVideo.addEventListener("playing", () => {
    clearTimeout(cutsceneRetryTimer);
    clearTimeout(cutsceneBailTimer);
    primeMenuMedia();
});

cutscenePress.addEventListener("click", releaseCutscene);

// a touch grants no activation until the tap completes, so a mouse releases on the press and a finger on the tap
cutscene.addEventListener("pointerdown", (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return;

    e.preventDefault();
    releaseCutscene();
});

cutscene.addEventListener("pointerup", releaseCutscene);
cutscene.addEventListener("click", releaseCutscene);

document.addEventListener("pointerup", unmuteCutscene, true);
document.addEventListener("touchend", unmuteCutscene, true);

cutsceneVideo.addEventListener("ended", endCutscene);

cutsceneVideo.addEventListener("error", () => {
    if (cutsceneStarted) {
        endCutscene();
        return;
    }

    cutsceneStarted = true;
    cutsceneEnded = true;
    cutscenePlanned = false;

    primeMenuMedia();
    releaseDock();
    playHero();
    playMenuMusic();
    maybeShowNotice();
});

document.addEventListener("keydown", (e) => {
    if (!cutsceneOpen()) return;

    if (cutsceneHeld && e.key !== "Tab") {
        e.preventDefault();
        releaseCutscene();
    }

    e.stopPropagation();
}, true);

// entry priming
if (!isInfoPath()) {
    if (cutsceneWatched()) primeMenuMedia();
    else prime(cutsceneVideo);
}

// a hidden tab freezes the cutscene's fade but not this timer, so the veil waits on the opacity itself
function dropIntroVeil() {
    const drop = () => {
        if (!cutsceneEnded && getComputedStyle(cutscene).opacity !== "1") {
            setTimeout(drop, 200);
            return;
        }
        introSequence.classList.remove("playing", "hold");
    };

    setTimeout(drop, CUTSCENE_FADE_MS + 120);
}

function routeToCurrentPath({ veiled = false } = {}) {
    document.documentElement.dataset.gear = "on";

    if (isInfoPath()) {
        releaseDock();
        pushedInfo = false;
        goToFaq();
        return;
    }

    const cinematic = !cutsceneWatched();
    cutscenePlanned = cinematic;

    goToMenu({ animate: false, music: !cinematic });

    if (cinematic) {
        startCutscene({ instant: !veiled });
        if (veiled) dropIntroVeil();
        return;
    }

    releaseDock();
    maybeShowNotice();
}

window.addEventListener("popstate", () => {
    if (screen === "warning" || screen === "intro") return;

    if (isInfoPath()) {
        if (screen !== "faq") {
            pushedInfo = true;
            goToFaq();
        }
    } else if (screen !== "menu") {
        pushedInfo = false;
        goToMenu();
    }
});

// first-visit intro
function playIntro() {
    screen = "intro";

    const veiled = !cutsceneWatched() && !isInfoPath();
    introSequence.classList.toggle("hold", veiled);
    introSequence.classList.add("playing");

    setTimeout(() => {
        if (!veiled) introSequence.classList.remove("playing");
        routeToCurrentPath({ veiled });
    }, INTRO_MS);
}

// section for the one-time intro and cutscene replay
const REPLAY_KEY = "zoneoutReplaySeen";
const REPLAY_EPOCH = "2";

function claimReplay() {
    if (store.get(REPLAY_KEY) === REPLAY_EPOCH) return false;

    store.set(REPLAY_KEY, REPLAY_EPOCH);
    store.remove(CUTSCENE_KEY);
    store.remove(NOTICE_KEY);
    return true;
}

if (store.get("zoneoutWarningAccepted") === "true") {
    warningScreen.classList.add("hidden");
    warningScreen.inert = true;

    if (claimReplay()) playIntro();
    else routeToCurrentPath();
}

// volume slider
volumeSlider.addEventListener("input", () => {
    masterVolume = Number(volumeSlider.value) / 100;
    store.set("zoneoutVolume", volumeSlider.value);
    applyMasterVolume();
});

// discretion warning
warningProceed.addEventListener("click", () => {
    if (screen !== "warning") return;

    playClick();
    store.set("zoneoutWarningAccepted", "true");
    store.set(REPLAY_KEY, REPLAY_EPOCH);
    warningScreen.classList.add("hidden");
    userInteracted = true;

    warningProceed.blur();
    warningScreen.inert = true;

    warmBackend();

    playIntro();
});

warningQuit.addEventListener("click", () => {
    if (screen !== "warning") return;

    playClick();
    setTimeout(() => {
        window.location.replace("about:blank");
    }, 120);
});

function settingsOpen() {
    return Boolean(window.zoneoutSettings && window.zoneoutSettings.isOpen());
}

function isTyping() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function gearFocused() {
    const gear = document.getElementById("settingsGear");
    return Boolean(gear) && document.activeElement === gear;
}

document.addEventListener("keydown", (e) => {
    if (screen !== "menu") return;
    if (settingsOpen() || noticeOpen() || cutsceneOpen() || isTyping() || gearFocused()) return;

    if (e.key === "ArrowDown") {
        index = (index + 1) % options.length;
        updateSelection();
    }

    if (e.key === "ArrowUp") {
        index = (index - 1 + options.length) % options.length;
        updateSelection();
    }

    if (index === 0) warmBackend();

    if (e.key === "Enter") {
        playClick();
        if (index === 0) openLogin();
        if (index === 1) triggerLearn();
        if (index === 2) openShop();
    }
});

options.forEach((opt, i) => {
    opt.addEventListener("mouseenter", () => {
        if (screen !== "menu") return;
        index = i;
        updateSelection();

        if (i === 0) warmBackend();
    });

    opt.addEventListener("click", () => {
        if (screen !== "menu") return;
        playClick();
        if (i === 0) openLogin();
        if (i === 1) triggerLearn();
        if (i === 2) openShop();
    });
});

// toast
let toastTimer = null;

function hideToast() {
    clearTimeout(toastTimer);
    toast.classList.remove("show");
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2600);
}

// shop
function openShop() {
    try { sessionStorage.setItem("zoneoutFadeIn", "1"); } catch (e) {}

    screenVeil.classList.add("on");

    setTimeout(() => {
        window.location.href = "/shop";
    }, VEIL_MS);
}

// login
function openLogin() {
    retireLoginPointer();

    showLoading();

    if (sessionVerified) {
        window.location.href = "/home";
        return;
    }

    warmBackend();

    window.location.href = "/api/auth/login";
}

window.addEventListener("pageshow", (e) => {
    if (!loadingTimer) hideLoading();
    if (!e.persisted) return;

    try { sessionStorage.removeItem("zoneoutFadeIn"); } catch (err) {}
    screenVeil.classList.remove("on");
});

// loading interstitial
function showLoading() {
    loadingScreen.classList.add("active");

    if (loadingDotsTimer) return;

    let dots = 0;
    loadingDotsTimer = setInterval(() => {
        dots = (dots + 1) % 4;
        loadingText.innerText = "Loading" + ".".repeat(dots);
    }, 400);
}

function hideLoading() {
    clearInterval(loadingDotsTimer);
    loadingDotsTimer = null;
    loadingText.innerText = "Loading";
    loadingScreen.classList.remove("active");
}

// learn more
function triggerLearn() {
    if (loadingTimer) return;

    retireLearnGlow();

    showLoading();

    const delay = Math.random() * 900 + 700;

    loadingTimer = setTimeout(() => {
        loadingTimer = null;
        hideLoading();

        history.pushState({ screen: "faq" }, "", INFO_PATH);
        pushedInfo = true;
        goToFaq();
    }, delay);
}

backBtn.addEventListener("click", () => {
    playClick();
    leaveFaq();
});

const firstFaqNode = faqNodes[0] || null;

if (firstFaqNode && !store.get("zoneoutEyeClicked")) {
    firstFaqNode.classList.add("attract");
}

// faq grid keyboard layer
function faqColumns() {
    if (!faqContainer) return 1;
    const cols = getComputedStyle(faqContainer).gridTemplateColumns;
    return Math.max(cols.split(" ").filter(Boolean).length, 1);
}

function setFaqFocus(i) {
    if (!faqNodes.length) return;

    faqIndex = (i % faqNodes.length + faqNodes.length) % faqNodes.length;
    faqNodes.forEach(node => node.classList.remove("focused"));

    const node = faqNodes[faqIndex];
    node.classList.add("focused");
    node.scrollIntoView({ block: "nearest" });
}

function clearFaqFocus() {
    faqNodes.forEach(node => node.classList.remove("focused"));
}

// faq eyes
const EYE_OPEN = "https://cdn.hackclub.com/019d155f-b707-7536-b45a-f45556a31211/openeye.png";
const EYE_SHUT = "https://cdn.hackclub.com/019d155f-c68f-70bb-bfd9-047b7a7224bb/closed%20eye.png";

function setFaqOpen(node, open) {
    if (!node || node.classList.contains("open") === open) return;

    const button = node.querySelector(".faqToggle");
    const img = button && button.querySelector("img");

    node.classList.toggle("open", open);
    if (img) img.src = open ? EYE_OPEN : EYE_SHUT;
    if (button) button.setAttribute("aria-expanded", String(open));
}

function toggleFaqNode(button) {
    if (!button) return;

    playClick();

    const node = button.closest(".faqNode");

    if (firstFaqNode) {
        firstFaqNode.classList.remove("attract");
    }
    store.set("zoneoutEyeClicked", "true");

    const isOpen = !node.classList.contains("open");

    faqNodes.forEach(other => {
        if (other !== node) setFaqOpen(other, false);
    });
    setFaqOpen(node, isOpen);

    if (faqContainer) faqContainer.classList.toggle("hasOpen", isOpen);

    if (isOpen) {
        const drop = node.querySelector(".faqDrop");
        if (drop) setTimeout(() => {
            if (node.classList.contains("open")) drop.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 380);
    }
}

faqToggles.forEach((button, i) => {
    button.addEventListener("click", () => {
        setFaqFocus(i);
        toggleFaqNode(button);
    });
});

faqNodes.forEach((node, i) => {
    node.addEventListener("mouseenter", () => {
        if (screen !== "faq") return;
        setFaqFocus(i);
    });
});

document.addEventListener("keydown", (e) => {
    if (screen !== "faq") return;
    if (settingsOpen() || noticeOpen() || cutsceneOpen() || isTyping() || gearFocused()) return;

    const cols = faqColumns();
    let handled = true;

    switch (e.key) {
        case "ArrowRight": setFaqFocus(faqIndex + 1); break;
        case "ArrowLeft":  setFaqFocus(faqIndex - 1); break;
        case "ArrowDown":  setFaqFocus(faqIndex + cols); break;
        case "ArrowUp":    setFaqFocus(faqIndex - cols); break;
        case "Enter":
        case " ":          toggleFaqNode(faqToggles[faqIndex]); break;
        case "Escape":     leaveFaq(); break;
        default:           handled = false;
    }

    if (handled) e.preventDefault();
});

// faq links
document.querySelectorAll(".faqAnswer a").forEach(link => {
    link.addEventListener("click", (e) => {
        e.stopPropagation();
    });
});

["pointerdown", "touchstart", "keydown"].forEach(evt => {
    document.addEventListener(evt, () => {
        userInteracted = true;

        hideToast();
        resumeAudio();
    }, true);
});

window.addEventListener("load", resumeAudio);

[menuAudio, faqAudio].forEach(track => {
    track.addEventListener("canplay", () => {
        if (userInteracted) resumeAudio();
    });
});

uiClick.volume = Math.max(masterVolume * 0.35, 0);
syncVolumeDisplay();
updateSelection();

// nothing decodes for a hidden tab
document.addEventListener("visibilitychange", () => {
    const wanted = cutsceneOpen() ? null : (screen === "faq" ? learnBgVideo : heroVideo);
    const visible = document.visibilityState === "visible";

    if (visible && cutsceneOpen()) kickCutsceneVideo();

    [heroVideo, learnBgVideo].forEach(clip => {
        if (!clip) return;
        if (clip !== wanted || !visible) clip.pause();
    });

    if (!visible || !wanted) return;

    if (wanted === heroVideo) playHero();
    else wanted.play().catch(() => {});
});

