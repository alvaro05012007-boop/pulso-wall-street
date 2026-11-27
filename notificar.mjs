// Notificación nativa de Windows, sin instalar nada. La usan alertas.mjs y videos.mjs.
import { spawnSync } from 'node:child_process';

export function notificar(titulo, texto) { // notificación nativa de Windows (sin instalar nada)
  const esc = s => String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  const xml = `<toast><visual><binding template="ToastGeneric"><text>${esc(titulo)}</text><text>${esc(texto)}</text></binding></visual></toast>`;
  const ps = `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null
$x = New-Object Windows.Data.Xml.Dom.XmlDocument; $x.LoadXml($env:PULSO_TOAST)
$app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show([Windows.UI.Notifications.ToastNotification]::new($x))`;
  // el texto viaja por una variable de entorno: nunca se arma código de PowerShell con datos
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { env: { ...process.env, PULSO_TOAST: xml }, encoding: 'utf8', timeout: 20000 });
  return r.status === 0;
}
