**UNIVERSIDAD DE CHILE**

**FACULTAD DE MEDICINA**

**ESCUELA DE POSTGRADO**

**PROGRAMA DE GRADOS ACADÉMICOS**

![Macintosh
HD:Users:mcerda:Desktop:logouchile.jpg](media/image1.png){width="0.91875in"
height="1.4097222222222223in"}

#### 

#### 

#### 

#### PROYECTO DE TESIS 

#### Programa de Magíster en Informática Médica

**Automatización del proceso de Triage, mejorando la priorización y
derivación de pacientes en centros de salud - una herramienta digital
basada en inteligencia artificial**

**Alumno:** Felipe Carrasco

**Director de Tesis:** Steffen Härtel

**Co-Directora de Tesis**: Sandra de la Fuente

**Profesor invitado:** Renato Pino

**Nota:**

+:--------------------------------------------------+:---------------------------------------------------+
| **........................................**      | **....................................**           |
|                                                   |                                                    |
| **Firma Director de Tesis**                       | **Firma Presidente Comité**                        |
|                                                   |                                                    |
| ![](media/image2.png){width="1.625320428696413in" | **Informática Médica**                             |
| height="0.6307688101487314in"}                    | ![](media/image3.png){width="1.4829046369203849in" |
|                                                   | height="1.4829046369203849in"}                     |
| **........................................**      |                                                    |
|                                                   | **....................................**           |
| **Firma Co-Directora de Tesis**                   |                                                    |
|                                                   | **Firma Prof. Invitado**                           |
+---------------------------------------------------+----------------------------------------------------+

**[Resumen]{.underline}**

El Triage es una herramienta fundamental para organizar la atención en
salud según la urgencia clínica (1). En Chile, se aplica principalmente
en servicios de urgencia mediante el Índice de Severidad de Emergencia
(ESI, *Emergency Severity Index*), pero su ejecución manual enfrenta
limitaciones ante la creciente demanda, tiempos de espera excesivos y la
falta de orientación temprana para los pacientes. Actualmente no existe
un sistema automatizado y accesible que permita realizar una primera
clasificación desde el hogar, lo que contribuye a la sobrecarga de los
servicios por consultas leves o la sub atención de casos complejos.

Este proyecto propone el diseño y la validación clínica inicial de una
herramienta digital de Triage basada en inteligencia artificial,
orientada a ser utilizada directamente por las personas a través de
celulares o computadores. El sistema permitirá analizar síntomas y
antecedentes entregados por el paciente, asignar una categoría ESI y
sugerir la acción más adecuada, ya sea acudir a urgencias, agendar
atención primaria o dar indicaciones para cuidado en domicilio.

Para validar su desempeño en esta tesis, el estudio se enfocará en
pacientes que acuden a centros de salud, permitiendo una comparación
directa de la categorización de la IA con el estándar profesional. Se
desarrollará un mecanismo para detectar datos clínicos faltantes y
generar preguntas automáticas , junto con una interfaz para que el
personal clínico clasifique los mismos casos sin conocer la categoría
asignada por IA. Esto permitirá validar la herramienta comparando
directamente sus resultados con los de enfermería, usando métricas como
el coeficiente Kappa y sensibilidad.

El método contempla cuatro fases: (i) análisis de flujos clínicos y
protocolos de Triage; (ii) definición del conjunto mínimo de datos
codificados con SNOMED CT y LOINC; (ii) implementación técnica de la
arquitectura del sistema; y (iv) validación clínica en escenarios
simulados y reales. Se espera que el sistema alcance una concordancia
≥85% con el Triage convencional. A futuro el sistema se podrá integrar
con plataformas de salud que operan con estándar HL7 FHIR, proyectando
su uso piloto en centros de salud de Coyhaique, evaluando la
factibilidad, impacto en tiempos de atención y la percepción de
pacientes y profesionales. Su escalamiento nacional permitiría integrar
esta solución con sistemas de agendamiento, telemedicina y dispositivos
de monitoreo remoto, mejorando el acceso oportuno a la atención y
optimizando el uso de recursos en salud (2).

**ÍNDICE**

[1 Introducción 4](#_heading=h.ow4akas421c)

> [1.1 Antecedentes 4](#_heading=h.x62sn6vg2e9s)
>
> [1.2 Problema 7](#_heading=h.wil2rbuhq3el)

[2 Hipótesis 9](#_heading=h.yxcfg4i12bvv)

[3 Objetivo general 10](#_heading=h.7r1yqxxrt6xd)

[4 Objetivos específicos 10](#_heading=h.hqesyzeoaqgd)

[5 Materiales y método 10](#_heading=h.35nv9fs96kij)

> [5.1 Diseño del estudio 10](#_heading=h.kogsxhkiaaqa)
>
> [5.2 Población y muestra 11](#_heading=h.go3fxnu9c9to)
>
> [5.3 Criterios de inclusión 11](#_heading=h.2pgwmgwtmuuw)
>
> [5.4 Criterios de exclusión 11](#_heading=h.1xmr2ibmgt36)
>
> [5.5 Método de selección 12](#_heading=h.mxu6subhoc1c)
>
> [5.6 Tamaño de la muestra 12](#_heading=h.pjd2kzgfrp4h)
>
> [5.7 Variables y mediciones 12](#_heading=h.lqh5qy8xnj1x)
>
> [5.8 Variables secundarias 12](#_heading=h.g9cyyt29upta)
>
> [5.9 Instrumentos 12](#_heading=h.906tukx6yjlw)
>
> [5.10 Escalas 12](#_heading=h.2nu7ko3b1rkn)
>
> [5.11 Recolección de datos 13](#_heading=h.njgrcmneh94y)
>
> [5.13 Consideraciones éticas 13](#_heading=h.358krtsn0fm)
>
> [5.14 Materiales utilizados 14](#_heading=h.e0u8su4arfyk)
>
> [5.15 Control de variables externas 14](#_heading=h.1q25iv2nnsxc)

[6 Resultados esperados y discusión 14](#_heading=h.3ar5hyjsxjpa)

[7 Bibliografía 16](#_heading=h.knsx4alnf6fm)

[8 Carta gantt 17](#_heading=h.z63v8cwg5sr5)

1.  []{#_heading=h.ow4akas421c .anchor}Introducción

    1.  []{#_heading=h.x62sn6vg2e9s .anchor}Antecedentes

El Triage (o "triaje" en español) consiste en clasificar a los pacientes
según la urgencia de atención que requieren, permitiendo que quienes
presentan condiciones críticas o tiempo-dependientes reciban atención
inmediata, mientras que los casos menos graves puedan esperar sin
riesgos mayores (3). Este concepto, que tuvo sus orígenes en contextos
militares y situaciones de catástrofe, se ha incorporado desde hace
décadas en hospitales de todo el mundo (4). En Chile, el Ministerio de
Salud (MINSAL) adoptó escalas estandarizadas de Triage a fines de 2010,
evolucionando hacia el modelo actual de cinco niveles conocido como ESI
(*Emergency Severity Index*) (5), utilizado en los principales servicios
de urgencia del país. Las categorías van desde Nivel I (resucitación
inmediata) hasta Nivel V (no urgente), y su aplicación ha contribuido a
priorizar la atención según la necesidad clínica de cada paciente.

Aun así, la demanda por atenciones de urgencia ha experimentado un alza
crítica, sobrecargando la red asistencial. Según cifras oficiales de la
Dirección de Presupuestos (DIPRES), sólo entre 2021 y 2022, las
atenciones de urgencia totales (hospitalarias y APS) en el sistema
público crecieron un 38,1%, pasando de 17,6 a 24,4 millones de
atenciones anuales. Este incremento, impulsado por el envejecimiento
poblacional, la cronicidad descompensada y los efectos post-pandemia,
tensiona al máximo los servicios. Esto ha generado congestión en los
servicios de urgencia, con tiempos de espera excesivos para pacientes
menos graves, y un riesgo de deterioro para aquellos en categorías
intermedias que no reciben atención a tiempo. En algunos centros se han
reportado incluso episodios de violencia de usuarios (6). Frente a esta
situación, han surgido iniciativas innovadoras como el piloto "Smart
Triage" implementado en 2023 en el Hospital de Quintero. Este proyecto
incorporó un módulo digital que mejoró la experiencia en la sala de
espera, desplegando pantallas con información en tiempo real, y apoyó al
personal de Triage con herramientas tecnológicas, incluyendo un sistema
de inteligencia artificial para sugerencias clínicas (7). Aunque su foco
estuvo más en la gestión y comunicación con el paciente, evidenció un
creciente interés por introducir la Inteligencia Artificial en las
decisiones clínicas.

En el nivel de Atención Primaria de Salud (APS), se ha comenzado a
explorar el concepto de TeleTriage, entendida como una pre-clasificación
remota antes de que el paciente llegue al centro de salud. Entre 2021 y
2022, la Universidad de Chile y la OPS/OMS pilotearon esta estrategia en
el Servicio de Salud Metropolitano Sur. El sistema permitía que el
usuario completará desde su hogar una solicitud en línea, la cual era
revisada posteriormente por un profesional clínico remoto que evaluaba
el caso, categorizaba la urgencia y ofrecía orientación o agendamiento
(8) según correspondiera. Los resultados iniciales fueron alentadores,
mostrando reducción en consultas innecesarias y mejor focalización de
los recursos disponibles (9). Sin embargo, el TeleTriage tradicional
requiere evaluación humana caso a caso, lo que limita su escalabilidad
en escenarios de alta demanda o disponibilidad restringida de
profesionales.

Frente a este panorama, la Inteligencia Artificial y las herramientas
digitales aparecen como una alternativa real para automatizar y escalar
el Triage clínico. Durante los últimos años han proliferado los llamados
"*Symptom Checkers*"^4^, plataformas en línea que permiten a los
pacientes describir sus síntomas y recibir orientación inmediata sobre
qué hacer o a qué nivel de atención acudir. Algunas redes de salud de
Estados Unidos, como *Sutter Health*, ya han integrado este tipo de
sistemas en sus portales institucionales (10). La pandemia de COVID-19
también aceleró el desarrollo de estas soluciones, que ayudaron a
reducir los contactos innecesarios y orientaron de forma remota a
millones de personas (11). Estos sistemas pueden operar mediante árboles
de decisión predefinidos o modelos de aprendizaje automático entrenados
con grandes volúmenes de datos clínicos. Ejemplos conocidos incluyen
Babylon Health, Ada y Buoy, junto con diversos proyectos académicos con
buenos resultados preliminares. Algunos algoritmos, como uno
desarrollado en Beijing con más de 270.000 registros reales, lograron
una precisión del 82,6% al clasificar pacientes en niveles de gravedad,
con curvas ROC superiores a 0,91.

No obstante, múltiples estudios han reportado falencias importantes en
estos sistemas. En el año 2015, se alertó sobre la baja precisión de
muchos *Symptom Checkers* en la recomendación del nivel de atención
(12). Una revisión sistemática más reciente, realizada en 2020, evaluó
22 aplicaciones utilizando casos clínicos estandarizados y encontró que
la precisión mediana apenas alcanzaba el 56%, sin mejoras sustantivas
respecto a cinco años antes (13). Además, algunos sistemas subestimaban
la gravedad de los casos: en más del 40% de las simulaciones con cuadros
graves, las herramientas entregaban indicaciones erróneas, recomendando
esperar o autocuidarse (14). Incluso los modelos de lenguaje más
avanzados hasta la fecha, como ChatGPT-4, han sido evaluados en
contextos de Triage y mostraron sensibilidad limitada para detectar
emergencias, lo que pone en duda su uso sin supervisión médica directa
(15). Por ello, la literatura especializada recomienda que estas
tecnologías se integren como apoyo a la toma de decisiones, manteniendo
el juicio clínico humano como elemento central (16), al menos mientras
se desarrollan mejores mecanismos de validación y seguridad.

Un segundo eje central para este tipo de soluciones es la
interoperabilidad. Si el sistema de Triage opera de forma aislada, puede
entregar recomendaciones al paciente sin resolver el problema de fondo:
acceder efectivamente a la atención sugerida. Por eso, es clave que
estos sistemas se integren con agendas médicas, historiales clínicos y
plataformas de atención remota. Aquí destaca el estándar internacional
HL7 FHIR, ampliamente utilizado para el intercambio de información
clínica estructurada mediante interfaces API. En Chile, tanto el MINSAL,
el CENS y el capítulo HL7 Chile (17), han impulsado activamente la
adopción de FHIR, existiendo múltiples iniciativas públicas y privadas
alineadas con este enfoque. La Ley 21.541 de Telemedicina (2023) y la
Ley 21.668 sobre Interoperabilidad del Registro Clínico (2024) refuerzan
este compromiso normativo (18). En el ámbito específico de agendamiento,
FHIR define recursos como *Appointment*, *Slot* y *ServiceRequest*, lo
que permitirá que un paciente categorizado como "urgencia menor" pueda
recibir automáticamente un enlace para agendar una hora médica según su
localización (19), generando de forma estructurada los datos clínicos
que el centro asistencial necesita para dar continuidad al proceso.

En resumen, los antecedentes revisados sugieren:

a)  Que existe una necesidad concreta de mejorar la priorización y
    derivación de pacientes en los niveles primario y secundario de
    atención, incorporando herramientas que permitan orientar desde el
    domicilio.

b)  Que la Inteligencia Artificial ofrece una oportunidad de digitalizar
    el Triage clínico, pero su uso requiere validaciones rigurosas,
    especialmente en el contexto chileno.

c)  Que la interoperabilidad con sistemas de salud es esencial para que
    las recomendaciones entregadas por el sistema puedan traducirse en
    acciones concretas dentro del flujo asistencial.

d)  Que la integración de estándares como HL7 FHIR, el soporte normativo
    nacional y la experiencia previa en salud digital posicionan a Chile
    como un entorno favorable para el desarrollo de este tipo de
    soluciones. No obstante, se deben tomar resguardos éticos, como
    prevenir sesgos algorítmicos, por ejemplo, el entrenamiento con
    datos no locales, garantizar inclusión, entrenando modelos con datos
    representativos y evaluando su desempeño en distintos subgrupos de
    pacientes.

    1.  []{#_heading=h.wil2rbuhq3el .anchor}Problema y propuesta

A pesar de los avances en la estandarización del Triage en Chile,
actualmente no existe un sistema automatizado y accesible directamente
al paciente que permita realizar una pre-clasificación clínica desde el
hogar. Frente a la aparición de síntomas agudos o una condición
inesperada, las personas deben decidir si acudir de inmediato a un
servicio de urgencia, esperar a consultar al día siguiente en un centro
de atención primaria o manejarse en casa. Esta decisión, que puede ser
crítica, suele depender del juicio subjetivo del paciente o su entorno,
y del acceso que tenga a la orientación médica. Esta saturación se
explica, en gran medida, por una demanda espontánea que no se
corresponde con la gravedad clínica. Estudios y reportes ministeriales
en Chile estiman que un alto porcentaje de las consultas en Unidades de
Emergencia Hospitalaria (UEH) son clasificadas como ESI 4 o ESI 5, es
decir, consultas de baja complejidad o no urgentes que podrían
resolverse eficientemente en la Atención Primaria (SAPU/SAR).

En la práctica, ante la falta de orientación, muchos optan por acudir al
hospital \"por si acaso\", contribuyendo a la congestión. En el extremo
opuesto, se subestima la gravedad de los síntomas y se posterga la
consulta. Esta falta de priorización temprana genera dos riesgos
clínicos: el sub-triage (paciente grave que espera demasiado) y el
sobre-triage (paciente leve que consume recursos de alta complejidad)

Paralelamente, los centros de atención primaria no siempre logran
absorber las consultas agudas con la celeridad necesaria. Con horarios
acotados y agendas sobrecargadas, la atención de urgencia en APS sigue
siendo limitada, incluso con la existencia de SAPU y SAR en horarios
extendidos. En muchos consultorios, los pacientes deben acudir temprano
y hacer fila para conseguir alguno de los escasos cupos disponibles para
urgencia, lo que no siempre se traduce en una atención priorizada según
necesidad clínica, sino más bien según orden de llegada.

En este escenario, se identifica una brecha clara: la falta de un
sistema digital autónomo, eficiente e interoperable, que permita
realizar Triage clínico inicial directamente por el paciente antes de
ingresar al sistema formal de salud. Esta carencia genera una serie de
sub-problemas específicos que afectan tanto la eficiencia como la
equidad en el acceso:

- **Sobreutilización de urgencias hospitalarias por casos de baja
  complejidad (Sobre-Triage):** Pacientes ESI 4 y 5 que, por falta de
  orientación, acuden a centros de alta complejidad, consumiendo
  recursos que no requieren y aumentando los tiempos de espera para
  casos graves.

- **Subutilización de niveles de atención adecuados:** pacientes que
  requerían atención urgente pueden restar importancia a sus síntomas y
  no buscar ayuda a tiempo, exponiéndose a complicaciones graves.

- **Falta de integración entre orientación y acción:** aunque existan
  canales de atención remota o recomendaciones generales, no hay un
  sistema que conecte esa indicación con la ejecución concreta (por
  ejemplo, agendar una hora).

- **Variabilidad y sesgo en la autoevaluación:** ciertos grupos, como
  adultos mayores que viven solos o personas con bajo nivel de
  alfabetización en salud, enfrentan mayor riesgo de error al decidir si
  consultar o no.

- **Desaprovechamiento de información clínica relevante:** los datos que
  se recogen en el Triage presencial (síntomas, signos de alarma,
  antecedentes) muchas veces no se registran de forma estructurada ni
  reutilizable, lo que impide una continuidad efectiva de la atención.

**Propuesta**

Este proyecto plantea que una herramienta de Triage automatizado basada
en inteligencia artificial, accesible vía aplicación web o móvil, podría
llenar ese vacío. El sistema permitiría que los propios pacientes
ingresen sus síntomas, antecedentes y datos clínicos básicos, para luego
recibir una clasificación de urgencia según criterios clínicos validados
y una recomendación clara sobre el curso de acción más adecuado (por
ejemplo, acudir al SAR más cercano, agendar con médico general,
consultar por telemedicina o mantenerse en control domiciliario). Esta
herramienta estaría diseñada para operar de manera universal y
descentralizada, sin depender de un centro específico, y se vincularía
al sistema de salud mediante interoperabilidad basada en el estándar HL7
FHIR.

Para que esta solución sea efectiva, debe estar integrada con los flujos
actuales de atención, particularmente con los sistemas de agendamiento y
derivación. Por ejemplo, si la Inteligencia Artificial determina que el
paciente debe consultar en 48 horas, la herramienta debería ofrecer la
posibilidad de concretar esa atención a través de un enlace directo a la
agenda del centro más cercano. Así, se cierra el ciclo entre orientación
y atención efectiva.

2.  []{#_heading=h.yxcfg4i12bvv .anchor}Hipótesis y objetivos

Hipótesis

Una herramienta digital de Triage automatizado, basada en inteligencia
artificial, accesible directamente al paciente y utilizada en el
contexto de la sala de espera de centros de salud, puede alcanzar una
concordancia (índice Kappa) ≥ 0,85 con el Triage realizado por
profesionales de enfermería, demostrando además una alta seguridad
clínica (tasa de sub-triage en casos de alta gravedad ESI 1-2 \< 5%)

[]{#_heading=h.7r1yqxxrt6xd .anchor}Objetivo general

Diseñar y evaluar de manera integral la concordancia, seguridad clínica
y aceptación de una herramienta digital basada en inteligencia
artificial, como apoyo a la estandarización del Triage médico inicial,
mejorando la priorización y derivación de pacientes en centros de salud.

[]{#_heading=h.hqesyzeoaqgd .anchor}Objetivos específicos

1.  Analizar y modelar los flujos clínicos y criterios médicos
    existentes en los procesos de Triage inicial, identificando
    variables clave y patrones clínicos relevantes para su
    digitalización y automatización.

2.  Definir y estructurar el conjunto mínimo de variables clínicas y
    operativas necesarias para la automatización del Triage,
    estableciendo reglas y condiciones lógicas que permitan la
    priorización de pacientes, incluyendo mecanismos para detectar datos
    faltantes y generar preguntas complementarias.

3.  Diseñar e implementar la arquitectura funcional de la herramienta
    digital, integrando servicios de inteligencia artificial mediante
    APIs previamente entrenadas.

4.  Evaluar integralmente el desempeño de la herramienta en el piloto
    clínico, mediante la validación de su concordancia (Índice Kappa)
    comparando la categorización de urgencia de la IA con la realizada
    por profesionales de enfermería, el análisis de su seguridad
    clínica, midiendo la tasa de sub-triage (subestimación de gravedad)
    en casos clasificados como ESI I y II por el estándar profesional y
    la medición de su aceptación y usabilidad por parte de los pacientes
    y el personal clínico, mediante encuestas de percepción.

<!-- -->

3.  []{#_heading=h.35nv9fs96kij .anchor}Materiales y método

    1.  []{#_heading=h.kogsxhkiaaqa .anchor}Diseño del estudio

El presente estudio es de tipo cuantitativo, descriptivo y analítico,
con un enfoque transversal, orientado a desarrollar y validar la
factibilidad operativa de una herramienta digital de Auto-Triage basada
en inteligencia artificial. La herramienta no reemplaza el Triage
clínico habitual, sino que se ejecuta en paralelo al Triage realizado
por personal profesional, permitiendo una comparación directa sin
alterar el flujo asistencial estándar.

El estudio se estructura en dos fases principales:

a)  Desarrollo e implementación de la herramienta digital, que incluye
    el diseño de la interfaz de usuario, la integración de un modelo de
    lenguaje IA (como GPT-4 o Med-PaLM) y reglas clínicas estructuradas,
    junto con conectores interoperables bajo estándar HL7 FHIR.

b)  Evaluación piloto en entornos reales (servicio de urgencia
    hospitalario y/o centros de APS), enfocada en validar la
    concordancia entre el Triage IA y el Triage humano, la sensibilidad
    para casos críticos y la aceptabilidad por parte de profesionales.

    1.  []{#_heading=h.go3fxnu9c9to .anchor}Población y muestra

La población de estudio corresponde a personas adultas (≥18 años) que
consultan de manera espontánea por motivos clínicos agudos no críticos
en centros de urgencia o atención primaria de la Región de Aysén, y que
aceptan utilizar la herramienta digital de Auto-Triage mientras se
encuentran en la sala de espera, previo a su atención profesional

2.  []{#_heading=h.2pgwmgwtmuuw .anchor}Criterios de inclusión

- Edad igual o superior a 18 años.

- Consulta espontánea por síntoma agudo.

- Estado de conciencia adecuado del paciente o acompañante para
  interactuar con la herramienta.

- Comprensión funcional del idioma español.

- Consentimiento informado otorgado voluntariamente.

  1.  []{#_heading=h.1xmr2ibmgt36 .anchor}Criterios de exclusión

<!-- -->

- Casos críticos clasificados como Nivel I.

- Urgencias de embarazos.

- Individuo presenta barrera idiomática sin acompañante o traductor
  disponible.

  1.  []{#_heading=h.mxu6subhoc1c .anchor}Método de selección

Muestreo **no probabilístico por conveniencia** con inclusión
consecutiva durante el periodo de estudio.

2.  []{#_heading=h.pjd2kzgfrp4h .anchor}Tamaño de la muestra

Se estiman 200-300 pacientes, basado en cálculos para estimar
concordancia (kappa esperado ≥0,8 con IC95%) y sensibilidad \>95% para
niveles ESI 1-2, lo que asegura potencia adecuada para evaluar métricas
principales.

3.  []{#_heading=h.lqh5qy8xnj1x .anchor}Variables y mediciones

**Variable principal:** Nivel de Triage asignado por la herramienta de
IA (escala ordinal de cinco niveles: I a V), comparado con la
categorización del Triage humano profesional (enfermero/a entrenado en
ESI).

4.  Variables secundarias

- Concordancia exacta y concordancia ±1 nivel.

<!-- -->

- Tasa de sobretriage y subtriage.

- Tiempo de clasificación IA vs humano (en minutos).

- Recomendación de nivel asistencial (urgencia / APS / autocuidado).

- Satisfacción del paciente y del profesional (mediante encuestas).

- Síntomas principales, edad, sexo.

  1.  []{#_heading=h.906tukx6yjlw .anchor}Instrumentos

<!-- -->

- Aplicación digital de Auto-Triage con cuestionario estructurado.

- Algoritmo híbrido de clasificación (modelo de lenguaje + reglas
  clínicas).

- Registro clínico institucional para obtener categoría ESI asignada por
  profesional.

- Cuestionarios de satisfacción (escala Likert).

  1.  []{#_heading=h.2nu7ko3b1rkn .anchor}Escalas

<!-- -->

- Escala ESI (*Emergency Severity Index*).

- Escala de dolor (0--10).

- Escalas Likert para evaluación de satisfacción.

- Escala de Glasgow (cuando corresponda).

  1.  []{#_heading=h.njgrcmneh94y .anchor}Recolección de datos

En la Figura 1 se presenta el diagrama BPMN que muestra el flujo de
ingreso, evaluación y clasificación de pacientes en el estudio de mejora
de priorización, el cual puede visualizarse de mejor manera en Anexo N°
1.

![A diagram of a flowchart AI-generated content may be
incorrect.](media/image4.png){width="6.097916666666666in"
height="3.4298611111111112in"}

*Figura 1. Flujo BPMN del estudio de comparación entre clasificación
automática y clasificación clínica (Elaboración propia).*

Representa el proceso completo de ingreso, evaluación y clasificación de
pacientes en el estudio de mejora de priorización. Incluye tres
pools/lane principales: Paciente, Enfermero/a y Sistema de Auto-Triage,
mostrando en paralelo la captura de síntomas por la aplicación y la
evaluación clínica humana. La salida del proceso es el registro de ambas
clasificaciones ESI (1--5) en la base de datos para su análisis
comparativo.

2.  Análisis de datos

- Estadística Descriptiva: Se calcularán medias, medianas, frecuencias e
  intervalos de confianza (IC95%) para las variables demográficas y
  clínicas.

- Análisis de Concordancia: Se construirá una matriz de confusión 5 x 5
  para comparar la clasificación ESI-IA contra la ESI-Humana. Se
  calculará la concordancia exacta, la concordancia ± 1 nivel, y el
  coeficiente Kappa de Cohen. Se considerará un valor Kappa ≥ 0,85 como
  indicador de concordancia \"casi perfecta\" (según Landis y Koch),
  umbral que justifica la robustez clínica del modelo frente al 56%
  reportado en *Symptom Checkers*.

- Análisis de Seguridad Clínica: Para evaluar el riesgo de sub-triage,
  se calculará la sensibilidad y el valor predictivo negativo (VPN) de
  la herramienta de IA para detectar correctamente los casos de alta
  gravedad (definidos como ESI 1 y 2 en el estándar de enfermería).

- Análisis de Percepción: Los datos de las encuestas de aceptación y
  usabilidad (escala Likert), aplicadas a pacientes y profesionales, se
  analizarán mediante estadística descriptiva para cada ítem
  (frecuencias, porcentajes y medianas)

- Variables Secundarias: La comparación de tiempos de clasificación (IA
  vs. humano) se realizará con t-test pareado o Wilcoxon, según la
  distribución de los datos.

  1.  []{#_heading=h.358krtsn0fm .anchor}Consideraciones éticas

El estudio se adhiere estrictamente a la normativa chilena vigente y a
los principios éticos de la investigación en seres humanos.

Proceso de Aprobación: Previo al inicio del reclutamiento de pacientes,
el protocolo de investigación, junto con los formularios de
Consentimiento Informado (para pacientes) y Asentimiento Informado (para
profesionales clínicos), será presentado para su revisión y aprobación
al Comité de Ética del Servicio de Salud Aysén (o, en su defecto, al
Comité de Ética de la Facultad de Medicina de la Universidad de Chile).
No se iniciará la recolección de datos hasta contar con dicha
aprobación.

Protección de Datos y Confidencialidad: Se garantizará la
confidencialidad de los participantes. El estudio cumplirá con:

- Ley 20.584: sobre derechos y deberes en salud.

- Ley 19.628: sobre protección de datos personales.

- Ley 21.668: sobre interoperabilidad del registro clínico.

El uso de la API de IA se limitará a datos clínicos anonimizados para
evitar la exposición de información sensible. Todos los datos
recolectados se almacenarán en una base de datos cifrada y solo el
equipo investigador tendrá acceso a ellos.

1.  []{#_heading=h.e0u8su4arfyk .anchor}Materiales utilizados

- Hardware: tablets o smartphones con conexión o PC de supervisión.

- Software: aplicación web (frontend React, backend Flask/Django), API
  IA (OpenAI GPT-4 / Med-PaLM), librerías HL7 FHIR, base de datos
  PostgreSQL o MongoDB, R Studio.

- Protocolos clínicos: manuales ESI, guías OPS, normativas MINSAL.

- Documentación: formularios, encuestas impresas o digitales.

- Seguridad: cifrado SSL, control de accesos, backup automático.

  1.  []{#_heading=h.1q25iv2nnsxc .anchor}Control de variables externas

<!-- -->

- **Cegamiento:** los profesionales clínicos desconocen la clasificación
  IA al momento de aplicar el triage.

- **Estandarización de procedimiento:** guiones únicos para la
  invitación y encuestas.

- **Muestreo y turnos:** reclutamiento consecutivo en distintos días y
  horarios, registro de motivos de exclusión y rechazos.

- **Sincronización IA-humano:** aplicación consecutiva en la misma
  sesión para minimizar variabilidad clínica.

- **Ambiente controlado:** monitoreo del entorno asistencial; suspensión
  del estudio en caso de emergencias colectivas.

4.  []{#_heading=h.3ar5hyjsxjpa .anchor}Resultados esperados y discusión

Se proyecta que este estudio genere **cuatro entregables principales**:

1.  Un **sistema funcional de triage automatizado** que opere en un
    entorno de prueba controlado, compuesto por una interfaz accesible
    al paciente, un motor de inferencia basado en IA y reglas clínicas,
    y conectores FHIR que aseguren su interoperabilidad con sistemas de
    salud.

2.  Un **conjunto de datos de validación clínica**, generado a partir de
    casos reales recolectados en centros de salud de la Región de Aysén
    u otra ciudad adecuada para el desempeño de la herramienta,
    acompañado de un análisis de desempeño que compara la clasificación
    entregada por la herramienta con la realizada por profesionales,
    utilizando métricas como concordancia exacta, coeficiente Kappa,
    sensibilidad, especificidad y tasas de sobre/subTriage.

3.  Una **evaluación de factibilidad operativa y aceptación del
    sistema**, basada en encuestas Likert a pacientes y profesionales,
    observaciones del equipo clínico y análisis de la experiencia
    usuaria durante el piloto, con especial foco en satisfacción,
    claridad de las recomendaciones y utilidad clínica percibida.

4.  Un **informe de viabilidad técnica y de escalamiento**, que analice
    la factibilidad de integración del sistema con plataformas de
    agendamiento reales vía HL7 FHIR, su alineación con la Estrategia
    Nacional de Salud Digital y los marcos regulatorios vigentes (Leyes
    21.541, 21.668), así como su potencial replicabilidad en otros
    territorios.

En cuanto al desempeño clínico esperado, se busca que la herramienta
alcance una concordancia elevada con el Triage estándar realizado por
personal de enfermería, idealmente un índice Kappa el cual se plantea
una exactitud global (accuracy) ≥80%, superior al rendimiento promedio
observado en Symptom Checkers actuales (55--60%).

Desde una perspectiva operativa, el sistema busca reducir el tiempo de
clasificación, permitiendo que el paciente complete el Auto-Triage en
menos de 5 minutos desde su hogar o sala de espera. Esto permitiría al
centro de salud recibir al paciente con datos pre-cargados (síntomas,
signos de alarma, comorbilidades), lo que podría acortar la atención
inicial y mejorar la continuidad del flujo clínico.

Se anticipa una buena aceptación por parte de los usuarios,
especialmente si la herramienta entrega un plan concreto y gestiona
efectivamente la cita médica. No obstante, se reconocen desafíos
relacionados con la confianza en las recomendaciones, la adopción por
parte del personal clínico y la necesidad de capacitaciones
complementarias.

Asimismo, se identifican riesgos potenciales que incluyen sesgos por
entrenamiento con datos no locales, la necesidad de mantener y
actualizar continuamente los modelos, y aspectos ético-legales
relacionados con la responsabilidad clínica y el uso de inteligencia
artificial.

Si la hipótesis del estudio se cumple, se habrá demostrado que un
sistema de Triage automatizado, accesible directamente al paciente,
puede integrarse de forma efectiva al sistema sanitario, contribuyendo a
mejorar la eficiencia, la seguridad clínica y el acceso oportuno,
aportando el avance de la transformación digital en salud.

5.  []{#_heading=h.knsx4alnf6fm .anchor}Bibliografía

+---+-----:+----------------------------------------------------------------------------+----------------------------------------------------------------------------+
|   | 1\.  | Iserson, K. V., & Moskop, J. C. (2007). Triage in medicine, Part I: Concept, history, and types. *Annals of Emergency Medicine, 49*(3), 275--281.       |
|   |      | https://doi.org/10.1016/j.annemergmed.2006.05.019                                                                                                       |
+---+------+----------------------------------------------------------------------------+----------------------------------------------------------------------------+
| 2\.                                                                                   | Salud OMdl. Informe Global sobre Estrategia Digital de Salud 2020--2025    |
|                                                                                       | (OMS). Ginebra: OMS. 2021.                                                 |
+---+------+----------------------------------------------------------------------------+----------------------------------------------------------------------------+
|   | 3\.  | Posadas Martínez, M. L., Pagoto, V., Grande Ratti, M. F., Alfie, V., Andresik, D., Torres Gómez, F., Giunta, D. H., Luxardo, R., Scolnik, M., &         |
|   |      | Vázquez, F. J. (2020). Medición del subtriaje como indicador de calidad y seguridad en un servicio de urgencias. *Revista Médica de Chile, 148*(5),     |
|   |      | 602--610. https://doi.org/10.4067/S0034-98872020000500602                                                                                               |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 4\.  | Gargantilla Madera, P., & Martín Cabrejas, B. M. (2019). Los orígenes militares del triaje. *Emergencias, 31*(3), 205--206.                             |
|   |      | https://revistaemergencias.org/wp-content/uploads/2023/09/Emergencias-2019_31_3_205-506-506_eng.pdf                                                     |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 5\.  | Correa-Sepúlveda, H., Vega Pinochet, H., & Medina Giacomozzi, A. (2021). Categorización de las urgencias gineco-obstétricas en un hospital público de   |
|   |      | Chile. *Revista Chilena de Obstetricia y Ginecología, 86*(2), 152--162. https://doi.org/10.4067/S0717-75262021000200152                                 |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 6\.  | Pro Salud Chile. (2023, agosto 10). Hospital de Quintero lanzó pilotaje de solución digital para disminuir malestar de los usuarios en el servicio de   |
|   |      | urgencias. *ProSalud Chile*.                                                                                                                            |
|   |      | https://prosaludchile.cl/hospital-de-quintero-lanzo-pilotaje-de-solucion-digital-para-disminuir-malestar-de-los-usuarios-en-el-servicio-de-urgencias    |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 7\.  | Sistemas Públicos. (s. f.). *Smart Triage del servicio de urgencia del Hospital de Quintero*.                                                           |
|   |      | https://sistemaspublicos.tech/smart-triage-del-servicio-de-urgencia-del-hospital-de-quintero                                                            |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 8\.  | Organización Panamericana de la Salud. (2021, 31 de agosto). Proyecto Teletriage en Chile: Tecnología al servicio de la atención de salud en tiempos de |
|   |      | pandemia. *OPS*. https://www.paho.org/es/noticias/31-8-2021-proyecto-teletriage-chile-tecnologia-al-servicio-atencion-salud-tiempos-pandemia            |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 9\.  | Organización Panamericana de la Salud. (2021, 27 de diciembre). Resultados del proyecto Teletriage 2021: Casi cien mil solicitudes de atención de salud |
|   |      | se recibieron a través del sistema digital. *OPS*.                                                                                                      |
|   |      | https://www.paho.org/es/noticias/27-12-2021-resultados-proyecto-teletriage-2021-casi-cien-mil-solicitudes-atencion-salud-se                             |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 10\. | Sutter Health. (2019, 11 de febrero). Sutter Health teams up with Ada Health to deliver on-demand healthcare guidance. *Vitals*.                        |
|   |      | https://vitals.sutterhealth.org/sutter-health-teams-up-with-ada-health-to-improve-patient-care-by-delivering-on-demand-healthcare-guidance              |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 11\. | Pearce, N. P., Holzmann, N., Blacker, K., & Wessels, A. (2022). The diagnostic and triage accuracy of digital and online symptom checker tools: A       |
|   |      | systematic review. *NPJ Digital Medicine, 5*(88). https://doi.org/10.1038/s41746-022-00661-w                                                            |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 12\. | Huesch, M. D., & Mosher, T. J. (2015). Using it or losing it? The case for symptom checkers. *BMJ, 351*, h3480. https://doi.org/10.1136/bmj.h3480       |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 13\. | Semigran, H. L., Levine, D. M., Nundy, S., & Mehrotra, A. (2022). Triage accuracy of symptom checker apps: 5-year follow-up evaluation. *Journal of     |
|   |      | Medical Internet Research, 24*(5), e31410. https://doi.org/10.2196/31410                                                                                |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 14\. | Schmieding, M. J., Jankowski, J., Latz, T., & Bartscherer, M. (2022). Evaluation of symptom checker apps: Accuracy of triage and diagnosis -- 5-year    |
|   |      | update. *Journal of Medical Internet Research, 24*(5), e31410. https://doi.org/10.2196/31410                                                            |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 15\. | Al-Zahawi, A., et al. (2025). Chat-GPT in triage: Still far from surpassing human expertise -- An observational study. *American Journal of Emergency   |
|   |      | Medicine, 92*. \[En prensa, sin DOI confirmado\]                                                                                                        |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 16\. | Ministerio de Salud de Chile. (2021). *Especificación de arquitectura e interoperabilidad -- Estándares y perfiles (Salud Digital)*. Ministerio de      |
|   |      | Salud, Gobierno de Chile. https://interoperabilidad.minsal.cl/                                                                                          |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 17\. | Gobierno de Chile. (2025). Chile destaca en el informe global sobre la adopción del estándar FHIR 2025. *Gobierno de Chile*. \[Fuente de prensa; sin    |
|   |      | URL oficial disponible\]                                                                                                                                |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 18\. | HL7 International. (2019). *FHIR Release 4.0.1: Scheduling module*. HL7 International. https://hl7.org/fhir/scheduling.html                             |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 19\. | Landis, J. R., & Koch, G. G. (1977). The measurement of observer agreement for categorical data. *Biometrics, 33*(1), 159--174.                         |
|   |      | [[https://doi.org/10.2307/2529310]{.underline}](https://doi.org/10.2307/2529310)                                                                        |
+---+------+---------------------------------------------------------------------------------------------------------------------------------------------------------+
|   | 20\. | Organización Mundial de la Salud. (2021). *Informe global sobre estrategia digital de salud 2020--2025*. OMS.                                           |
|   |      | [[www.who.int/publications/i/item/9789240020924]{.underline}](https://www.who.int/publications/i/item/9789240020924)                                    |
+---+------+----------------------------------------------------------------------------+----------------------------------------------------------------------------+
|   |      |                                                                            |                                                                            |
+---+------+----------------------------------------------------------------------------+----------------------------------------------------------------------------+

6.  []{#_heading=h.z63v8cwg5sr5 .anchor}Carta gantt

> Según Anexo N° 2.

**Anexo N° 1** "Flujo BPMN del estudio de comparación de proceso de
Auto-Triage versus Triage humano"

![A diagram of a flowchart AI-generated content may be
incorrect.](media/image4.png){width="9.528472222222222in"
height="5.3590277777777775in"}

**Anexo N° 2** "Carta gantt"

![](media/image5.emf){width="10.83586176727909in"
height="3.796496062992126in"}
