# Estado de la entrega

Fecha: 16 de noviembre de 2026. Ruta A: Needle Engine, Unity y Needle Cloud.

| Entregable solicitado | Estado y enlace |
|---|---|
| Experiencia publicada por HTTPS | [Jugar en Needle Cloud](https://rebote-de-cristal-160ydy19qg7w.needle.run/) |
| Fuentes completas | [GitHub público: ItsSilva/rebote-de-cristal](https://github.com/ItsSilva/rebote-de-cristal) |
| POV real de visor, 1–2 minutos | Pendiente de grabación física. Guion en `PRUEBAS_VISOR.md` |
| Behance | Preparado en `BEHANCE.md`; el usuario solicitó dejarlo en archivos por ahora. Sin publicación |

El build corresponde al código `9fbca9aa3d39`. El archivo público `include/build-info.json` identifica la revisión completa; los commits posteriores de documentación y evidencias pueden tener otro hash. La publicación conserva el transporte administrado de Needle; no depende del coordinador Node local.

## Comprobaciones realizadas

- TypeScript sin errores y nueve pruebas funcionales aprobadas: reglas, saque, deuce, let, contactos continuos, admisión, duplicados, salas separadas y abandono.
- Partidos completos por simulación con entradas cinemáticas de pala: CPU gana y pierde; revancha reinicia a 0–0. No se asignan puntos ni trayectorias para obtener el resultado. Es una prueba de lógica y física, no de ergonomía humana.
- Navegador: tomar pala, preparar saque, devolver efectivamente y puntuar contra CPU, mediante teclado y ratón. El registro identifica las entradas y los cambios de golpe.
- Unity real: escena a escala, UV2, Progressive CPU, un lightmap, exportador oficial y compresión de producción. El GLB contiene `Lightmap-0`; los 59 renderers estáticos lo cargan. Se conservan el atlas y las fuentes.
- La prueba de artefacto revisa errores de JavaScript y respuestas HTTP fallidas. El detalle de ejecución pública está en `evidencias/artefacto-web.json`.
- PvP: dos contextos independientes, primer ingreso anfitrión, ambos listos, tercero rechazado, mismo marcador y pausa al abandonar el invitado. Diez puntos consecutivos comprobados desde HTTPS, en dos partidas (7–1 y 2–0): todos los marcadores y servicios coincidieron. La prueba conserva los contactos compensados; el cierre del anfitrión se comunica al invitado.

Los registros de `evidencias/` contienen URL, método y resultado. Las capturas son de escritorio. `MATRIZ.md` relaciona cada requisito con su prueba y su límite.

## Lo que debe comprobar el equipo con el visor

Usar `PRUEBAS_VISOR.md` para registrar el modelo, navegador, fecha y revisión. Falta comprobar agarre cercano, orientación física de la pala, controladores de ambas manos, vibración, pinza experimental, tracking, lectura del marcador y confort. En RM faltan passthrough, suelo, colocación, giro y alineación entre dos habitaciones. Repetir CPU completa y diez puntos PvP con dos visores y redes distintas.

El requisito de **72 FPS estables en Quest no está certificado**. Los contadores y capturas de escritorio no lo acreditan. Grabar un POV auténtico de 1–2 minutos y completar las mediciones antes de presentar el proyecto como validado en visor.

## Límites y reproducción

El coordinador del anfitrión valida plaza, sesión, secuencias de poses y ventanas de contacto. El transporte administrado no convierte los mensajes personalizados en un sistema resistente a clientes modificados; no se ofrece esa garantía. La predicción visual tiene una ventana limitada, por lo que redes con retardo mayor requieren otra evaluación.

Se actualizaron ws y Vite. `dependency-audit.json` registra dos avisos moderados en producción asociados a uuid y al runtime que lo incorpora; npm no ofrece una corrección compatible dentro de la versión fijada del SDK. También hay avisos en herramientas de desarrollo. No se aplicó una actualización mayor forzada del motor.

Las fuentes y comandos reproducibles están en el README. El workflow de comprobación instala desde cero, valida tipos, ejecuta pruebas y compila sin optimización autenticada. El workflow manual de despliegue usa la acción oficial de Needle y necesita `NEEDLE_CLOUD_TOKEN` para optimizar y publicar. El build de producción optimizado realizado aquí ya está publicado; no se ha creado un secreto de CI ni activado publicación automática.

Equipo confirmado: Juan Silva (juansilva112), Majo Rodríguez Martínez (abejitallorona) e Isa Cabrera Sogamoso (isabellcabrera3). Sus aportes individuales siguen pendientes de declaración. Se declara la asistencia de Codex en código, geometría procedural, pruebas y documentación.

