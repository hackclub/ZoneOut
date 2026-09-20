// the catalogue, shared by the shop page and the order route
export const SHOP_SECTIONS = [
    { id: "halloween", name: "Halloween Shopping" },
    { id: "tech", name: "Tech Items" },
    { id: "grants", name: "Grants" },
    { id: "games", name: "Fun Games and Plushies!" }
];

// new-item label expiry
const DEPLOYED_AT = "2026-09-13T00:00:00Z";
const NEW_DAYS = 6;
const NEW_UNTIL = new Date(Date.parse(DEPLOYED_AT) + NEW_DAYS * 86400000).toISOString();

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
        id: "hardware-grant", fit: "contain", name: "Hardware Equipment Grant (10$)", hours: 2, section: "grants", note: "Stackable", image: "https://cdn.hackclub.com/01a03ee8-573e-709c-a690-49a94b9ba762/hardware.png",
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
        id: "games-grant", name: "Games Grant (10$)", hours: 2, section: "grants", note: "Stackable", newUntil: NEW_UNTIL, image: "https://cdn.hackclub.com/01a05379-d126-716e-a62a-aa5a433c3b93/gamegrant.png",
        description: "buy any sort of **game** using this 10$ grant from various sellers.",
        modalNote: "This grant allows you to buy games but prohibits spending on any in-app purchases or cosmetics."
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
        id: "yubikey-5c-nfc", local: true, fit: "contain", name: "YubiKey 5C NFC", hours: 14, section: "tech", image: "https://cdn.hackclub.com/01a03ee8-5dc9-7610-9f4e-1e82f758f935/yubikey.png",
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
        id: "movie-grant", name: "Movie Grant (5$)", hours: 1, section: "halloween", note: "Stackable", newUntil: NEW_UNTIL,
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
        id: "phone-grant", name: "Phone Grant (50$)", hours: 11, section: "grants", note: "Stackable", image: "https://cdn.hackclub.com/01a03ed1-0bb6-739d-b9d8-6258a7922585/samsung.png",
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
        id: "ssd-usb-enclosure", local: true, name: "SSD SATA To USB Encloser", hours: 2.5, section: "tech", newUntil: NEW_UNTIL, image: "https://cdn.hackclub.com/01a049b5-8bc2-7d11-b892-03717542ccac/encloser.png",
        description: "keep your SSD safe by enclosing it inside this case! protective cover."
    },
    {
        id: "completion-grant", name: "Completion Grant (2.5$)", hours: 0.5, section: "grants", note: "Stackable", image: "https://cdn.hackclub.com/01a049b5-8aa0-7ea8-a003-5e512509c5a7/usd.png",
        access: "cg", newUntil: NEW_UNTIL,
        description: "This is bought to accomodate any extra funds you need for your item or use it to pay customs or taxes!"
    },
    {
        id: "pay-customs", fit: "contain", name: "Pay Customs(5$)", hours: 1, section: "grants", note: "Extras", limit: 4, newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/01a09b6f-1c55-73fe-88ba-eba3294e6106/customs.png",
        description: "ts to help pay your customs taxes! you're not alone in this vro"
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
        id: "storage-grant", name: "Storage and Ram Grant (50$)", hours: 11, section: "grants", note: "Stackable", newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/01a04d2b-1a86-7aba-ba27-5c66b34b7642/storage.png",
        description: "Buy any sort of storage device or RAM!"
    },
    {
        id: "8bitdo-ultimate-2c", local: true, fit: "contain", name: "8BitDo Ultimate 2C", hours: 8, section: "tech", newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/01a09b03-e7cc-7e44-9a75-30a49ae3b4ed/8BitDo%20Ultimate%202C%20Wireless.png",
        description: "A budget wireless controller for your gaming needs!"
    },
    {
        id: "8bitdo-ultimate-3-mode", local: true, fit: "contain", name: "8BitDo Ultimate 3-mode Controller", hours: 15, section: "tech", newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/01a09b03-e6ed-71c4-b7e7-389c39915204/8BitDo%20Ultimate%203-mode.png",
        description: "A full fledged premium controller. works for most devices, has a charging port too. Goated controller"
    },
    {
        id: "sony-wireless-headset", local: true, fit: "contain", name: "Sony Wireless Headset", hours: 30, section: "tech", newUntil: NEW_UNTIL,
        regions: ["global", "us", "india", "uae", "canada"],
        rates: { us: 25, india: 25, uae: 20, canada: 45 },
        image: "https://cdn.hackclub.com/01a09b03-e5d2-762c-90e7-76cc1e8498dd/headphonesony.png",
        description: "A comfy headset that you can use to listen to peak linkin park songs. I TRIED SO HARD AND GOT SO FAR-"
    },
    {
        id: "nothing-cmf-pro-2", local: true, fit: "contain", name: "Nothing CMF Pro 2", hours: 15, section: "tech", newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/01a09b03-f812-7d96-ac0a-706127a80f27/cmfbuds.png",
        description: "one of the most used buds in town. you'll hear nothing from the outside but everything on the inside. rock n roll"
    },
    {
        id: "bambu-a1-mini", local: true, fit: "contain", name: "Bambu A1 mini", hours: 55, section: "tech", note: "Base Model", newUntil: NEW_UNTIL,
        rates: { us: 50, india: 50, eu: 50, canada: 45, uk: 45, australia: 50, uae: 60 },
        image: "https://cdn.hackclub.com/01a09b03-f514-7bdd-9705-eecde4a4ce7e/a1mini3d.png",
        description: "The best 3D printer to get you started with 3D printing! mini version. smol but powerful!"
    },
    {
        id: "bambu-a1-mini-combo", local: true, fit: "contain", name: "Bambu A1 mini (Combo Model)", hours: 85, section: "tech", note: "Multi-Colour Printing support", newUntil: NEW_UNTIL,
        rates: { us: 70, india: 85, eu: 75, canada: 65, uk: 75, australia: 85, uae: 97 },
        image: "https://cdn.hackclub.com/01a09b03-f2ce-71ab-ba39-e63a640e9632/a1mini3dcombo.png",
        description: "The best 3D printer to get you started with 3D printing! mini version. smol but powerful. Includes multi-colour printing - AMS Lite!"
    },
    {
        id: "bambu-lab-a1", local: true, fit: "contain", name: "Bambu Lab A1", hours: 68, section: "tech", note: "Base Model", newUntil: NEW_UNTIL,
        regions: ["global", "india", "us", "eu", "australia", "uk", "canada"],
        rates: { india: 70, us: 65, eu: 65, australia: 65, uk: 65, canada: 60 },
        image: "https://cdn.hackclub.com/01a09b03-f6d2-7513-acc8-ade37f21f255/3dprinter.png",
        description: "To print things that aren't mini... big brother of the A1 mini"
    },
    {
        id: "bambu-lab-a1-combo", local: true, fit: "contain", name: "Bambu Lab A1 (Combo Model)", hours: 100, section: "tech", note: "Multi-Colour Printing support", newUntil: NEW_UNTIL,
        rates: { india: 105, us: 90, eu: 93, australia: 100, uk: 93, canada: 85, uae: 130 },
        image: "https://cdn.hackclub.com/01a09b03-f38e-739b-99e3-927ba326ab8f/a13Dcombo.png",
        description: "To print things that aren't mini... big brother of the A1 mini. Includes multi-colour printing: AMS Lite!"
    },
    {
        id: "3d-printing-credits", fit: "contain", name: "3D Printing Credits (10$)", hours: 2, section: "grants", note: "Stackable", newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/01a09b03-f20f-79ab-95a7-7afbb4bc5d1a/3d%20printing%20creds.png",
        description: "To keep printing! You can spend this at any of the following places: Bambu Lab, Prusa, Trianglelab, Wol3D, Numakers, Ideal3D, Setterox, Polymaker, DIY3D, Creality, South African 3D Printing Store, Flashforge"
    },
    {
        id: "headphones-iems-grant", fit: "contain", name: "Headphones and IEMs grant (10$)", hours: 2, section: "grants", note: "Stackable", newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/01a09b03-f5e2-7460-9418-4d590c7eca57/iemsandhead.webp",
        description: "Get yourself a headphone or even better, an IEM!"
    },
    {
        id: "monitor-grant", fit: "contain", name: "Monitor Grant (50$)", hours: 11, section: "grants", note: "Stackable", newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/01a09b1f-335a-7d22-b15d-47a0d43fac1d/monitorgrant.png",
        description: "Get yourself a viewing device or monitor of any sort!"
    },
    {
        id: "motherboard-cpu-grant", fit: "contain", name: "Motherboard/CPU Grant (50$)", hours: 11, section: "grants", note: "Stackable", newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/01a09b20-c573-734f-ad98-8a64fb8b7d98/motherboardcpu.png",
        description: "Buy the heart and brain of your PC setup! Motherboard, CPU or both!"
    },
    {
        id: "asus-tuf-vg27aq3a", local: true, fit: "contain", name: "ASUS TUF Gaming VG27AQ3A Display", hours: 45, section: "tech", newUntil: NEW_UNTIL,
        regions: ["us"],
        image: "https://cdn.hackclub.com/01a09b03-eea5-758e-8cb6-e5d2c46e1936/ASUS%20TUF%20Gaming%20VG27AQ3A.png",
        description: "A very good gaming monitor! 27'', 1440p and 180Hz, height adjustment and what not."
    },
    {
        id: "lenovo-legion-r27qe-india", local: true, fit: "contain", name: "Lenovo Legion R27qe Gen 2 Display (India)", hours: 45, section: "tech", newUntil: NEW_UNTIL,
        regions: ["india"],
        image: "https://cdn.hackclub.com/01a09b03-efbd-79cb-ab12-61642816936e/LenovoLegionR27qe.png",
        description: "A very good gaming monitor! 27'', 1440p and 200Hz, height adjustment and what not."
    },
    {
        id: "lenovo-legion-r27qe-eu", local: true, fit: "contain", name: "Lenovo Legion R27qe Gen 2 Display (EU)", hours: 45, section: "tech", newUntil: NEW_UNTIL,
        regions: ["eu"],
        image: "https://cdn.hackclub.com/01a09b03-efbd-79cb-ab12-61642816936e/LenovoLegionR27qe.png",
        description: "A very good gaming monitor! 27'', 1440p and 200Hz, height adjustment and what not."
    },
    {
        id: "aoc-q27g4xf", local: true, fit: "contain", name: "AOC Q27G4XF Display", hours: 45, section: "tech", newUntil: NEW_UNTIL,
        regions: ["uk"],
        image: "https://cdn.hackclub.com/01a09b03-ed89-78cb-9ca2-a9ceb075ee87/AOC%20Q27G4XF.png",
        description: "A very good gaming monitor! 27'', 1440p and 180Hz, height adjustment and what not."
    },
    {
        id: "asus-tuf-vg27aq5a-j", local: true, fit: "contain", name: "ASUS TUF Gaming VG27AQ5A-J Display", hours: 47, section: "tech", newUntil: NEW_UNTIL,
        regions: ["uae"],
        image: "https://cdn.hackclub.com/01a09b03-eb43-7d6a-9bc9-80ed410bfe8f/ASUS%20TUF%20Gaming%20VG27AQ5A-J.png",
        description: "A very good gaming monitor! 27'', 1440p and 210Hz, height adjustment and what not."
    },
    {
        id: "aoc-27g4zr", local: true, fit: "contain", name: "AOC 27G4ZR Display", hours: 45, section: "tech", newUntil: NEW_UNTIL,
        regions: ["australia"],
        image: "https://cdn.hackclub.com/01a09b03-ea8e-7bf9-971f-349c8226caa8/AOC%2027G4ZR.png",
        description: "A very good gaming monitor! 27'', 1080p and 260Hz, height adjustment and what not."
    },
    {
        id: "ktc-h27t6", local: true, fit: "contain", name: "KTC H27T6 Display", hours: 47, section: "tech", newUntil: NEW_UNTIL,
        regions: ["canada"],
        image: "https://cdn.hackclub.com/01a09b03-e9be-7029-8a2e-01c27a676f25/KTC%20H27T6.png",
        description: "A very good gaming monitor! 27'', 1440p and 200Hz, height adjustment and what not."
    },
    {
        id: "samsung-odyssey-g50d", local: true, fit: "contain", name: "SAMSUNG 27-Inch Odyssey G50D", hours: 50, section: "tech", newUntil: NEW_UNTIL,
        regions: ["global"],
        image: "https://cdn.hackclub.com/01a09b03-e8c5-708e-843c-a8cb125da589/SAMSUNG%20Odyssey%20G50D.png",
        description: "A very good gaming monitor! 27'', 1440p and 180Hz, height adjustment and what not."
    },
    {
        id: "innioasis-y1", local: true, fit: "contain", name: "Innioasis Y1 MP3 Player", hours: 18, section: "tech", newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/01a09b6b-030e-7400-b2ed-814f88152bd5/inoasisv1.png",
        description: "A handy MP3 player! 64GB version."
    },
    {
        id: "innioasis-y2", local: true, fit: "contain", name: "Innioasis Y2 MP3 Player", hours: 20, section: "tech", note: "Better version of the Y1", newUntil: NEW_UNTIL,
        image: "https://cdn.hackclub.com/01a09b03-f0e8-750c-b526-a17d150fcb24/innoasisv2.png",
        description: "The better MP3 player. 72GB and more cool features."
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

// per-user order caps
export function itemLimit(item) {
    if (!item || !Number.isInteger(item.limit) || item.limit < 1) return null;
    return item.limit;
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

// entity breakout event
export const EVENT_SINCE = "2026-09-10";
export const EVENT_HOUR_GOAL = 280;
