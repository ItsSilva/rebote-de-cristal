# Rebote de Cristal

Juego de tenis de mesa arcade para la ruta A del parcial: **Needle Engine y publicación en Needle Cloud**. Interfaz y documentación en español. El origen está en el suelo bajo el centro de la mesa; Y es altura, Z es el eje longitudinal, A juega desde +Z y B desde -Z. Unidades: metros.

[Jugar en Needle Cloud](https://rebote-de-cristal-160ydy19qg7w.needle.run/) · [Repositorio GitHub](https://github.com/ItsSilva/rebote-de-cristal) · [Resultados y pendientes](docs/ENTREGA.md)

## Abrir y jugar

Desde `web/`, con Node 24:

```powershell
npm ci
npm start
```

Abrir la URL que imprime Vite. En escritorio: **G** toma o recupera la pala, **Espacio** prepara la bola y **clic / Enter** realiza el gesto de golpe. El ratón mueve la pala en altura y lateralmente. La rueda cambia el ángulo y Shift + golpe aumenta la fuerza. Golpear después de un bote en el propio campo. **P** pausa o continúa repitiendo el saque; **R** inicia revancha. Las teclas **1 / 2 / 3** llevan a entrada, banco y puesto. **H** cambia mano; flechas arriba/abajo ajustan la distancia del puesto. También hay botones para todas estas acciones.

Se inicia con CPU local, sin depender de una conexión. En «Partida y sala»: «Jugar ahora» abre una sala automática, «Contra CPU» la cierra a otro humano, «Esperar rival» conserva la plaza A. Compartir la invitación o el código. Ambos pulsan «Listo PvP» entre puntos para reiniciar a 0–0 con lados opuestos. Un tercero recibe «Sala llena». Al salir B, se pausa; al salir A, B debe crear otra sala.

La publicación utiliza el transporte administrado de Needle. En desarrollo puede probarse añadiendo `?transport=needle` a la URL. El coordinador Node compatible con la API de conexión de Needle es una alternativa local para probar validación de identidad y admisión:

```powershell
npm run server
```

Vite redirige `/socket` al puerto 8787. La opción `VITE_NETWORK_URL` permite seleccionar un endpoint propio; el valor `needle` selecciona la infraestructura oficial. No se requiere desplegar el coordinador Node para la publicación administrada.

## RV y RM

Abrir la experiencia por HTTPS en un navegador con WebXR. Las opciones RV y RM se detectan por separado. En RV: agarre cerca del mango toma o devuelve la pala; el panel permite recuperarla a distancia; gatillo acciona el panel espacial o prepara el saque; mover físicamente la pala devuelve la pelota. El panel permite pausar, recuperar, cambiar modo, iniciar revancha, desplazarse y salir de XR. Pinza con seguimiento de manos es una implementación experimental: **pendiente de probar en visor**.

En RM, usar «Colocar RM», «Girar RM» y «Confirmar RM» en el panel. Se intenta hit test; hay colocación manual si no se obtiene superficie. Se oculta la cantera y se conservan mesa, pelota, palas y panel. Escala compartida 1:1. **Passthrough, alineación de dos visores y confort siguen pendientes de validación física.**

## Proyecto y fuentes

- Unity: `Unity/`, Editor **6000.3.28f1**. Escena `Assets/Scenes/ReboteDeCristal.unity`.
- Exportador Needle para Unity **5.1.16**, fijado en `Unity/Packages/manifest.json` y `packages-lock.json`.
- Runtime `@needle-tools/engine` **5.1.16**; Three de Needle **0.169.19**; Vite **8.1.7**; npm **11.6.2**; Node **24.13.0**. Lockfile en `web/package-lock.json`.
- Rolldown fijado en **1.1.4**, recomendado por Needle para evitar [el fallo de división de chunks](https://github.com/rolldown/rolldown/issues/10337) observado durante la exportación. Se conserva el parche de Vite.
- Lógica: `web/src/game/`; interacción y XR: `web/src/main.ts`; salas: `web/src/network.ts`; coordinador opcional: `web/server/server.ts`.
- Modelado editable: `web/src/world.ts` y `Unity/Assets/Source/cancha.json`; mallas y materiales importados persistentes en `Unity/Assets/Models` y `Materials`.
- Autoría/reconstrucción Unity: `Unity/Assets/Editor/ClubBuilder.cs` y menú **Rebote**.
- Baking de tejido normal/AO y suelo: `tools/bake.py` (Python con Pillow). Mapas en `web/src/assets/`.
- Bake Unity: `Unity/Assets/Scenes/ReboteDeCristal/`, con lightmap y LightingData. El resultado del horneado se registra en `evidencias/unity-bake-result.json`.

## Hornear y exportar

Abrir Unity y la escena. El menú **Rebote / 2. Hornear iluminación** ajusta la codificación normal que exige Needle y ejecuta Progressive CPU: 12 texels/m, atlas hasta 1024, margen 4 px, 32 muestras directas, 64 indirectas, 32 de entorno y oclusión a 0,8 m. Las mallas estáticas tienen UV de material y UV2 generadas; los objetos móviles usan iluminación económica.

El menú **Rebote / 3. Exportar Needle y compilar** utiliza el exportador oficial. La sesión de Needle debe tener permiso para usar el editor. Para batch, iniciar previamente el servidor oficial que indica la versión instalada. El script espera la autenticación antes de exportar. No modificar `Library/PackageCache` ni el código del SDK para saltar licencias.

## Pruebas y publicación

```powershell
npm run typecheck
npm test
npm run build
npx needle-cloud deploy dist --name rebote-de-cristal --team eo3cwlpboqxn --non-interactive true --open false
```

Las pruebas de sockets y navegador necesitan permiso de red local. Los scripts `web/tests/play-cpu.mjs` y `browser-pvp.mjs` usan entradas de teclado y ratón; `GAME_URL` selecciona la URL de prueba. El controlador de navegador se configura en los scripts para Brave instalado en Windows; para otro equipo, ajustar el ejecutable o instalar Chromium de Playwright.

La matriz y los resultados definitivos se mantienen en `docs/MATRIZ.md` y `docs/ENTREGA.md`. Las capturas de escritorio **no acreditan** 72 FPS en Quest ni un POV real de visor.

## Créditos

Escenario, palas, dispensador y autómata generados para este proyecto mediante código editable asistido por Codex. No se copiaron emblemas ni el personaje de la referencia inflable. Las imágenes de referencia y el brief permanecen en la carpeta de trabajo y se excluyen del repositorio por no haberse confirmado su licencia de redistribución. Los tres integrantes están registrados; el equipo debe completar los aportes reales y créditos en `docs/BEHANCE.md`.

Base técnica: [plantilla Vite oficial de Needle](https://github.com/needle-engine/vite-template), [Needle para Unity](https://engine.needle.tools/docs/unity/), [networking](https://engine.needle.tools/docs/how-to-guides/networking/setup), [XR](https://engine.needle.tools/docs/how-to-guides/xr/index.html) y [publicación](https://engine.needle.tools/docs/cloud/).


