<#
.SYNOPSIS
  Import munder-difflin into vendor/ on a test-gated branch, or verify vendor/ matches the lock.
.EXAMPLE
  ./scripts/sync-upstream.ps1                 # import upstream main
  ./scripts/sync-upstream.ps1 -Ref v0.5.3     # import a tag or commit
  ./scripts/sync-upstream.ps1 -Verify         # fail if vendor/ drifted from upstream.lock.json
#>
param(
  [string]$Ref,
  [switch]$Verify,
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$cfg = Get-Content upstream/upstream.json -Raw | ConvertFrom-Json
$lockPath = 'upstream/upstream.lock.json'
$vendor = Join-Path $root $cfg.vendorDir

function Get-Hashes([string]$dir) {
  $map = [ordered]@{}
  Get-ChildItem $dir -Recurse -File | Sort-Object FullName | ForEach-Object {
    $rel = $_.FullName.Substring($dir.Length + 1).Replace('\', '/')
    $map[$rel] = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
  }
  $map
}

if ($Verify) {
  if (-not (Test-Path $lockPath)) { throw 'No upstream.lock.json. Run the import first.' }
  $lock = Get-Content $lockPath -Raw | ConvertFrom-Json
  $actual = Get-Hashes $vendor
  $expected = @{}
  $lock.files.PSObject.Properties | ForEach-Object { $expected[$_.Name] = $_.Value }
  $bad = @()
  foreach ($k in $expected.Keys) { if ($actual[$k] -ne $expected[$k]) { $bad += "changed or missing: $k" } }
  foreach ($k in $actual.Keys) { if (-not $expected.ContainsKey($k)) { $bad += "not in lock: $k" } }
  if ($bad) { $bad | ForEach-Object { Write-Host "FAIL $_" }; exit 1 }
  Write-Host "OK vendor matches $($lock.commit) ($($actual.Count) files)"
  exit 0
}

if (git status --porcelain) { throw 'Working tree is dirty. Commit or stash first.' }
$startBranch = git rev-parse --abbrev-ref HEAD
if (-not $Ref) { $Ref = $cfg.ref }

$tmp = Join-Path ([IO.Path]::GetTempPath()) "munder-sync-$PID"
git clone -q --filter=blob:none $cfg.repo $tmp
git -C $tmp checkout -q $Ref
$sha = (git -C $tmp rev-parse HEAD).Trim()
$short = $sha.Substring(0, 8)

$old = if (Test-Path $lockPath) { (Get-Content $lockPath -Raw | ConvertFrom-Json).commit } else { '(none)' }
if ($old -eq $sha -and -not $Force) { Write-Host "Already at $sha"; Remove-Item $tmp -Recurse -Force; exit 0 }

$branch = "upstream/$short"
git switch -q -c $branch

try {
  if (Test-Path $vendor) { Remove-Item $vendor -Recurse -Force }
  foreach ($p in $cfg.include) {
    $src = Join-Path $tmp $p
    if (-not (Test-Path $src)) { throw "Upstream path gone: $p (update upstream.json and the adapters)" }
    $dst = Join-Path $vendor $p
    New-Item -ItemType Directory -Force (Split-Path $dst -Parent) | Out-Null
    Copy-Item $src $dst -Recurse -Force
  }
  foreach ($p in $cfg.exclude) { $x = Join-Path $vendor $p; if (Test-Path $x) { Remove-Item $x -Recurse -Force } }

  $lock = [ordered]@{
    repo     = $cfg.repo
    ref      = $Ref
    commit   = $sha
    previous = $old
    files    = Get-Hashes $vendor
  }
  $lock | ConvertTo-Json -Depth 4 | Set-Content $lockPath -Encoding utf8

  if (Test-Path package.json) {
    foreach ($step in @('ci', 'run typecheck', 'test', 'run build')) {
      Write-Host "== npm $step"
      cmd /c "npm $step"
      if ($LASTEXITCODE -ne 0) { throw "Gate failed: npm $step" }
    }
  } else {
    Write-Host 'WARN no package.json yet, test gates skipped (bootstrap import only)'
  }

  git add -A
  git commit -q -m "upstream: munder-difflin $old -> $sha" -m "Imported by scripts/sync-upstream.ps1 after gates passed."
  Write-Host ''
  Write-Host "PASS $branch is ready. Review: git diff $startBranch..$branch --stat"
  Write-Host "Merge: git switch $startBranch; git merge --ff-only $branch"
}
catch {
  Write-Host "FAIL $($_.Exception.Message). Nothing imported."
  git reset -q --hard
  git clean -qfd
  git switch -q $startBranch
  git branch -q -D $branch
  exit 1
}
finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
