'use client';

import Link from 'next/link';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            {/* Hero Section */}
            <header className="relative overflow-hidden">
                {/* Animated background elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute top-60 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
                </div>

                <nav className="relative z-10 container mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-emerald-400 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                            </div>
                            <span className="text-2xl font-bold text-white">MediTriage</span>
                        </div>
                        <div className="hidden md:flex items-center gap-6 text-gray-300">
                            <a href="#como-funciona" className="hover:text-white transition-colors">Cómo Funciona</a>
                            <a href="#beneficios" className="hover:text-white transition-colors">Beneficios</a>
                            <a href="#futuro" className="hover:text-white transition-colors">Roadmap</a>
                            <Link href="/propuesta-piloto" className="hover:text-white transition-colors flex items-center gap-1">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                Piloto CESFAM
                            </Link>
                        </div>
                    </div>
                </nav>

                <div className="relative z-10 container mx-auto px-6 py-20 md:py-32">
                    <div className="max-w-4xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-2 mb-6">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            <span className="text-blue-200 text-sm font-medium">Sistema de Triage Inteligente</span>
                        </div>

                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                            Clasificación clínica{' '}
                            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                                potenciada por IA
                            </span>
                        </h1>

                        <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
                            MediTriage utiliza inteligencia artificial avanzada para clasificar pacientes
                            según el Índice de Severidad de Emergencia (ESI), optimizando tiempos de
                            atención y mejorando la eficiencia clínica.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href="/paciente"
                                className="group relative inline-flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Soy Paciente
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </Link>

                            <Link
                                href="/nurse"
                                className="group relative inline-flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-300 hover:scale-105"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                                Soy Enfermera
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Gradient divider */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900 to-transparent" />
            </header>

            {/* How it Works Section */}
            <section id="como-funciona" className="relative py-24 bg-slate-900">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            ¿Cómo Funciona?
                        </h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Un proceso simple y eficiente para clasificar pacientes utilizando IA
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {/* Step 1 */}
                        <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 hover:border-blue-500/50 transition-all duration-300">
                            <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/30">
                                1
                            </div>
                            <div className="mt-4">
                                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-3">Describe tus síntomas</h3>
                                <p className="text-gray-400 leading-relaxed">
                                    El paciente ingresa sus síntomas de forma natural, describiendo qué siente y desde cuándo.
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 hover:border-cyan-500/50 transition-all duration-300">
                            <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-cyan-500/30">
                                2
                            </div>
                            <div className="mt-4">
                                <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <svg className="w-7 h-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-3">La IA analiza</h3>
                                <p className="text-gray-400 leading-relaxed">
                                    Claude analiza los síntomas y asigna un nivel ESI (1-5) con razonamiento clínico detallado.
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 hover:border-emerald-500/50 transition-all duration-300">
                            <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/30">
                                3
                            </div>
                            <div className="mt-4">
                                <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-3">Enfermera valida</h3>
                                <p className="text-gray-400 leading-relaxed">
                                    El personal clínico revisa y valida la clasificación, pudiendo ajustarla si es necesario.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section id="beneficios" className="relative py-24 bg-gradient-to-b from-slate-900 to-slate-800">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Beneficios Clave
                        </h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Mejora la eficiencia clínica con tecnología de vanguardia
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                        {/* Metric Cards */}
                        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-2xl p-6 text-center">
                            <div className="text-4xl font-bold text-blue-400 mb-2">~3s</div>
                            <div className="text-gray-300 font-medium">Tiempo de Análisis</div>
                            <div className="text-gray-500 text-sm mt-1">IA en tiempo real</div>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-2xl p-6 text-center">
                            <div className="text-4xl font-bold text-emerald-400 mb-2">5</div>
                            <div className="text-gray-300 font-medium">Niveles ESI</div>
                            <div className="text-gray-500 text-sm mt-1">Clasificación estándar</div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-2xl p-6 text-center">
                            <div className="text-4xl font-bold text-purple-400 mb-2">24/7</div>
                            <div className="text-gray-300 font-medium">Disponibilidad</div>
                            <div className="text-gray-500 text-sm mt-1">Sin interrupciones</div>
                        </div>

                        <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-6 text-center">
                            <div className="text-4xl font-bold text-amber-400 mb-2">100%</div>
                            <div className="text-gray-300 font-medium">Trazabilidad</div>
                            <div className="text-gray-500 text-sm mt-1">FHIR compliant</div>
                        </div>
                    </div>

                    {/* Feature Grid */}
                    <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-12">
                        <div className="flex items-start gap-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">Privacidad Garantizada</h3>
                                <p className="text-gray-400 text-sm">Datos anónimos con códigos únicos. Sin información personal identificable.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">Análisis Clínico</h3>
                                <p className="text-gray-400 text-sm">Razonamiento médico detallado con identificación de signos críticos.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                            <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">Respuesta Inmediata</h3>
                                <p className="text-gray-400 text-sm">Clasificación en segundos sin esperas ni filas.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">Validación Profesional</h3>
                                <p className="text-gray-400 text-sm">Siempre supervisado por personal clínico calificado.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Future Roadmap Section */}
            <section id="futuro" className="relative py-24 bg-slate-800">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Escalabilidad Futura
                        </h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Funcionalidades planificadas para las próximas versiones
                        </p>
                    </div>

                    <div className="max-w-4xl mx-auto">
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-cyan-500 to-emerald-500 hidden md:block" />

                            {/* Timeline items */}
                            <div className="space-y-8">
                                <div className="relative flex items-start gap-6 md:gap-8">
                                    <div className="w-16 h-16 bg-blue-500/20 border-2 border-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0 z-10">
                                        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                    </div>
                                    <div className="bg-slate-700/50 border border-slate-600/50 rounded-2xl p-6 flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-medium rounded-full">Próximamente</span>
                                        </div>
                                        <h3 className="text-xl font-semibold text-white mb-2">Entrada por Voz</h3>
                                        <p className="text-gray-400">Integración con Whisper API para que pacientes puedan describir síntomas hablando en lugar de escribir.</p>
                                    </div>
                                </div>

                                <div className="relative flex items-start gap-6 md:gap-8">
                                    <div className="w-16 h-16 bg-cyan-500/20 border-2 border-cyan-500 rounded-2xl flex items-center justify-center flex-shrink-0 z-10">
                                        <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                    </div>
                                    <div className="bg-slate-700/50 border border-slate-600/50 rounded-2xl p-6 flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-medium rounded-full">Planificado</span>
                                        </div>
                                        <h3 className="text-xl font-semibold text-white mb-2">Alertas WhatsApp</h3>
                                        <p className="text-gray-400">Notificaciones automáticas al equipo médico para casos críticos (ESI 1-2) vía WhatsApp Business.</p>
                                    </div>
                                </div>

                                <div className="relative flex items-start gap-6 md:gap-8">
                                    <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-500 rounded-2xl flex items-center justify-center flex-shrink-0 z-10">
                                        <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    </div>
                                    <div className="bg-slate-700/50 border border-slate-600/50 rounded-2xl p-6 flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-medium rounded-full">Futuro</span>
                                        </div>
                                        <h3 className="text-xl font-semibold text-white mb-2">Dashboard Analytics</h3>
                                        <p className="text-gray-400">Panel de estadísticas para administradores con métricas de precisión IA vs enfermera, tiempos promedio y volumen.</p>
                                    </div>
                                </div>

                                <div className="relative flex items-start gap-6 md:gap-8">
                                    <div className="w-16 h-16 bg-purple-500/20 border-2 border-purple-500 rounded-2xl flex items-center justify-center flex-shrink-0 z-10">
                                        <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="bg-slate-700/50 border border-slate-600/50 rounded-2xl p-6 flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-medium rounded-full">Futuro</span>
                                        </div>
                                        <h3 className="text-xl font-semibold text-white mb-2">Multi-idioma</h3>
                                        <p className="text-gray-400">Soporte para español, inglés y mapudungun para atención inclusiva a comunidades originarias.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pilot Invitation Section for Directors */}
            <section id="piloto" className="relative py-24 bg-gradient-to-b from-slate-800 via-blue-900/30 to-slate-800">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl mx-auto">
                        <div className="relative bg-gradient-to-br from-emerald-900/40 to-slate-800/80 border border-emerald-500/30 rounded-3xl p-8 md:p-12 overflow-hidden">
                            {/* Decorative elements */}
                            <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
                            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />

                            <div className="relative z-10">
                                <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-4 py-2 mb-6">
                                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                    <span className="text-emerald-200 text-sm font-medium">Invitación Exclusiva para Directores de CESFAM/SAPU</span>
                                </div>

                                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                                    ¿Es usted Director/a de un Centro de Salud?
                                </h2>

                                <p className="text-gray-300 text-lg mb-8 max-w-2xl">
                                    Estamos buscando un centro partner para validar MediTriage en un piloto de 2 semanas.
                                    <strong className="text-white">Sin costo, sin riesgo operacional, y con reportes de gestión gratuitos.</strong>
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Link
                                        href="/propuesta-piloto"
                                        className="group inline-flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        Ver Propuesta Completa
                                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative py-24 bg-gradient-to-b from-slate-800 to-slate-900">
                <div className="container mx-auto px-6">
                    <div className="max-w-3xl mx-auto text-center">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                            Comienza Ahora
                        </h2>
                        <p className="text-gray-400 mb-10 text-lg">
                            Selecciona tu rol para acceder al sistema de triage inteligente
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href="/paciente"
                                className="group inline-flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold px-10 py-5 rounded-2xl transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 text-lg"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Acceder como Paciente
                            </Link>

                            <Link
                                href="/nurse"
                                className="group inline-flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold px-10 py-5 rounded-2xl transition-all duration-300 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 text-lg"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Acceder como Enfermera
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 border-t border-slate-800 py-12">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-emerald-400 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                            </div>
                            <span className="text-lg font-semibold text-white">MediTriage</span>
                        </div>

                        <div className="text-gray-500 text-sm text-center md:text-left">
                            Sistema de Auto-Triage con IA para CESFAM
                        </div>

                        <div className="text-gray-500 text-sm">
                            Desarrollado por Felipe Carrasco Grillo para Tesis de Magíster en Informática Médica Universidad de Chile • 2025
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
