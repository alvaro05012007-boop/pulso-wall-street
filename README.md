# Pulso de Wall Street

Plataforma local de inteligencia de mercado sobre la bolsa de Nueva York: noticias resumidas, datos de mercado reales,
indicadores, rankings, comparador, alertas e historial. Se abre con doble clic en `index.html`; no necesita servidor.

Prioridades: precisión, fiabilidad, inteligencia, seguridad, experiencia visual y rendimiento, en ese orden.
Nada de lo que muestra es una recomendación de inversión ni una predicción.

## Cómo se abre

- **En la computadora:** doble clic en el acceso directo **"Pulso de Wall Street"** del escritorio (o en `index.html`).
- **En el celular, en tu casa:** doble clic en **`Abrir en el celular.cmd`** (carpeta `bolsa-ny`) y dejá esa ventana abierta.
  Se abre la página en la PC con un código QR en la pestaña Estado: escanealo con la cámara del celular conectado al mismo
  Wi-Fi. El link trae una clave de acceso (no lo compartas); el celular la recuerda. La primera vez Windows puede preguntar
  si permitís Node.js: aceptá solo para redes privadas.
- **Desde cualquier lugar, con la PC apagada:** https://alvaro05012007-boop.github.io/pulso-wall-street/ (pública).

## Cómo se usa

- Con la página abierta, cada 2 minutos se fija si hay datos nuevos.
- 5 secciones: **Hoy** (resumen del día), **Mercado** (Panorama y Análisis), **Empresas** (Ranking y Comparar),
  **Historia** (Días, Tendencias y 5 años) y **Mis listas**. El engranaje de arriba tiene el estado del sistema y las
  preferencias; el "?" muestra la guía de 30 segundos.
- Gráficos de empresas y del S&P 500 con capas que se prenden y apagan: medias de 20, 50 y 200, Bollinger, volumen, RSI y MACD.
- **Informe PDF** (botón del resumen): resumen ejecutivo, índices, noticias con fuentes, sectores, riesgos, indicadores,
  tendencias y conclusión, listo para imprimir o guardar como PDF.
- Alertas por variación, volumen, volatilidad, palabras en noticias y acontecimientos económicos (Fed, inflación, empleo, PIB).
- El actualizador hace una copia diaria del historial en `../backups/auto/` y revisa las dependencias una vez por semana.
- Atajos: ← → cambian de resumen, 1 a 9 cambian de sección, / busca y P presenta.
- Cada resumen trae una **verificación de cifras**: compara lo que dicen las noticias con los datos reales de Yahoo y avisa las
  diferencias. Cada noticia lleva un **puntaje de importancia** de 0 a 100 y una **urgencia**, calculados con reglas fijas que
  la página explica (no los decide la IA que escribió el resumen).

## De dónde sale cada dato

| Dato | Fuente | Quién lo actualiza |
|---|---|---|
| Precios, volumen, máximos y mínimos de 100 empresas e índices (S&P 500, Dow Jones, Nasdaq Composite, Nasdaq 100, Russell 2000, VIX, bono a 10 años, WTI, dólar, letra a 13 semanas) | Yahoo Finance, API pública de gráficos, 5 años diarios | `acciones.mjs` |
| Indicadores (RSI, MACD, ATR, Bollinger, medias de 20/50/100/200, volatilidad, caída máxima, beta, Sharpe, correlación, amplitud, sectores, anomalías) | Calculados en `cuant.mjs` con esos precios | `acciones.mjs` |
| Resúmenes de noticias | Búsqueda web de la tarea programada de Claude | Tarea "Resumen bolsa NY" |
| Historial publicado (`datos.js`) | `datos/*.json`, validados | `datos.mjs` |
| Precio objetivo de analistas, próximo balance y capitalización | Yahoo Finance (quoteSummary), una vez por día | `empresas.mjs` |
| Presentaciones oficiales (10-K, 10-Q, 8-K) | SEC EDGAR, gratis, una vez por día | `empresas.mjs` |
| Precio antes de la apertura (4:00-9:30 NY) y después del cierre (16:00-20:00 NY) | Yahoo Finance (v7/quote), cada 15 min en la PC y cada 30 min en la nube, solo en esas franjas | `fuera-horario.mjs` |

Si Yahoo falla, `acciones.mjs` reintenta y prueba su servidor alternativo; si sigue fallando, conserva el último dato
válido marcado como **desactualizado**. Nunca completa un valor inventado. Cada dato muestra fuente y hora de Nueva York.
**Proyección estimada** (ficha de cada empresa, 30 a 720 días): no es una predicción ni un consejo de inversión, y la página lo
dice siempre. Escenario central = promedio de (1) el pasado de la empresa en tramos del mismo largo, con el percentil movido
de 40 a 60 por el tono de sus noticias de los últimos 30 días, (2) la mediana del S&P 500 y (3) el precio objetivo de los
analistas llevado al plazo. Pesimista y optimista = central más la dispersión histórica (percentiles 10 y 90). Código en
`proyeccion.js`; percentiles en `cuant.mjs` (`escenarios`, con prueba).

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html`, `estilo.css` | Estructura y estilos de la página |
| `app.js` | Resumen, historial, tendencias, ranking, fichas, gráficos, presentación, esfera 3D |
| `terminal.js`, `inteligencia.js`, `comparador.js`, `listas.js`, `estado.js` | Secciones nuevas, enchufadas a `app.js` con `window.Pulso` |
| `proyeccion.js`, `ficha.js` | Proyección estimada y ficha ampliada de cada empresa (balance, SEC, parecidas, temas, regulación) |
| `empresas.mjs` → `empresas.js` | Analistas, balances, capitalización y SEC, una vez por día |
| `fuera-horario.mjs` → `extendido.js` | Precio de cada empresa antes de la apertura y después del cierre ("pre"/"post" en el ranking y en la ficha) |
| `motor-noticias.js` | Puntaje e importancia de noticias con reglas fijas y verificación de cifras contra Yahoo |
| `Abrir en el celular.cmd` | Arranca el servidor en modo red y abre la página con el código QR |
| `PENDIENTES.md` | Lo que solo podés hacer vos (cuentas, claves, pagos) |
| `acciones.mjs` + `cuant.mjs` | Datos de mercado e indicadores; pruebas en `cuant.test.mjs` |
| `datos.mjs` (y `build-datos.ps1`, que lo llama) + `validar.mjs` | Valida los resúmenes y arma `datos.js` |
| `noticias.mjs` | Resúmenes de noticias por la API de Anthropic, sin Claude Code abierto (necesita clave en `.env`) |
| `alertas.mjs` | Avisa las alertas con notificaciones de Windows aunque la página esté cerrada |
| `version.mjs` → `version.js` | Marca qué datos cambiaron, para que la página baje solo eso |
| `servidor.mjs` | Servidor local opcional con cabeceras de seguridad y `/api/estado` |
| `actualizar.mjs` | Actualizador independiente de Claude: precios, noticias, historial y alertas, con reintentos y registro en `logs/` |
| `instalar-tarea-windows.ps1` | Registra el actualizador en el Programador de tareas de Windows |
| `datos/` | El historial. **No borrar.** |

## Mantenimiento

```
cd bolsa-ny && npm install               # solo la primera vez: instala la librería de Anthropic para noticias.mjs
node --test bolsa-ny/                    # pruebas de fórmulas (cuant.test.mjs)
node bolsa-ny/acciones.mjs               # actualizar precios e indicadores ahora
node bolsa-ny/datos.mjs                  # rearmar el historial (valida cada resumen)
node bolsa-ny/actualizar.mjs             # las dos cosas, con reintentos y registro
```

- Feriados de la bolsa de Nueva York: cargados hasta 2027 en `app.js` y `actualizar.mjs`. Sumar los de 2028 cuando se publiquen.
- Un resumen inválido no se publica ni se borra: `datos.mjs` avisa qué tiene mal.
- Copias de seguridad: `../backups/` (la primera es del 24/11/2026, antes de la versión 2.0).

## Automatización sin Claude

**Precios, indicadores e historial:** `actualizar.mjs` no necesita a Claude. Para que corra solo en esta PC:

```
powershell -ExecutionPolicy Bypass -File bolsa-ny/instalar-tarea-windows.ps1
```

Se ejecuta cada 15 minutos y actualiza una vez antes de la apertura (9:00 a 9:45 de NY) y una vez después del cierre
(16:20 a 17:30 de NY). Calcula todo en `America/New_York`, así que respeta los cambios de horario de verano.
Necesita la PC prendida. El registro queda en `logs/ejecuciones.jsonl` y se ve en la pestaña Estado.

**Resúmenes de noticias sin Claude:** `noticias.mjs` está listo y conectado al actualizador. Para activarlo, copiá
`.env.example` como `.env` y poné tu `ANTHROPIC_API_KEY` (se crea en console.anthropic.com; se paga por uso, cada resumen
usa el modelo Claude Opus 5.5 con búsqueda web). Sin clave, ese paso se omite y queda registrado como "omitido". Si ya hay un
resumen del mismo momento del día (por ejemplo, de la tarea de Claude), no genera otro. Cuando funcione con tu clave,
podés pausar la tarea de Claude "Resumen bolsa NY" para no pagar dos veces.

**Alertas con la página cerrada:** en "Mis listas", el botón "Avisar también con la página cerrada" descarga
`pulso-alertas.json`. El actualizador lo toma solo de tu carpeta Descargas y avisa con una notificación de Windows, una vez
por cada dato nuevo. Prueba: `node bolsa-ny/alertas.mjs --probar`.

**Servidor con seguridad (opcional):** `node bolsa-ny/servidor.mjs` (solo esta PC) o `--red` (también el Wi-Fi, con clave).
Agrega política de seguridad de contenido, no sirve `.env`, scripts internos ni `node_modules`, compara la clave en tiempo
constante y bloquea 15 minutos a quien falle 10 veces. API de solo lectura, con parámetros validados y caché por ETag:
`/api/estado`, `/api/indices`, `/api/empresas?sector=Salud`, `/api/empresa?ticker=NVDA`,
`/api/resumenes?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&q=texto&limite=20`.

**En la nube (GitHub Actions + Pages):** `.github/workflows/actualizar.yml` corre `actualizar.mjs` en las mismas ventanas
de NY, arma `datos.js`, `acciones.js` y `version.js` (no se guardan en el repositorio, así nunca chocan con la PC) y publica.
Antes de correr baja de la página publicada los precios previos y el registro, para tener respaldo si Yahoo falla.
La PC sube sola los resúmenes nuevos de `datos/`: `actualizar.mjs` se fija cada 15 minutos y hace commit y push solo de
esa carpeta; cada push vuelve a publicar. Para noticias en la nube sin la PC: secreto `ANTHROPIC_API_KEY` en GitHub.

## Seguridad

- La página no usa claves ni manda datos a ningún lado; solo pide la librería 3D a cdnjs y las fuentes a Google Fonts.
- Todo el texto que viene de la web se inserta como texto (nunca como HTML) y los enlaces se aceptan solo si son http(s).
- `datos.mjs` valida cada resumen antes de publicarlo.
- Las claves futuras irían en `.env`, que está en `.gitignore` y nunca llega al navegador.
- Las listas, alertas y preferencias se guardan solo en el navegador (localStorage).
