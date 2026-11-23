# Photo edits

The bottle photos on the site are edited copies of the client's originals, which are kept unchanged in the media library (items 99, 102, 106 and 108). The blue "Product of United Kingdom" banners are replaced with lettering that follows each label's curved bottom edge: pale gold on the green labels, white on the blue one.

| Media item | File | What changed |
|---|---|---|
| 135 | `olive-emerald-green-750ml-330ml-v2.jpg` | Cropped above the "Design Concepts" plaque; the three blue "Product of United Kingdom" banners replaced with curved pale-gold lettering (`replace-uk-banner.ps1`). Used for the home hero and the Products page Range photo. |
| 136 | `olive-emerald-green-750ml-v2.jpg` | The same, cropped to the 750ml bottle only. Used on the Emerald Green Spring cards. |
| 139 | `olive-classic-olive-green-750ml.jpg` | From item 102. Classic Olive Green cards and shop product. |
| 140 | `olive-forest-reserve-750ml.jpg` | From item 106. Dark Green – Forest Reserve cards and shop product. |
| 141 | `olive-deep-sapphire-blue-750ml.jpg` | From item 99 (white lettering). Deep Sapphire Blue cards, shop product and the About page photo. |

`replace-uk-banner.ps1` runs in Windows PowerShell (System.Drawing). It measures each label's gold bottom edge from the pixels beside the banner, fits a curve, repaints the banner in the label's green and gold, and writes PRODUCT OF UNITED KINGDOM along the curve in Palatino Linotype. Run it with `-In <original.jpg> -Out <new.jpg> [-Preview]`; the banner positions for each photo are in the `switch` near the end of the script.

## Current versions (23 Nov 2026)

The first edits drew a thin flat gold line where the banner had been, so the lettering sat on the border. The script now copies the border's real colour profile (outer dark line, gold, inner shadow) from the label's straight side and redraws the curved edge with it at full thickness, and keeps the lettering a set gap inside it.

| Media item | File | Used for |
|---|---|---|
| 145 | `olive-emerald-green-750ml-330ml-v3.jpg` | Home hero, Products Range photo, link previews, Emerald Green Spring 330ml product |
| 146 | `olive-emerald-green-750ml-v3.jpg` | Emerald Green Spring cards and 750ml product |
| 147 | `olive-classic-olive-green-750ml-v2.jpg` | Classic Olive Green cards and product |
| 148 | `olive-forest-reserve-750ml-v2.jpg` | Forest Reserve cards and product |
| 149 | `olive-deep-sapphire-blue-750ml-v2.jpg` | Deep Sapphire Blue cards and product, About page photo |

Items 135, 136 and 139 to 141 are the earlier versions and are no longer used.
