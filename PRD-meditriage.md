# PRD — MediTriage: plataforma comercial de auto-triaje ESI para APS

**Estado:** Borrador
**Fecha:** 20 de agosto de 2026
**Autor:** Felipe Carrasco Grillo
**Versión:** 1.0
**Horizonte:** 3, producto comercial (SaaS multi-CESFAM)

## Visión de producto

MediTriage es un sistema web multi-tenant que ofrece a centros de atención primaria (CESFAM) y servicios de urgencia un flujo de auto-triaje asistido por IA basado en el protocolo Emergency Severity Index (ESI), con validación de enfermería y análisis retrospectivo de Datos de Atención de Urgencia (DAU) para gestión clínica y tesis académicas.

El producto se comercializa como suscripción anual por centro, con un piloto controlado gratuito de 2 semanas como onboarding, y se construye por incrementos numerados. Este PRD documenta el mapa completo y desarrolla en detalle solo el incremento 1.

### Mapa de incrementos

| Incremento | Nombre | Estado | Descripción breve |
|---|---|---|---|
| I1 | Piloto controlado + multi-tenancy mínima | En este PRD | Aislamiento por organización, auth productiva de enfermeros, deploy en Vercel + Supabase, DAU listo para tesis |
| I2 | Cobro y suscripciones | Postergado | Stripe, planes, facturación, gestión de suscripción por admin del centro |
| I3 | Onboarding auto-servicio | Postergado | Alta de nuevos CESFAM sin intervención manual, incluyendo creación de la organización desde la landing |
| I4 | API pública para HIS/RIS | Postergado | Endpoints REST autenticados por token para integración con sistemas de información hospitalaria |
| I5 | Soporte y operación | Postergado | Canal de tickets, SLA, monitoreo público, status page |
| I6 | Certificación normativa | Postergado | Cumplimiento formal Ley 19.628 (datos personales) y estándares HL7 FHIR ampliados |

### Dimensiones comerciales, decisiones al cierre de este PRD

- **Captación.** Landing pública `/propuesta-piloto` ya existe y captura interés por correo. Se mantiene sin cambios en I1.
- **Onboarding.** En I1 el onboarding es manual: el equipo MediTriage crea la organización y el primer usuario admin. La automatización queda para I3.
- **Multi-tenancy.** Se implementa en I1 la separación por `organization_id`. Cada organización solo ve sus casos.
- **Cobro.** No aplica en I1. Todos los pilotos I1 son gratuitos por 2 semanas por decisión comercial. Se cubre en I2.
- **API pública.** No aplica en I1. Se cubre en I4.
- **Soporte y operación.** En I1 el soporte es por correo directo al autor. Canal formal queda en I5.
- **Legal.** En I1 se publica una política de privacidad mínima y términos del piloto. La certificación formal queda en I6. Los datos clínicos son anónimos (código ABC-123) por diseño, lo que reduce el alcance legal.

---

# Incremento 1: Piloto controlado + multi-tenancy mínima

## 1. Resumen ejecutivo

MediTriage entra en producción con un piloto controlado por CESFAM. El sistema pasa de un despliegue de un solo tenant (uso mixto) a una plataforma multi-organización con aislamiento por `organization_id` a nivel de base de datos. Los enfermeros validadores se autentican con correo y contraseña, ven únicamente los casos de su CESFAM, y el módulo de análisis DAU corre por organización. La derivación clínica por nivel ESI (urgencia, atención primaria hoy, atención al día siguiente) queda estabilizada y visible en el chat del paciente y en la vista del enfermero.

## 2. Contexto y problema

MediTriage está desplegado hoy como aplicación de tesis en Vercel con una única Supabase y sin separación por organización. Cualquier enfermero autenticado ve todos los casos de todos los pacientes que hayan usado el sistema. Esto impide invitar a un segundo CESFAM sin comprometer los datos del primero y bloquea la firma de cualquier acuerdo formal de piloto.

Adicionalmente, aunque la clasificación ESI existe hace varias iteraciones, hasta la versión anterior de este PRD el sistema no derivaba de forma explícita a los pacientes ESI 4-5 a una atención programada en CESFAM al día siguiente. Ese cambio ya está en `main` (commit `ad5a6ff`, migración `011_add_disposition.sql`, PRD previo) y se considera parte de este incremento porque necesita quedar aplicado en producción y monitoreable por organización.

Impacto de no resolverlo: no hay ruta comercial. El proyecto sigue siendo una demo de tesis, no un producto vendible, y cada piloto adicional requeriría desplegar una instancia separada.

## 3. Objetivo

Al cierre de este incremento, un segundo CESFAM puede sumarse al sistema y sus enfermeros ven únicamente los casos de sus pacientes, en el mismo despliegue de Vercel + Supabase que usa el primer CESFAM, sin cambios de código. La derivación por ESI (`disposition`) está aplicada en la Supabase productiva y visible en las tres vistas del sistema (chat, dashboard de enfermería, análisis DAU).

## 4. Usuarios y contexto de uso

- **Paciente anónimo.** Consulta síntomas desde su celular. No se autentica. Genera un caso vinculado a la organización que le entregó el link (por subdominio o parámetro `?org=`).
- **Enfermero validador.** Se autentica con correo y contraseña. Revisa los casos de su CESFAM en el dashboard `/nurse/dashboard`, valida o corrige el nivel ESI propuesto por la IA. Uso diario, desde PC del CESFAM.
- **Admin de organización.** Se autentica con correo y contraseña. Crea usuarios enfermeros de su organización, ve el listado de casos y las corridas DAU de su organización. Uso semanal, desde PC.
- **Admin de plataforma (equipo MediTriage).** Un solo usuario con rol `admin` sin `organization_id`. Crea organizaciones y su primer admin. Uso puntual, desde PC.
- **Investigador (rol `researcher`).** Acceso lectura al módulo DAU de su organización. Uso mensual para la tesis y para el reporte del piloto.

## 5. Requisitos funcionales

### 5.1. Multi-tenancy

RF-01. El sistema debe modelar la entidad `organization` con al menos los campos `id` (UUID), `name`, `slug` único, `is_active` y `created_at`.
RF-02. El sistema debe vincular cada `user_profile` a una `organization_id` (nullable solo para el admin de plataforma).
RF-03. El sistema debe vincular cada `clinical_record` a una `organization_id` no nula al momento de la inserción.
RF-04. El sistema debe vincular cada corrida DAU (`dau_analysis_runs`) a una `organization_id` no nula.
RF-05. El sistema debe rechazar cualquier lectura, actualización o inserción cruzada entre organizaciones a nivel de base de datos (RLS de Postgres), no solo a nivel de aplicación.
RF-06. El sistema debe permitir al paciente identificar su organización al iniciar la conversación mediante el parámetro `?org=<slug>` en la URL, y persistir esa asociación en el registro clínico creado.
RF-07. El sistema debe rechazar el flujo del paciente si el `slug` de organización no existe o está `is_active = false`, mostrando un mensaje claro sin exponer que la organización existe o no (respuesta genérica de "enlace no válido").

### 5.2. Autenticación productiva

RF-08. El sistema debe permitir al enfermero y al admin autenticarse con correo y contraseña mediante Supabase Auth.
RF-09. El sistema debe permitir al admin de organización crear cuentas de enfermero de su propia organización, ingresando correo, contraseña inicial y rol.
RF-10. El sistema debe permitir al admin de organización desactivar (no eliminar) cuentas de enfermero de su propia organización.
RF-11. El sistema debe permitir al admin de plataforma crear organizaciones y crear el primer usuario admin de esa organización, desde una vista `/admin/organizations` visible solo para el rol `admin` sin `organization_id`.
RF-12. El sistema debería (deseable) ofrecer un flujo de "olvidé mi contraseña" con envío de link por correo. Depende de RF-08.

### 5.3. Derivación clínica por ESI (estabilización de `disposition`)

RF-13. El sistema debe persistir el campo `disposition` en `clinical_records` para todo caso con `status = 'success'`, calculado server-side desde el nivel ESI final.
RF-14. El sistema debe mostrar al paciente, al cerrar la conversación, una tarjeta de disposición con jerarquía visual roja (urgencia), amber (APS hoy) o azul (CESFAM día siguiente).
RF-15. El sistema debe mostrar al enfermero, junto al nivel ESI, un chip con la disposición vigente para cada caso.

### 5.4. Análisis DAU por organización

RF-16. El sistema debe filtrar el listado y las corridas DAU (`/resultados/dau` y `/api/dau/runs`) por la `organization_id` del usuario autenticado.
RF-17. El sistema debe permitir que una corrida DAU incluya el campo `disposition` inferido en cada caso, sin cambios en el pipeline actual, solo propagando el campo si está presente.

## 6. Requisitos no funcionales

RNF-01. **Seguridad.** El aislamiento por organización debe estar garantizado por RLS de Postgres, no por filtros en el código de la aplicación. Un bug en la aplicación no debe poder filtrar datos entre organizaciones.
RNF-02. **Control de acceso.** Toda ruta autenticada (`/nurse/*`, `/admin/*`, `/resultados/*`) debe verificar rol y `organization_id` en el middleware antes de renderizar.
RNF-03. **Rendimiento.** El dashboard de enfermería debe cargar el listado de los últimos 100 casos de la organización en menos de 2 segundos en la Supabase productiva actual.
RNF-04. **Compatibilidad hacia atrás.** La migración de multi-tenancy debe crear una organización por defecto (`slug = 'meditriage-piloto'`) y asignarle todos los registros y usuarios preexistentes, sin pérdida de datos.
RNF-05. **Disponibilidad.** El sistema debe operar en Vercel producción con dominio `meditriage.vercel.app` (o el definido en el deploy) y Supabase productiva, sin dependencias adicionales de infraestructura.
RNF-06. **Respaldo.** El respaldo diario automático de Supabase debe estar habilitado sobre el proyecto productivo. Sin herramienta adicional en este incremento.
RNF-07. **Trazabilidad.** Toda inserción o actualización sobre `clinical_records` debe registrar `user_id` (o `null` si es paciente anónimo) y `organization_id` en cada fila. La tabla de auditoría formal queda para I5.
RNF-08. **Cumplimiento.** El sistema no persiste datos clínicos identificables. El código anónimo `ABC-123` sigue siendo la única referencia al paciente. Esto se documenta en la política de privacidad del piloto.
RNF-09. **Recuperación.** Existe procedimiento documentado para revertir la migración de multi-tenancy en caso de falla crítica en producción, dentro de la primera hora post-deploy.

## 7. Criterios de aceptación

CA-01. Dado un CESFAM A con slug `cesfam-a` y un enfermero de esa organización, cuando el enfermero inicia sesión y abre `/nurse/dashboard`, entonces el sistema muestra solo los casos con `organization_id = <A>` y ninguno de otras organizaciones.
CA-02. Dado un enfermero autenticado del CESFAM A, cuando intenta leer directamente desde el cliente Supabase un registro clínico con `organization_id` distinto, entonces la lectura falla por RLS con cero filas devueltas.
CA-03. Dado un enfermero autenticado del CESFAM A, cuando intenta actualizar (validar) un registro con `organization_id` distinto, entonces la operación falla por RLS y el registro no cambia.
CA-04. Dado un paciente que abre `https://<app>/paciente?org=cesfam-a`, cuando completa el chat, entonces el registro creado tiene `organization_id` igual al id de `cesfam-a`.
CA-05. Dado un paciente que abre `https://<app>/paciente?org=inexistente`, cuando entra a la ruta, entonces el sistema muestra un mensaje "Este enlace no es válido, consulte con su CESFAM" y no crea ningún registro.
CA-06. Dado un admin de plataforma autenticado, cuando crea una nueva organización con slug `cesfam-b` y luego crea el primer admin de esa organización, entonces ese admin puede iniciar sesión, crear un enfermero de `cesfam-b`, y ese enfermero solo ve casos de `cesfam-b`.
CA-07. Dado un admin de organización de `cesfam-a`, cuando intenta crear un usuario con `organization_id = cesfam-b` mediante manipulación del payload, entonces el API lo rechaza con HTTP 403 y no crea el usuario.
CA-08. Dado el sistema productivo antes de la migración con N registros clínicos y M usuarios, cuando se aplica la migración `012_add_organizations_multitenancy.sql`, entonces los N registros quedan asignados a la organización `meditriage-piloto` y los M usuarios también, sin pérdida de filas ni cambios en otros campos.
CA-09. Dado un caso clasificado con `status = 'success'` y `esi_level = 4`, cuando se persiste, entonces la columna `disposition` queda en `'next_day_primary_care'` y el paciente ve la tarjeta azul "Atención al día siguiente en CESFAM".
CA-10. Dado un caso donde el motor de reglas sobreescribe la propuesta del LLM de ESI 4 a ESI 2, cuando se persiste, entonces `disposition` queda en `'emergency'` y el paciente ve la tarjeta roja de urgencia (regla del peor caso preservada).
CA-11. Dado un caso con `status = 'needs_info'`, cuando se persiste, entonces `disposition` es `NULL` y no se muestra tarjeta de disposición al paciente.
CA-12. Dado un investigador con rol `researcher` de `cesfam-a`, cuando abre `/resultados/dau`, entonces solo ve corridas DAU de `cesfam-a` y la exportación CSV incluye la columna `disposition`.
CA-13. Dada la aplicación desplegada en Vercel producción tras aplicar las migraciones 011 y 012, cuando se ejecuta `npx tsc --noEmit`, `npx vitest run` y `npx next build`, entonces las tres tareas terminan sin error y con todos los tests pasando.
CA-14. Dado un enfermero con contraseña inicial fijada por el admin, cuando inicia sesión por primera vez, entonces el sistema le exige cambiar su contraseña antes de continuar.

El trabajo se considera terminado cuando todos los criterios CA se cumplen y sus pruebas pasan.

## 8. Fuera de alcance

**Postergado a incrementos siguientes.**

- Stripe y cobro por suscripción (I2)
- Registro auto-servicio de nuevas organizaciones desde la landing (I3)
- API pública con tokens para integraciones (I4)
- Canal formal de tickets y status page (I5)
- Certificación HL7 FHIR completa y auditoría Ley 19.628 (I6)
- SSO empresarial (Google Workspace, Azure AD)
- App móvil nativa
- Módulo de reportes financieros por organización

**Descartado por decisión.**

- Multi-tenancy con base de datos por cliente. Se opta por `organization_id` compartido con RLS para simplicidad operacional y costo.
- Datos clínicos identificables (RUT, nombre real). El anonimato por código `ABC-123` es una decisión de diseño estable.
- Cambio de proveedor de IA. Se mantiene Anthropic Claude 3.5 Sonnet.

## 9. Supuestos y riesgos

| Supuesto o riesgo | Tipo | Impacto si falla | Mitigación |
|---|---|---|---|
| Los CESFAM piloto aceptan email + password sin SSO | Supuesto | Medio | Preguntar en la primera reunión de cada piloto y ofrecer SSO como upgrade en I2 |
| El link con `?org=<slug>` es entregado por el CESFAM al paciente | Supuesto | Alto | Documentar el flujo de entrega en el material de onboarding del piloto |
| Los ~pocos registros preexistentes en la Supabase de tesis pueden reasignarse a `meditriage-piloto` sin objeciones | Supuesto | Bajo | Confirmar con el autor antes de correr la migración 012 |
| La RLS actual sobre `clinical_records` es compatible con el nuevo predicado por `organization_id` | Supuesto | Alto | La migración 012 debe droppear y recrear las políticas de forma idempotente y ejecutar tests de RLS antes de considerar terminada la tarea |
| Habilitar RLS por organización no degrada el rendimiento del dashboard | Riesgo | Medio | Crear índice sobre `clinical_records(organization_id, created_at DESC)` en la migración |
| Un admin de organización malicioso crea un enfermero con `organization_id` de otra organización manipulando el payload | Riesgo | Crítico | El API server-side debe forzar `organization_id` al del actor, ignorando el payload (CA-07) |
| Los pacientes no tienen link con `?org=` y llegan a la raíz | Riesgo | Medio | Definir una organización "público general" o mostrar un selector previo. En I1 se define selector previo con la lista de organizaciones activas |

## 10. Métricas de éxito

| Métrica | Hoy | Objetivo | Cómo se mide |
|---|---|---|---|
| Organizaciones activas en producción | 1 (uso mixto de tesis) | 2 (piloto inicial + tesis) | `SELECT count(*) FROM organizations WHERE is_active` |
| Fuga de datos entre organizaciones detectada | No medido | 0 casos en las primeras 4 semanas | Auditoría manual sobre `clinical_records` cruzando `organization_id` con `user_profile.organization_id` del validador |
| Tasa de derivación correcta ESI 4-5 → CESFAM día siguiente | 0% (no existía) | ≥ 95% en los casos con `status = 'success'` y `esi_level ∈ {4,5}` | `SELECT count(*) FILTER (WHERE disposition = 'next_day_primary_care') / count(*) FROM clinical_records WHERE esi_level BETWEEN 4 AND 5 AND status_completed` |
| Tiempo de carga del dashboard de enfermería | No medido | < 2 segundos con 100 casos | Instrumentación manual con DevTools en el CESFAM piloto |
| CESFAM piloto captados vía landing en 90 días post-deploy | 0 | ≥ 3 correos entrantes | Bandeja de `felipe.carrasco.gr@ug.uchile.cl` filtrando por asunto "Interés en Piloto MediTriage" |

## 11. Preguntas abiertas

- ¿La organización "por defecto" para los datos preexistentes se llama `meditriage-piloto` o queremos ponerle el nombre del CESFAM real que ya está usando la app? Responsable: autor, antes de correr la migración 012.
- ¿El admin de plataforma es un rol nuevo o reutilizamos el rol `admin` sin `organization_id`? Este PRD asume reutilización.
- ¿En qué región de Vercel/Supabase quedará la producción para minimizar latencia desde Chile? Responsable: autor, antes del deploy.
- ¿Existe algún requerimiento legal específico del hospital piloto sobre residencia de datos (Chile vs. AWS us-east-1)? Responsable: autor + contraparte del piloto, antes de firmar el acuerdo.
