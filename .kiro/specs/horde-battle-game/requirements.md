# Requirements Document

## Introduction

Horde Battle Game es un juego de navegador de acción top-down multijugador asíncrono, ambientado en un cementerio y protagonizado por un guardia que debe defender su territorio de oleadas de muertos vivientes. Inspirado en títulos como Boxhead y Brotato, el jugador controla al guardia dentro de la arena del cementerio y debe sobrevivir oleadas sucesivas de no-muertos que aumentan en número y dificultad. El guardia comienza el juego solo con ataque cuerpo a cuerpo; el combate a distancia (proyectiles) es una capacidad que se desbloquea en rondas posteriores o como característica post-MVP. El juego opera en navegadores web de escritorio y móvil, cuenta con un backend en AWS para autenticación, rankings globales, lista de amigos y clasificaciones entre amigos.

---

## Glossary

- **Game**: El sistema de juego completo (cliente Phaser 3 + backend AWS).
- **Player**: El guardia de cementerio controlado por el usuario humano; personaje principal del juego.
- **Graveyard_Guard**: El personaje jugable — un guardia de cementerio que defiende su territorio de los no-muertos usando primero su bastón/pala (melee) y posteriormente armas a distancia.
- **Enemy**: Un no-muerto (zombie, esqueleto u otro muerto viviente) controlado por la IA que persigue al Player y le inflige daño cuerpo a cuerpo.
- **Undead**: Término genérico para todos los tipos de Enemy; hace referencia a la temática de muertos vivientes del juego.
- **Arena**: El cementerio acotado — el espacio de juego con lápidas, cercas y elementos temáticos que contienen al Player y a los Enemies.
- **Round**: Una oleada de Enemies no-muertos que deben ser eliminados para avanzar.
- **Wave_Manager**: El componente del Game encargado de generar y controlar los Rounds.
- **Combat_System**: El componente que calcula y aplica daño entre Player y Enemies; gestiona tanto el combate melee como (post-MVP) el ranged.
- **Melee_Attack**: El ataque cuerpo a cuerpo del Player usando su bastón/pala; único modo de ataque disponible en el MVP.
- **Melee_Range**: La distancia máxima en píxeles a la que el Melee_Attack del Player puede impactar a un Enemy.
- **Projectile**: Un objeto disparado por el Player (post-MVP o rondas avanzadas) que viaja en línea recta y causa daño al impactar un Enemy.
- **Health_Bar**: El indicador visual de puntos de vida restantes de un Enemy, visible solo cuando el Enemy ha recibido daño.
- **HUD**: La capa de interfaz superpuesta al juego que muestra información de estado al usuario (vida, ronda, puntuación, etc.).
- **Auth_Service**: El componente backend responsable de registro, inicio de sesión y gestión de sesiones de usuario, implementado sobre Amazon Cognito.
- **User_Profile**: El registro persistido en DynamoDB que almacena datos de cuenta, estadísticas y lista de amigos de un usuario.
- **Leaderboard_Service**: El componente backend que gestiona rankings globales y entre amigos, almacenado en DynamoDB.
- **Friends_Service**: El componente backend que gestiona solicitudes de amistad, lista de amigos y consultas de clasificación entre amigos.
- **API_Gateway**: El servicio AWS API Gateway que expone los endpoints REST del backend.
- **Lambda**: Las funciones AWS Lambda que implementan la lógica de negocio del backend.
- **CDN**: Amazon CloudFront que sirve los assets estáticos del frontend.
- **Pathfinding**: El algoritmo de navegación que los Enemies utilizan para alcanzar al Player dentro de la Arena.
- **Boss**: Un Enemy no-muerto especial de alta resistencia (ej. zombie gigante o señor no-muerto) que aparece al final de rondas específicas (característica post-MVP).
- **Asset**: Recurso gráfico o sonoro en formato pixel art utilizado por el Game; incluye sprites del cementerio, guardia, no-muertos y efectos de sonido temáticos.

---

## Requirements

### Requerimiento 1: Movimiento del Guardia

**Historia de usuario:** Como guardia de cementerio, quiero mover a mi personaje libremente por la arena usando teclado o controles táctiles, para reposicionarme estratégicamente y evitar a los no-muertos mientras me preparo para atacar cuerpo a cuerpo.

#### Criterios de aceptación

1. CUANDO el jugador presiona una entrada direccional cardinal (WASD o teclas de dirección para Norte, Sur, Este, Oeste; o el joystick en pantalla desplazado más del 10% de su radio máximo), EL Juego DEBERÁ mover al Graveyard_Guard en la dirección correspondiente a una velocidad constante de 200 píxeles por segundo.
2. CUANDO la posición del jugador más el siguiente paso de movimiento exceda el límite de la Arena, EL Juego DEBERÁ fijar la posición del jugador al límite antes de renderizar, impidiendo cualquier movimiento fuera de los bordes.
3. MIENTRAS el jugador esté en movimiento, EL Juego DEBERÁ animar el sprite del Graveyard_Guard usando la animación de caminata direccional correspondiente.
4. MIENTRAS el jugador esté estático, EL Juego DEBERÁ mostrar la animación idle del Graveyard_Guard.
5. EL Juego DEBERÁ aceptar entradas direccionales simultáneas para producir movimiento diagonal; el vector de velocidad resultante DEBERÁ normalizarse a 200 píxeles por segundo (no 283 px/s).
6. EN CASO DE que el Juego se ejecute en un dispositivo móvil, EL Juego DEBERÁ renderizar un joystick virtual en pantalla de al menos 80 píxeles de radio en la región inferior izquierda de la pantalla, posicionado a al menos 16 píxeles de los bordes izquierdo e inferior y ocupando no más del 20% del ancho de la pantalla.

---

### Requerimiento 2: Sistema de Ataque Cuerpo a Cuerpo del Guardia (MVP)

**Historia de usuario:** Como guardia de cementerio, quiero atacar a los no-muertos cercanos con mi arma cuerpo a cuerpo (bastón o pala), para defenderme de la horda en distancia corta.

#### Criterios de aceptación

1. CUANDO el jugador activa una entrada de ataque (clic del ratón en escritorio, toque en móvil, barra espaciadora o botón de ataque en pantalla), EL Sistema_de_Combate DEBERÁ ejecutar un Ataque_Cuerpo_a_Cuerpo centrado en la posición actual del Graveyard_Guard, afectando a todos los Enemigos dentro del Rango_Melee.
2. EL Sistema_de_Combate DEBERÁ definir el Rango_Melee del ataque del Graveyard_Guard como 64 píxeles desde el centro del jugador.
3. EL Sistema_de_Combate DEBERÁ definir el rango de ataque cuerpo a cuerpo de los Enemigos como 48 píxeles desde su centro, que DEBERÁ ser estrictamente menor que el Rango_Melee del jugador (64 píxeles).
4. EL Juego DEBERÁ reproducir la animación de golpe cuerpo a cuerpo del Graveyard_Guard cuando se ejecute un Ataque_Cuerpo_a_Cuerpo, completando la animación en no más de 400 milisegundos.
5. CUANDO se ejecute un Ataque_Cuerpo_a_Cuerpo y uno o más Enemigos estén dentro del Rango_Melee, EL Sistema_de_Combate DEBERÁ aplicar 30 puntos de daño a cada Enemigo dentro del rango simultáneamente.
6. CUANDO se ejecute un Ataque_Cuerpo_a_Cuerpo y no haya Enemigos dentro del Rango_Melee, EL Sistema_de_Combate DEBERÁ reproducir la animación de golpe sin aplicar daño alguno; no DEBERÁ desencadenarse ningún error ni efecto adicional.
7. EL Sistema_de_Combate DEBERÁ limitar la tasa de ataque del jugador a un Ataque_Cuerpo_a_Cuerpo cada 600 milisegundos; las entradas de ataque recibidas antes de que expire el tiempo de recarga DEBERÁN ignorarse silenciosamente.
8. EN CASO DE que el Juego se ejecute en un dispositivo móvil, EL Juego DEBERÁ renderizar un botón de ataque en pantalla de al menos 64 × 64 píxeles posicionado dentro de 16 píxeles de los bordes derecho e inferior de la pantalla.

---

### Requerimiento 3: Comportamiento de los No-Muertos (Pathfinding y Movimiento)

**Historia de usuario:** Como guardia de cementerio, quiero que los no-muertos me persigan activamente por el cementerio, para que el juego presente una amenaza constante y creciente que me obligue a seguir moviéndome y atacando.

#### Criterios de aceptación

1. MIENTRAS una Ronda esté activa, EL Sistema_de_Pathfinding DEBERÁ actualizar la dirección de cada Enemigo hacia la posición actual del jugador con una frecuencia mínima de 10 veces por segundo.
2. MIENTRAS una Ronda esté activa, EL Juego DEBERÁ mover cada Enemigo (zombie/esqueleto) hacia el jugador a una velocidad base de 80 píxeles por segundo.
3. CUANDO un Enemigo colisione con el límite de la Arena, EL Sistema_de_Pathfinding DEBERÁ recalcular una dirección válida que mantenga al Enemigo dentro de la Arena; SI no existe ninguna dirección válida hacia el jugador (por ejemplo, si el Enemigo está acorralado), ENTONCES EL Sistema_de_Pathfinding DEBERÁ permitir que el Enemigo permanezca estático hasta que el jugador se mueva a una posición donde exista un camino válido, momento en el cual el Enemigo DEBERÁ reanudar inmediatamente el movimiento hacia el jugador.
4. CUANDO los centros de múltiples Enemigos estén a menos de 32 píxeles entre sí, EL Sistema_de_Pathfinding DEBERÁ aplicar una fuerza de separación para alejarlos; SI la fuerza de separación empujaría a un Enemigo fuera del límite de la Arena, EL Juego DEBERÁ fijar la posición del Enemigo para que permanezca dentro de la Arena.
5. MIENTRAS un Enemigo esté a más de 48 píxeles del jugador, EL Sistema_de_Combate DEBERÁ impedir que el Enemigo inflija daño cuerpo a cuerpo al jugador.
6. MIENTRAS no haya ninguna Ronda activa, EL Sistema_de_Combate DEBERÁ impedir que todos los Enemigos inflijan daño cuerpo a cuerpo al jugador, independientemente de la distancia.

---

### Requerimiento 4: Sistema de Daño y Vida de los No-Muertos

**Historia de usuario:** Como guardia de cementerio, quiero ver las barras de vida de los no-muertos cuando los golpeo y verlos colapsar al llegar a cero de vida, para medir la efectividad de mi combate contra la horda.

#### Criterios de aceptación

1. EL Sistema_de_Combate DEBERÁ inicializar cada Enemigo No-Muerto estándar (zombie o esqueleto) con 100 puntos de vida al aparecer.
2. CUANDO un Enemigo reciba daño por primera vez, EL Juego DEBERÁ mostrar la Barra_de_Vida del Enemigo encima de su sprite.
3. MIENTRAS los puntos de vida de un Enemigo sean mayores que 0 y menores que el máximo, EL Juego DEBERÁ actualizar el ancho de la Barra_de_Vida de forma proporcional al ratio de puntos de vida actuales sobre los máximos.
4. CUANDO los puntos de vida de un Enemigo lleguen a 0 o menos, EL Juego DEBERÁ iniciar inmediatamente la animación de muerte/colapso del Enemigo y eliminarlo de la Arena a más tardar 300 milisegundos después de que comience la animación de muerte; la Barra_de_Vida DEBERÁ ocultarse cuando comience la animación de muerte.
5. CUANDO los puntos de vida de un Enemigo lleguen a 0 o menos, EL Juego DEBERÁ incrementar la puntuación del jugador en exactamente 10 puntos por ese Enemigo, independientemente del daño excedente (overkill).
6. CUANDO un Enemigo sea eliminado de la Arena, EL Juego DEBERÁ destruir la Barra_de_Vida asociada.

---

### Requerimiento 5: Daño al Guardia

**Historia de usuario:** Como guardia de cementerio, quiero perder salud cuando los no-muertos me arañen o muerdan, para que la supervivencia requiera gestionar activamente el posicionamiento y el tiempo de los ataques.

#### Criterios de aceptación

1. MIENTRAS un Enemigo esté a menos de 48 píxeles del jugador, EL Sistema_de_Combate DEBERÁ infligir 10 puntos de daño al Graveyard_Guard cada 1000 milisegundos por Enemigo (cada Enemigo aplica su propio tick de daño de forma independiente).
2. CUANDO comience una sesión de juego, EL Sistema_de_Combate DEBERÁ establecer los puntos de vida del Graveyard_Guard en 100; los puntos de vida del jugador NUNCA DEBERÁN caer por debajo de 0.
3. SI los puntos de vida del jugador llegan a 0 tras un cálculo de daño, ENTONCES EL Juego DEBERÁ activar la secuencia de fin de juego en un plazo de 500 milisegundos.
4. MIENTRAS una Ronda esté activa, EL HUD DEBERÁ mostrar los puntos de vida actuales del jugador como valor numérico y como barra de salud.
5. SI los puntos de vida del jugador llegan a 0, ENTONCES EL Juego DEBERÁ registrar el número de Ronda actual como la última Ronda alcanzada en esa sesión.

---

### Requerimiento 6: Sistema de Rondas — Hordas de No-Muertos (Wave Manager)

**Historia de usuario:** Como guardia de cementerio, quiero enfrentarme a oleadas crecientes de no-muertos que aumentan en número cada ronda, para que el juego sea progresivamente más desafiante a medida que avanza la noche.

#### Criterios de aceptación

1. CUANDO comience la sesión de juego, EL Gestor_de_Oleadas DEBERÁ iniciar en la Ronda 1 y generar 5 Enemigos.
2. CUANDO comience una Ronda, EL Gestor_de_Oleadas DEBERÁ generar todos los Enemigos de esa Ronda en posiciones aleatorias a lo largo de una franja de 32 píxeles de ancho en el interior del límite de la Arena, con cada punto de aparición a al menos 100 píxeles de la posición actual del jugador (medido de centro a centro).
3. CUANDO todos los Enemigos de una Ronda sean eliminados, EL Gestor_de_Oleadas DEBERÁ activar una pausa de 3 segundos entre rondas antes de comenzar la siguiente.
4. CUANDO finalice la pausa entre rondas, EL Gestor_de_Oleadas DEBERÁ incrementar el contador de Rondas en 1 y establecer el número de Enemigos en el recuento de la Ronda anterior más 3.
5. MIENTRAS una Ronda esté activa, EL HUD DEBERÁ mostrar el número de Ronda actual y el recuento de Enemigos restantes.
6. MIENTRAS la pausa entre rondas esté activa, EL Juego DEBERÁ mostrar una notificación "Ronda [N] en camino" donde [N] es el número de la próxima Ronda, durante los 3 segundos completos.
7. EL Gestor_de_Oleadas DEBERÁ soportar un mínimo de 50 Rondas consecutivas sin requerir reinicio del juego.

---

### Requerimiento 7: Interfaz HUD durante el Juego

**Historia de usuario:** Como jugador, quiero un HUD claro que muestre mi salud, puntuación e información de ronda, para tomar decisiones informadas durante el combate.

#### Criterios de aceptación

1. MIENTRAS una Ronda esté activa, EL HUD DEBERÁ mostrar simultáneamente los puntos de vida actuales del jugador, el número de Ronda actual, el número de Enemigos restantes y la puntuación actual del jugador.
2. EL HUD DEBERÁ mantenerse legible en anchos de ventana entre 360 y 1920 píxeles, con un tamaño de fuente mínimo de 12 píxeles y una relación de contraste de al menos 4,5:1 respecto al fondo (WCAG AA).
3. CUANDO los puntos de vida del jugador caigan por debajo del 30% de sus puntos de vida máximos, EL HUD DEBERÁ renderizar la barra de salud y el valor numérico de salud en rojo.
4. CUANDO los puntos de vida del jugador vuelvan al 30% o más, EL HUD DEBERÁ revertir la barra de salud y el valor numérico al color predeterminado.
5. CUANDO la puntuación del jugador aumente, EL HUD DEBERÁ actualizar la visualización de la puntuación en un fotograma renderizado.
6. EL HUD NO DEBERÁ ocluir más del 10% del área de juego de la Arena en ningún tamaño de ventana soportado.
7. CUANDO comience una Ronda, EL HUD DEBERÁ mostrar el número de Ronda correcto, el recuento de Enemigos y los puntos de vida del jugador antes de que ocurra la primera acción de un Enemigo.

---

### Requerimiento 8: Condición de Fin de Juego

**Historia de usuario:** Como jugador, quiero una pantalla de fin de juego clara al morir, con mis estadísticas finales y opciones para enviar mi puntuación o jugar de nuevo, para tener cierre y motivación para mejorar.

#### Criterios de aceptación

1. CUANDO se active la secuencia de fin de juego, EL Juego DEBERÁ pausar toda la jugabilidad y mostrar una pantalla superpuesta de fin de juego en un plazo de 500 milisegundos.
2. EL Juego DEBERÁ mostrar en la pantalla de fin de juego: la Ronda final alcanzada, el total de Enemigos eliminados y la puntuación total.
3. SI un Usuario está autenticado, ENTONCES EL Juego DEBERÁ mostrar un botón "Enviar Puntuación" en la pantalla de fin de juego.
4. CUANDO el Usuario active el botón "Enviar Puntuación", EL Servicio_de_Clasificación DEBERÁ persistir la puntuación, el número de Ronda y la marca de tiempo en el Perfil_de_Usuario en DynamoDB.
5. CUANDO el Usuario active el botón "Jugar de Nuevo", EL Juego DEBERÁ restablecer los puntos de vida del jugador a 100, establecer el contador de Rondas en 1, eliminar todos los Enemigos e iniciar la Ronda 1.
6. SI el envío al Servicio_de_Clasificación falla por un error de red, ENTONCES EL Juego DEBERÁ mostrar un mensaje de error y conservar el botón "Enviar Puntuación" para que el Usuario pueda reintentar.
7. SI el envío al Servicio_de_Clasificación falla por un error no relacionado con la red, ENTONCES EL Juego DEBERÁ ocultar el botón "Enviar Puntuación" y mostrar un mensaje de error genérico; el fallo DEBERÁ registrarse silenciosamente sin exponer detalles internos.
8. CUANDO el envío al Servicio_de_Clasificación sea exitoso, EL Juego DEBERÁ deshabilitar el botón "Enviar Puntuación" y mostrar un mensaje de confirmación para evitar envíos duplicados.

---

### Requerimiento 9: Registro e Inicio de Sesión de Usuarios

**Historia de usuario:** Como jugador, quiero crear una cuenta e iniciar sesión, para que mis puntuaciones se guarden y pueda competir en las clasificaciones.

#### Criterios de aceptación

1. EL Servicio_de_Autenticación DEBERÁ permitir que un Usuario se registre con un nombre de usuario único, una dirección de correo en formato local-parte@dominio.tld y una contraseña de entre 8 y 72 caracteres inclusive.
2. CUANDO un Usuario envíe credenciales de registro válidas, EL Servicio_de_Autenticación DEBERÁ crear un Perfil_de_Usuario en DynamoDB y devolver un token de sesión en un plazo de 3 segundos.
3. CUANDO un Usuario envíe credenciales de registro inválidas (nombre de usuario duplicado, formato de correo inválido o contraseña fuera del rango de 8–72 caracteres), EL Servicio_de_Autenticación DEBERÁ devolver un mensaje de error descriptivo identificando el campo específico que falló en la validación.
4. CUANDO un Usuario envíe su correo registrado y contraseña para autenticarse, EL Servicio_de_Autenticación DEBERÁ devolver un token de sesión en un plazo de 3 segundos.
5. CUANDO un Usuario proporcione credenciales de autenticación incorrectas, EL Servicio_de_Autenticación DEBERÁ devolver un mensaje de error sin especificar si el correo o la contraseña fue incorrecto.
6. EL Servicio_de_Autenticación DEBERÁ invalidar un token de sesión cuando hayan transcurrido 24 horas desde la última solicitud autenticada realizada usando dicho token.
7. EL Juego DEBERÁ permitir que Usuarios no autenticados jueguen sin cuenta, sin que sus puntuaciones se persistan en ninguna clasificación.
8. SI la escritura del Perfil_de_Usuario en DynamoDB falla tras un registro exitoso en Cognito, ENTONCES EL Servicio_de_Autenticación DEBERÁ devolver un token de sesión válido y reintentar la escritura en DynamoDB hasta 3 veces a intervalos de 5 minutos; SI todos los reintentos fallan, EL Servicio_de_Autenticación DEBERÁ marcar el perfil como fallido permanentemente y devolver HTTP 500 en solicitudes posteriores que requieran datos del perfil.
9. CUANDO un Usuario cierre sesión, EL Servicio_de_Autenticación DEBERÁ invalidar inmediatamente el token de sesión en el servidor, impidiendo su uso posterior.

---

### Requerimiento 10: Rankings Globales

**Historia de usuario:** Como jugador, quiero ver una clasificación global con las mejores puntuaciones, para comparar mi rendimiento con jugadores de todo el mundo.

#### Criterios de aceptación

1. EL Servicio_de_Clasificación DEBERÁ mantener un ranking global ordenado por la mayor Ronda alcanzada, usando la puntuación total como criterio de desempate.
2. CUANDO se solicite la clasificación global, EL Servicio_de_Clasificación DEBERÁ devolver las 100 mejores entradas del ranking global.
3. CUANDO un Usuario envíe una puntuación, EL Servicio_de_Clasificación DEBERÁ actualizar el ranking global en un plazo de 5 segundos; SI la actualización falla, EL Servicio_de_Clasificación DEBERÁ registrar el error y devolver HTTP 500 al solicitante.
4. CUANDO se muestre la clasificación global, EL Juego DEBERÁ mostrar por cada entrada: posición en el ranking, nombre de usuario, mayor Ronda alcanzada y puntuación total.
5. CUANDO un Usuario consulte la clasificación global, EL Juego DEBERÁ resaltar la entrada del propio Usuario tanto si aparece dentro del top 100 como si está fuera (mostrada al final de la lista si está fuera del top 100).
6. EL Servicio_de_Clasificación DEBERÁ rechazar los envíos de puntuación que no incluyan un token de sesión válido, devolviendo HTTP 401.

---

### Requerimiento 11: Lista de Amigos

**Historia de usuario:** Como jugador, quiero agregar amigos y ver sus puntuaciones en una clasificación dedicada, para competir directamente con personas que conozco.

#### Criterios de aceptación

1. CUANDO un Usuario autenticado envíe una solicitud de amistad usando un nombre de usuario válido, EL Servicio_de_Amigos DEBERÁ crear una relación de amistad pendiente en DynamoDB.
2. CUANDO el Usuario destinatario acepte la solicitud de amistad, EL Servicio_de_Amigos DEBERÁ marcar la relación como confirmada y hacer que ambos Usuarios aparezcan en las listas de amigos del otro.
3. CUANDO un Usuario rechace una solicitud de amistad, EL Servicio_de_Amigos DEBERÁ eliminar la relación pendiente de DynamoDB.
4. CUANDO un Usuario autenticado solicite su lista de amigos, EL Servicio_de_Amigos DEBERÁ devolver todos los amigos confirmados incluyendo el nombre de usuario y la mayor Ronda alcanzada de cada amigo.
5. CUANDO un Usuario autenticado solicite la clasificación de amigos, EL Servicio_de_Clasificación DEBERÁ devolver un ranking de los amigos confirmados del Usuario ordenado por mayor Ronda alcanzada, con la puntuación total como criterio de desempate.
6. CUANDO se muestre la clasificación de amigos, EL Juego DEBERÁ mostrar por cada entrada: posición en el ranking, nombre de usuario, mayor Ronda alcanzada y puntuación total.
7. SI un Usuario elimina un amigo, ENTONCES EL Servicio_de_Amigos DEBERÁ eliminar la relación confirmada e inmediatamente excluir a ese Usuario de las clasificaciones de amigos de ambas partes.

---

### Requerimiento 12: Soporte para Dispositivos Móviles

**Historia de usuario:** Como jugador móvil, quiero que el juego sea completamente jugable en mi teléfono o tableta, para disfrutarlo sin necesitar teclado ni ratón.

#### Criterios de aceptación

1. EL Juego DEBERÁ renderizarse en el tamaño nativo de ventana del dispositivo sin desplazamiento horizontal en pantallas con un ancho mínimo de 360 píxeles.
2. EL Juego DEBERÁ escalar la Arena y el HUD proporcionalmente para llenar la ventana disponible preservando la relación de aspecto del juego; las áreas no cubiertas por el contenido escalado DEBERÁN rellenarse con barras de letterbox o pillarbox.
3. EN CASO DE que el Juego se ejecute en un dispositivo táctil, EL Juego DEBERÁ aceptar eventos táctiles como entrada equivalente a teclado y ratón.
4. EL Juego DEBERÁ mostrar controles en pantalla (joystick virtual y botón de ataque) únicamente en dispositivos táctiles.
5. MIENTRAS se muestren los controles en pantalla, EL Juego DEBERÁ garantizar que respondan a la entrada táctil y produzcan la acción de juego correspondiente en un fotograma renderizado.
6. CUANDO la orientación del dispositivo cambie, EL Juego DEBERÁ pausar la jugabilidad, recalcular el diseño, redimensionar la Arena y el HUD en un plazo de 200 milisegundos y luego reanudar la jugabilidad.
7. Los objetivos táctiles del HUD (botones) DEBERÁN tener un tamaño mínimo de 44 × 44 píxeles; el joystick virtual y el botón de ataque DEBERÁN tener un objetivo táctil mínimo de 48 × 48 píxeles en todos los tamaños de ventana.
8. El área de pantalla combinada ocupada por el joystick virtual y el botón de ataque NO DEBERÁ ocluir más del 20% del área de juego de la Arena.

---

### Requerimiento 13: Infraestructura AWS y Despliegue

**Historia de usuario:** Como desarrollador, quiero que el juego esté desplegado en AWS con una arquitectura escalable, para que pueda manejar carga variable de jugadores de forma fiable y a bajo costo.

#### Criterios de aceptación

1. LA CDN DEBERÁ servir todos los assets estáticos del frontend (HTML, JavaScript, CSS y Assets) desde un bucket de S3 a través de CloudFront con un TTL de caché de al menos 86400 segundos para assets versionados.
2. EL API_Gateway DEBERÁ exponer todos los endpoints del backend únicamente sobre HTTPS, rechazando las solicitudes HTTP con una redirección 301.
3. LA Lambda DEBERÁ procesar cada solicitud de API en una latencia p99 de 2000 milisegundos bajo carga normal.
4. EL Servicio_de_Autenticación DEBERÁ usar Amazon Cognito User Pools como proveedor de identidad y devolver tokens JWT conformes al estándar OAuth 2.0.
5. EL Servicio_de_Clasificación y EL Servicio_de_Amigos DEBERÁN almacenar todos los datos persistentes en tablas de DynamoDB con modo de capacidad bajo demanda.
6. CUANDO una función Lambda encuentre una excepción no manejada, LA Lambda DEBERÁ registrar el stack trace completo en Amazon CloudWatch Logs.
7. EL API_Gateway DEBERÁ aplicar CORS, aceptando solicitudes únicamente desde el dominio de la distribución de CloudFront registrada.

---

### Requerimiento 14: Rendimiento y Compatibilidad del Cliente

**Historia de usuario:** Como jugador, quiero que el juego funcione fluidamente en navegadores modernos sin instalación, para poder empezar a jugar de inmediato.

#### Criterios de aceptación

1. EL Juego DEBERÁ mantener una tasa de fotogramas mínima de 60 fotogramas por segundo en navegadores de escritorio (Chrome 120+, Firefox 120+, Safari 17+) durante Rondas con hasta 30 Enemigos simultáneos.
2. EL Juego DEBERÁ mantener una tasa de fotogramas mínima de 30 fotogramas por segundo en navegadores móviles (Chrome para Android 120+, Safari para iOS 17+) durante Rondas con hasta 20 Enemigos simultáneos.
3. EL Juego DEBERÁ cargar y alcanzar un estado interactivo en un plazo de 5 segundos con una conexión de 10 Mbps.
4. EL Juego NO DEBERÁ requerir ningún plugin de navegador ni instalación nativa para ejecutarse.
5. SI un navegador no soporta WebGL, ENTONCES EL Juego DEBERÁ mostrar un mensaje indicando que se requiere un navegador compatible con WebGL y proporcionar un enlace para descargar un navegador compatible.

---

### Requerimiento 15: Gestión de Assets Pixel Art — Temática de Cementerio

**Historia de usuario:** Como desarrollador, quiero una estructura clara de gestión de assets con pixel art temático de cementerio, para que los recursos del cementerio (guardia, no-muertos, lápidas, vallas) puedan actualizarse o reemplazarse en iteraciones futuras sin romper el juego.

#### Criterios de aceptación

1. EL Juego DEBERÁ cargar todos los Assets desde un archivo de manifiesto centralizado que mapea claves lógicas de assets a rutas de archivos.
2. CUANDO un archivo de Asset no se encuentre o falle al cargar, EL Juego DEBERÁ registrar el error en la consola del navegador y sustituirlo por un sprite placeholder visible.
3. EL Juego DEBERÁ soportar el intercambio en caliente de Assets actualizando el manifiesto sin requerir cambios en el código de lógica del juego.
4. EL Juego DEBERÁ usar sprite sheets con un tamaño de fotograma uniforme por categoría de personaje u objeto, tal como se define en el manifiesto de assets.
5. EL manifiesto de assets DEBERÁ definir categorías de assets separadas para: animaciones del Graveyard_Guard (idle, caminar, atacar, recibir daño, muerte), animaciones de Enemigos No-Muertos (idle, caminar, atacar, muerte), tiles del entorno de la Arena (suelo del cementerio, lápidas, vallas, portones) y efectos de audio (golpe cuerpo a cuerpo, gemido de no-muerto, daño al guardia, inicio de ronda).

---

### Requerimiento 16: Seguridad y Validación del Backend

**Historia de usuario:** Como operador del sistema, quiero que el backend valide todas las entradas y proteja los datos de los jugadores, para que el juego sea resistente al abuso y el acceso no autorizado.

#### Criterios de aceptación

1. EL API_Gateway DEBERÁ rechazar cualquier solicitud que carezca de un token de sesión JWT válido en los endpoints protegidos, devolviendo HTTP 401.
2. LA Lambda DEBERÁ validar todos los parámetros de entrada contra un esquema definido antes de procesarlos, devolviendo HTTP 400 con un error descriptivo para entradas inválidas.
3. EL Servicio_de_Clasificación DEBERÁ rechazar los envíos de puntuación en los que el número de Ronda enviado supere un valor máximo plausible calculado por el servidor en función de la duración de la sesión.
4. EL Servicio_de_Autenticación DEBERÁ limitar los intentos de inicio de sesión a un máximo de 10 intentos por minuto por dirección IP, devolviendo HTTP 429 cuando se supere el límite.
5. EL Servicio_de_Autenticación DEBERÁ almacenar todas las contraseñas usando una función de hash criptográfica (bcrypt o Argon2) y NO DEBERÁ almacenar contraseñas en texto plano.

---

### Requerimiento 17: Variedad de No-Muertos — Post-MVP

**Historia de usuario:** Como guardia de cementerio, quiero enfrentarme a diferentes tipos de no-muertos con distintos patrones de movimiento y habilidades en rondas avanzadas, para que el juego siga siendo entretenido a medida que avanza la noche.

#### Criterios de aceptación

1. EN CASO DE que la función de enemigos variantes esté habilitada, EL Gestor_de_Oleadas DEBERÁ introducir un segundo tipo de No-Muerto (esqueleto rápido) con una velocidad de movimiento de 140 píxeles por segundo a partir de la Ronda 10.
2. EN CASO DE que la función de enemigos variantes esté habilitada, EL Gestor_de_Oleadas DEBERÁ introducir un tipo de No-Muerto a distancia (lanzador de huesos) que mantiene una distancia de 200 píxeles del jugador y dispara proyectiles de huesos hacia el jugador a intervalos de 2 segundos, a partir de la Ronda 15.
3. EN CASO DE que la función de enemigos variantes esté habilitada, EL Sistema_de_Combate DEBERÁ asignar a cada tipo de No-Muerto valores distintos de puntos de vida y daño según se define en el archivo de configuración de enemigos.

---

### Requerimiento 18: Jefes No-Muertos (Bosses) — Post-MVP

**Historia de usuario:** Como guardia de cementerio, quiero enfrentarme a un poderoso jefe no-muerto al final de ciertas rondas, para vivir un desafío culminante que ponga a prueba mis habilidades acumuladas como defensor del cementerio.

#### Criterios de aceptación

1. EN CASO DE que la función de jefes esté habilitada, EL Gestor_de_Oleadas DEBERÁ generar un Jefe No-Muerto (p. ej., Zombie Gigante o Señor No-Muerto) como el último Enemigo de cada décima Ronda (Rondas 10, 20, 30, etc.).
2. EN CASO DE que la función de jefes esté habilitada, EL Sistema_de_Combate DEBERÁ inicializar al Jefe No-Muerto con 1000 puntos de vida y un daño cuerpo a cuerpo de 25 puntos por golpe.
3. EN CASO DE que la función de jefes esté habilitada, EL Juego DEBERÁ mostrar una Barra_de_Vida de Jefe diferenciada en la parte superior de la pantalla, además de la Barra_de_Vida estándar encima del sprite del Jefe.
4. EN CASO DE que la función de jefes esté habilitada, CUANDO el Jefe No-Muerto sea eliminado, EL Juego DEBERÁ otorgar al Graveyard_Guard 500 puntos de bonificación.

---

### Requerimiento 19: Sistema de Ataque a Distancia — Post-MVP

**Historia de usuario:** Como guardia de cementerio, quiero desbloquear ataques a distancia (lanzar agua bendita, disparar una pistola de bengalas, etc.) en rondas avanzadas, para poder enfrentarme a grandes hordas de no-muertos desde una distancia más segura a medida que el juego avanza.

#### Criterios de aceptación

1. EN CASO DE que la función de ataque a distancia esté habilitada, EL Sistema_de_Combate DEBERÁ permitir que el Graveyard_Guard ejecute un Ataque_a_Distancia activando la entrada de ataque secundario (clic derecho en escritorio, botón de ataque a distancia dedicado en móvil).
2. EN CASO DE que la función de ataque a distancia esté habilitada, EL Sistema_de_Combate DEBERÁ generar un Proyectil en la posición del jugador apuntando hacia la posición del cursor en escritorio o el punto de toque en móvil en el momento de la entrada.
3. EN CASO DE que la función de ataque a distancia esté habilitada, EL Sistema_de_Combate DEBERÁ asignar a cada Proyectil una velocidad de desplazamiento de 400 píxeles por segundo y un rango máximo de 400 píxeles.
4. EN CASO DE que la función de ataque a distancia esté habilitada, EL rango del Proyectil (400 píxeles) DEBERÁ superar siempre el rango de ataque cuerpo a cuerpo del Enemigo (48 píxeles).
5. EN CASO DE que la función de ataque a distancia esté habilitada, CUANDO un Proyectil colisione con un Enemigo No-Muerto, EL Sistema_de_Combate DEBERÁ aplicar 25 puntos de daño al Enemigo y destruir el Proyectil.
6. EN CASO DE que la función de ataque a distancia esté habilitada, EL Sistema_de_Combate DEBERÁ limitar la tasa de Ataque_a_Distancia a un Proyectil cada 500 milisegundos; las entradas recibidas antes de que expire el tiempo de recarga DEBERÁN ignorarse silenciosamente.
