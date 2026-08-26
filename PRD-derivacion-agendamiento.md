# PRD — Derivación geolocalizada y agendamiento de atención

**Estado:** Borrador
**Fecha:** 26 de agosto de 2026
**Autor:** Felipe Carrasco Grillo
**Versión:** 0.1
**Horizonte:** 2, producto piloto

## Visión de producto

MediTriage hoy clasifica la urgencia del paciente y le dice qué tipo de atención necesita. No le dice dónde ni le consigue hora. Esta línea de trabajo cierra ese tramo, convirtiendo la clasificación en una derivación concreta: el paciente urgente recibe el centro de urgencia más cercano con su dirección, y el paciente no urgente recibe una hora reservada en un centro médico aliado cercano, tomada de las agendas que esos centros publican mediante el estándar HL7 FHIR.

### Relación con el análisis DAU, y por qué no son lo mismo

El módulo de análisis de Datos de Atención de Urgencia (DAU) y esta línea de trabajo se confunden con facilidad porque ambos hablan de triage. Cumplen funciones distintas y no comparten código.

- **El análisis DAU es el instrumento de validación.** Corre sobre registros históricos y compara la clasificación automatizada contra la categoría que asignó la enfermera de triage. Responde una sola pregunta: ¿clasifica la máquina igual o parecido que la enfermera? Su resultado es el índice Kappa de la tesis. No atiende pacientes.
- **Esta línea de trabajo es el servicio.** Corre sobre pacientes reales en tiempo real y termina en una acción: ir a tal urgencia, o tener hora tal día en tal centro.

La dependencia va en una sola dirección. El DAU produce la evidencia que autoriza a ofrecer la derivación sin supervisión presencial. Sin esa evidencia, dirigir a un paciente a un centro u otro es una decisión clínica sin respaldo. Por eso el análisis DAU es requisito previo de la puesta en marcha, no un componente de esta solución.

### Observación sobre el encargo

El encargo describió esto como una solución paralela al análisis DAU. La descripción es la de una solución, no la de un problema. El problema que hay detrás es otro y conviene dejarlo escrito, porque es lo que se mide al final: hoy el paciente termina la conversación con una instrucción que debe resolver solo. Se le dice que acuda a su CESFAM al día siguiente, sin decirle a cuál, sin saber si hay hora, y sin ningún registro de si efectivamente fue. La derivación con agenda es una forma de resolverlo, y es la que este documento desarrolla, pero el criterio de éxito no es que exista el agendamiento sino que el paciente llegue a la atención que corresponde a su nivel de urgencia.

Cabe registrar además que este tramo no es una idea nueva del proyecto. El documento de contexto de la tesis ya define la salida esperada del sistema como recomendación de acción más vinculación con agenda, y nombra los recursos FHIR `Appointment` y `Slot` entre los que se deben usar. Esta línea de trabajo salda esa brecha pendiente.

### Mapa de incrementos

| Incremento | Nombre | Estado | Descripción breve |
|---|---|---|---|
| D1 | Derivación geolocalizada y agendamiento con agendas simuladas | En este PRD | Directorio de centros, cálculo de proximidad, derivación urgente con dirección y reserva de hora contra un servidor FHIR de prueba |
| D2 | Integración con agendas reales de centros aliados | Postergado | Reemplazo del servidor simulado por endpoints FHIR de cada centro, con autenticación y contrato de datos por convenio |
| D3 | Administración de centros aliados y cobertura territorial | Postergado | Alta y baja de centros desde el panel de administración, definición de comunas cubiertas y horarios |
| D4 | Confirmación y recordatorio de citas | Postergado | Aviso al paciente por canal a definir, confirmación de asistencia y liberación de cupos no confirmados |
| D5 | Panel de resultados de derivación | Postergado | Métricas de cuántos pacientes fueron derivados, cuántos reservaron y cuántos asistieron |

Este documento desarrolla en detalle solo el incremento D1. Los incrementos siguientes se documentan en sus propios PRD cuando les llegue el turno.

### Dimensiones de producto, decisiones al cierre de este PRD

El horizonte es producto piloto, sin intención de venta a terceros en esta etapa, por lo que las dimensiones comerciales quedan fuera. Se documentan las que sí aplican.

- **Onboarding de centros aliados.** En D1 es manual. El equipo carga el directorio de centros por migración. La administración desde la interfaz queda en D3.
- **Multi-tenancy.** Se reutiliza el aislamiento por `organization_id` ya implementado en la migración `012`. Los centros aliados son un catálogo compartido entre organizaciones, no un recurso por tenant, porque un centro de urgencia atiende a cualquier paciente sin importar qué CESFAM lo derivó.
- **Cobro.** No aplica en este horizonte.
- **Interfaz de programación pública.** No aplica en D1. La integración FHIR de D2 es de consumo, no de publicación.
- **Soporte y operación.** Se mantiene el canal actual, correo directo al autor.
- **Legal.** Esta línea de trabajo introduce por primera vez datos personales identificables en el sistema, y por lo tanto un cambio de régimen respecto de la Ley 19.628. Se desarrolla en la sección 3.

---

# Incremento D1: Derivación geolocalizada y agendamiento con agendas simuladas

## 1. Resumen ejecutivo

MediTriage pasa de recomendar un tipo de atención a entregar una atención concreta. Al terminar la conversación, el paciente clasificado como urgente recibe el nombre y la dirección del centro de urgencia más cercano a su ubicación. El paciente clasificado como no urgente recibe las horas disponibles en los centros médicos aliados cercanos, tomadas de un servidor HL7 FHIR, y puede reservar una entregando sus datos de contacto bajo un consentimiento propio y separado del clínico. La reserva se hace contra un servidor FHIR de prueba con agendas ficticias, de modo que el flujo completo queda validado antes de firmar convenio con ningún centro real.

## 2. Contexto y problema

El sistema clasifica hoy la urgencia en cinco niveles y deriva a una de tres vías de atención, según el módulo `src/lib/triage/disposition.ts`: urgencia hospitalaria para los niveles ESI 1 y 2, atención primaria el mismo día para el nivel 3, y atención primaria al día siguiente para los niveles 4 y 5. Esa derivación llega al paciente como un texto fijo. El de nivel 4 lee que agende una atención en su CESFAM para el día siguiente.

Ahí termina el sistema y empieza el problema. El paciente no sabe cuál es su CESFAM si no está inscrito, no sabe si hay horas, y no tiene forma de tomar una. Para conseguirla debe llamar por teléfono en horario hábil o presentarse de madrugada a la fila de horas, que son exactamente las dos barreras que lo llevaron a considerar la urgencia hospitalaria en primer lugar. El resultado previsible es que una parte de los pacientes derivados a atención primaria termine igual en la urgencia del hospital, que es el problema que el proyecto declara querer resolver.

En el lado urgente el vacío es más serio. Al paciente de nivel ESI 1 o 2 se le indica acudir de inmediato a la urgencia hospitalaria más cercana, sin decirle cuál es. Un paciente con dolor torácico está resolviendo esa pregunta en el peor momento posible para resolverla.

Tampoco hay registro de lo que pasa después. El sistema guarda la clasificación pero no si el paciente llegó a atenderse, de modo que no existe manera de saber si la derivación funciona. Sin ese dato, la afirmación de que el sistema descongestiona urgencias no se puede sostener con evidencia.

**Supuesto declarado.** No se cuenta con cifras propias de cuántos pacientes derivados a atención primaria terminan consultando en urgencia hospitalaria. La magnitud del problema se está estimando a partir de la literatura sobre consultas de baja complejidad en servicios de urgencia y no de datos del piloto. Medir esa cifra es uno de los objetivos de este incremento.

### La tensión central que este incremento debe resolver

El sistema es anónimo por diseño. El registro clínico se identifica con un código de seguimiento del tipo ABC-123 y no guarda nombre ni RUT. Ese anonimato es la base del argumento legal y ético del proyecto.

Reservar una hora médica rompe ese anonimato. Un centro de salud no puede recibir una cita sin saber a quién corresponde, y el recurso FHIR `Appointment` requiere una referencia al paciente. En el momento en que el paciente reserva, deja de ser anónimo.

Esto no es un detalle de implementación, es la decisión de diseño más importante del incremento, y una implementación descuidada la resolvería mal por omisión, guardando el nombre junto al relato clínico y convirtiendo toda la base de datos en datos sensibles identificables. La solución que este PRD adopta es la separación estricta: el relato clínico permanece anónimo en su tabla actual, los datos de contacto viven en una tabla distinta con sus propias reglas de acceso, y el único vínculo entre ambas es el código de seguimiento derivado del RUT mediante el hash determinista que el proyecto ya implementa en `hashRut`. El paciente que no quiere entregar sus datos conserva el flujo completo hasta la recomendación y solo pierde la reserva de hora.

## 3. Objetivo

Al cierre de este incremento, un paciente que completa la conversación recibe una derivación accionable en vez de una instrucción genérica. Si es urgente, ve el centro de urgencia más cercano con su dirección. Si no lo es, ve las horas disponibles en centros cercanos y puede reservar una, quedando registrado si lo hizo o no.

## 4. Usuarios y contexto de uso

- **Paciente anónimo.** Consulta desde su celular, mayoritariamente fuera de horario hábil, con conexión móvil variable y sin conocimiento técnico. Es el mismo usuario del flujo actual. En este incremento se le pide, por primera vez y solo si decide reservar, un dato personal.
- **Paciente que reserva.** Subconjunto del anterior. Entrega nombre, RUT y teléfono. Necesita saber con claridad a qué centro van sus datos y para qué.
- **Enfermero validador.** Ve, además de la clasificación, si el paciente reservó y dónde. Le sirve para el seguimiento de los casos de su centro. Uso diario desde computador del CESFAM.
- **Administrador de plataforma.** Carga y mantiene el directorio de centros. En este incremento lo hace por migración de base de datos, no por interfaz. Uso puntual.
- **Investigador.** Consulta la tasa de reserva por nivel de urgencia para el informe del piloto. Uso mensual, solo lectura.

El centro médico aliado no es usuario del sistema en este incremento. Recibe las citas en su propio sistema de agenda a través de FHIR y no entra a MediTriage.

## 5. Requisitos funcionales

### 5.1 Directorio de centros

RF-01. El sistema debe modelar la entidad `care_center` con los campos `id`, `name`, `center_type`, `address`, `comuna`, `latitude`, `longitude`, `is_active` y `created_at`.
RF-02. El sistema debe admitir en `center_type` los valores `emergency_hospital` para urgencia hospitalaria, `cesfam` para atención primaria y `partner_clinic` para centro médico aliado.
RF-03. El sistema debe almacenar en `care_center` el identificador del endpoint FHIR del centro cuando el centro publica agenda, y admitir su ausencia cuando no la publica. Depende de RF-01.
RF-04. El sistema debe excluir del directorio operativo todo centro con `is_active` en falso, sin eliminarlo.
RF-05. El sistema debe cargar el directorio inicial de centros mediante migración de base de datos versionada.

### 5.2 Determinación de proximidad

RF-06. El sistema debe solicitar al paciente la autorización de geolocalización del navegador antes de mostrar centros, explicando para qué se usa.
RF-07. El sistema debe calcular la distancia entre el paciente y cada centro activo cuando el paciente autoriza la geolocalización.
RF-08. El sistema debe solicitar al paciente que seleccione su comuna cuando la geolocalización no está disponible, es denegada, o falla. Depende de RF-06.
RF-09. El sistema debe ordenar los centros por comuna declarada cuando opera sin coordenadas, priorizando los de la misma comuna del paciente.
RF-10. El sistema debe continuar el flujo entregando la recomendación genérica actual cuando el paciente no autoriza la geolocalización ni declara comuna, sin bloquear la conversación en ningún caso.
RF-11. El sistema no debe persistir las coordenadas exactas del paciente en ninguna tabla. Solo puede persistir la comuna.

### 5.3 Derivación urgente

RF-12. El sistema debe mostrar al paciente con disposición `emergency` el centro de tipo `emergency_hospital` más cercano, con su nombre y dirección.
RF-13. El sistema debe mostrar junto al centro de urgencia la instrucción de llamar al 131 ante riesgo vital, manteniendo el texto actual del módulo de derivación.
RF-14. El sistema no debe ofrecer agendamiento a ningún paciente con disposición `emergency`, bajo ninguna condición.
RF-15. El sistema debe mostrar al paciente con disposición `same_day_primary_care` el centro de atención primaria más cercano con indicación de acudir el mismo día, y no debe ofrecer agendamiento para el día siguiente.
RF-16. El sistema debería mostrar un enlace de navegación hacia la dirección del centro que abra la aplicación de mapas del dispositivo. (deseable)

### 5.4 Agendamiento no urgente

RF-17. El sistema debe consultar los cupos disponibles mediante el recurso FHIR `Slot` para los centros cercanos cuando la disposición del paciente es `next_day_primary_care`.
RF-18. El sistema debe mostrar como máximo cinco cupos disponibles, ordenados por proximidad del centro y luego por fecha del cupo.
RF-19. El sistema debe indicar por cada cupo el nombre del centro, su dirección, la fecha y la hora.
RF-20. El sistema debe entregar la recomendación genérica de acudir al CESFAM cuando no existen cupos disponibles en ningún centro cercano, explicando que no hay horas y sin presentar el resultado como un error del paciente.
RF-21. El sistema debe permitir al paciente elegir un cupo y reservarlo. Depende de RF-17.
RF-22. El sistema debe crear un recurso FHIR `Appointment` en el servidor del centro al confirmar la reserva. Depende de RF-21.
RF-23. El sistema debe mostrar al paciente la confirmación de la reserva con centro, dirección, fecha, hora y su código de seguimiento.
RF-24. El sistema debe informar al paciente que el cupo ya no está disponible y volver a mostrar los cupos vigentes cuando la reserva falla porque otro paciente tomó el mismo cupo.
RF-25. El sistema debe permitir al paciente terminar sin reservar y conservar la recomendación en pantalla.

### 5.5 Consentimiento e identificación para reservar

RF-26. El sistema debe solicitar un consentimiento específico para la reserva, distinto del consentimiento clínico inicial, antes de pedir cualquier dato personal.
RF-27. El sistema debe indicar en ese consentimiento el nombre del centro que recibirá los datos y qué datos recibirá.
RF-28. El sistema debe solicitar nombre, RUT y teléfono de contacto únicamente después de que el paciente acepta el consentimiento de reserva. Depende de RF-26.
RF-29. El sistema debe validar el formato y el dígito verificador del RUT antes de enviar la reserva.
RF-30. El sistema debe almacenar los datos de contacto en una tabla `appointment_bookings` separada de `clinical_records`.
RF-31. El sistema no debe almacenar el RUT en claro en ninguna tabla, sino su código derivado mediante `hashRut`, reutilizando la función existente.
RF-32. El sistema debe vincular la reserva con el caso clínico únicamente mediante el código de seguimiento anónimo.
RF-33. El sistema no debe enviar el relato clínico del paciente al centro. Solo puede enviar el nivel de urgencia y el motivo de consulta resumido.

### 5.6 Trazabilidad y vista del enfermero

RF-34. El sistema debe registrar por cada caso si al paciente se le ofreció agendamiento, si reservó, y en qué centro.
RF-35. El sistema debe mostrar en el panel de enfermería, por cada caso, si el paciente reservó hora y en qué centro.
RF-36. El sistema debe registrar el motivo por el cual no se ofreció agendamiento cuando corresponde, distinguiendo al menos entre nivel de urgencia que lo excluye, ausencia de ubicación y ausencia de cupos.

## 6. Requisitos no funcionales

RNF-01. **Rendimiento.** La consulta de cupos disponibles debe responder en menos de 3 segundos, o mostrar la recomendación genérica si excede ese plazo.
RNF-02. **Tolerancia a fallas.** La caída del servidor FHIR no debe impedir que el paciente reciba su clasificación y su recomendación. El agendamiento degrada, el triage no.
RNF-03. **Seguridad clínica.** La regla que excluye del agendamiento a los pacientes de nivel ESI 1 y 2 debe estar implementada en el servidor y cubierta por pruebas automatizadas. No puede depender de que la interfaz oculte un botón.
RNF-04. **Protección de datos.** Los datos de contacto deben quedar sujetos a reglas de acceso a nivel de base de datos que impidan su lectura desde el rol del paciente y desde el módulo de análisis DAU.
RNF-05. **Cumplimiento normativo.** El consentimiento de reserva debe cumplir la Ley 19.628 en cuanto a finalidad declarada y destinatario de los datos, y quedar registrado con fecha y hora.
RNF-06. **Interoperabilidad.** La comunicación con las agendas debe usar los recursos `Slot` y `Appointment` de HL7 FHIR R4, sin campos propietarios que impidan cambiar de servidor en el incremento D2.
RNF-07. **Sustituibilidad.** El acceso al servidor FHIR debe estar detrás de una interfaz que permita reemplazar el servidor simulado por endpoints reales sin modificar la lógica de derivación.
RNF-08. **Compatibilidad.** El flujo debe funcionar en navegador móvil sin instalación, incluyendo el caso de navegadores que no exponen geolocalización.
RNF-09. **Trazabilidad.** Cada reserva creada, fallida o cancelada debe quedar registrada con marca de tiempo.
RNF-10. **Respaldo.** Las tablas nuevas deben quedar incluidas en el respaldo automático de la base de datos existente, sin configuración adicional.

## 7. Criterios de aceptación

### Derivación urgente

CA-01. Dado un paciente clasificado en nivel ESI 2 que autorizó la geolocalización, cuando termina la conversación, entonces el sistema muestra el centro de urgencia hospitalaria más cercano con nombre y dirección, y la instrucción de llamar al 131.

CA-02. Dado un paciente clasificado en nivel ESI 1 o 2, cuando termina la conversación, entonces el sistema no muestra ninguna opción de agendamiento, ni siquiera si existen cupos disponibles en centros cercanos.

CA-03. Dado un paciente clasificado en nivel ESI 3, cuando termina la conversación, entonces el sistema muestra el centro de atención primaria más cercano con indicación de acudir el mismo día y no ofrece cupos para días posteriores.

### Proximidad

CA-04. Dado un paciente que autoriza la geolocalización, cuando el sistema calcula los centros cercanos, entonces los ordena por distancia ascendente desde su ubicación.

CA-05. Dado un paciente que deniega el permiso de geolocalización, cuando el sistema necesita ubicarlo, entonces le solicita seleccionar su comuna y continúa el flujo con esa comuna.

CA-06. Dado un paciente que deniega la geolocalización y no selecciona comuna, cuando termina la conversación, entonces el sistema muestra la recomendación genérica correspondiente a su nivel de urgencia y el flujo termina sin error.

CA-07. Dado cualquier paciente que autorizó la geolocalización, cuando el caso queda persistido, entonces ninguna tabla contiene sus coordenadas y solo puede contener su comuna.

### Agendamiento

CA-08. Dado un paciente clasificado en nivel ESI 4 con ubicación conocida y cupos disponibles, cuando termina la conversación, entonces el sistema muestra hasta cinco cupos con centro, dirección, fecha y hora.

CA-09. Dado un paciente con cupos disponibles a la vista, cuando selecciona uno y confirma, entonces el sistema crea un recurso `Appointment` en el servidor FHIR y muestra la confirmación con su código de seguimiento.

CA-10. Dado un paciente clasificado en nivel ESI 5 sin cupos disponibles en ningún centro cercano, cuando termina la conversación, entonces el sistema muestra la recomendación genérica de acudir a su CESFAM e indica que no hay horas disponibles.

CA-11. Dado un paciente que selecciona un cupo que otro paciente reservó entremedio, cuando confirma la reserva, entonces el sistema informa que el cupo ya no está disponible y muestra la lista de cupos actualizada.

CA-12. Dado el servidor FHIR caído, cuando un paciente de nivel ESI 4 termina la conversación, entonces el sistema muestra su clasificación y la recomendación genérica, y no muestra ningún error técnico.

CA-13. Dado un paciente que ve cupos disponibles, cuando decide no reservar y cierra el flujo, entonces el caso queda registrado como ofrecido y no reservado.

### Consentimiento y datos personales

CA-14. Dado un paciente que selecciona un cupo, cuando el sistema le solicita sus datos, entonces primero muestra un consentimiento que nombra el centro destinatario y los datos que recibirá, y no muestra ningún campo de datos antes de la aceptación.

CA-15. Dado un paciente que rechaza el consentimiento de reserva, cuando cierra ese paso, entonces conserva en pantalla su clasificación y su recomendación, y el sistema no almacena ningún dato personal suyo.

CA-16. Dado un paciente que completa una reserva, cuando se inspecciona la tabla `clinical_records`, entonces esa tabla no contiene su nombre, su RUT ni su teléfono.

CA-17. Dado un paciente que completa una reserva, cuando se inspecciona la tabla `appointment_bookings`, entonces el RUT figura como código derivado y no en claro.

CA-18. Dado un RUT con dígito verificador inválido, cuando el paciente intenta reservar, entonces el sistema rechaza el dato indicando el motivo y no crea la cita.

CA-19. Dada una reserva creada, cuando se inspecciona el recurso `Appointment` enviado al centro, entonces no contiene el relato clínico del paciente.

### Trazabilidad

CA-20. Dado un caso con reserva confirmada, cuando el enfermero abre el panel de enfermería, entonces ve que el paciente reservó y en qué centro.

CA-21. Dado un caso de nivel ESI 2, cuando el enfermero lo revisa, entonces ve registrado que no se ofreció agendamiento por nivel de urgencia.

El trabajo se considera terminado cuando todos los criterios CA se cumplen y sus pruebas pasan.

## 8. Fuera de alcance

**Descartado por decisión.**

- Agendamiento para pacientes de nivel ESI 1, 2 y 3. Es una decisión de seguridad clínica, no una limitación técnica, y no se revisará en incrementos posteriores.
- Envío del relato clínico completo al centro receptor. El centro recibe nivel de urgencia y motivo resumido.
- Cancelación o reprogramación de la cita por parte del paciente desde MediTriage. El paciente cancela con el centro por sus canales.
- Registro de cuenta de paciente. El flujo sigue siendo de un solo uso, sin sesión persistente.

**Postergado a incrementos posteriores.**

- Integración con agendas reales de centros aliados, en D2.
- Administración del directorio de centros desde la interfaz, en D3.
- Recordatorios y confirmación de asistencia, en D4.
- Medición de asistencia efectiva del paciente al centro, en D5. Este incremento registra la reserva, no la asistencia.
- Definición de cobertura territorial por convenio, es decir, qué centro atiende a qué comunas, en D3. En D1 la cobertura es puramente geográfica.

## 9. Supuestos y riesgos

| Supuesto o riesgo | Tipo | Impacto si falla | Mitigación |
|---|---|---|---|
| Los centros aliados aceptan publicar agenda por FHIR | Supuesto | Alto, el incremento D2 no se puede construir | Validar con un centro antes de iniciar D2. D1 no depende de esto |
| El paciente entrega sus datos para reservar | Supuesto | Alto, la reserva no se usa | Medir la tasa de aceptación del consentimiento como métrica del piloto |
| Los pacientes autorizan la geolocalización en el navegador móvil | Supuesto | Medio, degrada a selección de comuna | La comuna declarada es el camino de respaldo desde el diseño, no un parche |
| El paciente reserva hora y no asiste | Riesgo | Medio, ocupa cupos de centros aliados | D4 introduce confirmación y liberación de cupos. En D1 se acepta y se mide |
| Un paciente urgente ve el agendamiento por una falla | Riesgo | Crítico, retrasa una atención de riesgo vital | Regla en el servidor cubierta por pruebas, RNF-03, y verificación en CA-02 |
| La introducción de datos personales cambia el régimen legal del sistema | Riesgo | Alto, expone el proyecto | Separación de tablas, hash del RUT y consentimiento específico. Revisión con la contraparte de la universidad antes de la puesta en marcha |
| El directorio de centros queda desactualizado | Riesgo | Medio, deriva a un centro cerrado | D3 traslada la mantención al administrador. En D1 el directorio se revisa antes de cada semana de piloto |
| La distancia geográfica no representa el tiempo real de traslado | Supuesto | Medio, se recomienda un centro más lejano en la práctica | Se acepta en D1. Se evalúa incorporar tiempo de viaje si la métrica de asistencia lo justifica |

## 10. Métricas de éxito

| Métrica | Hoy | Objetivo | Cómo se mide |
|---|---|---|---|
| Pacientes no urgentes que terminan con una hora reservada | 0% | 40% | Reservas confirmadas sobre casos con disposición `next_day_primary_care` |
| Pacientes urgentes que reciben un centro concreto con dirección | 0% | 95% | Casos con disposición `emergency` que muestran centro, sobre el total de esos casos |
| Pacientes que aceptan el consentimiento de reserva | Sin dato | 60% | Aceptaciones sobre veces que se mostró el consentimiento |
| Casos que quedan sin ubicación | Sin dato | Menos de 20% | Casos sin comuna ni coordenadas sobre el total |
| Casos derivados con trazabilidad de destino | 0% | 100% | Casos con motivo de derivación registrado, sea reserva o motivo de no oferta |

Las dos primeras métricas son las que responden si el incremento sirvió. Las tres siguientes explican los resultados de las dos primeras cuando no se cumplen.

## 11. Preguntas abiertas

| Pregunta | Responsable | Plazo |
|---|---|---|
| ¿Qué centros componen el directorio inicial y quién valida sus direcciones? | Felipe Carrasco | Antes de iniciar la construcción |
| ¿El consentimiento de reserva requiere revisión del comité de ética que aprobó la tesis, o queda cubierto por la aprobación vigente? | Felipe Carrasco con la contraparte de la universidad | Antes de la puesta en marcha |
| ¿Se usa un servidor FHIR público de prueba, como HAPI FHIR, o se levanta uno propio con datos ficticios? | Felipe Carrasco | Antes de iniciar la construcción |
| ¿Cuánto tiempo se conservan los datos de contacto después de la fecha de la cita? | Felipe Carrasco con la contraparte de la universidad | Antes de la puesta en marcha |
| ¿El teléfono de contacto es obligatorio para reservar o basta el nombre y el RUT? | Felipe Carrasco con el primer centro aliado | Antes de iniciar D2 |
