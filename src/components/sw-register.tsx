"use client";

import { useEffect } from "react";

/** Registra el service worker básico de la PWA (solo en producción). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sin service worker la app funciona igual, solo sin modo sin conexión.
    });
  }, []);
  return null;
}
