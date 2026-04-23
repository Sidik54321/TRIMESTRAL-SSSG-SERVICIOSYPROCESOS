$file = 'c:\Users\syu02\GLOVEUP\GLOVEUP\dashboard\entrenador\dashboard.react.js'
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$content = $content -replace 'Inscripci[^\x00-\x7F]+n', 'Inscripción'
$content = $content -replace 'conexi[^\x00-\x7F]+n', 'conexión'
$content = $content -replace 'gesti[^\x00-\x7F]+n', 'gestión'
$content = $content -replace 'Gesti[^\x00-\x7F]+n', 'Gestión'
$content = $content -replace 'sesi[^\x00-\x7F]+n', 'sesión'
$content = $content -replace 'm[^\x00-\x7F]+tricas', 'métricas'
$content = $content -replace 'econ[^\x00-\x7F]+mica', 'económica'
$content = $content -replace 'A[^\x00-\x7F]+adir', 'Añadir'
$content = $content -replace 'est[^\x00-\x7F]+tico', 'estático'
$content = $content -replace "pointer' \} \}, '[^\x00-\x7F]+'\)", "pointer' } }, '×')"
$content = $content -replace "mensual [^\x00-\x7F]+ inscripciones", "mensual × inscripciones"

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "Reemplazos completados"
