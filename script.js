
const options = document.querySelectorAll(".option");
let index = 1;

let screen = "warning";

const INFO_PATH = "/info";
const INTRO_MS = 4000;
const HERO_HIDE_MS = 600;
const MENU_FADE_MS = 4000;
const VEIL_MS = 450;

const EYE_OPEN = "https://cdn.hackclub.com/019d155f-b707-7536-b45a-f45556a31211/openeye.png";
const EYE_SHUT = "https://cdn.hackclub.com/019d155f-c68f-70bb-bfd9-047b7a7224bb/closed%20eye.png";

const FAQ_REVEAL_GAP = 24;
const FAQ_DROP_PADDING = 32;
const FAQ_DROP_OFFSET = 12;

let faqScrollFrom = null;

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

function updateSelection() {
    options.forEach(opt => opt.classList.remove("active", "selector"));
    options[index].classList.add("active", "selector");
}

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
const heroVideo = document.querySelector(".hero video");
const faqNodes = Array.from(document.querySelectorAll(".faqNode"));
const faqToggles = Array.from(document.querySelectorAll(".faqToggle"));
let loadingTimer = null;
let loadingDotsTimer = null;
let faqIndex = 0;
let pushedInfo = false;

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

const FIRST_RUN_KEYS = ["zoneoutWarningAccepted", "zoneoutLearnClicked",
                        "zoneoutLoginClicked", "zoneoutEyeClicked"];

const AUTH_MESSAGES = {
    denied:  "Sign-in cancelled.",
    state:   "That link expired. Try signing in again.",
    noemail: "Hack Club sent no email address back.",
    failed:  "Sign-in failed. Try again in a moment."
};

let pendingAuthNotice = null;

const HINT_COOKIE = /(?:^|;\s*)(?:__Host-)?zo_hint=1(?:\s*;|$)/;

let sessionVerified = false;

function forgetSessionHint() {
    const attrs = "Max-Age=0; Path=/; SameSite=Lax";
    document.cookie = `zo_hint=; ${attrs}`;
    if (location.protocol === "https:") {
        document.cookie = `__Host-zo_hint=; ${attrs}; Secure`;
    }
}

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
            } else if (response.status === 401 || response.status === 404) {
                forgetSessionHint();
            }
        })
        .catch(() => {});
}

let warmed = false;

function warmBackend() {
    if (warmed) return;
    warmed = true;

    try {
        fetch("/api/warm", { method: "GET", keepalive: true, credentials: "omit" }).catch(() => {});
    } catch (e) {}
}

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

function playClick() {
    uiClick.currentTime = 0;
    uiClick.volume = Math.max(masterVolume * 0.35, 0);
    uiClick.play().catch(() => {});
}

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

function playMenuMusic() {
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
    faqAudio.currentTime = 0;
    faqAudio.volume = 0;
    startTrack(faqAudio);

    fadeAudio(menuAudio, menuAudio.volume, 0, 500, () => {
        menuAudio.pause();
        menuAudio.currentTime = 0;
    });

    fadeAudio(faqAudio, 0, masterVolume, 600);
}

function resumeAudio() {

    if (screen === "warning" || screen === "intro") return;

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

let heroPauseTimer = null;

function playVideo(el) {
    if (el && !document.hidden) el.play().catch(() => {});
}

function pauseVideo(el) {
    if (el && !el.paused) el.pause();
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        pauseVideo(heroVideo);
        pauseVideo(learnBgVideo);
        return;
    }

    if (screen === "faq") playVideo(learnBgVideo);
    else playVideo(heroVideo);
});

function isInfoPath() {
    return location.pathname.replace(/\/+$/, "").endsWith(INFO_PATH);
}

function goToFaq({ music = true } = {}) {
    learnPage.classList.remove("fadeOut");
    learnPage.classList.add("active");
    screen = "faq";
    setFaqFocus(0);

    playVideo(learnBgVideo);

    clearTimeout(heroPauseTimer);
    heroPauseTimer = setTimeout(() => pauseVideo(heroVideo), HERO_HIDE_MS);

    if (music) playFaqMusic();
}

function goToMenu({ animate = true, music = true } = {}) {
    screen = "menu";
    clearFaqFocus();
    closeFaqNodes(null);
    restoreFaqScroll();
    flushAuthNotice();

    clearTimeout(heroPauseTimer);
    playVideo(heroVideo);

    if (!animate) {
        learnPage.classList.remove("active", "fadeOut");
        pauseVideo(learnBgVideo);
        if (music) playMenuMusic();
        return;
    }

    screenVeil.classList.add("on");
    learnPage.classList.add("fadeOut");

    setTimeout(() => {
        learnPage.classList.remove("active", "fadeOut");
        pauseVideo(learnBgVideo);
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

function routeToCurrentPath() {
    if (isInfoPath()) {
        pushedInfo = false;
        goToFaq();
    } else {
        goToMenu({ animate: false });
    }
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

function playIntro() {
    screen = "intro";
    introSequence.classList.add("playing");

    setTimeout(() => {
        introSequence.classList.remove("playing");
        routeToCurrentPath();
    }, INTRO_MS);
}

if (store.get("zoneoutWarningAccepted") === "true") {
    warningScreen.classList.add("hidden");
    warningScreen.inert = true;

    routeToCurrentPath();
}

volumeSlider.addEventListener("input", () => {
    masterVolume = Number(volumeSlider.value) / 100;
    store.set("zoneoutVolume", volumeSlider.value);
    applyMasterVolume();
});

warningProceed.addEventListener("click", () => {

    if (screen !== "warning") return;

    playClick();
    store.set("zoneoutWarningAccepted", "true");
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

document.addEventListener("keydown", (e) => {
    if (screen !== "menu") return;

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
    });
});

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

window.addEventListener("pageshow", () => {
    if (!loadingTimer) hideLoading();
});

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

function setFaqNodeOpen(node, open) {
    const button = node.querySelector(".faqToggle");
    if (!button) return;
    if (node.classList.contains("open") === open) return;

    node.classList.toggle("open", open);
    button.querySelector("img").src = open ? EYE_OPEN : EYE_SHUT;
    button.setAttribute("aria-expanded", String(open));
}

function closeFaqNodes(except) {
    faqNodes.forEach(node => {
        if (node !== except) setFaqNodeOpen(node, false);
    });
}

function faqScrollTo(top) {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    learnPage.scrollTo({ top, behavior: still ? "auto" : "smooth" });
}

function restoreFaqScroll() {
    if (faqContainer) faqContainer.style.paddingBottom = "";
    if (faqScrollFrom === null) return;

    const top = faqScrollFrom;
    faqScrollFrom = null;
    faqScrollTo(top);
}

function revealFaqDrop(node) {
    const drop = node.querySelector(".faqDrop");
    if (!drop || !learnPage || !faqContainer) return;
    if (getComputedStyle(drop).position !== "absolute") return;

    faqContainer.style.paddingBottom = "";
    const basePad = parseFloat(getComputedStyle(faqContainer).paddingBottom) || 0;

    const view = learnPage.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    const panelBottom = box.bottom + FAQ_DROP_OFFSET + drop.scrollHeight + FAQ_DROP_PADDING;

    const need = (panelBottom + FAQ_REVEAL_GAP) - view.bottom;
    if (need <= 0) {
        restoreFaqScroll();
        return;
    }

    const slack = faqContainer.getBoundingClientRect().bottom - (panelBottom + FAQ_REVEAL_GAP);
    if (slack < 0) faqContainer.style.paddingBottom = `${basePad - slack}px`;

    if (faqScrollFrom === null) faqScrollFrom = learnPage.scrollTop;
    faqScrollTo(learnPage.scrollTop + need);
}

function toggleFaqNode(button) {
    if (!button) return;

    playClick();

    const node = button.closest(".faqNode");

    if (firstFaqNode) {
        firstFaqNode.classList.remove("attract");
    }
    store.set("zoneoutEyeClicked", "true");

    const open = !node.classList.contains("open");

    closeFaqNodes(node);
    setFaqNodeOpen(node, open);

    if (open) revealFaqDrop(node);
    else restoreFaqScroll();
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
    }, { capture: true, passive: true });
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
