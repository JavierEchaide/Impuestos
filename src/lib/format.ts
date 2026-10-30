const TZ = "Europe/Madrid";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

/** "2026-10-30" -> "30 oct 2026". La fecha de un gasto es un día de calendario, sin zona horaria. */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(`${iso}T00:00:00Z`)).replace(/\./g, "");
}

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date).replace(/\./g, "");
}

/** Fecha de hoy (YYYY-MM-DD) en la hora de España. */
export function todayInMadrid(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(now);
}
