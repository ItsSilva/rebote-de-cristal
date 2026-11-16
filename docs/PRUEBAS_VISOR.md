# Comprobación física y evidencia de entrega

Responsable: integrante con Quest. Completar fecha, modelo, navegador, versión del navegador, frecuencia y revisión que figure en `ENTREGA.md`. Abrir la **URL de Needle Cloud** en una sesión nueva. Conservar un espacio físico despejado y usar el sistema de límites del visor.

## Primera partida y confort

1. Confirmar que RV está disponible y entrar desde el botón. Mirar libremente: ningún golpe o punto debe mover la cámara.
2. Recorrer entrada, banco y puesto desde el panel espacial. Comparar mesa de 0,76 m con el cuerpo y pala de aproximadamente 0,25 m con la mano.
3. Tomar con derecha, luego izquierda; comprobar orientación del mango, cara de golpe, soltar y recuperar fuera de alcance. Probar agarre cercano y recuperación desde el panel.
4. Preparar repetidamente el saque: solo una bola. Sacar, conseguir ambos botes y devolver después del bote propio. Hacer un gesto suave, uno fuerte y uno oblicuo. Registrar si la respuesta se distingue y si hay vibración en el controlador compatible.
5. Conseguir un punto, leer el motivo, terminar una partida y pedir revancha a 0–0.
6. Probar puesto sentado y ajuste de distancia. Pausar antes de recentrar. Perder tracking de forma controlada y salir/volver a XR: la partida debe pausar y repetir saque al continuar.

El seguimiento de manos por pinza es experimental. Registrar aparte de los controladores; no declararlo compatible con un dispositivo sin completar una partida.

## PvP real

1. A crea una sala automática y comparte código/enlace. B entra desde otro equipo o visor. Ver 2/2 y lados opuestos.
2. Si A está en rally, B espera. Ambos confirman «Listo PvP» entre puntos; marcador 0–0 y bot retirado.
3. Registrar diez puntos: resultado y motivo en A y B. Incluir saque y devolución desde B; no basta con que B vea la bola.
4. Entrar simultáneamente a la última plaza desde dos clientes: una sola admisión. Un tercero no obtiene pala ni avatar en la partida.
5. Probar otra sala al mismo tiempo; marcadores separados. Recargar B, salir B durante un rally y cerrar A: no debe continuar una bola con autoridad huérfana.
6. Repetir en dos redes si es posible. Anotar ping mostrado en el diagnóstico y fallos de contacto. La compensación de contacto está limitada a 300 ms; una conexión peor no se considera validada.

## Realidad mixta

1. Entrar en RM solo si la opción se detecta. Debe verse la habitación sin la envolvente de cantera.
2. Previsualizar, colocar, girar y confirmar. La mesa no cambia de escala. Probar superficie detectada y alternativa manual.
3. Comparar tablero/collider y altura del suelo; probar pelota contra una habitación clara. Leer marcador y panel con ambos ojos.
4. Con dos visores remotos, cada uno coloca su mesa. Verificar que ambos golpean en el mismo espacio lógico, aunque sus habitaciones sean diferentes.

## Protocolo de 72 FPS

Calentar 30 s. Registrar **al menos 60 s por escenario**: entorno completo, rally CPU, rally PvP del host y RM si está disponible. Registrar también un tramo desde B. Mantener el grabador apagado para la medición base y medir aparte el coste de grabar POV.

Usar «Registrar cuadros» para descargar CSV; complementar con la herramienta de diagnóstico del dispositivo cuando sea posible. Registrar frecuencia del panel y FPS renderizados por separado. A 72 Hz, el presupuesto es 13,89 ms. Calcular ventanas de un segundo, mínimos, tramos sostenidos de caída y p95 de tiempo de cuadro. Un promedio alto o la frecuencia configurada del panel no bastan.

Guardar:

| Campo | Valor a completar |
|---|---|
| Modelo / navegador / versión | Pendiente |
| URL / revisión / fecha | Pendiente |
| Modo / refresco / herramienta | Pendiente |
| Escenario / duración / grabador activo | Pendiente |
| FPS por ventana / mínimos / p95 ms | Pendiente |
| Caídas sostenidas y mejora aplicada | Pendiente |
| Resultado y archivos de evidencia | Pendiente |

## POV de 90 segundos

| Tiempo | Acción real desde visor |
|---|---|
| 0–12 s | Entrada, vista general y recorrido al banco |
| 12–27 s | Tomar pala y activar dispensador |
| 27–47 s | Saque, devolución CPU y punto |
| 47–70 s | Sala 2/2 y devolución con otro humano |
| 70–85 s | Resultado y revancha |
| 85–90 s | Vista general del club |

El archivo final debe durar entre 1 y 2 minutos y mostrar POV de RV. No sustituirlo por captura de escritorio. Añadir una toma RM solo si se conserva el recorrido principal RV y la duración exigida.
