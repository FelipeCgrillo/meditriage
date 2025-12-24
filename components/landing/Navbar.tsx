"use client";

import Link from "next/link";
import { Activity, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="container mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#0056b3]">
              <Activity className="h-7 w-7 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-gray-900">
                Sistema de Triage
              </span>
              <span className="text-xs text-gray-500">
                Atención Primaria de Salud
              </span>
            </div>
          </Link>
          
          <Link href="/nurse/dashboard">
            <Button
              variant="secondary"
              className="gap-2 text-gray-600 hover:bg-gray-100 flex items-center px-4 py-2"
            >
              <User className="h-4 w-4" />
              Acceso Funcionario
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

