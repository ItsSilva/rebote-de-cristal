# Matriz de verificación del parcial

Fuente: brief de la docente leído completo en `referencias/brief-parcial-3.pdf`; ruta A, Needle. Los pesos son los del original. Esta matriz distingue implementación, pruebas de escritorio/simulación y evidencia que requiere visor o autoría humana. No equivale a una calificación.

| Criterio / requisito | Implementación y evidencia concreta | Probado aquí | Pendiente del equipo |
|---|---|---|---|
| Inmersión y escala **30 %** | Escena `Unity/Assets/Scenes/ReboteDeCristal.unity`; medidas en `web/src/game/physics.ts`; captura `evidencias/04-unity-escala.png` | Mesa 2,74 × 1,525 m, cara superior 0,76 m, red 0,1525 m y radio de bola 0,020 m en fuentes; escena real abierta por Unity batch y exportada | POV físico comparando cuerpo, mesa y agarre. Confort y lectura binocular desde A/B |
| Complejidad del mundo **25 %** | Cantera, estratos, cristales, banco, dispensador, robot, palas y marcador. Fuentes `world.ts`, `cancha.json`, mallas y materiales Unity | Capturas de escena web y Unity; geometría propia importada y editable; agrupación de estáticos. Captura del build de producción: 15.318 triángulos y 63 llamadas; no son presupuesto certificado de Quest | Revisar siluetas, lectura y composición dentro del visor. Confirmar autoría humana y permisos de referencias |
| Interactividad y UX **25 %** | Agarre/recuperación, dispensador/saque, peloteo, panel, recorrido y revancha. `web/src/main.ts` | Teclado/ratón: agarre, saque, devolución del jugador mediante entradas automatizadas, punto para ambos lados. `partida-cpu.json`; dos lados PvP en `pvp-browser.json` y pruebas administradas de Needle | Agarre cercano con controladores, mano izquierda/derecha física, pinza, haptics, pérdida de tracking, salida XR y prueba con persona nueva |
| Behance **20 %** | Estructura, narrativa y selección de proceso en `docs/BEHANCE.md`; créditos en `CREDITOS.md` | Material preparado a partir de archivos reales y decisiones documentadas | Nombres confirmados; faltan rol y aporte verificable de cada integrante. Publicación diferida por el usuario. Falta enlace Behance |
| Tres puntos de interacción | Pala, saque/dispensador, panel; además rally y estaciones | Flujo escritorio comprobado mediante entradas reales de navegador | Completar secuencias desde visor y registrar respuesta/recuperación |
| Texture baking | Normal/AO del tejido (`tools/bake.py`, 1024 px); lightmap real Progressive CPU de Unity; UV2; `NEEDLE_lightmaps` en GLB exportado | `unity-bake-result.json`, `unity-export-result.txt`, `uv2-atlas-unity.png`; el GLB contiene mapa Lightmap-0 y TEXCOORD_1; 59 renderers con lightmap cargado, atlas extraído en atlas-unity.png | Confirmar ausencia de costuras, caras negras y sombras duplicadas en ambos ojos de producción |
| Mínimo estable **72 FPS en Quest** | Registro CSV de tiempos de cuadro, panel de diagnóstico y protocolo en `PRUEBAS_VISOR.md` | No se dispone de medición física de Quest. Los FPS de escritorio no acreditan el requisito | Calentar 30 s y medir 60 s por escenario; registrar dispositivo, refresco, ventanas de FPS, mínimos, caídas y p95. Repetir tras optimizar si falla |
| Reglas arcade | A 7 y diferencia de 2; servicio cada dos y desde 6–6 cada uno; let, volea, fuera, doble bote, doble golpe y revancha | Pruebas automatizadas: 6–6 → 7–6 → 8–6; let; eventos repetidos; servicio. Partidos físicos simulados con CPU ganadora y perdedora en `partidos-simulacion.json` | Confirmar legibilidad del motivo del punto y sensación del gesto en visor |
| Física continua | Paso fijo 120 Hz, barrido de esfera contra pala móvil, mesa y red; velocidad lineal/angular; límites de tracking | Pruebas de barrido rápido, rebote de mesa/red y devolución física CPU/escritorio | Borde de mesa, golpes extremos, tracking irregular y coste de 120 Hz en Quest |
| Salas de dos / primer anfitrión | Primer ingreso confirmado por Needle; reserva de propiedad; coordinador anfitrión serializa segunda plaza. Alternativa Node local disponible | Prueba con dos contextos independientes, tercero rechazado y desconexión; secuencias duplicadas, separación de salas y snapshots en test del coordinador local. Diez puntos y saques de ambos lados en Needle público; carrera entre dos invitados, sala CPU cerrada y sala independiente en admision-needle.json | Repetir diez puntos con dos visores en otras redes y retardo variable |
| Coherencia compartida | Sesión, lados, fase, servicio, marcador, rally y revisión; poses 30 Hz, bola 25 Hz; ingreso persistente separado de estados efímeros | Diez de diez marcadores y servicios coinciden en HTTPS; devolución y saque del invitado con validación histórica. El registro administrado conserva el ping observado y los contactos compensados | Repetir desde producción en dos visores. No se declara resistencia a clientes modificados para hacer trampas |
| RV | Detección WebXR por modo, gesto de entrada, panel 3D, rig y controladores | Compilado; en escritorio sin visor la disponibilidad se muestra correctamente. No se emuló una partida inmersiva | Partida completa en Quest y POV auténtico |
| RM | Colocación local, giro y confirmación 1:1; hit test con alternativa manual; entorno opaco separado | Implementado, con grupos exportados de entorno y cancha | Passthrough, suelo, alineación visual/física y dos habitaciones remotas |
| Publicación Needle HTTPS | Build Vite de Needle y despliegue oficial de Needle Cloud | El estado definitivo, enlace y revisión se registran en `ENTREGA.md` | Abrir desde otra red y visor; conservar los cuatro enlaces de entrega |
| Repositorio GitHub | Código, escena, mallas, mapas, metadatos, lockfiles, instrucciones y CI | Publicado en `ItsSilva/rebote-de-cristal` con autorización explícita; referencias, cachés y credenciales excluidas | Revisar aportes de cada integrante; no se asigna autoría humana por el nombre de la cuenta |
| Video POV **1–2 minutos** | Guion realista de 90 s y lista de tomas en `PRUEBAS_VISOR.md` | Guion preparado; no se inventó un video de visor | Grabar, revisar duración/audio/texto y subir con acceso para la docente |

## Condiciones de prueba

Las pruebas de navegador se realizaron en Windows con Brave y Playwright, en contextos independientes. Usaron teclado/ratón y lectura del estado para conducir las entradas; no asignaron puntos ni trayectorias a la bola. Los fixtures automatizados de reglas sí crean estados controlados y se identifican como tales. Los partidos completos de simulación usan palas cinemáticas de prueba: acreditan reglas y física, no habilidad ni ergonomía humana.

El coordinador Node opcional comprueba identidad desde la conexión del servidor. El transporte administrado valida sesión, plaza, secuencia y pertenencia a sala y protege el estado persistente mediante propiedad de Needle; no es un sistema antitrampas para clientes modificados. La validación de contacto remoto rechaza eventos de más de 300 ms; el historial retenido es ligeramente mayor para resolver el intervalo. Registrar la conexión real al evaluar jugabilidad.

## Incidencias resueltas durante desarrollo

- El primer saque ensayado tocaba la red: se ajustó la velocidad del gesto de escritorio y la inclinación inicial.
- La cámara inicial estrecha ocultaba la composición: se amplió a 60° en escritorio.
- La lista de Needle no expresaba orden por su primer índice: se usó la membresía inicial confirmada y reserva de propiedad.
- El invitado perdía contactos por el retardo: se añadió ping, compensación de reloj y comprobación de contacto sobre historial.
- El horneado de alta calidad no era exportable: se rehízo con la codificación normal exigida por Needle.
- El primer material importado del suelo quedaba blanco por omitir su mapa: se corrigió la base oscura y se repitió el bake.

## Evidencia pendiente que no se da por aprobada

72 FPS estables, passthrough RM, agarre/hand tracking y confort físico; POV de visor; prueba de diez puntos con dos visores; aportes humanos y publicación Behance (diferida por el usuario). Seguir `PRUEBAS_VISOR.md` y adjuntar resultados, incluso si fallan.



