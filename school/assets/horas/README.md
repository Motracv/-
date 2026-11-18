# 호라스 (Horas) production artwork

These assets were generated for the user's approved original UR character concept. The supplied design is a pink-haired, cat-eared woman with rose/pale-blue heterochromia, a large ice-blue ribbon, flowing blue sleeves and dress tails, white socks, and pale mint high-top shoes. No third-party game artwork is embedded. The pickup image contains no painted UI, labels, prices, dates, or probability promises: the game supplies accessible interactive controls and actual rules.

## Files

- `combat.webp`: transparent, lossless WebP; **1536×1056**, four columns and three rows. Each cell is **384×352**. Every cell uses foot anchor **(192, 328)**. Body height is approximately 300px. The sprite faces right.
- `combat.json`: exact frame rectangles, body bounds and suggested sequences. Frames 0 idle; 1–3 inward basic sweep; 4–6 outward basic sweep; 7–8 five-orb fusion pose; 9–10 ritual command/release; 11 hurt. Effects and orb counts are drawn from actual game state, not baked into the image.
- `portrait.webp`: transparent smooth anime illustration, **768×1152**, for recruitment reveals and character details. Unlike battle sprites, this intentionally uses an illustration style. Face is in the upper-right portion of the full-body composition.
- `cutin.webp`: transparent **640×640** face/upper-body crop of the same illustration. Face center is approximately (260, 220), for the short ultimate cut-in.
- `pickup.webp`: opaque **1672×941** textless nighttime school courtyard key art with the character on the right and quiet space on the left for live UI.

Load production assets with `?v=horas1`. Canvas drawing should preserve aspect ratio and respect the common foot anchor. DOM previews may use object-fit and crop explicitly; the combat image should not be stretched. Runtime effects use bounded vectors/particles and the shared simulation clock.

## Provenance and packaging

Reference concepts were approved in the conversation:

- `/workspace/generated_images/exec-e996d672-6cc1-4000-a540-23fe4b6d9e72.png`: revised two-basic-attack / five-orb / ritual storyboard.
- `/workspace/generated_images/exec-eebeb24d-e7d6-4ad6-a836-7fe8068211de.png`: illustration-style pickup screen concept.

The image generation tool produced these new production sources:

- `exec-69ab8f9e-0825-4e09-9f0e-3323a49b6df7.png`: twelve transparent combat poses, 1536×1024.
- `exec-0939fc62-abc8-4fd5-9f80-f8b8620531bc.png`: transparent full-body illustration, 1024×1536.
- `exec-b87cdc51-42bf-4067-b0bd-ff08b3f55910.png`: textless scenic pickup illustration, 1672×941.

Sources remain untouched in the generated-images directory. ImageMagick performs cropping, frame packing, WebP encoding and portrait downsampling only. Combat frames are not stretched; alpha-derived foot positions are translated onto the common grid. Each frame is cropped to its visible alpha bounds (alpha > 12/255) with two pixels of padding before packing, removing isolated near-zero-alpha noise in otherwise empty cell gutters without changing visible character pixels. `combat.json` records source cells and original foot positions for reproducibility. The portrait is resampled to 768×1152, while the cut-in is the 640×640 source rectangle at (360, 30). The combat WebP is lossless; illustration WebPs use quality 86–90 with alpha retained.

Some raw image viewers display the RGB values stored underneath zero alpha as pink rectangular artifacts. Actual alpha compositing has been checked over navy, and the browser validation checks transparent gutters in every frame; these hidden colors do not appear in game.

## Validation

Local Chromium decodes all four WebPs. Twelve combat frames are distinct, all four image dimensions match the manifest, all combat cell edge gutters are fully transparent, each frame has substantial opaque character pixels, and every visible foot finishes at the common baseline. Portrait and cut-in corners are alpha zero. Navy composites were visually reviewed. Metadata contains SHA-256 and byte sizes in `assets.json`.
