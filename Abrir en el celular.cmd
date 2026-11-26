@echo off
rem Abre Pulso de Wall Street para el celular (mismo Wi-Fi que esta PC). Dejá esta ventana abierta mientras lo uses.
rem La primera vez Windows puede preguntar si permitís el acceso de Node.js: aceptá solo para "redes privadas".
cd /d "%~dp0"
node servidor.mjs --red --abrir 8787
pause
