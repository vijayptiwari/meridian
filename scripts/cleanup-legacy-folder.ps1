# Removes the leftover empty JobApplier folder after the meridian rename.
# Run this if Windows reports the folder is locked (e.g. while Cursor had it open).

$legacy = Join-Path (Split-Path $PSScriptRoot -Parent) "..\JobApplier"
$legacy = [System.IO.Path]::GetFullPath($legacy)

if (-not (Test-Path $legacy)) {
  Write-Host "Nothing to clean — JobApplier folder not found."
  exit 0
}

$items = Get-ChildItem -Force $legacy -ErrorAction SilentlyContinue | Where-Object { $_.Name -notin ".", ".." }
if ($items.Count -gt 0) {
  Write-Warning "JobApplier is not empty ($($items.Count) items). Review before deleting:"
  $items | ForEach-Object { Write-Host "  $($_.Name)" }
  exit 1
}

try {
  Remove-Item -Force $legacy -ErrorAction Stop
  Write-Host "Removed empty folder: $legacy"
} catch {
  Write-Warning "Could not remove folder (likely in use): $($_.Exception.Message)"
  Write-Host "Close Cursor/Explorer terminals using JobApplier, then run this script again."
  exit 1
}
