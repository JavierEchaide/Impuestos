import { randomInt } from "node:crypto";

/** Alfabeto sin caracteres ambiguos (sin 0/O, 1/l/I). */
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Contraseña temporal aleatoria legible: 4 grupos de 4, p. ej. "kT7m-Qx3p-a9Zc-RnH4". */
export function generateTempPassword(groups = 4, groupSize = 4): string {
  return Array.from({ length: groups }, () =>
    Array.from({ length: groupSize }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""),
  ).join("-");
}
