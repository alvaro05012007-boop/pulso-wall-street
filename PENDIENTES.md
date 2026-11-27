# Pendientes que solo podés hacer vos

Todo lo demás de Pulso de Wall Street está hecho y probado. Estas cosas necesitan una cuenta, una clave o un pago a tu nombre,
y por seguridad no las puedo hacer yo. También están en la pestaña **Estado** de la página.

## 1. Noticias sin depender de Claude abierto
- [ ] Crear una clave de API en https://console.anthropic.com (se paga por uso).
- [ ] Para que la nube escriba los resúmenes con la PC apagada: en GitHub, repositorio → Settings → Secrets and variables
      → Actions → "New repository secret", nombre `ANTHROPIC_API_KEY`, y pegar la clave ahí.
- [ ] Avisarme para probar la primera corrida real.
- [ ] Cuando funcione, pausar la tarea de Claude "Resumen bolsa NY" (para no pagar dos veces).

## 2. Que la página funcione con la PC apagada y desde cualquier lugar — HECHO el 26/11/2026
Publicada en https://alvaro05012007-boop.github.io/pulso-wall-street/ (pública). GitHub actualiza precios e historial solo
los días de bolsa. Los resúmenes que escribe la tarea de Claude en la PC se suben solos (cada 15 minutos se fija si hay
nuevos), así que para que lleguen la PC tiene que estar prendida, hasta que actives el punto 1 en la nube.

## 3. Más datos de mercado
- [ ] Crear una clave gratuita en un proveedor de datos (por ejemplo Alpha Vantage o Twelve Data) para tener:
  una segunda fuente de precios independiente de Yahoo (la capitalización bursátil ya se muestra desde el 27/11/2026).
- [ ] Pegarla en `bolsa-ny/.env` y avisarme.

## 4. Cifras oficiales de la economía (inflación, empleo, PIB, tasa de la Fed)
Hoy se siguen por las noticias y con las tasas de mercado de Yahoo (bono a 10 años y letra a 13 semanas). Para tener los
datos oficiales con su historia (IPC, PCE, desempleo, nóminas, PIB, tasa de la Fed):
- [ ] Crear una clave gratuita en https://fred.stlouisfed.org/docs/api/api_key.html (Reserva Federal de St. Louis).
- [ ] Pegarla en `bolsa-ny/.env` como `FRED_API_KEY=` y avisarme.

## 5. Pruebas que necesitan tus dispositivos
- [ ] Abrir la página en Safari (iPhone o Mac) y contarme si algo se ve mal.
- [ ] Mañana entre las 10:00 y las 10:45: mirar en la pestaña Estado que el actualizador corrió solo.
