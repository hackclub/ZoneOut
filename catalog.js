// the catalogue, shared by the shop page and the order route
export const SHOP_ITEMS = [
    {
        id: "big-blahaj", name: "Big Blahaj", hours: 7, image: "https://cdn.hackclub.com/01a02cc0-c7ae-73c7-9d28-3f553f894d6e/blahaj.png",
        description: "A metre of shark. very huggable"
    },
    {
        id: "smolhaj", name: "Smolhaj", hours: 3, image: "https://cdn.hackclub.com/01a02cc0-c7ae-73c7-9d28-3f553f894d6e/blahaj.png",
        description: "Same same but smaller - 55cm"
    },
    {
        id: "yuki-chan-seal", name: "Yuki Chan Seal Plush", hours: 6.5, image: "https://cdn.hackclub.com/019d2024-51c4-707f-98e2-5bf06221e77f/yuki-chan.png",
        description: "Cieling."
    },
    {
        id: "hardware-grant", name: "Hardware Equipment Grant (10$)", hours: 2.5, image: "https://cdn.hackclub.com/01a02cc4-fab0-7bb8-bfe9-4d5cd77629a9/hardware.png",
        description: "Get a 10$ hardware grant to buy new tech parts for your project!"
    },
    {
        id: "thermal-camera", name: "Attachable Thermal Camera", hours: 20, image: "https://cdn.hackclub.com/01a02cc0-c701-7983-8df3-c5e6a732116e/thermalcam.png",
        description: "Look at things that are HOT."
    },
    {
        id: "emf-reader", name: "EMF Reader", hours: 3, image: "https://cdn.hackclub.com/01a02cc0-c65a-786b-9f3a-840c3fe70e65/emf.png",
        description: "demonology irl. detect ghosts and stuff im assuming"
    },
    {
        id: "fairy-lights", name: "Halloween Fairy Lights", hours: 2, image: "https://cdn.hackclub.com/01a02cc0-c5a3-7d6e-adf8-d0f32f62af05/fairylights.webp",
        description: "A purple orange and green or purple/orange mix of lights! [dm @Kuzu for the colours]!"
    },
    {
        id: "jack-o-lantern", name: "Halloween Jack-o-Lantern", hours: 4, image: "https://cdn.hackclub.com/01a02cc0-c496-73ab-8b1d-da22a324b5a0/jacklantern.png",
        description: "jack and o and lantern"
    },
    {
        id: "halloween-decor", name: "Halloween Decor Grant (10$)", hours: 2, image: "https://cdn.hackclub.com/01a02cc0-c3f7-740f-9890-e7c01b4da9f6/hallodecor.png", note: "",
        description: "A 10$ grant  to buy any sort of halloween decor! :ghost: ."
    },
    {
        id: "halloween-costume", name: "Halloween Costumes Grant (10$)", hours: 2, image: "https://cdn.hackclub.com/01a02cc0-c30d-72ec-b6c3-c600074f0b70/costume.png", note: "",
        description: "10$ to get a costume! become something cool gng"
    },
    {
        id: "ai-credits", name: "AI Credits (10$)", hours: 2, image: "https://cdn.hackclub.com/01a02d3b-bd0a-7c35-9cc3-58a37d8fc3ee/ai.webp",
        description: "get a 10$ grant to buy some ai creds :3 stackable!"
    },
    {
        id: "steam-gift-card", name: "Steam Gift Card", hours: 3, image: "https://cdn.hackclub.com/019d2025-f118-7993-b534-8c3c129d92f6/steam.png", note: "$10",
        description: "A 10$ steam gift card! stackable owo"
    },
    {
        id: "minecraft", name: "Minecraft", hours: 7, image: "https://cdn.hackclub.com/01a02cc0-c1f3-71bf-9fab-4fe3c3f0af43/minecraft.png",
        description: "EVERYBODY'S FAV BLOCK GAME!!!!"
    },
    {
        id: "laptop-grant", name: "Laptop Grant (100$)", hours: 25, image: "https://cdn.hackclub.com/019d2030-d829-7af1-bf86-6ada946bdf83/laptopg.png",
        description: "need me some devices - stackable!"
    },
    {
        id: "yubikey-5c-nfc", name: "YubiKey 5C NFC", hours: 14, image: "https://cdn.hackclub.com/01a02cc0-c106-7d53-ae5a-75eccd5f6a4e/yubikey.png",
        description: "A yubikey :) keep things secure"
    },
    {
        id: "geometry-dash", name: "Geometry Dash", hours: 2, image: "https://cdn.hackclub.com/01a02cc0-c01d-7302-bf42-91690d77abfb/gd.png",
        description: "my fav rythm-based game fr. "
    },
    {
        id: "pacman-arcade-led", name: "Pac-Man Arcade LED", hours: 8, image: "https://cdn.hackclub.com/01a02cc0-bf5d-7691-8480-f0053b99b3b2/pacman.png",
        description: "A pacman and ghost themed LED arcade light"
    },
    {
        id: "smart-watch-grant", name: "Smart Watch Grant (15$)", hours: 4, image: "https://cdn.hackclub.com/01a02cc0-be7f-7ca9-a52e-8d06f2081b87/smartwatch.png",
        description: "You might be able to track your health and become human again"
    },
    {
        id: "vampire-cloak", name: "Vampire Cloak", hours: 3.5, image: "https://cdn.hackclub.com/01a02cc0-bda4-783f-9f86-71deb5850e5b/coak.png",
        description: "Long vampire type cloak"
    }
];

// order limits
export const MAX_QUANTITY = 5;

// lookup
export function findItem(itemId) {
    if (typeof itemId !== "string") return undefined;
    return SHOP_ITEMS.find(item => item.id === itemId);
}
