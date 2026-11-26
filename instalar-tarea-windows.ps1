# Registra el actualizador independiente (actualizar.mjs) en el Programador de tareas de Windows. No necesita a Claude.
# Se ejecuta cada 15 minutos; actualizar.mjs decide si es hora según el reloj de Nueva York (antes de la apertura y
# después del cierre, días hábiles, feriados incluidos) y corre una sola vez por ventana. Requiere la PC prendida.
# Instalar:  powershell -ExecutionPolicy Bypass -File instalar-tarea-windows.ps1
# Quitar:    Unregister-ScheduledTask -TaskName "Pulso de Wall Street" -Confirm:$false
$ErrorActionPreference = 'Stop'
$node = (Get-Command node).Source
$script = Join-Path $PSScriptRoot 'actualizar.mjs'
$accion = New-ScheduledTaskAction -Execute $node -Argument "`"$script`" --si-toca" -WorkingDirectory $PSScriptRoot
$disparador = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 15)
$config = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Pulso de Wall Street' -Action $accion -Trigger $disparador -Settings $config `
  -Description 'Actualiza precios, indicadores e historial de Pulso de Wall Street (bolsa-ny/actualizar.mjs).' -Force | Out-Null
Write-Output 'Listo: la tarea "Pulso de Wall Street" corre cada 15 minutos y actualiza en las ventanas de Nueva York.'
