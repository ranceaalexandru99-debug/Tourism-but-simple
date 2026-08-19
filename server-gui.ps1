# Turism, dar simplu! — Control Panel (WinForms GUI)
# Launched by server-gui.bat. Starts/stops the Vite dev server, streams its
# logs live into a console box, and opens the app in the browser.
#
# Threading model: the child process' stdout/stderr fire on background threads,
# so they push lines into a thread-safe ConcurrentQueue. A WinForms Timer on the
# UI thread drains that queue and appends to the log box — no cross-thread calls.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ProjectDir = $PSScriptRoot
$DefaultUrl = "http://localhost:5173"

# ---- palette (matches the app's porcelain + antique-gold theme) -------------
$cBg     = [System.Drawing.Color]::FromArgb(24, 24, 27)
$cPanel  = [System.Drawing.Color]::FromArgb(32, 32, 36)
$cGold   = [System.Drawing.Color]::FromArgb(180, 152, 63)
$cText   = [System.Drawing.Color]::FromArgb(230, 228, 222)
$cGreen  = [System.Drawing.Color]::FromArgb(56, 128, 89)
$cRed    = [System.Drawing.Color]::FromArgb(188, 80, 80)
$cMuted  = [System.Drawing.Color]::FromArgb(140, 138, 130)

# ---- shared state ------------------------------------------------------------
$script:proc     = $null
$script:queue    = New-Object System.Collections.Concurrent.ConcurrentQueue[string]
$script:url      = $DefaultUrl
$script:psOut    = $null
$script:psErr    = $null
$script:lanUrl   = $null   # http://<lan-ip>:<port> for same-Wi-Fi phones
$script:tunProc  = $null   # ssh tunnel process
$script:psTun    = $null   # tunnel stdout reader
$script:psTun2   = $null   # tunnel stderr reader
$script:tunUrl   = $null   # the public https link
$script:tunWanted = $false # keep the tunnel alive (auto-reconnect on drop)

# Background reader: pumps a process stream into the shared queue on its own
# thread (no message-pump dependency, unlike Register-ObjectEvent).
$script:reader = {
  param($stream, $q)
  while ($null -ne ($line = $stream.ReadLine())) { $q.Enqueue($line) }
}

# ---- form --------------------------------------------------------------------
$form = New-Object System.Windows.Forms.Form
$form.Text = "Turism, dar simplu! - Control Panel"
$form.Size = New-Object System.Drawing.Size(980, 600)
$form.MinimumSize = New-Object System.Drawing.Size(720, 400)
$form.StartPosition = "CenterScreen"
$form.BackColor = $cBg

# ---- top button bar ----------------------------------------------------------
$bar = New-Object System.Windows.Forms.Panel
$bar.Dock = "Top"
$bar.Height = 56
$bar.BackColor = $cPanel
$form.Controls.Add($bar)

function New-Btn($text, $x, $w, $fore) {
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $text
  $b.Location = New-Object System.Drawing.Point($x, 11)
  $b.Size = New-Object System.Drawing.Size($w, 34)
  $b.FlatStyle = "Flat"
  $b.FlatAppearance.BorderColor = $cGold
  $b.FlatAppearance.BorderSize = 1
  $b.BackColor = $cPanel
  $b.ForeColor = $fore
  $b.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
  $b.Cursor = "Hand"
  $bar.Controls.Add($b)
  return $b
}

$btnStart   = New-Btn "Porneste server"  12 140 $cGreen
$btnStop    = New-Btn "Opreste server"  158 140 $cRed
$btnBrowser = New-Btn "Deschide browser" 304 148 $cGold
$btnLan     = New-Btn "Link Wi-Fi"      458 128 $cGold
$btnTunnel  = New-Btn "Tunel net"       592 118 $cGold
$btnClear   = New-Btn "Curata log"      716 108 $cMuted
$btnStop.Enabled = $false
$btnBrowser.Enabled = $false
$btnLan.Enabled = $false
$btnTunnel.Enabled = $false

# ---- status strip ------------------------------------------------------------
# Added first so it docks to the very bottom edge; the link panel below is added
# after, so it stacks just above the status strip.
$status = New-Object System.Windows.Forms.Label
$status.Dock = "Bottom"
$status.Height = 26
$status.TextAlign = "MiddleLeft"
$status.BackColor = $cPanel
$status.ForeColor = $cMuted
$status.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$status.Padding = New-Object System.Windows.Forms.Padding(10, 0, 0, 0)
$status.Text = "  Server oprit."
$form.Controls.Add($status)

# ---- phone-link strip (hidden until a tunnel URL is ready) -------------------
$linkBar = New-Object System.Windows.Forms.Panel
$linkBar.Dock = "Bottom"
$linkBar.Height = 42
$linkBar.BackColor = $cPanel
$linkBar.Visible = $false
$form.Controls.Add($linkBar)

$lblLink = New-Object System.Windows.Forms.Label
$lblLink.Text = "Link telefon:"
$lblLink.Location = New-Object System.Drawing.Point(10, 12)
$lblLink.AutoSize = $true
$lblLink.ForeColor = $cGold
$lblLink.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$linkBar.Controls.Add($lblLink)

$txtLink = New-Object System.Windows.Forms.TextBox
$txtLink.Location = New-Object System.Drawing.Point(96, 9)
$txtLink.Size = New-Object System.Drawing.Size(560, 24)
$txtLink.Anchor = "Top,Left,Right"
$txtLink.ReadOnly = $true
$txtLink.BackColor = [System.Drawing.Color]::FromArgb(16, 16, 18)
$txtLink.ForeColor = $cText
$txtLink.Font = New-Object System.Drawing.Font("Consolas", 10)
$txtLink.BorderStyle = "FixedSingle"
$linkBar.Controls.Add($txtLink)

$btnCopy = New-Object System.Windows.Forms.Button
$btnCopy.Text = "Copiaza"
$btnCopy.Size = New-Object System.Drawing.Size(90, 26)
$btnCopy.Location = New-Object System.Drawing.Point(664, 8)
$btnCopy.Anchor = "Top,Right"
$btnCopy.FlatStyle = "Flat"
$btnCopy.FlatAppearance.BorderColor = $cGold
$btnCopy.BackColor = $cPanel
$btnCopy.ForeColor = $cGold
$btnCopy.Cursor = "Hand"
$linkBar.Controls.Add($btnCopy)

# ---- log box -----------------------------------------------------------------
$log = New-Object System.Windows.Forms.RichTextBox
$log.Dock = "Fill"
$log.BackColor = [System.Drawing.Color]::FromArgb(16, 16, 18)
$log.ForeColor = $cText
$log.Font = New-Object System.Drawing.Font("Consolas", 9.5)
$log.ReadOnly = $true
$log.BorderStyle = "None"
$log.DetectUrls = $false
$log.WordWrap = $false
$log.ScrollBars = "Both"
$form.Controls.Add($log)
$log.BringToFront()

function Add-Log($line) {
  $clean = $line -replace "$([char]27)\[[0-9;]*m", ""   # strip ANSI colours
  if ($clean.Trim().Length -eq 0) { return }
  $log.AppendText($clean + "`r`n")
  $log.SelectionStart = $log.TextLength
  $log.ScrollToCaret()
  # Parse Vite's "Local:  http://localhost:PORT/" to learn the real URL.
  if ($clean -match "Local:\s*(https?://\S+)") {
    $script:url = $Matches[1].TrimEnd("/")
    $btnBrowser.Enabled = $true
    $btnLan.Enabled = $true
    $btnTunnel.Enabled = $true
  }
  # Parse Vite's "Network: http://<lan-ip>:PORT/" — the reliable same-Wi-Fi link.
  if ($clean -match "Network:\s*(https?://[0-9.]+:\d+)") {
    $script:lanUrl = $Matches[1].TrimEnd("/")
    $btnLan.Enabled = $true
  }
  # Parse the localhost.run public URL when a tunnel is running.
  if ($clean -match "(https://[a-z0-9-]+\.lhr\.life)") {
    $script:tunUrl = $Matches[1]
    Set-LinkUrl $script:tunUrl "Link internet gata"
  }
}

# Show a URL in the phone-link strip, copy it to the clipboard, note it in the
# status bar. Used by both the Wi-Fi (LAN) and internet (tunnel) links.
function Set-LinkUrl($u, $label) {
  $txtLink.Text = $u
  $linkBar.Visible = $true
  try { [System.Windows.Forms.Clipboard]::SetText($u) } catch {}
  $status.ForeColor = $cGold
  $status.Text = "  $label (copiat in clipboard): $u"
}

# The same-Wi-Fi URL: prefer Vite's parsed Network line, else compute from the
# machine's LAN IPv4 + the current port.
function Get-LanUrl {
  if ($script:lanUrl) { return $script:lanUrl }
  $port = 5173
  if ($script:url -match ":(\d+)") { $port = $Matches[1] }
  try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254.*" } |
      Select-Object -First 1).IPAddress
    if ($ip) { return "http://${ip}:${port}" }
  } catch {}
  return $null
}

# ---- port cleanup ------------------------------------------------------------
function Stop-Port($port) {
  try {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  } catch {}
}

# ---- start / stop ------------------------------------------------------------
function Start-Server {
  if ($script:proc -and -not $script:proc.HasExited) { return }
  $log.Clear()
  Add-Log "[*] Pornesc dev server in: $ProjectDir"
  Stop-Port 5173
  Stop-Port 5174

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cmd.exe"
  $psi.Arguments = "/c npm run dev"
  $psi.WorkingDirectory = $ProjectDir
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true

  $script:proc = New-Object System.Diagnostics.Process
  $script:proc.StartInfo = $psi

  [void]$script:proc.Start()

  # Spin up one background reader per stream; both feed the shared queue.
  $script:psOut = [System.Management.Automation.PowerShell]::Create()
  [void]$script:psOut.AddScript($script:reader).AddArgument($script:proc.StandardOutput).AddArgument($script:queue)
  [void]$script:psOut.BeginInvoke()
  $script:psErr = [System.Management.Automation.PowerShell]::Create()
  [void]$script:psErr.AddScript($script:reader).AddArgument($script:proc.StandardError).AddArgument($script:queue)
  [void]$script:psErr.BeginInvoke()

  $btnStart.Enabled = $false
  $btnStop.Enabled = $true
  $status.ForeColor = $cGreen
  $status.Text = "  Server pornit (PID $($script:proc.Id)). Astept Vite..."
}

function Stop-Server {
  if ($script:proc -and -not $script:proc.HasExited) {
    try { & taskkill /PID $script:proc.Id /T /F *> $null } catch {}
  }
  Stop-Port 5173
  Stop-Port 5174
  if ($script:psOut) { try { $script:psOut.Stop(); $script:psOut.Dispose() } catch {}; $script:psOut = $null }
  if ($script:psErr) { try { $script:psErr.Stop(); $script:psErr.Dispose() } catch {}; $script:psErr = $null }
  $script:proc = $null
  Stop-Tunnel
  $linkBar.Visible = $false
  $script:lanUrl = $null
  $btnStart.Enabled = $true
  $btnStop.Enabled = $false
  $btnBrowser.Enabled = $false
  $btnLan.Enabled = $false
  $btnTunnel.Enabled = $false
  $status.ForeColor = $cRed
  $status.Text = "  Server oprit."
  Add-Log "[*] Server oprit."
}

# ---- phone tunnel (localhost.run over SSH, auto-reconnecting) ----------------
# localhost.run drops connections often; we keep $tunWanted set and the drain
# timer respawns ssh whenever it exits, so the link keeps working.
function Spawn-Ssh {
  $port = 5173
  if ($script:url -match ":(\d+)") { $port = $Matches[1] }
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "ssh"
  $psi.Arguments = "-o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ExitOnForwardFailure=yes -R 80:localhost:$port nokey@localhost.run"
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  try { [void]$p.Start() }
  catch { Add-Log "[!] Nu am gasit 'ssh'. Instaleaza OpenSSH Client din Setari Windows."; return $false }
  $script:tunProc = $p
  $script:psTun = [System.Management.Automation.PowerShell]::Create()
  [void]$script:psTun.AddScript($script:reader).AddArgument($p.StandardOutput).AddArgument($script:queue)
  [void]$script:psTun.BeginInvoke()
  $script:psTun2 = [System.Management.Automation.PowerShell]::Create()
  [void]$script:psTun2.AddScript($script:reader).AddArgument($p.StandardError).AddArgument($script:queue)
  [void]$script:psTun2.BeginInvoke()
  return $true
}

function Start-Tunnel {
  if ($script:tunProc -and -not $script:tunProc.HasExited) {
    if ($script:tunUrl) { Set-LinkUrl $script:tunUrl "Link internet gata" }
    return
  }
  $port = 5173
  if ($script:url -match ":(\d+)") { $port = $Matches[1] }
  Add-Log "[*] Deschid tunel public catre localhost:$port (localhost.run)..."
  $status.ForeColor = $cGold
  $status.Text = "  Creez linkul de internet... (poate dura 5-10s)"
  $script:tunWanted = $true
  if (Spawn-Ssh) { $btnTunnel.Text = "Reia tunel" }
}

function Stop-Tunnel {
  $script:tunWanted = $false
  if ($script:tunProc -and -not $script:tunProc.HasExited) {
    try { & taskkill /PID $script:tunProc.Id /T /F *> $null } catch {}
  }
  if ($script:psTun)  { try { $script:psTun.Stop();  $script:psTun.Dispose() }  catch {}; $script:psTun = $null }
  if ($script:psTun2) { try { $script:psTun2.Stop(); $script:psTun2.Dispose() } catch {}; $script:psTun2 = $null }
  $script:tunProc = $null
  $script:tunUrl = $null
  $btnTunnel.Text = "Tunel net"
}

# ---- drain timer (UI thread) -------------------------------------------------
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 150
$timer.Add_Tick({
  $line = ""
  while ($script:queue.TryDequeue([ref]$line)) { Add-Log $line }
  if ($script:proc -and $script:proc.HasExited -and $btnStop.Enabled) {
    Add-Log "[!] Procesul s-a inchis (cod $($script:proc.ExitCode))."
    Stop-Server
  }
  # Auto-reconnect the tunnel if it dropped while still wanted.
  if ($script:tunWanted -and $script:tunProc -and $script:tunProc.HasExited) {
    Add-Log "[*] Tunelul a picat - reconectez..."
    $script:tunUrl = $null
    if ($script:psTun)  { try { $script:psTun.Dispose() }  catch {}; $script:psTun = $null }
    if ($script:psTun2) { try { $script:psTun2.Dispose() } catch {}; $script:psTun2 = $null }
    $script:tunProc = $null
    [void](Spawn-Ssh)
  }
})
$timer.Start()

# ---- wiring ------------------------------------------------------------------
$btnStart.Add_Click({ Start-Server })
$btnStop.Add_Click({ Stop-Server })
$btnClear.Add_Click({ $log.Clear() })
$btnBrowser.Add_Click({ Start-Process $script:url })
$btnLan.Add_Click({
  $u = Get-LanUrl
  if ($u) { Set-LinkUrl $u "Link Wi-Fi (telefonul pe aceeasi retea)" }
  else { $status.Text = "  Nu am gasit IP-ul de retea. Astept Vite..." }
})
$btnTunnel.Add_Click({ Start-Tunnel })
$btnCopy.Add_Click({
  if ($txtLink.Text) {
    try { [System.Windows.Forms.Clipboard]::SetText($txtLink.Text) } catch {}
    $status.ForeColor = $cGold
    $status.Text = "  Link copiat: $($txtLink.Text)"
  }
})

$form.Add_FormClosing({ Stop-Server })

# Auto-start on launch so double-clicking the .bat just works.
$form.Add_Shown({ Start-Server })

[void]$form.ShowDialog()
