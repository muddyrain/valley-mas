$files = @(
  'd:\my-code\valley-mas\apps\web\src\pages\Home\index.tsx',
  'd:\my-code\valley-mas\apps\web\src\pages\Home\components\HeroImmersiveShowcase.tsx',
  'd:\my-code\valley-mas\apps\web\src\pages\Home\components\HomeAICoreDialog.tsx',
  'd:\my-code\valley-mas\apps\web\src\pages\Home\components\HomeEnergyCore.tsx',
  'd:\my-code\valley-mas\apps\web\src\pages\Home\components\HomeLabSection.tsx',
  'd:\my-code\valley-mas\apps\web\src\pages\Home\components\HomeSectionBlocks.tsx',
  'd:\my-code\valley-mas\apps\web\src\pages\Home\components\HomeAuthorProfileCard.tsx',
  'd:\my-code\valley-mas\apps\web\src\pages\Creator\index.tsx',
  'd:\my-code\valley-mas\apps\web\src\pages\CreatorProfile\index.tsx',
  'd:\my-code\valley-mas\apps\web\src\components\CreatorCard.tsx',
  'd:\my-code\valley-mas\apps\web\src\pages\MySpace\index.tsx',
  'd:\my-code\valley-mas\apps\web\src\pages\Guestbook\index.tsx',
  'd:\my-code\valley-mas\apps\web\src\pages\ClimberLab.tsx',
  'd:\my-code\valley-mas\apps\web\src\pages\ScratchLegendLab.tsx',
  'd:\my-code\valley-mas\apps\web\src\components\ApplyCreatorBanner.tsx',
  'd:\my-code\valley-mas\apps\web\src\pages\ApplyCreator\index.tsx',
  'd:\my-code\valley-mas\apps\web\src\components\page\HeroSectionTitle.tsx'
)

$regexPatterns = @(
  @('color-mix\(in_srgb,rgba\(var\(--theme-secondary-rgb\),[0-9.]+\)_\d+%,white\)', 'hsl(var(--accent))'),
  @('color-mix\(in_srgb,rgba\(var\(--theme-tertiary-rgb\),[0-9.]+\)_\d+%,white\)', 'hsl(var(--accent))'),
  @('color-mix\(in_srgb,var\(--theme-primary-soft\)_\d+%,white\)', 'hsl(var(--accent))'),
  @('color-mix\(in_srgb,var\(--theme-primary\)_(\d+)%,white\)', 'hsl(var(--primary)/0.$1)'),
  @('color-mix\(in srgb, rgba\(var\(--theme-secondary-rgb\),[0-9.]+\) (\d+)%, white\)', 'hsl(var(--primary)/0.$1)'),
  @('color-mix\(in srgb, rgba\(var\(--theme-tertiary-rgb\),[0-9.]+\) (\d+)%, white\)', 'hsl(var(--primary)/0.$1)'),
  @('color-mix\(in srgb, var\(--theme-primary-soft\) \d+%, white\)', 'hsl(var(--accent))'),
  @('color-mix\(in srgb, var\(--theme-primary\) (\d+)%, white\)', 'hsl(var(--primary)/0.$1)'),
  @('rgba\(var\(--theme-primary-rgb\),\s*([0-9.]+)\)', 'hsl(var(--primary)/$1)'),
  @('rgba\(var\(--theme-secondary-rgb\),\s*([0-9.]+)\)', 'hsl(var(--primary)/$1)'),
  @('rgba\(var\(--theme-tertiary-rgb\),\s*([0-9.]+)\)', 'hsl(var(--primary)/$1)'),
  @('var\(--theme-primary-soft\)', 'hsl(var(--accent))'),
  @('var\(--theme-primary-deep\)', 'hsl(var(--primary))'),
  @('var\(--theme-primary\)', 'hsl(var(--primary))'),
  @('var\(--theme-page-start\)', 'hsl(var(--background))'),
  @('var\(--theme-page-mid\)', 'hsl(var(--background))'),
  @('var\(--theme-page-cool\)', 'hsl(var(--background))'),
  @('var\(--theme-page-end\)', 'hsl(var(--background))'),
  @('var\(--theme-surface-alt\)', 'hsl(var(--muted))'),
  @('var\(--theme-border\)', 'hsl(var(--border))'),
  @('var\(--theme-panel-border\)', 'hsl(var(--border))')
)

$literals = @(
  'theme-avatar-fallback|bg-primary text-primary-foreground',
  'theme-input-border|border-input',
  'theme-panel-shell|border-border bg-card',
  'theme-btn-primary |',
  'hover:bg-theme-primary-hover|hover:bg-primary',
  'hover:bg-theme-primary|hover:bg-primary',
  'hover:text-theme-primary-hover|hover:text-primary',
  'hover:text-theme-primary-deep|hover:text-primary',
  'hover:text-theme-primary|hover:text-primary',
  'hover:bg-theme-soft-strong|hover:bg-accent',
  'hover:bg-theme-soft|hover:bg-accent',
  'hover:border-theme-soft-strong|hover:border-accent',
  'group-hover:text-theme-primary|group-hover:text-primary',
  'group-hover:bg-theme-soft-strong|group-hover:bg-accent',
  'group-hover:bg-theme-soft|group-hover:bg-accent',
  'hover:from-theme-primary-hover|hover:from-primary',
  'hover:to-theme-primary-deep|hover:to-primary',
  'focus:ring-theme-primary|focus:ring-primary',
  'focus:ring-theme-soft-strong|focus:ring-accent',
  'focus:ring-theme-soft|focus:ring-accent',
  'focus:border-theme-primary|focus:border-primary',
  'focus-visible:border-theme-primary|focus-visible:border-primary',
  'focus-visible:ring-theme-primary|focus-visible:ring-primary',
  'focus-visible:border-theme-soft-strong|focus-visible:border-accent',
  'focus-visible:ring-theme-soft|focus-visible:ring-accent',
  'ring-theme-primary|ring-primary',
  'text-theme-primary-hover|text-primary',
  'text-theme-primary-deep|text-primary',
  'text-theme-primary|text-primary',
  'bg-theme-primary-hover|bg-primary',
  'bg-theme-primary-deep|bg-primary',
  'bg-theme-primary|bg-primary',
  'bg-theme-soft-strong|bg-accent',
  'bg-theme-soft|bg-accent',
  'border-theme-shell-border|border-border',
  'border-theme-panel-border|border-border',
  'border-theme-soft-strong|border-accent',
  'border-theme-primary|border-primary',
  'border-theme-border|border-border',
  'border-t-theme-primary|border-t-primary',
  'from-theme-primary-hover|from-primary',
  'to-theme-primary-deep|to-primary',
  'from-theme-primary|from-primary'
)

$changeCount = 0

foreach ($file in $files) {
  if (-not (Test-Path $file)) {
    Write-Host "NOT FOUND: $file"
    continue
  }
  $content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
  $original = $content
  foreach ($rp in $regexPatterns) {
    $content = $content -replace $rp[0], $rp[1]
  }
  foreach ($lit in $literals) {
    $parts = $lit -split '\|', 2
    $oldVal = $parts[0]
    $newVal = if ($parts.Length -gt 1) { $parts[1] } else { '' }
    $content = $content.Replace($oldVal, $newVal)
  }
  if ($content -ne $original) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
    Write-Host "UPDATED: $([System.IO.Path]::GetFileName($file))"
    $changeCount++
  } else {
    Write-Host "NO CHANGE: $([System.IO.Path]::GetFileName($file))"
  }
}

Write-Host "`nTotal files updated: $changeCount"
