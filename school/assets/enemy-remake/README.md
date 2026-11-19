# Cursed-school enemy artwork

24 generated monster families, each with four authored poses: idle, anticipation,
leftward attack, and special cast. The 96 transparent frames are packed into three
1024 × 2048 WebP atlases. Small spell effects are part of the cast artwork.

`atlas.json` maps all 45 original school object types, all 25 campaign kinds,
the five tower themes, and daily/weekly bosses to these families. Ordinary
variants in a chapter share its illustrated family; the game retains their
independent names, roles and combat rules. Ascension and hard chapters use the
corresponding thematic family. Existing Yeti and balloon art stays separate.

Every frame occupies a 256 × 256 cell and has a foot anchor of `[128,232]`.
Scale using `desiredHeight / family.bodyHeight`, because each family's four poses
share a scale that preserves its widest attack. Suggested idle body height is
68 game units for ordinary enemies and 116 for bosses. `family.crops` records
the exact source rectangle, original source foot, packing scale, and destination
cell. A few stepped source rectangles exclude a neighboring pose's cape or foot.

`company-emblem.webp` is the separately generated 256 × 256 navy and gold academy
shield with a book, sword, and laurel. It has no lettering or background.

`provenance.json` records image-generation prompts and source image filenames.
The originals remain in `/workspace/generated_images`. Repack with:

```sh
node tools/build-enemy-remake.cjs
```

The packer only crops, measures alpha, resizes, and encodes generated artwork.
It verifies that all 96 frames contain visible artwork and transparent gutters,
records the results in `validation.json`, and writes a review contact sheet to
`/tmp/school-enemy-remake-contact.png`. Final crops and alpha were also visually
checked over a dark game-like background.
