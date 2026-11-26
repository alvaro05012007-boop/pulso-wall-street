# Junta los resúmenes de datos\*.json en datos.js. La lógica (con validación) está en datos.mjs;
# este archivo queda para que la tarea programada de Claude lo siga llamando igual que antes.
$ErrorActionPreference = 'Stop'
node (Join-Path $PSScriptRoot 'datos.mjs')
exit $LASTEXITCODE
