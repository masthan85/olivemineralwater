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

function FixLabel($name, $mx1, $mx2, $my1, $my2, $lx1, $lx2, $searchTop, $searchBot, $textSize, $spacing, $lift, $inkColor = $script:ink) {
  # 1. Find the label's gold bottom edge outside the banner.
  $pts = @(); $thick = @(); $goldCols = @()
  for ($x = $lx1; $x -le $lx2; $x++) {
    $run = @()
    for ($y = $searchTop; $y -le $searchBot; $y++) {
      $inMask = ($x -ge $mx1 -and $x -le $mx2 -and $y -ge $my1 -and $y -le $my2)
      if (-not $inMask -and (IsGold $bmp.GetPixel($x, $y))) { $run += $y }
    }
    if ($run.Count -ge 2 -and $run.Count -le 12 -and (($run[-1] - $run[0]) -le 14)) {
      $pts += ,@($x, (($run | Measure-Object -Average).Average)); $thick += $run.Count
      foreach ($yy in $run) { $goldCols += $bmp.GetPixel($x, $yy) }
    }
  }
  $cx = ($mx1 + $mx2) / 2.0
  $fit = FitQuad $pts $cx
  $band = [Math]::Max(3, (($thick | Sort-Object)[[int]($thick.Count/2)]))
  $gold = [System.Drawing.Color]::FromArgb([int](($goldCols | Measure-Object R -Average).Average), [int](($goldCols | Measure-Object G -Average).Average), [int](($goldCols | Measure-Object B -Average).Average))
  $script:previews += ,@("p-$name", [Math]::Max(0, $lx1 - 10), [Math]::Max(0, $my1 - 50), [Math]::Min($W - $lx1 + 10, $lx2 - $lx1 + 20), [Math]::Min($H - $my1 + 50, 110), 4)
  "$name : $($pts.Count) edge points, curve a=$([Math]::Round($fit[0],1)) b=$([Math]::Round($fit[1],4)) c=$([Math]::Round($fit[2],5)), band $band px"

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
    $inner = $mid - $band / 2.0; $outer = $mid + $band / 2.0
    for ($y = $my1; $y -le $my2; $y++) {
      if ($y -lt $inner - 0.5) {
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
      } elseif ($y -le $outer + 0.5) {
        $e = [Math]::Min($y - ($inner - 0.5), ($outer + 0.5) - $y); $t = [Math]::Min(1.0, 0.3 + $e / 1.2)
        $edgeCol = if (($y - $inner) -lt ($outer - $y)) { $green[$x] } else { $orig["$x,$([Math]::Min($H-1,$my2+1))"] }
        $col = Mix $edgeCol $gold $t
      } else {
        # outside the label: mirror the scenery beside the banner, fading into
        # the scenery just below it near the bottom edge
        $mxs = if ($x -lt $cx) { [Math]::Max(0, 2 * $mx1 - $x - 1) } else { [Math]::Min($W - 1, 2 * $mx2 - $x + 1) }
        $side = $bmp.GetPixel($mxs, $y)
        $down = $orig["$x,$([Math]::Min($my2 + 1 + [int]($y - $outer), $my2 + 40))"]
        if (-not $down) { $down = $orig["$x,$($my2+1)"] }
        $tv = [Math]::Max(0.0, 1.0 - ($my2 - $y) / 10.0)
        $col = Mix $side $down $tv
      }
      $bmp.SetPixel($x, $y, $col)
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
      $yb = $fit[0] + $fit[1]*$d + $fit[2]*$d*$d - $band / 2.0 - $lift
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
  '*Emerald*' {
    #        name     banner x1 x2   y1  y2   label x1 x2  search y  size spacing lift
    FixLabel 'big'    176 447  784 820   118 505   770 845   12   1.6  3
    FixLabel '750ml'  577 751  810 834   560 772   800 852   7.5  0.8  6
    FixLabel '330ml'  792 929  796 816   783 946   788 828   6    0.6  5
  }
  '*emerald*' {
    FixLabel 'big'    176 447  784 820   118 505   770 845   12   1.6  3
    FixLabel '750ml'  577 751  810 834   560 772   800 852   7.5  0.8  6
    FixLabel '330ml'  792 929  796 816   783 946   788 828   6    0.6  5
  }
  '*Olive-Green*'    { FixLabel 'bottle' 608 752  807 830   582 778   798 852   7.5  0.8  9 }
  '*Dark-Green*'     { FixLabel 'bottle' 583 757  865 893   559 785   858 918   8    0.9  10 }
  '*Deep-Sapphire*'  { FixLabel 'bottle' 577 752  829 855   562 773   822 872   8    0.9  9  $white }
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
