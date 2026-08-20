# PRD — MediTriage, derivación diferenciada para descongestionar urgencias

**Estado:** Borrador
**Fecha:** 20 de agosto de 2026
**Autor:** Felipe Carrasco
**Versión:** 0.1

## Resumen ejecutivo

MediTriage es una aplicación web progresiva de auto-triaje ESI (Emergency Severity Index) que hoy clasifica pacientes de 1 a 5 pero no diferencia la vía de atención resultante. Este trabajo agrega una política explícita de derivación por nivel ESI, de modo que los pacientes de baja urgencia (ESI 4 y 5) reciban indicación clara de atención al día siguiente en el CESFAM, los de urgencia intermedia (ESI 3) sean derivados a atención primaria el mismo día, y solo los ESI 1 y 2 sean orientados a urgencia hospitalaria. La mejora esperada es reducir la proporción de pacientes ESI 4-5 que hoy consultan innecesariamente en urgencias.

## Contexto y problema

MediTriage está desplegado en Vercel a partir del repo [FelipeCgrillo/meditriage](https://github.com/FelipeCgrillo/meditriage), con clasificación ESI 1-5 vía Claude 3.5 Sonnet, motor de reglas determinista de salvaguarda (`src/lib/triage/ruleEngine.ts`) y persistencia en Supabase.

Hoy el chat del paciente termina siempre igual en apariencia. El componente `ChatInterface` (`src/components/triage/ChatInterface.tsx`) solo distingue dos caminos, muestra una alerta roja de urgencia cuando `esi_level <= 2` y en el resto de los niveles se limita a imprimir el `suggested_action` que devuelva el modelo, más un badge azul "Criterio IA: ESI N". No existe una recomendación estandarizada por nivel ESI ni una pantalla que diga al paciente ESI 4 o 5 dónde y cuándo debe atenderse.

El resultado operativo es que pacientes con baja complejidad, cuya condición puede resolverse en una consulta ambulatoria dentro de las próximas 24 horas, no reciben una indicación explícita de esperar y agendar en el CESFAM. Esa ausencia contribuye al problema descrito en `CONTEXTO_PROYECTO.md`, saturación de urgencias por pacientes ESI 4 y 5 que acuden a hospitales de alta complejidad. No hay hoy una medición interna del porcentaje de casos ESI 4-5 que terminan derivados a urgencia versus atención primaria (supuesto declarado, se estima a partir del prompt ESI y del flujo actual que el 100 por ciento reciben el mismo mensaje neutro).

Nota del skill, el requerimiento inicial estaba planteado como solución ("/goal"), no como problema. Se separó ambos, la solución es la derivación diferenciada por nivel ESI, el problema es la ausencia de una recomendación clara de vía de atención al final del chat.

## Objetivo

Que el chat del paciente termine con una recomendación de vía de atención determinada por el nivel ESI, verificable con estos tres estados finales visibles:

- ESI 1 y 2, indicación de urgencia hospitalaria inmediata (comportamiento actual, sin cambios de fondo).
- ESI 3, indicación de atención primaria de urgencia el mismo día.
- ESI 4 y 5, indicación de atención ambulatoria en el CESFAM al día siguiente.

Se cumple el objetivo cuando los tres caminos aparecen en la interfaz según el `esi_level` devuelto por el backend y quedan registrados en `clinical_records` con un campo nuevo `disposition` que refleje la vía asignada.

## Usuarios y contexto de uso

- **Paciente**, autoevalúa síntomas desde móvil, uso puntual. Necesita entender en menos de un minuto qué debe hacer al terminar el chat.
- **Enfermero validador**, revisa los registros pendientes en `/nurse/dashboard`. Necesita ver la vía de atención propuesta por el sistema junto al ESI para validar o modificar.
- **Investigador de tesis**, analiza retrospectivamente en `/resultados/dau`. Necesita que la vía de atención quede almacenada por caso para poder medir concordancia y tasas de derivación.

## Requisitos funcionales

RF-01. El backend `POST /api/triage` debe devolver, junto al `esi_level`, un campo `disposition` con uno de los valores `emergency`, `same_day_primary_care`, `next_day_primary_care`.
RF-02. El backend debe derivar el valor de `disposition` de forma determinista a partir del `esi_level` según el mapa `ESI 1|2 → emergency`, `ESI 3 → same_day_primary_care`, `ESI 4|5 → next_day_primary_care`.
RF-03. El sistema debe estandarizar el `suggested_action` según la disposición asignada, con textos definidos en un helper único que use el motor y el frontend. Depende de RF-02.
RF-04. El chat del paciente debe mostrar, al final del flujo cuando `status === 'success'`, una tarjeta de disposición con título, indicación de plazo y una línea de instrucción al paciente. Depende de RF-01.
RF-05. La tarjeta de disposición debe distinguirse visualmente entre las tres vías, con estilo rojo para `emergency`, ámbar para `same_day_primary_care` y azul para `next_day_primary_care`.
RF-06. Para disposiciones `next_day_primary_care` y `same_day_primary_care`, la tarjeta debe incluir la instrucción explícita de no acudir a urgencia hospitalaria salvo empeoramiento y el teléfono de emergencia 131.
RF-07. El registro persistido en `clinical_records` debe incluir la columna `disposition` con el valor asignado por el backend. Depende de RF-01.
RF-08. El dashboard del enfermero debe mostrar la disposición junto al nivel ESI en cada registro pendiente.
RF-09. El prompt ESI debe actualizarse para explicar al modelo que su `suggested_action` será reemplazado por texto estandarizado según la disposición, de modo que el modelo se concentre en el razonamiento clínico.
RF-10. El motor de reglas determinista debe conservar intacto su comportamiento actual de override para ESI 1 y 2, y no debe modificar la asignación de `disposition` fuera del mapeo de RF-02.

## Requisitos no funcionales

RNF-01. Compatibilidad. El cambio debe funcionar en el mismo despliegue actual de Vercel sin variables de entorno nuevas.
RNF-02. Rendimiento. La derivación de `disposition` no debe agregar latencia perceptible, es una operación local sin llamadas externas.
RNF-03. Seguridad. El cambio no debe reducir la salvaguarda de ESI 1 y 2, el motor de reglas mantiene su override determinista.
RNF-04. Compatibilidad con datos previos. La nueva columna `disposition` debe permitir `NULL` para no romper los registros existentes.
RNF-05. Trazabilidad. Cada registro debe incluir en `ai_response` el objeto original devuelto por el LLM para no perder auditoría de la propuesta del modelo.

## Criterios de aceptación

CA-01. Dado un caso con `esi_level = 5` clasificado por el backend, cuando se consulta `POST /api/triage`, entonces la respuesta incluye `disposition: "next_day_primary_care"`.
CA-02. Dado un caso con `esi_level = 4`, cuando se consulta `POST /api/triage`, entonces la respuesta incluye `disposition: "next_day_primary_care"`.
CA-03. Dado un caso con `esi_level = 3`, cuando se consulta `POST /api/triage`, entonces la respuesta incluye `disposition: "same_day_primary_care"`.
CA-04. Dado un caso con `esi_level = 2`, cuando se consulta `POST /api/triage`, entonces la respuesta incluye `disposition: "emergency"`.
CA-05. Dado un caso con `esi_level = 1`, cuando se consulta `POST /api/triage`, entonces la respuesta incluye `disposition: "emergency"`.
CA-06. Dado un paciente que finaliza el chat con ESI 4 o 5, cuando la clasificación llega al frontend, entonces la interfaz muestra una tarjeta azul con el título "Atención al día siguiente en CESFAM" y la instrucción de agendar en el centro de salud correspondiente.
CA-07. Dado un paciente que finaliza el chat con ESI 3, cuando la clasificación llega al frontend, entonces la interfaz muestra una tarjeta ámbar con el título "Atención primaria hoy" y la instrucción de acudir al CESFAM en el día.
CA-08. Dado un paciente que finaliza el chat con ESI 1 o 2, cuando la clasificación llega al frontend, entonces la interfaz muestra la tarjeta roja actual de urgencia y el aviso 131.
CA-09. Dado un caso persistido en `clinical_records`, cuando se consulta la fila, entonces la columna `disposition` contiene uno de los tres valores permitidos y coincide con el mapeo de RF-02.
CA-10. Dada una migración aplicada a una base con registros previos, cuando se ejecuta, entonces las filas anteriores mantienen `disposition = NULL` sin errores y las nuevas filas escriben el valor correcto.
CA-11. Dado un motor de reglas que detecta ESI 2 sobre una propuesta LLM de ESI 4, cuando aplica el override, entonces la disposición final es `emergency`, no `next_day_primary_care`.

El trabajo se considera terminado cuando todos los criterios CA se cumplen y sus pruebas pasan.

## Fuera de alcance

Descartado por decisión en esta etapa.

- Agendamiento efectivo de la cita en el CESFAM. La tarjeta solo instruye al paciente, no reserva hora.
- Integración con FHIR `Appointment` o `Slot`. Se mantiene solo el mapeo actual a `RiskAssessment`.
- Envío de recordatorios por SMS o correo al paciente.
- Multi-CESFAM con textos institucionalmente distintos. Se usa un texto genérico en esta versión.

Postergado para una etapa posterior.

- Interoperabilidad con SIGLE u otros sistemas de agenda del CESFAM.
- Selección del CESFAM del paciente por comuna o previsión.
- Métrica automática de tasa de sub-triaje y sobre-triaje segmentada por disposición.

## Supuestos y riesgos

| Supuesto o riesgo | Tipo | Impacto si falla | Mitigación |
|---|---|---|---|
| El mapeo ESI → disposición es aceptado por la contraparte clínica de la tesis | Supuesto | Alto | Confirmar con tutor clínico antes de operar el piloto |
| Los pacientes leerán la tarjeta y respetarán la vía indicada | Supuesto | Medio | Reforzar la instrucción con lenguaje directo y aviso 131 solo cuando aplique |
| El motor de reglas actual no requiere ajustes para preservar el override ESI 1-2 | Supuesto | Alto | Prueba unitaria dedicada al caso override → disposición emergency (CA-11) |
| Sobre-derivación a urgencias por miedo del paciente pese al ESI 4-5 | Riesgo | Medio | Medir en el piloto y ajustar el copy si la tasa observada es alta |

## Métricas de éxito

| Métrica | Hoy | Objetivo | Cómo se mide |
|---|---|---|---|
| Casos ESI 4-5 con tarjeta de derivación al día siguiente | 0 % | 100 % | Consulta a `clinical_records` sobre `disposition = 'next_day_primary_care'` cuando `esi_level in (4,5)` |
| Casos ESI 3 con tarjeta de APS mismo día | 0 % | 100 % | Consulta a `clinical_records` sobre `disposition = 'same_day_primary_care'` cuando `esi_level = 3` |
| Pacientes ESI 4-5 que declaran haber acudido a urgencia | Sin medición | Menor a la línea base institucional | Encuesta o registro comparativo en el piloto de tesis |

## Preguntas abiertas

1. Confirmar el texto oficial de la tarjeta para ESI 4-5 con el tutor clínico de la tesis. Responsable, autor.
2. Definir si en el piloto se registra el CESFAM del paciente para personalizar la instrucción. Responsable, autor.
