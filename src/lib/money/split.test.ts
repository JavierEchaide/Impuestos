import { describe, expect, it } from "vitest";
import { SplitError, allocateByWeights, computeSplit } from "./split";

const sum = (parts: { amountCents: number }[]) =>
  parts.reduce((acc, p) => acc + p.amountCents, 0);
const ids = (...names: string[]) => names.map((userId) => ({ userId }));
const amountsOf = (parts: { userId: string; amountCents: number }[]) =>
  Object.fromEntries(parts.map((p) => [p.userId, p.amountCents]));

describe("reparto a partes iguales", () => {
  it("divide exactamente cuando no hay resto", () => {
    const parts = computeSplit(1200, "equal", ids("a", "b", "c", "d"));
    expect(parts.map((p) => p.amountCents)).toEqual([300, 300, 300, 300]);
  });

  it("reparte el resto de céntimos y la suma es exacta (100 / 3)", () => {
    const parts = computeSplit(100, "equal", ids("a", "b", "c"));
    expect(sum(parts)).toBe(100);
    expect(parts.map((p) => p.amountCents).sort()).toEqual([33, 33, 34]);
  });

  it("1 céntimo entre 5 personas: solo una recibe el céntimo", () => {
    const parts = computeSplit(1, "equal", ids("a", "b", "c", "d", "e"));
    expect(sum(parts)).toBe(1);
    expect(parts.filter((p) => p.amountCents === 1)).toHaveLength(1);
  });

  it("la suma siempre coincide con el total para muchos casos", () => {
    for (let total = 0; total <= 250; total++) {
      for (let n = 1; n <= 7; n++) {
        const people = ids(...Array.from({ length: n }, (_, i) => `u${i}`));
        const parts = computeSplit(total, "equal", people, `exp-${total}-${n}`);
        expect(sum(parts)).toBe(total);
        const amounts = parts.map((p) => p.amountCents);
        expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("es determinista y no depende del orden de entrada", () => {
    const a = computeSplit(1000, "equal", ids("c", "a", "b"), "gasto-1");
    const b = computeSplit(1000, "equal", ids("b", "c", "a"), "gasto-1");
    expect(amountsOf(a)).toEqual(amountsOf(b));
    expect(computeSplit(1000, "equal", ids("a", "b", "c"), "gasto-1")).toEqual(
      computeSplit(1000, "equal", ids("a", "b", "c"), "gasto-1"),
    );
  });

  it("la semilla rota quién recibe el céntimo sobrante", () => {
    const winners = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const parts = computeSplit(100, "equal", ids("a", "b", "c"), `gasto-${i}`);
      winners.add(parts.find((p) => p.amountCents === 34)!.userId);
    }
    expect(winners.size).toBe(3);
  });

  it("sin semilla el extra va siempre al primer id (orden canónico)", () => {
    const parts = computeSplit(100, "equal", ids("b", "a", "c"));
    expect(amountsOf(parts)).toEqual({ a: 34, b: 33, c: 33 });
  });
});

describe("reparto por importes exactos", () => {
  it("respeta los importes cuando suman el total", () => {
    const parts = computeSplit(1000, "exact", [
      { userId: "a", value: 250 },
      { userId: "b", value: 750 },
    ]);
    expect(amountsOf(parts)).toEqual({ a: 250, b: 750 });
  });

  it("rechaza importes que no suman el total", () => {
    expect(() =>
      computeSplit(1000, "exact", [
        { userId: "a", value: 250 },
        { userId: "b", value: 700 },
      ]),
    ).toThrowError(expect.objectContaining({ code: "EXACT_SUM_MISMATCH" }));
  });

  it("acepta una persona con 0 € si el resto suma el total", () => {
    const parts = computeSplit(500, "exact", [
      { userId: "a", value: 0 },
      { userId: "b", value: 500 },
    ]);
    expect(amountsOf(parts)).toEqual({ a: 0, b: 500 });
  });
});

describe("reparto por porcentajes", () => {
  it("50/30/20 sobre 10 €", () => {
    const parts = computeSplit(1000, "percent", [
      { userId: "a", value: 5000 },
      { userId: "b", value: 3000 },
      { userId: "c", value: 2000 },
    ]);
    expect(amountsOf(parts)).toEqual({ a: 500, b: 300, c: 200 });
  });

  it("33,33 / 33,33 / 33,34 reparte el resto sin perder céntimos", () => {
    const parts = computeSplit(1000, "percent", [
      { userId: "a", value: 3333 },
      { userId: "b", value: 3333 },
      { userId: "c", value: 3334 },
    ]);
    expect(sum(parts)).toBe(1000);
    expect(amountsOf(parts)).toEqual({ a: 333, b: 333, c: 334 });
  });

  it("rechaza porcentajes que no suman 100 %", () => {
    expect(() =>
      computeSplit(1000, "percent", [
        { userId: "a", value: 5000 },
        { userId: "b", value: 4999 },
      ]),
    ).toThrowError(expect.objectContaining({ code: "PERCENT_SUM_MISMATCH" }));
  });

  it("un 0 % no recibe nada ni siquiera del resto", () => {
    const parts = computeSplit(101, "percent", [
      { userId: "a", value: 5000 },
      { userId: "b", value: 5000 },
      { userId: "c", value: 0 },
    ]);
    expect(sum(parts)).toBe(101);
    expect(amountsOf(parts).c).toBe(0);
  });
});

describe("reparto por participaciones", () => {
  it("1 : 2 : 3 sobre 12 €", () => {
    const parts = computeSplit(1200, "shares", [
      { userId: "a", value: 100 },
      { userId: "b", value: 200 },
      { userId: "c", value: 300 },
    ]);
    expect(amountsOf(parts)).toEqual({ a: 200, b: 400, c: 600 });
  });

  it("admite participaciones decimales (1,5 : 1)", () => {
    const parts = computeSplit(1000, "shares", [
      { userId: "a", value: 150 },
      { userId: "b", value: 100 },
    ]);
    expect(amountsOf(parts)).toEqual({ a: 600, b: 400 });
  });

  it("reparte restos: 100 céntimos con pesos 1:1:1", () => {
    const parts = computeSplit(100, "shares", [
      { userId: "a", value: 100 },
      { userId: "b", value: 100 },
      { userId: "c", value: 100 },
    ]);
    expect(sum(parts)).toBe(100);
  });

  it("rechaza pesos que suman cero", () => {
    expect(() =>
      computeSplit(100, "shares", [
        { userId: "a", value: 0 },
        { userId: "b", value: 0 },
      ]),
    ).toThrowError(expect.objectContaining({ code: "ZERO_WEIGHT" }));
  });
});

describe("casos límite", () => {
  it("importe 0: todas las partes son 0", () => {
    const parts = computeSplit(0, "equal", ids("a", "b", "c"));
    expect(parts.map((p) => p.amountCents)).toEqual([0, 0, 0]);
    const percent = computeSplit(0, "percent", [
      { userId: "a", value: 6000 },
      { userId: "b", value: 4000 },
    ]);
    expect(sum(percent)).toBe(0);
  });

  it("un solo participante asume todo el importe", () => {
    expect(computeSplit(999, "equal", ids("a"))).toEqual([
      { userId: "a", amountCents: 999, weight: 1 },
    ]);
    expect(computeSplit(999, "shares", [{ userId: "a", value: 300 }])[0].amountCents).toBe(999);
    expect(computeSplit(999, "percent", [{ userId: "a", value: 10000 }])[0].amountCents).toBe(999);
    expect(computeSplit(999, "exact", [{ userId: "a", value: 999 }])[0].amountCents).toBe(999);
  });

  it("sin participantes lanza error", () => {
    expect(() => computeSplit(100, "equal", [])).toThrowError(SplitError);
    expect(() => computeSplit(100, "equal", [])).toThrowError(
      expect.objectContaining({ code: "NO_PARTICIPANTS" }),
    );
  });

  it("participantes duplicados lanzan error", () => {
    expect(() => computeSplit(100, "equal", ids("a", "a"))).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_PARTICIPANT" }),
    );
  });

  it("importes negativos, decimales o enormes son inválidos", () => {
    for (const total of [-1, 10.5, Number.NaN, 1e12]) {
      expect(() => computeSplit(total, "equal", ids("a"))).toThrowError(
        expect.objectContaining({ code: "INVALID_TOTAL" }),
      );
    }
  });

  it("valores de reparto no enteros son inválidos", () => {
    expect(() =>
      computeSplit(100, "shares", [
        { userId: "a", value: 1.5 },
        { userId: "b", value: 1 },
      ]),
    ).toThrowError(expect.objectContaining({ code: "INVALID_VALUE" }));
  });

  it("guarda el peso original para poder reeditar", () => {
    const parts = computeSplit(1000, "percent", [
      { userId: "a", value: 7000 },
      { userId: "b", value: 3000 },
    ]);
    expect(parts.map((p) => p.weight)).toEqual([7000, 3000]);
  });
});

describe("allocateByWeights", () => {
  it("mayor resto primero, empates por orden de prioridad", () => {
    // 10 céntimos con pesos 1:1:1 -> base 3,3,3 + 1 extra
    expect(allocateByWeights(10, [1, 1, 1], [2, 0, 1])).toEqual([3, 3, 4]);
    expect(allocateByWeights(10, [1, 1, 1], [0, 1, 2])).toEqual([4, 3, 3]);
  });

  it("el mayor resto fraccionario gana frente al orden", () => {
    // 10 céntimos con pesos 1:2:2 -> 2, 4, 4 exactos
    expect(allocateByWeights(10, [1, 2, 2])).toEqual([2, 4, 4]);
    // 7 con pesos 1:1:5 -> exactos 1, 1, 5 exactos
    expect(allocateByWeights(7, [1, 1, 5])).toEqual([1, 1, 5]);
    // 5 con pesos 3:1 -> 3.75 y 1.25 => 4 y 1
    expect(allocateByWeights(5, [3, 1])).toEqual([4, 1]);
  });
});
