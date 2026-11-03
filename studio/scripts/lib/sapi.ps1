param(
  [Parameter(Mandatory = $true)][string]$TextFile,
  [Parameter(Mandatory = $true)][string]$OutFile,
  [string]$Gender = 'male',
  [int]$Rate = 0
)
# Offline fallback voice: Windows built-in speech (System.Speech). No network, no account.
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $g = if ($Gender -eq 'female') { [System.Speech.Synthesis.VoiceGender]::Female } else { [System.Speech.Synthesis.VoiceGender]::Male }
  $s.SelectVoiceByHints($g)
} catch { }
$s.Rate = [Math]::Max(-10, [Math]::Min(10, $Rate))
$s.SetOutputToWaveFile($OutFile)
$s.Speak([System.IO.File]::ReadAllText($TextFile, [System.Text.Encoding]::UTF8))
$s.Dispose()
