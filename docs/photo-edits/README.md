# Photo edits

The bottle photos on the site are edited copies of the client's originals. The originals stay unchanged in the media library.

## Photos in use (since 25 November 2026)

| Media item | File | Used for | Made from |
|---|---|---|---|
| 196 | `olive-white-750ml-330ml-hd2.jpg` | Home hero | `SD-White-2-Glass-Bottles-750ml-330ml-Label-final-1.jpg` (178) |
| 191 | `olive-classic-olive-green-750ml-hd2.jpg` | Classic Olive Green cards and product 66 | `olive-classic-olive-green-750ml-v3.jpg` (153) |
| 192 | `olive-forest-reserve-750ml-hd2.jpg` | Dark Green – Forest Reserve cards and product 67 | `olive-forest-reserve-750ml-v3.jpg` (154) |
| 193 | `olive-deep-sapphire-blue-750ml-hd2.jpg` | Deep Sapphire Blue cards, About page photo, product 68 | `olive-deep-sapphire-blue-750ml-v3.jpg` (155) |
| 194 | `olive-emerald-green-750ml-hd2.jpg` | Emerald Green Spring cards and product 69 | `SD-Emerald-Green-Glass-Bottle-750ml-Label.jpg` (164) |
| 195 | `olive-emerald-green-750ml-330ml-hd2.jpg` | Products page Range photo, link previews, product 70 | `SDEMER1.jpg` (161) |

What the `-hd2` photos have:

- **Sharp at any size.** Each photo was upscaled 4x with Real-ESRGAN and saved at 2560px on its long side (WordPress's limit before it makes a `-scaled` copy). The pages use the full-size file, and Jetpack serves smaller copies to small screens. Before this, the Home hero and the Emerald card used WordPress's 300px "medium" copies stretched to full width, which is why they looked blurred.
- **"Product of United Kingdom" with the Union flag** on every label, big and small, matching the client's sample (`X.jpg`, media item 173). The lettering follows the curve of the label's bottom gold border, sits clear of the border and of the label's divider lines, in a Palatino-style serif: gold on the green and blue labels, cream on the pale Classic Olive label, dark green on the white label. The flag is drawn, not copied, so it stays sharp.
- **No blue banners.** Where the client's original had the blue "Product of United Kingdom" banner, it is removed and the label and its gold border rebuilt behind it.
- **No olive sprig** on the rock in front of the bottles, and no "Design Concepts" plaque.

The lettering and flag are drawn after the upscale, at full resolution, so they are as sharp as the type on a printed label.

Known limits: the small-bottle labels in the client's renders have some garbled small print (for example "300% NAYUMAL" instead of "100% NATURAL"). That is in the originals and was not changed.

The Playwright range test fails if a page shows one of the originals or an earlier edit, or a 300px copy of a photo.

## Earlier versions (not used, can be deleted)

| Media items | Why replaced |
|---|---|
| 129, 132 | Plaque removed, but the blue banners were still there |
| 135, 136, 139, 140, 141 | Banners replaced, but the gold border was redrawn as a thin flat line, so the lettering sat on it |
| 147, 148, 149 | Bottle labels fixed, but the big labels had no lettering, unlike the Emerald Green one |
| 145, 146, 153, 154, 155 | Capitals lettering with no flag, an olive sprig on the rock, and only about 1000px across |
| 182–187 (`-hd`) | On some labels the lettering was too wide, so "Product" ran into the curved border and the flag touched a divider line |

## The scripts

`hd/` holds the Python pipeline that made the `-hd` photos. It needs Python 3 with Pillow, NumPy, OpenCV, PyTorch and spandrel, two model files in `models/` (`RealESRGAN_x4plus.pth` saved as `x4.pth`, from the Real-ESRGAN GitHub releases, and `big-lama.pt`, from the `Sanster/models` GitHub releases) and the TeX Gyre Pagella font (`fonts-texgyre` on Debian/Ubuntu). Run them from a folder that has `dl/` (the source photos), `models/` and `work/`:

```bash
python3 stage1.py classic        # remove the old lettering or banners, the olive sprig and the plaque (LaMa inpainting)
python3 upscale.py work/classic_s1.png work/classic_x4.png   # 4x Real-ESRGAN upscale, about 3 minutes on 4 CPU cores
python3 render.py classic        # curved lettering and flag at 2.5x the source size
```

`cfg.py` has one entry per photo: the source file, where each label's bottom border runs (three rough points; the script fits the exact curve), the blue banner boxes, and the outlines of the olive sprigs and the plaque. Per label, `w` sets the lettering's width as a share of the border span (0.58 on the big labels, 0.74 on the bottles), and `xc` and `lift` move it sideways and up where a label needs it, as on the big label of the 750ml/330ml photo, whose divider lines run lower. A new photo needs its own entry.

`replace-uk-banner.ps1` is the earlier Windows PowerShell script that made the `-v3` photos. It is kept for reference.
