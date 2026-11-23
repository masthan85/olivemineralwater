# Replaces the blue "Product of United Kingdom" banners on the Emerald Green
# photo with curved pale-gold serif lettering that follows each label's bottom
# edge. Only the banner's own pixels change. The label's gold edge is measured
# from the visible gold on either side of (and below) the banner, fitted with a
# curve, and redrawn through the banner.
param([string]$In = 'olive-emerald-green-750ml-330ml.jpg', [string]$Out = 'olive-emerald-green-750ml-330ml-v2.jpg', [switch]$Preview, [switch]$NoText)
Add-Type -AssemblyName System.Drawing
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = [System.Drawing.Bitmap]::FromFile("$dir\$In")
$bmp = New-Object System.Drawing.Bitmap $src.Width, $src.Height
$g0 = [System.Drawing.Graphics]::FromImage($bmp); $g0.DrawImage($src, 0, 0, $src.Width, $src.Height); $g0.Dispose(); $src.Dispose()
$W = $bmp.Width; $H = $bmp.Height

function Lum($c) { 0.3 * $c.R + 0.59 * $c.G + 0.11 * $c.B }
function Mix($a, $b, $t) { [System.Drawing.Color]::FromArgb([int]($a.R*(1-$t)+$b.R*$t), [int]($a.G*(1-$t)+$b.G*$t), [int]($a.B*(1-$t)+$b.B*$t)) }
function Near($a, $b) { if (-not $b) { return $false }; ([Math]::Abs($a.R-$b.R) + [Math]::Abs($a.G-$b.G) + [Math]::Abs($a.B-$b.B)) -lt 70 }
function IsGold($c) { $c.R -gt 140 -and $c.G -gt 100 -and $c.B -lt 120 -and $c.R -ge $c.G -and ($c.R - $c.B) -gt 60 }

# Least-squares fit of y = a + b*dx + c*dx^2.
function FitQuad($pts, $cx) {
  $n = $pts.Count; $s = @{}; foreach ($k in 's0','s1','s2','s3','s4','t0','t1','t2') { $s[$k] = 0.0 }
  foreach ($p in $pts) { $d = $p[0] - $cx; $y = $p[1]
    $s.s0 += 1; $s.s1 += $d; $s.s2 += $d*$d; $s.s3 += $d*$d*$d; $s.s4 += $d*$d*$d*$d
    $s.t0 += $y; $s.t1 += $d*$y; $s.t2 += $d*$d*$y }
  # Solve the 3x3 normal equations by Cramer's rule.
  $m = @(@($s.s0,$s.s1,$s.s2),@($s.s1,$s.s2,$s.s3),@($s.s2,$s.s3,$s.s4)); $v = @($s.t0,$s.t1,$s.t2)
  function Det3($q) { $q[0][0]*($q[1][1]*$q[2][2]-$q[1][2]*$q[2][1]) - $q[0][1]*($q[1][0]*$q[2][2]-$q[1][2]*$q[2][0]) + $q[0][2]*($q[1][0]*$q[2][1]-$q[1][1]*$q[2][0]) }
  $D = Det3 $m; $r = @()
  for ($c = 0; $c -lt 3; $c++) { $q = @(@($m[0][0],$m[0][1],$m[0][2]),@($m[1][0],$m[1][1],$m[1][2]),@($m[2][0],$m[2][1],$m[2][2])); for ($i=0;$i -lt 3;$i++){ $q[$i][$c] = $v[$i] }; $r += (Det3 $q) / $D }
  return $r
}

function FixLabel($name, $mx1, $mx2, $my1, $my2, $lx1, $lx2, $searchTop, $searchBot, $textSize, $spacing, $profY, $profX, $inkColor = $script:ink) {
  # 1. Find the label's gold bottom edge outside the banner.
  $pts = @(); $thick = @(); $goldCols = @()
  for ($x = $lx1; $x -le $lx2; $x++) {
    $run = @()
    for ($y = $searchTop; $y -le $searchBot; $y++) {
      $inMask = ($x -ge $mx1 -and $x -le $mx2 -and $y -ge $my1 -and $y -le $my2)
      if (-not $inMask -and (IsGold $bmp.GetPixel($x, $y))) { $run += $y }
    }
    if ($run.Count -ge 2 -and $run.Count -le 12 -and (($run[-1] - $run[0]) -le 14)) {
      # the bottom edge of the gold: the banner can hide the top of the border, never its bottom
      $pts += ,@($x, $run[-1]); $thick += $run.Count
      foreach ($yy in $run) { $goldCols += $bmp.GetPixel($x, $yy) }
    }
  }
  $cx = ($mx1 + $mx2) / 2.0
  $fit = FitQuad $pts $cx
  # Refit twice without outliers (gold reflections in the glass, decorations).
  for ($pass = 0; $pass -lt 2; $pass++) {
    $keep = @($pts | Where-Object { $dd = $_[0] - $cx; [Math]::Abs($_[1] - ($fit[0] + $fit[1]*$dd + $fit[2]*$dd*$dd)) -le 1.6 })
    if ($keep.Count -ge 12) { $pts = $keep; $fit = FitQuad $pts $cx }
  }
  $band = [Math]::Max(3, (($thick | Sort-Object)[[int]($thick.Count/2)]))
  $gold = [System.Drawing.Color]::FromArgb([int](($goldCols | Measure-Object R -Average).Average), [int](($goldCols | Measure-Object G -Average).Average), [int](($goldCols | Measure-Object B -Average).Average))
  $script:previews += ,@("p-$name", [Math]::Max(0, $lx1 - 10), [Math]::Max(0, $my1 - 50), [Math]::Min($W - $lx1 + 10, $lx2 - $lx1 + 20), [Math]::Min($H - $my1 + 50, 110), 4)
  # Border profile across the label's straight left side: walk left from inside
  # the label to the gold, through it, and keep from the inner shadow line to the
  # outer dark line. t = distance outward from the gold's centre.
  $x = $profX
  while (-not (IsGold $bmp.GetPixel($x, $profY)) -and $x -gt 0) { $x-- }
  $goldIn = $x
  while ((IsGold $bmp.GetPixel($x, $profY)) -and $x -gt 0) { $x-- }
  $goldOut = $x + 1
  $center = ($goldIn + $goldOut) / 2.0
  $inEnd = $goldIn + 3; $outEnd = $goldOut - 1
  $profile = @{}; for ($px = $outEnd; $px -le $inEnd; $px++) { $profile[$px] = $bmp.GetPixel($px, $profY) }
  $insideHalf = $inEnd - $center; $outsideHalf = $center - $outEnd
  # the curve was fitted to the gold's bottom edge; move it up to the gold's centre
  $fit[0] -= ($goldIn - $goldOut) / 2.0
  "$name : $($pts.Count) edge points, curve a=$([Math]::Round($fit[0],1)) b=$([Math]::Round($fit[1],4)) c=$([Math]::Round($fit[2],5)), border $($goldIn - $goldOut + 1) px gold, profile $([Math]::Round($insideHalf,1)) in / $([Math]::Round($outsideHalf,1)) out"

  # A label with no banner (my2 < my1) only gets the lettering.
  if ($my2 -ge $my1) {
  # 2. Label green per column just above the banner. Columns hidden by text
  #    are skipped, then the colours are smoothed across a 25 px window so the
  #    label's shading survives but no stripes do.
  $raw = @{}
  for ($x = $mx1 - 12; $x -le $mx2 + 12; $x++) {
    $cs = @(2..4 | ForEach-Object { $bmp.GetPixel($x, $my1 - $_) }) | Where-Object { (Lum $_) -lt 125 -and -not (IsGold $_) -and ([Math]::Max($_.R,[Math]::Max($_.G,$_.B)) - [Math]::Min($_.R,[Math]::Min($_.G,$_.B))) -gt 25 }
    if ($cs.Count -gt 0) { $raw[$x] = @(($cs | Measure-Object R -Average).Average, ($cs | Measure-Object G -Average).Average, ($cs | Measure-Object B -Average).Average) }
  }
  $green = @{}
  for ($x = $mx1 - 2; $x -le $mx2 + 2; $x++) {
    $r = 0; $gq = 0; $b = 0; $n = 0
    for ($k = $x - 12; $k -le $x + 12; $k++) { if ($raw.ContainsKey($k)) { $r += $raw[$k][0]; $gq += $raw[$k][1]; $b += $raw[$k][2]; $n++ } }
    if ($n -gt 0) { $green[$x] = [System.Drawing.Color]::FromArgb([int]($r/$n), [int]($gq/$n), [int]($b/$n)) }
  }
  $last = $null
  for ($x = $mx1 - 2; $x -le $mx2 + 2; $x++) { if ($green.ContainsKey($x)) { $last = $green[$x] } elseif ($last) { $green[$x] = $last } }
  for ($x = $mx2 + 2; $x -ge $mx1 - 2; $x--) { if ($green.ContainsKey($x) -and $green[$x]) { $last = $green[$x] } elseif ($last) { $green[$x] = $last } }
  # 3. Repaint the banner.
  $orig = @{}
  for ($x = $mx1; $x -le $mx2; $x++) { for ($y = $my2 + 1; $y -le [Math]::Min($H - 1, $my2 + 40); $y++) { $orig["$x,$y"] = $bmp.GetPixel($x, $y) } }
  for ($x = $mx1; $x -le $mx2; $x++) {
    $d = $x - $cx; $mid = $fit[0] + $fit[1]*$d + $fit[2]*$d*$d
    $cos = 1.0 / [Math]::Sqrt(1 + [Math]::Pow($fit[1] + 2*$fit[2]*$d, 2))
    $inner = $mid - $insideHalf / $cos; $outer = $mid + $outsideHalf / $cos
    for ($y = $my1; $y -le $my2; $y++) {
      $t = ($y - $mid) * $cos
      if ($t -lt -$insideHalf) {
        # Top of the banner: the smoothed green from above. Lower down, blend
        # towards the label's own green just left and right of the banner on
        # the same row, so the shading continues instead of forming a block.
        $col = $green[$x]
        $L = $bmp.GetPixel($mx1 - 2, $y); $R = $bmp.GetPixel($mx2 + 2, $y)
        $okL = (Near $L $green[$mx1]) -and (Lum $L) -lt 125 -and -not (IsGold $L) -and ([Math]::Max($L.R,[Math]::Max($L.G,$L.B)) - [Math]::Min($L.R,[Math]::Min($L.G,$L.B))) -gt 25
        $okR = (Near $R $green[$mx2]) -and (Lum $R) -lt 125 -and -not (IsGold $R) -and ([Math]::Max($R.R,[Math]::Max($R.G,$R.B)) - [Math]::Min($R.R,[Math]::Min($R.G,$R.B))) -gt 25
        if ($okL -or $okR) {
          if (-not $okL) { $L = $R }; if (-not $okR) { $R = $L }
          $hMix = Mix $L $R (($x - $mx1) / [double]($mx2 - $mx1))
          $tv = [Math]::Min(0.6, ($y - $my1) / [double]([Math]::Max(1, $inner - $my1)) * 0.6)
          $col = Mix $col $hMix $tv
        }
        # Where the label continues below the banner, fade down into its real
        # colour there so there is no step at the banner's bottom edge.
        $bs = @(); for ($k = [Math]::Max($mx1, $x - 6); $k -le [Math]::Min($mx2, $x + 6); $k++) { $c = $orig["$k,$($my2 + 1)"]; if ($c -and (Lum $c) -lt 125 -and -not (IsGold $c)) { $bs += $c } }
        $bot = if ($bs.Count -gt 0) { [System.Drawing.Color]::FromArgb([int](($bs | Measure-Object R -Average).Average), [int](($bs | Measure-Object G -Average).Average), [int](($bs | Measure-Object B -Average).Average)) } else { $null }
        if ($bot -and (Lum $bot) -lt 125 -and -not (IsGold $bot) -and ($my2 + 1) -lt ($mid - $insideHalf / $cos)) {
          $col = Mix $col $bot ([Math]::Min(1.0, [Math]::Max(0.0, ($y - $my1) / [double]($my2 + 1 - $my1))))
        }
      } elseif ($t -le $outsideHalf) {
        # the border, copied layer by layer from the label's side
        $sx = $center - $t; $x0 = [Math]::Floor($sx); $f = $sx - $x0
        $c0 = $profile[[int][Math]::Max($outEnd, [Math]::Min($inEnd, $x0))]; $c1 = $profile[[int][Math]::Max($outEnd, [Math]::Min($inEnd, $x0 + 1))]
        $col = Mix $c0 $c1 $f
        if ($t -lt -$insideHalf + 1) { $col = Mix $green[$x] $col ($t + $insideHalf) }
      } else {
        # outside the label: mirror the scenery beside the banner, fading into
        # the scenery just below it near the bottom edge
        $mxs = if ($x -lt $cx) { [Math]::Max(0, 2 * $mx1 - $x - 1) } else { [Math]::Min($W - 1, 2 * $mx2 - $x + 1) }
        $side = $bmp.GetPixel($mxs, $y)
        $down = $orig["$x,$([Math]::Min($my2 + 1 + ($my2 - $y), $my2 + 40))"]   # mirrored about the bottom edge, so the rows meet exactly
        if (-not $down) { $down = $orig["$x,$($my2+1)"] }
        $tv = [Math]::Max(0.0, 1.0 - ($my2 - $y) / 10.0)
        $col = Mix $side $down $tv
      }
      $bmp.SetPixel($x, $y, $col)
    }
  }
  }
  # 4. Lettering along the curve, centred, sitting just above the gold edge.
  if (-not $NoText) {
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAlias'
    $font = New-Object System.Drawing.Font $script:serif, $textSize, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $fmt = [System.Drawing.StringFormat]::GenericTypographic
    $brush = New-Object System.Drawing.SolidBrush $inkColor
    $text = 'PRODUCT OF UNITED KINGDOM'
    $widths = @(); foreach ($ch in $text.ToCharArray()) { $w = $g.MeasureString([string]$ch, $font, 1000, $fmt).Width; if ($ch -eq ' ') { $w = $textSize * 0.38 }; $widths += $w }
    $total = ($widths | Measure-Object -Sum).Sum + $spacing * ($widths.Count - 1)
    $x = $cx - $total / 2; $ff = $font.FontFamily; $asc = $textSize * $ff.GetCellAscent([System.Drawing.FontStyle]::Regular) / $ff.GetEmHeight([System.Drawing.FontStyle]::Regular)
    for ($i = 0; $i -lt $widths.Count; $i++) {
      $m = $x + $widths[$i] / 2; $d = $m - $cx
      $cosT = 1.0 / [Math]::Sqrt(1 + [Math]::Pow($fit[1] + 2*$fit[2]*$d, 2))
      $gap = [Math]::Max(2.5, $textSize * 0.3)
      if ($my2 -ge $my1) {
        $yb = $fit[0] + $fit[1]*$d + $fit[2]*$d*$d - ($insideHalf + $gap) / $cosT
      } else {
        # Lettering-only labels: measure up from the border's bottom edge,
        # allowing a border at least as thick as it looks at this text size
        # (dark gold is not always detected), plus the inner shadow and gap.
        $bottomEdge = $fit[0] + ($goldIn - $goldOut) / 2.0 + $fit[1]*$d + $fit[2]*$d*$d
        $yb = $bottomEdge - ([Math]::Max($goldIn - $goldOut + 1, 0.75 * $textSize) + 3 + $gap) / $cosT
      }
      $ang = [Math]::Atan($fit[1] + 2*$fit[2]*$d) * 180 / [Math]::PI
      $st = $g.Save(); $g.TranslateTransform([float]$m, [float]$yb); $g.RotateTransform([float]$ang)
      $g.DrawString([string]$text[$i], $font, $brush, [float](-$widths[$i]/2), [float](-$asc), $fmt); $g.Restore($st)
      $x += $widths[$i] + $spacing
    }
    $brush.Dispose(); $font.Dispose(); $g.Dispose()
  }
}

$script:previews = @()
$script:serif = 'Palatino Linotype'
if (-not ([System.Drawing.FontFamily]::Families | Where-Object { $_.Name -eq $script:serif })) { $script:serif = 'Georgia' }
$script:ink = [System.Drawing.Color]::FromArgb(230, 212, 158)

$white = [System.Drawing.Color]::FromArgb(236, 240, 247)
switch -Wildcard ($In) {
  # Big labels that never had a banner: lettering only (empty banner area,
  # x1 = x2 = the label's centre). Run on the already edited photos.
  # These come first and stop with break, because -Wildcard is not
  # case-sensitive and *Olive-Green* would also match these names.
  #                                       centre    no area   label x1 x2  search y  size spacing  profile y, inside x
  '*classic-olive-green-750ml-v2*'  { FixLabel 'big'  303 303   1 0       110 496   780 832   12   1.6   700 140; break }
  '*forest-reserve-750ml-v2*'       { FixLabel 'big'  288 288   1 0       100 476   808 862   12   1.6   740 130; break }
  '*deep-sapphire-blue-750ml-v2*'   { FixLabel 'big'  309 309   1 0       112 506   780 832   12   1.6   700 140  $white; break }
  '*merald*' {
    #        name     banner x1 x2   y1  y2   label x1 x2  search y  size spacing  profile y, inside x
    FixLabel 'big'    176 447  784 820   118 505   770 845   12   1.6   610 135
    FixLabel '750ml'  577 751  810 840   560 772   800 852   7.5  0.8   775 572
    FixLabel '330ml'  792 929  796 820   783 946   788 828   6    0.6   760 795
  }
  '*Olive-Green*'    { FixLabel 'bottle' 608 752  807 834   582 778   798 852   7.5  0.8   790 598 }
  '*Dark-Green*'     { FixLabel 'bottle' 583 757  865 897   559 785   858 918   8    0.9   850 575 }
  '*Deep-Sapphire*'  { FixLabel 'bottle' 577 752  829 859   562 773   822 872   8    0.9   800 578  $white }
}

$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$p = New-Object System.Drawing.Imaging.EncoderParameters 1
$p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 92L
$bmp.Save("$dir\$Out", $enc, $p)
if ($Preview) {
  foreach ($z in $script:previews) {
    $zb = New-Object System.Drawing.Bitmap ($z[3]*$z[5]), ($z[4]*$z[5])
    $zg = [System.Drawing.Graphics]::FromImage($zb); $zg.InterpolationMode = 'NearestNeighbor'
    $zg.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0,0,($z[3]*$z[5]),($z[4]*$z[5])), (New-Object System.Drawing.Rectangle $z[1],$z[2],$z[3],$z[4]), 'Pixel')
    $zg.Dispose(); $zb.Save("$dir\$($z[0]).png"); $zb.Dispose()
  }
}
$bmp.Dispose()
"saved $Out with font $script:serif"
