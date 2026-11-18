# Winter Yeti battle art

Original assets generated for 학교용병단 on 2026-11-18. Only this asset directory was changed by the asset task.

- `background.webp`: 1672×941 (approximately 16:9), snowy school courtyard at night, no characters or interface. The lower half is a clear combat floor. WebP quality 88, 359,762 bytes.
- `poses.png`: 1536×1024 RGBA, 3 columns × 2 rows of 512×512 cells. Six consistent Yeti poses face left. Losslessly recompressed PNG, 1,845,266 bytes. Combined delivery is approximately 2.10 MiB.
- `atlas.json`: cell positions and individual foot anchors. Use the anchors when drawing to avoid a small vertical jump between rows. The source poses are deliberately smaller than the cells so no meaningful character pixels cross a slice boundary.

| Index | Pose | Cell x,y | Foot anchor within cell |
| --- | --- | --- | --- |
| 0 | Idle | 0,0 | 256,424 |
| 1 | Fist windup | 512,0 | 256,424 |
| 2 | Ground slam | 1024,0 | 256,423 |
| 3 | Frost roar | 0,512 | 256,408 |
| 4 | Charging swipe | 512,512 | 256,407 |
| 5 | Defeat | 1024,512 | 256,405 |

Transparency was checked from decoded RGBA values: cell corners/gaps are transparent, the character interior is opaque or near opaque, and each silhouette at alpha >127 is fully inside its own cell. The generated PNG retains a few nearly transparent edge/halo pixels (alpha 1–16); the image was not manually masked. Most sprite content occupies 300–370 pixels of the 512-pixel cell, so draw a larger cell size for an imposing boss. Frost breath, expanding ice rings and attack trails should be drawn by the game renderer.

Generated originals are retained outside the repository:

- Background: `/workspace/generated_images/exec-f1b957a8-d817-4f3d-8f36-f268140af014.png`
- Original atlas: `/workspace/generated_images/exec-677670df-a124-48ad-b66b-e6d08a16bc63.png`
- Alpha cleanup: `/workspace/generated_images/exec-b0468c38-e069-49d0-b393-ae6adb889638.png`
- Final cell-safe atlas: `/workspace/generated_images/exec-fa14818f-9ed8-46e8-9a6c-d42ff7fa2e62.png`

The final PNG and its generated source have identical decoded RGBA pixels; only PNG compression settings changed.
