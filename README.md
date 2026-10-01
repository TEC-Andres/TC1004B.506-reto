<div align="center">
    <img src="assets/svg/toolnest-contour.svg" width="60%" align="top">
</div>

# Acerca de ToolNest
ToolNest es un sistema inteligente de almacenamiento y gestión de herramientas diseñado para monitorear en tiempo real el inventario interno, garantizar la seguridad del equipo y optimizar el trabajo en entornos exigentes o de poca visibilidad. Su objetivo principal es transformar una caja de herramientas convencional en un sistema conectado capaz de identificar, administrar y proteger cualquier material almacenado, permitiendo a los equipos de trabajo tener un control preciso sobre sus recursos sin depender de procesos manuales o registros externos. Mediante la integración de tecnologías de identificación, comunicación y seguridad, ToolNest busca reducir pérdidas de material, mejorar la organización y aumentar la eficiencia operativa en espacios donde el acceso rápido y confiable a las herramientas es fundamental.

### Sistema de Inventario

#### Identificación automática de herramientas
Utilizando tecnología RFID y por medio de un YRM100X, el almacenamiento es capaz de leer en tiempo real la información correspondiente a las herramientas y materiales que se encuentran dentro de la caja. Cada objeto identificado cuenta con una etiqueta única que permite reconocerlo automáticamente sin necesidad de una inspección manual. El sistema de identificación tarda menos de un segundo en actuar, permitiendo detectar inmediatamente cuando una herramienta es retirada, colocada nuevamente o comienza a ser utilizada dentro del área de trabajo.

#### Monitoreo en tiempo real
En el momento en que una herramienta sale del almacenamiento, ToolNest genera una alerta automática indicando que un objeto fue tomado y actualiza el inventario interno de manera instantánea. Esto permite conocer en todo momento qué herramientas están disponibles, cuáles están siendo utilizadas y cuáles requieren ser devueltas, evitando pérdidas de material y reduciendo tiempos de búsqueda durante las operaciones.

#### Control de acceso personalizado
Cualquier persona autorizada para abrir la caja de herramientas podrá hacerlo simplemente escaneando su credencial dentro del sistema. Cada acceso queda asociado con un usuario específico, permitiendo identificar quién ingresó al almacenamiento y relacionar las herramientas utilizadas con la persona responsable. Esto proporciona mayor trazabilidad y control dentro de equipos donde múltiples usuarios comparten el mismo conjunto de materiales.

### Actualizaciones

#### Historial de movimientos
El almacén le muestra a tu equipo quién tiene qué material en cada momento. Además del estado actual del inventario, ToolNest genera un historial detallado donde se registran los movimientos realizados dentro de la caja, incluyendo la herramienta involucrada, la fecha, la hora y la persona responsable de cada modificación. Esto permite consultar fácilmente el uso del material y detectar cualquier cambio realizado previamente.

#### Comunicación entre equipos
Cada actualización realizada dentro del sistema es reflejada casi instantáneamente para todos los usuarios autorizados. Esto permite mantener una comunicación eficaz entre múltiples equipos de trabajo, incluso cuando se encuentran en diferentes áreas o realizando distintas actividades al mismo tiempo. De esta manera, se elimina la necesidad de realizar documentación manual constante acerca de la entrega, devolución o transferencia de materiales.

#### Seguimiento de responsables
Cada modificación dentro de la colecta de material queda asociada a un responsable específico, permitiendo conocer quién fue la última persona en interactuar con una herramienta determinada. Esto facilita la administración de recursos compartidos y ayuda a mantener una mayor responsabilidad sobre el uso adecuado del equipo.

### Universal

#### Compatibilidad con distintos objetos
Siempre y cuando sea posible colocarle una etiqueta de identificación, cualquier objeto puede ser almacenado y monitoreado desde nuestra aplicación. ToolNest no está limitado únicamente a herramientas tradicionales, sino que puede adaptarse a diferentes tipos de materiales utilizados dentro de un entorno de trabajo, permitiendo gestionar componentes, accesorios, dispositivos o cualquier otro recurso necesario.

#### Registro simplificado de nuevos materiales
Para agregar un nuevo objeto al sistema, únicamente es necesario acercarlo al lector una vez que tenga colocada su etiqueta correspondiente. Cuando el dispositivo detecte el nuevo material, la aplicación mostrará automáticamente una ventana emergente solicitando información básica como el nombre del objeto. En menos de un minuto, cualquier usuario autorizado puede registrar nuevos elementos y comenzar a monitorearlos sin configuraciones complejas.

#### Escalabilidad del sistema
La cantidad de objetos administrados puede crecer conforme aumenten las necesidades del equipo de trabajo. ToolNest permite agregar nuevos materiales de manera sencilla, manteniendo toda la información organizada dentro de la misma plataforma y evitando la creación de registros separados o sistemas externos de control.

### Seguridad

#### Protección digital de información
Todos nuestros datos son encriptados utilizando una versión de la criptografía de curva elíptica (ECC). Dicha tecnología permite transmitir información entre dispositivos de manera segura sin comprometer el espacio de almacenamiento ni la velocidad de comunicación. Gracias a esto, los datos relacionados con usuarios, inventarios e historiales permanecen protegidos ante accesos no autorizados.

#### Autenticación física
Además del sistema de protección digital, ToolNest cuenta con mecanismos físicos para evitar accesos no autorizados al almacenamiento. En caso de que una persona intente forzar la apertura de la caja sin contar con una autenticación válida, el sistema detectará la actividad irregular y responderá inmediatamente.

#### Alertas de seguridad
Cuando se detecta un intento de acceso no autorizado, la aplicación enviará una notificación indicando que una persona desconocida intentó ingresar al almacenamiento. Al mismo tiempo, una alarma física se activará y los LEDs internos comenzarán a parpadear para generar una alerta visual y sonora dentro del área de trabajo. Esto permite reaccionar rápidamente ante posibles intentos de robo o manipulación indebida del equipo.

## Equipo de desarrollo
| Nombre | Matrícula | GitHub | Rol |
| --- | --- | --- | --- |
| Elena María Barrios Jordan | A01771338 | [@ElenaaJordan](https://github.com/ElenaaJordan) | Product Owner, Frontend, Backend & Docs |  
| Jared Aldana Palacios | A00844802 | [@JaredAlPa](https://github.com/JaredAlPa) | Estructura, Hardware, Firmware & Docs |  
| Diego Javier Martínez Sánchez | A00845422 | [@DiegoMartinez10](https://github.com/DiegoMartinez10) | Hardware, Firmware & Docs | 
| Andrés Rodríguez Cantú | A01287002 | [@TEC-Andres](https://github.com/TEC-Andres) | Scrum Master, Estructura, Frontend, Backend & Docs | 

## Run 
Run ./setup.sh on bash, then ./run.sh

<div align="center">