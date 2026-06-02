'use client';

import Link from 'next/link';

/**
 * Landing page — rediseño editorial.
 *
 * Filosofía: este es un proyecto de investigación clínica en la Universidad
 * de Chile, no un producto SaaS genérico. La paleta original (azul oscuro
 * saturado, gradientes cian-esmeralda, glows, glassmorphism, íconos SVG
 * decorativos, pulsos animados) se asociaba a estética genérica de IA y no
 * comunicaba seriedad institucional ni rigor metodológico.
 *
 * Esta versión adopta una dirección editorial inspirada en publicaciones
 * académicas y revistas clínicas: papel marfil, tipografía serif para
 * el display, jerarquía clara, un único color de acento (Hydra Teal), nada
 * de íconos, nada de gradientes, nada de animaciones decorativas. Las
 * transiciones son únicamente funcionales (hover de enlaces y botones).
 */
const sty = {
    body: 'font-[\'Inter\',sans-serif]',
    display: "font-['Instrument_Serif',serif]",
};

export default function LandingPage() {
    return (
        <div className={`min-h-screen bg-[#F7F6F2] text-[#28251D] ${sty.body} selection:bg-[#01696F]/15`}>
            {/* ─── Topbar institucional ─── */}
            <header className="border-b border-[#D4D1CA]">
                <div className="max-w-6xl mx-auto px-6 lg:px-10 py-5 flex items-center justify-between">
                    <Link href="/" className="flex items-baseline gap-3">
                        <span className={`${sty.display} text-2xl tracking-tight text-[#28251D]`}>MediTriage</span>
                        <span className="hidden sm:inline text-xs uppercase tracking-[0.18em] text-[#7A7974]">
                            Tesis · Universidad de Chile
                        </span>
                    </Link>
                    <nav className="hidden md:flex items-center gap-8 text-sm">
                        <a href="#metodo" className="text-[#28251D] hover:text-[#01696F] transition-colors">
                            Método
                        </a>
                        <a href="#estudio" className="text-[#28251D] hover:text-[#01696F] transition-colors">
                            Estudio
                        </a>
                        <Link href="/propuesta-piloto" className="text-[#28251D] hover:text-[#01696F] transition-colors">
                            Piloto CESFAM
                        </Link>
                        <Link
                            href="/login/resultados"
                            className="text-[#01696F] hover:text-[#0C4E54] underline underline-offset-4 decoration-[#01696F]/40 hover:decoration-[#01696F] transition-colors"
                        >
                            Panel investigador
                        </Link>
                    </nav>
                </div>
            </header>

            {/* ─── Hero editorial ─── */}
            <section className="border-b border-[#D4D1CA]">
                <div className="max-w-6xl mx-auto px-6 lg:px-10 pt-20 pb-24 lg:pt-28 lg:pb-32 grid lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-8">
                        <p className="text-xs uppercase tracking-[0.22em] text-[#7A7974] mb-8">
                            Investigación clínica · Magíster en Informática Médica
                        </p>
                        <h1
                            className={`${sty.display} text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-[#28251D]`}
                        >
                            Apoyo a la decisión clínica en triage de urgencia,
                            <span className="italic"> evaluado con el rigor</span> de un
                            estudio piloto.
                        </h1>
                        <p className="mt-8 text-lg leading-relaxed text-[#28251D]/85 max-w-2xl">
                            MediTriage clasifica consultas de urgencia según el Índice de Severidad de
                            Emergencia (ESI). El sistema entrega su propuesta a la enfermera profesional,
                            quien valida o ajusta la categoría. El acuerdo entre ambas decisiones se evalúa
                            con el coeficiente Kappa de Cohen ponderado.
                        </p>

                        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
                            <Link
                                href="/paciente"
                                className="inline-flex items-center gap-3 bg-[#01696F] hover:bg-[#0C4E54] text-white text-sm font-medium px-6 py-3.5 rounded-sm transition-colors"
                            >
                                Acceso del paciente
                                <span aria-hidden="true" className="text-base leading-none">›</span>
                            </Link>
                            <Link
                                href="/login/nurse"
                                className="inline-flex items-center gap-3 text-sm font-medium text-[#28251D] hover:text-[#01696F] underline underline-offset-4 decoration-[#28251D]/30 hover:decoration-[#01696F] transition-colors"
                            >
                                Acceso de enfermería
                                <span aria-hidden="true" className="text-base leading-none">›</span>
                            </Link>
                        </div>
                    </div>

                    {/* Bloque lateral: cita corta */}
                    <aside className="lg:col-span-4 lg:border-l lg:border-[#D4D1CA] lg:pl-10 flex items-center">
                        <blockquote className="text-[#28251D]/80">
                            <p className={`${sty.display} text-2xl leading-snug italic`}>
                                «El objetivo no es reemplazar el juicio clínico, sino documentarlo, hacerlo
                                comparable y abrir la decisión a auditoría.»
                            </p>
                            <footer className="mt-5 text-xs uppercase tracking-[0.18em] text-[#7A7974]">
                                Marco de la investigación
                            </footer>
                        </blockquote>
                    </aside>
                </div>
            </section>

            {/* ─── Método (numerado, editorial, sin íconos) ─── */}
            <section id="metodo" className="border-b border-[#D4D1CA]">
                <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
                    <div className="grid lg:grid-cols-12 gap-10 mb-14">
                        <div className="lg:col-span-4">
                            <p className="text-xs uppercase tracking-[0.22em] text-[#7A7974] mb-4">Método</p>
                            <h2 className={`${sty.display} text-4xl lg:text-5xl leading-[1.1] tracking-tight`}>
                                Tres pasos para una decisión documentada.
                            </h2>
                        </div>
                        <p className="lg:col-span-7 lg:col-start-6 text-[#28251D]/75 text-base leading-relaxed">
                            El flujo está diseñado para preservar la responsabilidad clínica: el sistema
                            propone, el profesional valida. Cada interacción queda registrada como recurso
                            FHIR R4 y es trazable para auditoría posterior.
                        </p>
                    </div>

                    <ol className="grid md:grid-cols-3 gap-0 border-t border-[#D4D1CA]">
                        {[
                            {
                                n: '01',
                                titulo: 'Relato del paciente',
                                texto: 'La persona describe síntomas, duración y antecedentes en lenguaje natural. No se pregunta nombre ni RUT en esta etapa.',
                            },
                            {
                                n: '02',
                                titulo: 'Propuesta del sistema',
                                texto: 'El modelo clasifica la consulta en uno de los cinco niveles ESI y expone su razonamiento, los recursos previstos y las banderas rojas detectadas.',
                            },
                            {
                                n: '03',
                                titulo: 'Validación de enfermería',
                                texto: 'La enfermera revisa la propuesta a ciegas, ajusta el nivel si corresponde y registra la decisión final. Esta es la categoría que rige la atención.',
                            },
                        ].map((paso) => (
                            <li
                                key={paso.n}
                                className="border-b border-[#D4D1CA] md:border-b-0 md:border-r last:md:border-r-0 py-10 md:py-12 md:px-8 first:md:pl-0 last:md:pr-0"
                            >
                                <div className={`${sty.display} text-5xl text-[#01696F] mb-6`}>{paso.n}</div>
                                <h3 className="text-lg font-semibold text-[#28251D] mb-3">{paso.titulo}</h3>
                                <p className="text-[#28251D]/75 leading-relaxed text-[15px]">{paso.texto}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* ─── Cifras del estudio (sobrias, tipográficas) ─── */}
            <section id="estudio" className="border-b border-[#D4D1CA]">
                <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
                    <div className="grid lg:grid-cols-12 gap-10 mb-12">
                        <div className="lg:col-span-5">
                            <p className="text-xs uppercase tracking-[0.22em] text-[#7A7974] mb-4">
                                Estudio piloto
                            </p>
                            <h2 className={`${sty.display} text-4xl lg:text-5xl leading-[1.1] tracking-tight`}>
                                Una hipótesis, dos vías de evidencia.
                            </h2>
                        </div>
                        <p className="lg:col-span-6 lg:col-start-7 text-[#28251D]/75 text-base leading-relaxed">
                            El protocolo contempla un diseño prospectivo en vivo y un diseño retrospectivo
                            sobre Datos de Atención de Urgencia (DAU). Ambos comparten hipótesis (κ ≥ 0,85),
                            tamaño muestral y aparato estadístico; la elección operativa depende de la
                            autorización del Comité Ético Científico.
                        </p>
                    </div>

                    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10 border-t border-[#D4D1CA] pt-10">
                        {[
                            { k: '230–300', l: 'Pacientes estimados', sub: 'fórmula de Donner, α 0,05' },
                            { k: '5', l: 'Niveles ESI', sub: 'estándar v4 de referencia' },
                            { k: '≥ 0,85', l: 'Kappa esperado', sub: 'acuerdo casi perfecto' },
                            { k: 'FHIR R4', l: 'Recursos clínicos', sub: '100% conformidad HL7' },
                        ].map((item) => (
                            <div key={item.l}>
                                <dt className={`${sty.display} text-5xl lg:text-6xl text-[#28251D] leading-none mb-3 tabular-nums`}>
                                    {item.k}
                                </dt>
                                <dd className="text-sm text-[#28251D] font-medium">{item.l}</dd>
                                <dd className="text-xs text-[#7A7974] mt-1">{item.sub}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            {/* ─── Cierre / accesos secundarios ─── */}
            <section>
                <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
                    <div className="grid lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-7">
                            <p className="text-xs uppercase tracking-[0.22em] text-[#7A7974] mb-4">Accesos</p>
                            <h2 className={`${sty.display} text-4xl lg:text-5xl leading-[1.1] tracking-tight mb-6`}>
                                Selecciona tu rol para continuar.
                            </h2>
                            <p className="text-[#28251D]/75 max-w-xl leading-relaxed">
                                El acceso de enfermería y el panel del investigador requieren credenciales
                                emitidas para el estudio. El flujo del paciente es público y anonimizado.
                            </p>
                        </div>

                        <ul className="lg:col-span-5 divide-y divide-[#D4D1CA] border-t border-b border-[#D4D1CA]">
                            <li>
                                <Link
                                    href="/paciente"
                                    className="group flex items-baseline justify-between py-5 hover:text-[#01696F] transition-colors"
                                >
                                    <span className="flex items-baseline gap-4">
                                        <span className="text-xs tabular-nums text-[#7A7974] group-hover:text-[#01696F]">
                                            01
                                        </span>
                                        <span className="text-base font-medium">Iniciar consulta como paciente</span>
                                    </span>
                                    <span aria-hidden="true" className="text-lg leading-none">→</span>
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/login/nurse"
                                    className="group flex items-baseline justify-between py-5 hover:text-[#01696F] transition-colors"
                                >
                                    <span className="flex items-baseline gap-4">
                                        <span className="text-xs tabular-nums text-[#7A7974] group-hover:text-[#01696F]">
                                            02
                                        </span>
                                        <span className="text-base font-medium">Ingresar como enfermería</span>
                                    </span>
                                    <span aria-hidden="true" className="text-lg leading-none">→</span>
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/login/resultados"
                                    className="group flex items-baseline justify-between py-5 hover:text-[#01696F] transition-colors"
                                >
                                    <span className="flex items-baseline gap-4">
                                        <span className="text-xs tabular-nums text-[#7A7974] group-hover:text-[#01696F]">
                                            03
                                        </span>
                                        <span className="text-base font-medium">Panel del investigador</span>
                                    </span>
                                    <span aria-hidden="true" className="text-lg leading-none">→</span>
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/propuesta-piloto"
                                    className="group flex items-baseline justify-between py-5 hover:text-[#01696F] transition-colors"
                                >
                                    <span className="flex items-baseline gap-4">
                                        <span className="text-xs tabular-nums text-[#7A7974] group-hover:text-[#01696F]">
                                            04
                                        </span>
                                        <span className="text-base font-medium">Propuesta del piloto CESFAM</span>
                                    </span>
                                    <span aria-hidden="true" className="text-lg leading-none">→</span>
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* ─── Pie de página ─── */}
            <footer className="border-t border-[#D4D1CA] bg-[#F9F8F5]">
                <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <p className={`${sty.display} text-xl text-[#28251D]`}>MediTriage</p>
                        <p className="text-xs text-[#7A7974] mt-1">
                            Tesis de Magíster en Informática Médica · Universidad de Chile · 2026
                        </p>
                    </div>
                    <p className="text-xs text-[#7A7974] md:text-right max-w-sm leading-relaxed">
                        Sistema de apoyo a la decisión clínica para triage de urgencia. Las clasificaciones
                        del sistema no constituyen indicación médica y deben ser validadas por personal
                        clínico habilitado.
                    </p>
                </div>
            </footer>
        </div>
    );
}
