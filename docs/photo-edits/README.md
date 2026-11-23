# Photo edits

The bottle photos on the site are edited copies of the client's originals. The originals are kept unchanged in the media library (items 99, 102, 106 and 108).

What was changed:

- The blue "Product of United Kingdom" banners are replaced with lettering that follows each label's curved bottom edge: pale gold on the green labels, white on the blue one.
- The label's gold border is redrawn at its full thickness where the banner covered it.
- The big labels behind the bottles all carry the same curved PRODUCT OF UNITED KINGDOM lettering. (The Emerald Green one replaces a banner; the other three never had one, so the lettering is added.)
- The Emerald Green photo is cropped above a "Design Concepts" plaque. A one-bottle version is cropped from it for the product cards.

## Photos in use

| Media item | File | Used for |
|---|---|---|
| 145 | `olive-emerald-green-750ml-330ml-v3.jpg` | Home hero, Products page Range photo, link previews, Emerald Green Spring 330ml product |
| 146 | `olive-emerald-green-750ml-v3.jpg` | Emerald Green Spring cards and 750ml product |
| 153 | `olive-classic-olive-green-750ml-v3.jpg` | Classic Olive Green cards and product |
| 154 | `olive-forest-reserve-750ml-v3.jpg` | Dark Green – Forest Reserve cards and product |
| 155 | `olive-deep-sapphire-blue-750ml-v3.jpg` | Deep Sapphire Blue cards and product, About page photo |

The Playwright range test fails if a page shows one of the originals or an earlier edit.

## Earlier versions (not used, can be deleted)

| Media items | Why replaced |
|---|---|
| 129, 132 | Plaque removed, but the blue banners were still there |
| 135, 136, 139, 140, 141 | Banners replaced, but the gold border was redrawn as a thin flat line, so the lettering sat on it |
| 147, 148, 149 | Bottle labels fixed, but the big labels had no lettering, unlike the Emerald Green one |

## The script

`replace-uk-banner.ps1` runs in Windows PowerShell (System.Drawing, no other software). For each label it:

1. Finds the gold bottom border beside and below the banner and fits a curve to its bottom edge.
2. Reads the border's colour profile (outer dark line, gold, inner shadow) from the label's straight side.
3. Repaints the banner in the label's colour and redraws the border along the curve with that profile.
4. Writes PRODUCT OF UNITED KINGDOM along the curve in Palatino Linotype, a set gap inside the border.

A label with no banner gets the lettering only: give it an empty banner area (`1 0`) and the label's centre as both x values. The big-label entries at the top of the `switch` work this way and run on the already edited `-v2` photos.

```powershell
.\replace-uk-banner.ps1 -In SD-Olive-Green-Glass-Bottle-750ml-Label.jpg -Out olive-classic-olive-green-750ml-v2.jpg -Preview   # the bottle
.\replace-uk-banner.ps1 -In olive-classic-olive-green-750ml-v2.jpg -Out olive-classic-olive-green-750ml-v3.jpg            # then the big label
```

`-Preview` also saves zoomed crops of each edited area. The banner and border positions for each photo are in the `switch` near the end of the script; a new photo needs its own line there.
