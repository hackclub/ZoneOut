// the catalogue, shared by the shop page and the order route
export const SHOP_SECTIONS = [
    { id: "halloween", name: "Halloween Shopping" },
    { id: "tech", name: "Tech Items" },
    { id: "grants", name: "Grants" },
    { id: "games", name: "Fun Games and Plushies!" }
];

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
        description: "To build a more cooler setup and flex it!"
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
        id: "crucial-p310-1tb", local: true, regions: ["india"], fit: "contain", name: "Crucial P310 1TB NVME SSD", hours: 43, section: "tech", note: "India only", image: "https://cdn.hackclub.com/01a03ed1-0cee-737c-8fd9-7bf1e6abf172/crucial_ind.png",
        description: "ships for indians only; a pretty good NVME"
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
        id: "phone-grant", name: "Phone Grant (50$)", hours: 12, section: "grants", image: "https://cdn.hackclub.com/01a03ed1-0bb6-739d-b9d8-6258a7922585/samsung.png",
        description: "A 50$ grant to buy any type of phone u want!"
    },
    {
        id: "manga-halloween-keycaps", local: true, name: "Japanese Styled Manga-Halloween Keycap Set", hours: 7, section: "halloween", image: "https://cdn.hackclub.com/01a03ec8-3627-7717-a7f8-4a8c1dde9b42/japkeyboard.png",
        description: "A manga styled black and white keycap set! fits the halloween vibe imo"
    },
    {
        id: "pacman-keycaps", local: true, name: "Pacman Keycaps", hours: 3, section: "halloween", note: "OEM/Cherry/XDA only", image: "https://cdn.hackclub.com/01a03ed1-0e05-70a0-8861-2c80406402dc/pacmancaps.png",
        description: "ghostly keycaps from the game we all know and love - Pacman!!"
    }
];

// order limits
// regions
export const SHOP_REGIONS = [
    { id: "global", name: "Global" },
    { id: "eu", name: "EU" },
    { id: "us", name: "United States" },
    { id: "india", name: "India" },
    { id: "canada", name: "Canada" },
    { id: "australia", name: "Australia" }
];

export function itemInRegion(item, regionId) {
    if (!item || !Array.isArray(item.regions)) return true;
    return item.regions.includes(regionId);
}

export const MAX_QUANTITY = 5;

// lookup
export function findItem(itemId) {
    if (typeof itemId !== "string") return undefined;
    return SHOP_ITEMS.find(item => item.id === itemId);
}

// hackatime
export const HACKATIME_SINCE = "2026-08-21";
