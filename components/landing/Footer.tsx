"use client";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-8">
      <div className="container mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <p className="text-sm text-gray-600">
            Proyecto de Investigación - Magíster en Informática Médica
          </p>
          <p className="text-xs text-gray-500">
            Universidad de Chile © {new Date().getFullYear()}
          </p>
          <p className="mt-4 text-xs text-gray-400">
            Este sistema es una herramienta de apoyo. La clasificación final será validada por personal de enfermería.
          </p>
        </div>
      </div>
    </footer>
  );
}

