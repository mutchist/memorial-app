# Serves the site folder at http://localhost:8080 so YouTube videos play (they refuse pages opened from disk, error 153).
# Start it by double-clicking start-site.bat. Close the window to stop it.
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'site'))
$port = 8080
$prefix = "http://localhost:$port/"
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.md' = 'text/plain; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'; '.svg' = 'image/svg+xml'
  '.webp' = 'image/webp'; '.ico' = 'image/x-icon'; '.pdf' = 'application/pdf'; '.woff2' = 'font/woff2'; '.woff' = 'font/woff'
  '.map' = 'application/json'
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try { $listener.Start() }
catch {
  Write-Host "Could not start the site on port $port. Is it already running in another window?" -ForegroundColor Red
  Write-Host $_.Exception.Message
  Read-Host 'Press Enter to close'
  exit 1
}
Write-Host "The site is running:"
Write-Host "  Watch: ${prefix}index.html"
Write-Host "  Admin: ${prefix}admin.html"
Write-Host "Close this window to stop it."
Start-Process "${prefix}index.html"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = 'index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $root $rel))
    $ext = [IO.Path]::GetExtension($full).ToLower()
    if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $res.StatusCode = 404; $bytes = [Text.Encoding]::UTF8.GetBytes("Not found: $rel")
      Write-Host "404  $rel" -ForegroundColor Yellow
    } elseif (-not $types.ContainsKey($ext)) {
      $res.StatusCode = 415; $bytes = [Text.Encoding]::UTF8.GetBytes("Unknown file type: $ext (add it to start-site.ps1)")
      Write-Host "415  $rel  (unknown file type $ext)" -ForegroundColor Yellow
    } else {
      $res.ContentType = $types[$ext]
      # never cache: after an update, a normal reload shows the new version
      $res.Headers.Add('Cache-Control', 'no-store')
      $bytes = [IO.File]::ReadAllBytes($full)
    }
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
  } finally {
    $res.OutputStream.Close()
  }
}
