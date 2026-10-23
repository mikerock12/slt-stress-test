# Compila APK de distribuição assinado. Chave e senha ficam locais, fora do Git.
$ErrorActionPreference = 'Stop'
$repoSlt = Split-Path $PSScriptRoot -Parent
$assinaturaSlt = Join-Path $repoSlt '.local/assinatura-android'
New-Item -ItemType Directory -Force $assinaturaSlt | Out-Null
$chaveSlt = Join-Path $assinaturaSlt 'slt-release.jks'
$senhaSlt = Join-Path $assinaturaSlt 'senha.txt'
if (-not (Test-Path -LiteralPath $chaveSlt)) {
    if (-not (Test-Path -LiteralPath $senhaSlt)) {
        $bytesSlt = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48)
        [System.IO.File]::WriteAllText($senhaSlt, [Convert]::ToBase64String($bytesSlt))
    }
    & keytool -genkeypair -keystore $chaveSlt -storepass:file $senhaSlt -keypass:file $senhaSlt -alias slt -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Smells Like Tech, O=Smells Like Tech, C=BR'
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar chave local de assinatura.' }
}
try {
    $env:SLT_KEYSTORE = $chaveSlt
    $env:SLT_STORE_PASSWORD = [System.IO.File]::ReadAllText($senhaSlt).Trim()
    & (Join-Path $repoSlt 'android/gradlew.bat') -p (Join-Path $repoSlt 'android') assembleRelease lintRelease
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar APK de distribuição.' }
    $releaseSlt = Join-Path $repoSlt '.local/release'
    New-Item -ItemType Directory -Force $releaseSlt | Out-Null
    Copy-Item -LiteralPath (Join-Path $repoSlt 'android/app/build/outputs/apk/release/app-release.apk') -Destination (Join-Path $releaseSlt 'SLTStressTest.apk')
    Write-Output 'APK assinado em .local/release/SLTStressTest.apk. Preserve a pasta de assinatura para atualizar o mesmo aplicativo.'
} finally {
    Remove-Item Env:SLT_KEYSTORE -ErrorAction SilentlyContinue
    Remove-Item Env:SLT_STORE_PASSWORD -ErrorAction SilentlyContinue
}
