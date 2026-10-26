param([Parameter(Mandatory=$true)][string]$RequestPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $request = Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($request.action -eq 'voices') {
    $voices = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object {
      @{ name = $_.VoiceInfo.Name; language = $_.VoiceInfo.Culture.Name }
    })
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    ConvertTo-Json -InputObject $voices -Compress
  } else {
    $synth.SelectVoice([string]$request.voice)
    $synth.Rate = [Math]::Max(-5, [Math]::Min(5, [int][Math]::Round(($request.rate - 190) / 25)))
    $synth.SetOutputToWaveFile([string]$request.output)
    $synth.Speak([string]$request.text)
  }
} finally { $synth.Dispose() }
