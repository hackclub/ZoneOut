// the catalogue, shared by the shop page and the order route
export const SHOP_SECTIONS = [
    { id: "halloween", name: "Halloween Shopping" },
    { id: "tech", name: "Tech Items" },
    { id: "grants", name: "Grants" },
    { id: "games", name: "Fun Games and Plushies!" }
];

// new-item label expiry
const NEW_UNTIL = "2026-08-31T23:59:59Z";

export function itemIsNew(item, now) {
    if (!item || !item.newUntil) return false;
    const until = Date.parse(item.newUntil);
    return Number.isFinite(until) && (now === undefined ? Date.now() : now) < until;
}

export const SHOP_ITEMS = [
    {
        id: "big-blahaj", fit: "contain", name: "Big Blahaj", hours: 7, section: "games", image: "https://cdn.hackclub.com/01a03ec8-3c66-7650-982f-0031f7fc041a/blahaj.webp",
        description: "A metre of shark. very huggable"
    },
    {
        id: "smolhaj", fit: "contain", name: "Smolhaj", hours: 3, section: "games", image: "https://cdn.hackclub.com/01a03ec8-3c66-7650-982f-0031f7fc041a/blahaj.webp",
        description: "Same same but smaller - 55cm"
    },
    {
        id: "yuki-chan-seal", local: true, name: "Yuki Chan Seal Plush", hours: 6.5, section: "games", image: "https://cdn.hackclub.com/01a03ee9-c221-7676-be6f-22fef2dcf76c/yuki.png",
        description: "Cieling. large seal: 60cm long. not horror though"
    },
    {
        id: "hardware-grant", fit: "contain", name: "Hardware Equipment Grant (10$)", hours: 2.5, section: "grants", note: "Stackable", image: "https://cdn.hackclub.com/01a03ee8-573e-709c-a690-49a94b9ba762/hardware.png",
        description: "Get a 10$ hardware grant to buy new tech parts for your project!"
    },
    {
        id: "thermal-camera", local: true, name: "Attachable Thermal Camera", hours: 20, section: "tech", image: "https://cdn.hackclub.com/01a03eee-38da-73a2-b7fd-e001e4f5c0c0/thermalcam.png",
        description: "Look at things that are HOT."
    },
    {
        id: "emf-reader", local: true, zoom: 1.35, name: "EMF Reader", hours: 3, section: "halloween", image: "https://cdn.hackclub.com/01a03ee8-58f4-76a3-9962-972f0016f651/emf.png",
        description: "demonology irl. detect ghosts and stuff im assuming"
    },
    {
        id: "fairy-lights", local: true, name: "Halloween Fairy Lights", hours: 2, section: "halloween", image: "https://cdn.hackclub.com/01a02cc0-c5a3-7d6e-adf8-d0f32f62af05/fairylights.webp",
        description: "A purple orange and green or purple/orange mix of lights! [dm @Kuzu for the colours]!"
    },
    {
        id: "jack-o-lantern", local: true, name: "Halloween Jack-o-Lantern", hours: 4, section: "halloween", image: "https://cdn.hackclub.com/01a02cc0-c496-73ab-8b1d-da22a324b5a0/jacklantern.png",
        description: "jack and o and lantern"
    },
    {
        id: "halloween-decor", name: "Halloween Decor Grant (10$)", hours: 2, section: "halloween", image: "https://cdn.hackclub.com/01a02cc0-c3f7-740f-9890-e7c01b4da9f6/hallodecor.png", note: "Stackable",
        description: "A 10$ grant  to buy any sort of halloween decor! :ghost: ."
    },
    {
        id: "halloween-costume", fit: "contain", name: "Halloween Costumes Grant (10$)", hours: 2, section: "halloween", image: "https://cdn.hackclub.com/01a03ee8-5bdd-75fe-ad29-d4eba8c6229a/costume.png", note: "Stackable",
        description: "10$ to get a costume! become something cool gng"
    },
    {
        id: "consumable-grant", name: "Consumable Grant (10$)", hours: 2, section: "halloween", image: "https://cdn.hackclub.com/01a03a25-430a-7a57-bd6d-91d808252e7b/candy.png", note: "Stackable",
        description: "Now you can get candy for trick or treating and drinks to clench your thirst. Covers **Candy and Drinks** only."
    },
    {
        id: "ai-credits", fit: "contain", name: "AI Credits (10$)", hours: 2, section: "grants", note: "Stackable", image: "https://cdn.hackclub.com/01a02d3b-bd0a-7c35-9cc3-58a37d8fc3ee/ai.webp",
        description: "get a 10$ grant to buy some ai creds :3 stackable!"
    },
    {
        id: "steam-gift-card", name: "Steam Gift Card", hours: 3, section: "games", image: "https://cdn.hackclub.com/019d2025-f118-7993-b534-8c3c129d92f6/steam.png", note: "stackable",
        description: "A 10$ steam gift card! buy any sort of horror game u want"
    },
    {
        id: "minecraft", name: "Minecraft", hours: 7, section: "games", image: "https://cdn.hackclub.com/01a02cc0-c1f3-71bf-9fab-4fe3c3f0af43/minecraft.png",
        description: "EVERYBODY'S FAV BLOCK GAME!!!!"
    },
    {
        id: "laptop-grant", zoom: 1.15, name: "Laptop Grant (100$)", hours: 25, section: "grants", note: "Stackable", image: "https://cdn.hackclub.com/01a03ee8-565a-703d-bd88-d6e5fd21b578/laptop.png",
        description: "need me some devices - stackable!"
    },
    {
        id: "yubikey-5c-nfc", fit: "contain", name: "YubiKey 5C NFC", hours: 14, section: "tech", image: "https://cdn.hackclub.com/01a03ee8-5dc9-7610-9f4e-1e82f758f935/yubikey.png",
        description: "A yubikey :) keep things secure"
    },
    {
        id: "geometry-dash", name: "Geometry Dash", hours: 2, section: "games", image: "https://cdn.hackclub.com/01a02cc0-c01d-7302-bf42-91690d77abfb/gd.png",
        description: "my fav rythm-based game fr. "
    },
    {
        id: "pacman-arcade-led", local: true, name: "Pac-Man Arcade LED", hours: 8, section: "halloween", image: "https://cdn.hackclub.com/01a02cc0-bf5d-7691-8480-f0053b99b3b2/pacman.png",
        description: "A pacman and ghost themed LED arcade light"
    },
    {
        id: "smart-watch-grant", fit: "contain", name: "Smart Watch Grant (15$)", hours: 4, section: "grants", note: "Stackable", image: "https://cdn.hackclub.com/01a03ee8-5cc4-7dd2-9ee5-9c97b01ff9af/smartwatch.png",
        description: "You might be able to track your health and become human again"
    },
    {
        id: "vampire-cloak", local: true, zoom: 1.3, name: "Vampire Cloak", hours: 3.5, section: "halloween", image: "https://cdn.hackclub.com/01a03ee8-5a06-7bd8-8c16-7c3f9a258158/coak.png",
        description: "Long vampire type cloak"
    },
    {
        id: "peripherals-grant", name: "Peripherals Grant (20$)", hours: 5, section: "grants", image: "https://cdn.hackclub.com/019d202f-1142-7f3e-9851-d3c3b0ce00ad/perpherals.png", note: "Stackable",
        description: "To build a more cooler setup and flex it! supports RAM sticks too"
    },
    {
        id: "movie-grant", name: "Movie Grant (5$)", hours: 1, section: "halloween", newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/019d2022-bcc0-7c96-bd2d-ad90363804d4/moviegrant.png",
        description: "Watch any type of movie you like!"
    },
    {
        id: "sticker-pile", name: "Bunch of Stickers", hours: 1, section: "halloween", image: "https://cdn.hackclub.com/019d1fe2-db71-782b-b9d0-60423696377d/pile_of_stickers.png",
        description: "just a bunch  of stickers from HQ!"
    },
    {
        id: "desk-lamp", local: true, name: "Desk Lamp", hours: 10, section: "halloween", image: "https://cdn.hackclub.com/01a03a25-41b7-712b-9f80-a3fa2f019eac/lamp.png",
        description: "This is the lamp from the main menu screen. high quality and durable. Very cool."
    },
    {
        id: "samsung-990-pro-1tb", local: true, fit: "contain", name: "Samsung SSD 990 PRO 1TB", hours: 50, section: "tech", image: "https://cdn.hackclub.com/01a03ed1-09ac-7b08-860e-e3af7f796da7/SSD%20nvme.png",
        description: "a very fast NVME. you can store so many pictures and files in this one and QUICK"
    },
    {
        id: "keyboard-grant", name: "Keyboard Grant (10$)", hours: 2, section: "grants", note: "Stackable", image: "https://cdn.hackclub.com/01a03ec8-351c-743b-9507-ad976c6cf2a5/keygrant.png",
        description: "a 10$ grant you can stack to buy any keyboard of your choice!"
    },
    {
        id: "aula-f75-pro", local: true, zoom: 1.3, name: "AULA F75 Pro", hours: 17, section: "tech", image: "https://cdn.hackclub.com/01a03ed1-0866-7139-a8db-f26413b45162/aulaf75.png",
        description: "one of peakest keyboards in existence! I use it daily"
    },
    {
        id: "phone-grant", name: "Phone Grant (50$)", hours: 11, section: "grants", image: "https://cdn.hackclub.com/01a03ed1-0bb6-739d-b9d8-6258a7922585/samsung.png",
        description: "A 50$ grant to buy any type of phone u want!"
    },
    {
        id: "manga-halloween-keycaps", local: true, name: "Japanese Styled Manga-Halloween Keycap Set", hours: 7, section: "halloween", image: "https://cdn.hackclub.com/01a03ec8-3627-7717-a7f8-4a8c1dde9b42/japkeyboard.png",
        description: "A manga styled black and white keycap set! fits the halloween vibe imo"
    },
    {
        id: "pacman-keycaps", local: true, name: "Pacman Keycaps", hours: 3, section: "halloween", note: "OEM/Cherry/XDA only", image: "https://cdn.hackclub.com/01a03ed1-0e05-70a0-8861-2c80406402dc/pacmancaps.png",
        description: "ghostly keycaps from the game we all know and love - Pacman!!"
    },
    {
        id: "crucial-500gb-gen4", local: true, fit: "contain", name: "Crucial 500GB SSD NVMe PCIe Gen4", hours: 28, section: "tech", newUntil: NEW_UNTIL, image: "https://cdn.hackclub.com/01a049b5-8931-7fec-afb5-db25c4c0bfbc/crucial_500gb.png",
        rates: { us: 23, india: 33, uae: 23, canada: 30, eu: 25, australia: 23, uk: 25 },
        description: "A high performance NVME. High Speed, stores a lot of stuff at once ^_^"
    },
    {
        id: "ssd-usb-enclosure", name: "SSD SATA To USB Encloser", hours: 2.5, section: "tech", newUntil: NEW_UNTIL, image: "https://cdn.hackclub.com/01a049b5-8bc2-7d11-b892-03717542ccac/encloser.png",
        description: "keep your SSD safe by enclosing it inside this case! protective cover."
    },
    {
        id: "completion-grant", name: "Completion Grant (2.5$)", hours: 0.5, section: "grants", note: "Stackable", image: "https://cdn.hackclub.com/01a049b5-8aa0-7ea8-a003-5e512509c5a7/usd.png",
        access: "cg", newUntil: NEW_UNTIL,
        description: "This is bought to accomodate any extra funds you need for your item or use it to pay customs or taxes!"
    },
    {
        id: "sata-ssd-2tb", local: true, fit: "contain", name: "SATA SSD 2TB", hours: 33, section: "tech", newUntil: NEW_UNTIL,
        regions: ["global", "eu", "us", "india", "canada", "uae", "uk"],
        image: "https://cdn.hackclub.com/01a04d22-9205-7fb6-b69d-5f0cf947719e/WD_2TB.png",
        rates: { us: 28, india: 27, uae: 22, canada: 34, uk: 32, eu: 25 },
        description: "A high speed 2.5inch SSD. You can store 2TB worth of data in this one. so peak"
    },
    {
        id: "crucial-1tb-nvme", local: true, fit: "contain", name: "Crucial 1TB NVME SSD", hours: 36, section: "tech", newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/01a04d22-93c1-7daf-9678-409af677843e/crucial_E100_1TB.png",
        images: {
            uk: "https://cdn.hackclub.com/01a03ed1-0cee-737c-8fd9-7bf1e6abf172/crucial_ind.png",
            eu: "https://cdn.hackclub.com/01a03ed1-0cee-737c-8fd9-7bf1e6abf172/crucial_ind.png",
            australia: "https://cdn.hackclub.com/01a03ed1-0cee-737c-8fd9-7bf1e6abf172/crucial_ind.png"
        },
        rates: { us: 32, india: 35, uae: 33, canada: 36, uk: 36, eu: 40, australia: 35 },
        description: "Another High-End Gen 4 NVME for all of your needs! this one's 1TB! so much space :O"
    },
    {
        id: "storage-grant", name: "Storage Grant (10$)", hours: 2, section: "grants", note: "Stackable", newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/01a04d2b-1a86-7aba-ba27-5c66b34b7642/storage.png",
        description: "10$ grant to buy a storage device of your choice!"
    }
];

// regions
export const SHOP_REGIONS = [
    { id: "global", name: "Global" },
    { id: "eu", name: "EU" },
    { id: "us", name: "United States" },
    { id: "india", name: "India" },
    { id: "canada", name: "Canada" },
    { id: "australia", name: "Australia" },
    { id: "uae", name: "United Arab Emirates" },
    { id: "uk", name: "United Kingdom" }
];

export function itemInRegion(item, regionId) {
    if (!item || !Array.isArray(item.regions)) return true;
    return item.regions.includes(regionId);
}

export function isRegion(id) {
    return SHOP_REGIONS.some(entry => entry.id === id);
}

export function regionName(id) {
    const entry = SHOP_REGIONS.find(item => item.id === id);
    return entry ? entry.name : null;
}

// regional artwork
export function itemImage(item, regionId) {
    if (!item) return "";
    if (item.images && Object.prototype.hasOwnProperty.call(item.images, regionId)) {
        return item.images[regionId];
    }
    return item.image;
}

// regional pricing
export function itemHours(item, regionId) {
    if (!item) return 0;
    if (item.rates && Object.prototype.hasOwnProperty.call(item.rates, regionId)) {
        return item.rates[regionId];
    }
    return item.hours;
}

// restricted items
export function itemUnlocked(item, grants) {
    if (!item || !item.access) return true;
    return Array.isArray(grants) && grants.includes(item.access);
}

export const MAX_QUANTITY = 999;

// lookup
export function findItem(itemId) {
    if (typeof itemId !== "string") return undefined;
    return SHOP_ITEMS.find(item => item.id === itemId);
}

// hackatime
export const HACKATIME_SINCE = "2026-08-21";
