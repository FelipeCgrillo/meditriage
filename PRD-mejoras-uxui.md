# PRD — Coherencia UX/UI del flujo de triaje (paciente y enfermería)

**Estado:** Borrador
**Fecha:** 26 de agosto de 2026
**Autor:** Felipe Carrasco Grillo
**Versión:** 0.1
**Horizonte:** 1, incremento sobre el producto existente. Complementa el PRD-meditriage.md (I1) y cierra brechas de sus RF-14 y RF-15.

## 1. Contexto y problema

La revisión UX/UI del código en producción detectó tres rupturas de experiencia y un grupo de fricciones menores.

**Ruptura A, el CTA principal de la landing lleva a un callejón sin salida.** Los botones "Soy Paciente" y "Acceder como Paciente" de `src/app/page.tsx` enlazan a `/paciente` sin parámetro `?org=`. `TriageChatLegacy` exige un slug de organización válido y, al no recibirlo, muestra "Enlace no válido, consulte con su CESFAM". Todo visitante que entra por la landing ve un error como primera pantalla. El PRD I1 ya definió la mitigación (selector previo de organizaciones activas) pero no está implementada.

**Ruptura B, el paciente termina el triaje sin saber dónde ir.** El flujo vivo (`/paciente` → `TriageChatLegacy`) oculta el payload terminal y muestra solo la pantalla "Evaluación Finalizada" con el código anónimo. La tarjeta de disposición (urgencia roja, APS hoy amber, CESFAM día siguiente azul) exigida por RF-14 del PRD I1 existe solo en `ChatInterface.tsx`, montado en la ruta paralela `/patient/chat` que ningún enlace de la aplicación referencia. El valor clínico central del producto, decirle al paciente a qué nivel de atención acudir, no llega al paciente en el flujo real. Para un caso ESI 1-2 esto es además un riesgo de seguridad, porque nadie le indica acudir a urgencia o llamar al 131.

**Ruptura C, duplicación de vistas que ya produjo divergencia.** Existen dos chats de paciente (`TriageChatLegacy` y `ChatInterface`) y dos vistas de enfermería (`NurseDashboardClient`, viva, y `NurseValidation.tsx`, sin uso). Las mejoras se aplican a una copia y la otra queda atrás, que es exactamente lo que pasó con la disposición. El dashboard vivo de enfermería tampoco muestra el chip de disposición exigido por RF-15.

**Fricciones menores.** El consentimiento ofrece solo "Masculino" y "Femenino" aunque la base de datos ya soporta `Other` y `Prefer not to say`. El encabezado del chat dice "Chat de Triage ESI", sigla sin significado para un paciente, y el nombre del CESFAM se consulta al API (`orgName`) pero nunca se muestra. Los errores de guardado en el dashboard de enfermería usan `alert()` nativo. El login no ofrece recuperación de contraseña. La landing repite dos veces la misma botonera de accesos y afirma cifras no sustentadas ("100% trazabilidad", "~3s").

## 2. Objetivo

Al cierre de este incremento, un visitante que entra por la landing puede completar un triaje sin ver pantallas de error, y todo paciente con clasificación terminal ve en la pantalla final a qué nivel de atención acudir, con la misma jerarquía visual roja, amber o azul definida en el PRD I1. Existe una sola implementación de chat de paciente y una sola vista de enfermería, y esta última muestra la disposición de cada caso clasificado.

## 3. Usuarios y contexto de uso

Los mismos del PRD I1. Relevantes aquí: el paciente anónimo desde celular, con alfabetización digital y sanitaria variable, y el enfermero validador desde PC del CESFAM. Este incremento no agrega usuarios nuevos.

## 4. Requisitos funcionales

### 4.1. Entrada al flujo del paciente

RF-01. El sistema debe mostrar, cuando `/paciente` se abre sin `?org=`, un selector con las organizaciones activas en lugar del mensaje de enlace no válido.
RF-02. El sistema debe mantener el mensaje genérico "Enlace no válido" solo para slugs que no existen o están inactivos.
RF-03. El sistema debe mostrar el nombre de la organización validada en el encabezado del chat, reutilizando el `orgName` que ya entrega `/api/patient/organization`.
RF-04. El sistema debe reemplazar el título "Chat de Triage ESI" por un título sin siglas orientado al paciente, por ejemplo "Orientación de urgencia".

### 4.2. Consentimiento y demografía

RF-05. El sistema debe ofrecer en la pregunta de sexo las opciones "Masculino", "Femenino", "Otro" y "Prefiero no responder", mapeadas a los valores `M`, `F`, `Other` y `Prefer not to say` que la base de datos ya acepta.

### 4.3. Cierre del triaje del paciente

RF-06. El sistema debe mostrar en la pantalla final del flujo vivo (`/paciente`) la tarjeta de disposición con jerarquía visual roja (urgencia), amber (APS hoy) o azul (CESFAM día siguiente), junto al código anónimo. Cierra RF-14 del PRD I1.
RF-07. El sistema debe incluir en la tarjeta roja de urgencia la instrucción explícita de acudir de inmediato al servicio de urgencia o llamar al 131.
RF-08. El sistema no debe mostrar tarjeta de disposición cuando el caso termina sin clasificación (`needs_info`, error o disposición nula).

### 4.4. Consolidación de vistas

RF-09. El sistema debe servir el chat de paciente desde una única implementación, retirando la ruta `/patient/chat` y el componente que quede sin uso (`ChatInterface.tsx` o fusión de ambos).
RF-10. El sistema debe retirar `NurseValidation.tsx` si ninguna ruta lo monta, dejando `NurseDashboardClient` como única vista de enfermería.

### 4.5. Dashboard de enfermería

RF-11. El sistema debe mostrar, en cada caso clasificado del dashboard, un chip con la disposición vigente junto a los chips de ESI. Cierra RF-15 del PRD I1.
RF-12. El sistema debe reemplazar el `alert()` de error de guardado por un aviso en la propia tarjeta del caso, con botón de reintento.
RF-13. El sistema debería (deseable) ofrecer "olvidé mi contraseña" en `/login/nurse` con envío de link por correo, según RF-12 del PRD I1.

### 4.6. Landing

RF-14. El sistema debe consolidar los accesos de la landing en una sola botonera, eliminando la sección duplicada "Comienza Ahora" o el par de botones del hero, a elección de diseño.
RF-15. El sistema debe retirar o sustentar las cifras de la sección de beneficios; toda cifra que permanezca debe tener fuente verificable en el propio sistema.
RF-16. El sistema debería (deseable) usar denominaciones neutras en los accesos, "Personal de enfermería" en lugar de "Soy Enfermera".

## 5. Requisitos no funcionales

RNF-01. **Accesibilidad.** La tarjeta de disposición y los chips ESI deben comunicar el nivel también con texto, no solo con color, y cumplir contraste WCAG AA (4.5:1) en su texto.
RNF-02. **Compatibilidad.** Las pantallas modificadas deben operar en Chrome Android y Safari iOS, que son los navegadores del paciente objetivo.
RNF-03. **Sin regresión de datos.** La consolidación de componentes no debe cambiar el contrato de `/api/triage` ni el payload de `/api/patient/record`.
RNF-04. **Rendimiento.** El selector de organizaciones debe cargar en menos de 2 segundos con hasta 50 organizaciones activas.

## 6. Criterios de aceptación

CA-01. Dado un visitante que abre `/paciente` sin parámetros, cuando carga la página, entonces ve el selector de organizaciones activas y al elegir una entra al flujo de consentimiento sin ver mensajes de error.
CA-02. Dado un visitante que abre `/paciente?org=inexistente`, cuando carga la página, entonces ve el mensaje genérico de enlace no válido y no se crea ningún registro.
CA-03. Dado un paciente en `/paciente?org=<slug válido>`, cuando el chat carga, entonces el encabezado muestra el nombre de la organización y no contiene la sigla "ESI".
CA-04. Dado el paso de sexo del consentimiento, cuando se muestran las opciones, entonces aparecen las cuatro opciones y elegir "Prefiero no responder" persiste `Prefer not to say` en el registro.
CA-05. Dado un caso terminal con `esi_level = 4`, cuando el paciente llega a la pantalla final, entonces ve la tarjeta azul "Atención al día siguiente en CESFAM" junto al código anónimo.
CA-06. Dado un caso terminal con `esi_level = 2`, cuando el paciente llega a la pantalla final, entonces ve la tarjeta roja con la instrucción de acudir a urgencia o llamar al 131.
CA-07. Dado un caso que termina en error o `needs_info`, cuando se muestra la pantalla o banner correspondiente, entonces no aparece ninguna tarjeta de disposición.
CA-08. Dado el repositorio tras la consolidación, cuando se busca `ChatInterface` o `NurseValidation` en rutas montadas, entonces no queda ninguna ruta que sirva un chat o vista de enfermería duplicados, y `npx tsc --noEmit`, `npx vitest run` y `npx next build` terminan sin error.
CA-09. Dado un caso clasificado por la enfermera en el dashboard, cuando la tarjeta se muestra, entonces incluye el chip de disposición junto a los chips "Enfermera: ESI n" e "IA: ESI n".
CA-10. Dado un fallo de guardado de clasificación (RLS o sesión expirada), cuando el update devuelve 0 filas o error, entonces el aviso aparece dentro de la tarjeta con botón "Reintentar" y no se dispara ningún `alert()` nativo.
CA-11. Dada la landing publicada, cuando se recorre la página completa, entonces existe una sola botonera de accesos y ninguna cifra sin fuente verificable.
CA-12. Dada la tarjeta de disposición y los chips ESI, cuando se inspeccionan con una herramienta de contraste, entonces el texto cumple razón de contraste mínima 4.5:1 y cada nivel se identifica por texto además del color.

El trabajo se considera terminado cuando todos los criterios CA se cumplen y sus pruebas pasan.

## 7. Fuera de alcance

**Postergado.**

- Rediseño visual completo de la landing (mensajes, secciones nuevas, testimonios). Aquí solo se consolida y se corrige veracidad.
- Notificaciones al paciente (SMS, correo) con su disposición.
- Modo oscuro y ajustes de tamaño de fuente para el paciente.
- Auditoría de accesibilidad completa (lector de pantalla de punta a punta); este incremento cubre contraste y texto no dependiente de color.

**Descartado por decisión.**

- Cambiar el principio de evaluación ciega del dashboard de enfermería. El ocultamiento del ESI de la IA hasta clasificar es una decisión metodológica estable de la tesis.
- Mostrar al paciente el nivel ESI numérico o el razonamiento clínico. El paciente ve solo la disposición y el código.

## 8. Supuestos y riesgos

| Supuesto o riesgo | Tipo | Impacto si falla | Mitigación |
|---|---|---|---|
| El selector público de organizaciones no expone información sensible | Supuesto | Medio | Listar solo nombre y slug de organizaciones activas que hayan aceptado aparecer; agregar flag `is_public` si algún CESFAM no quiere listarse |
| La disposición llega al cliente en el payload terminal o puede recalcularse client-side con la misma regla server | Supuesto | Alto | Reutilizar `src/lib/triage/disposition.ts` como fuente única; verificar contra el valor persistido |
| `ChatInterface.tsx` no contiene lógica exclusiva aún necesaria | Supuesto | Medio | Diff funcional entre ambos chats antes de retirar; portar a `TriageChatLegacy` lo que falte (la tarjeta de disposición ya identificada) |
| Mostrar disposición al paciente ESI 1-2 genera pánico en vez de acción | Riesgo | Medio | Redacción revisada por la contraparte clínica del piloto antes del deploy |

## 9. Preguntas abiertas

- ¿El selector de organizaciones lista todos los CESFAM activos o solo los que lo autoricen? Responsable: autor, con la contraparte de cada piloto.
- ¿La redacción exacta de la tarjeta roja (urgencia / 131) requiere visto bueno clínico formal para la tesis? Responsable: autor con profesor guía.
- ¿Se conserva `/patient/chat` como redirección 308 a `/paciente` o se elimina la ruta? Este PRD asume redirección para no romper enlaces guardados.
