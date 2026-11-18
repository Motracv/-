# Ryusion artwork

Original character requested by the user: brown bob, black T-shirt, gray long shorts, brown shoes; female human earth defender carrying a large shield. These two PNGs were generated for the game from the approved concept.

- `portrait.png`: 1024×1536 RGBA illustration for recruitment and character details.
- `combat.png`: 1536×1024 transparent RGBA atlas, 4 columns × 2 rows. Read left to right: idle, guard, wind-up, shield strike, charge, shield plant, barrier lift, hurt. Every pose faces right; the arena mirrors the opposing team.

`school/ryusion.js` owns the atlas mapping, bounded cached poses and movement/effects. These assets contain no game rules or text; all descriptions remain accessible as live UI text.
