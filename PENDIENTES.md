# Pendientes que solo podés hacer vos

Todo lo demás de Pulso de Wall Street está hecho y probado. Estas cosas necesitan una cuenta, una clave o un pago a tu nombre,
y por seguridad no las puedo hacer yo. También están en la pestaña **Estado** de la página.

## 1. Noticias sin depender de Claude abierto
- [ ] Crear una clave de API en https://console.anthropic.com (se paga por uso).
- [ ] Copiar `bolsa-ny/.env.example` como `bolsa-ny/.env` y pegar la clave en `ANTHROPIC_API_KEY=`.
- [ ] Avisarme para probar la primera corrida real.
- [ ] Cuando funcione, pausar la tarea de Claude "Resumen bolsa NY" (para no pagar dos veces).

## 2. Que la página funcione con la PC apagada y desde cualquier lugar
- [ ] Crear una cuenta en un servicio de nube (por ejemplo GitHub, gratis) y decidir si la página puede quedar pública
      o si tiene que tener contraseña.
- [ ] Avisarme para configurar la publicación y el actualizador en la nube.

Mientras tanto, el celular funciona en tu casa, conectado al mismo Wi-Fi que la PC: probado el 25/11/2026
(doble clic en "Abrir en el celular.cmd").

## 3. Más datos de mercado
- [ ] Crear una clave gratuita en un proveedor de datos (por ejemplo Alpha Vantage o Twelve Data) para tener:
  - una segunda fuente de precios independiente de Yahoo,
  - la capitalización bursátil de cada empresa.
- [ ] Pegarla en `bolsa-ny/.env` y avisarme.

## 4. Cifras oficiales de la economía (inflación, empleo, PIB, tasa de la Fed)
Hoy se siguen por las noticias y con las tasas de mercado de Yahoo (bono a 10 años y letra a 13 semanas). Para tener los
datos oficiales con su historia (IPC, PCE, desempleo, nóminas, PIB, tasa de la Fed):
- [ ] Crear una clave gratuita en https://fred.stlouisfed.org/docs/api/api_key.html (Reserva Federal de St. Louis).
- [ ] Pegarla en `bolsa-ny/.env` como `FRED_API_KEY=` y avisarme.

## 5. Pruebas que necesitan tus dispositivos
- [ ] Abrir la página en Safari (iPhone o Mac) y contarme si algo se ve mal.
- [ ] Mañana entre las 10:00 y las 10:45: mirar en la pestaña Estado que el actualizador corrió solo.
