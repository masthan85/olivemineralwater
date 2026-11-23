# Photo edits

The Emerald Green Spring photos on the site are edited copies of the client's
`SD-Emerald-Green-2-Glass-Bottles-750ml-330ml-Label.jpg` (media item 108, kept unchanged):

| Media item | File | What changed |
|---|---|---|
| 135 | `olive-emerald-green-750ml-330ml-v2.jpg` | Cropped above the "Design Concepts" plaque; the three blue "Product of United Kingdom" banners replaced with curved pale-gold lettering (`replace-uk-banner.ps1`). Used for the home hero and the Products page Range photo. |
| 136 | `olive-emerald-green-750ml-v2.jpg` | The same, cropped to the 750ml bottle only. Used on the Emerald Green Spring cards. |

`replace-uk-banner.ps1` runs in Windows PowerShell (System.Drawing). It measures each label's gold bottom edge from the pixels beside the banner, fits a curve, repaints the banner in the label's green and gold, and writes PRODUCT OF UNITED KINGDOM along the curve in Palatino Linotype. The banner positions in the last lines of the script are specific to this photo.
