import { describe, expect, it } from "vitest";
import {
  assertBalanced,
  balancesSum,
  computeBalances,
  directDebts,
  mergeBalances,
  simplifyDebts,
  summarizeForUser,
  type ExpenseLike,
  type PaymentLike,
} from "./balances";
import { computeSplit } from "./split";

function expense(paidBy: string, amountCents: number, participants: string[]): ExpenseLike {
  const splits = computeSplit(
    amountCents,
    "equal",
    participants.map((userId) => ({ userId })),
    `${paidBy}-${amountCents}`,
  ).map((s) => ({ userId: s.userId, amountCents: s.amountCents }));
  return { paidBy, amountCents, splits };
}

/** Pagos que saldan exactamente una lista de transferencias. */
const asPayments = (transfers: { from: string; to: string; amountCents: number }[]): PaymentLike[] =>
  transfers.map((t) => ({ fromUserId: t.from, toUserId: t.to, amountCents: t.amountCents }));

describe("computeBalances", () => {
  it("el pagador queda en positivo y los demás en negativo", () => {
    const balances = computeBalances([expense("javi", 1200, ["javi", "amy", "pablo", "paula"])]);
    expect(balances).toEqual({ javi: 900, amy: -300, pablo: -300, paula: -300 });
    expect(balancesSum(balances)).toBe(0);
  });

  it("pagador que no participa: todo el importe es lo que le deben", () => {
    const balances = computeBalances([expense("javi", 900, ["amy", "pablo", "paula"])]);
    expect(balances.javi).toBe(900);
    expect(balances.amy).toBe(-300);
    expect(balancesSum(balances)).toBe(0);
  });

  it("pagador que es el único participante: saldo 0", () => {
    const balances = computeBalances([expense("javi", 500, ["javi"])]);
    expect(balances).toEqual({ javi: 0 });
  });

  it("incluye a usuarios sin movimientos", () => {
    const balances = computeBalances([], [], ["a", "b"]);
    expect(balances).toEqual({ a: 0, b: 0 });
  });

  it("gasto de 0 € no cambia los saldos", () => {
    const balances = computeBalances([expense("a", 0, ["a", "b"])]);
    expect(balances).toEqual({ a: 0, b: 0 });
  });

  it("un pago de A a B reduce lo que A debe y lo que B espera cobrar", () => {
    const expenses = [expense("javi", 900, ["amy", "pablo", "paula"])];
    const before = computeBalances(expenses);
    const after = computeBalances(expenses, [{ fromUserId: "amy", toUserId: "javi", amountCents: 300 }]);
    expect(before.amy).toBe(-300);
    expect(after.amy).toBe(0);
    expect(after.javi).toBe(before.javi - 300);
    expect(balancesSum(after)).toBe(0);
  });

  it("un pago mayor que la deuda deja a favor al pagador", () => {
    const expenses = [expense("javi", 900, ["amy", "pablo", "paula"])];
    const balances = computeBalances(expenses, [{ fromUserId: "amy", toUserId: "javi", amountCents: 500 }]);
    expect(balances.amy).toBe(200);
    expect(balances.javi).toBe(400);
    expect(balancesSum(balances)).toBe(0);
  });

  it("detecta repartos incoherentes", () => {
    const broken: ExpenseLike = {
      paidBy: "a",
      amountCents: 100,
      splits: [{ userId: "b", amountCents: 90 }],
    };
    expect(() => assertBalanced(computeBalances([broken]))).toThrow();
  });

  it("mergeBalances suma saldos de varias secciones", () => {
    const merged = mergeBalances({ a: 100, b: -100 }, { a: -40, c: 40 });
    expect(merged).toEqual({ a: 60, b: -100, c: 40 });
  });
});

describe("simplifyDebts", () => {
  it("empareja al mayor acreedor con el mayor deudor", () => {
    const transfers = simplifyDebts({ a: 500, b: 300, c: -600, d: -200 });
    expect(transfers).toEqual([
      { from: "c", to: "a", amountCents: 500 },
      { from: "d", to: "b", amountCents: 200 },
      { from: "c", to: "b", amountCents: 100 },
    ]);
  });

  it("saldos cero no generan transferencias", () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
    expect(simplifyDebts({})).toEqual([]);
  });

  it("simplifica cadenas A→B→C en una transferencia A→C", () => {
    // A debe 10 a B, B debe 10 a C
    const expenses = [expense("b", 1000, ["a"]), expense("c", 1000, ["b"])];
    const balances = computeBalances(expenses);
    expect(simplifyDebts(balances)).toEqual([{ from: "a", to: "c", amountCents: 1000 }]);
    // pero las deudas directas conservan las dos
    expect(directDebts(expenses)).toHaveLength(2);
  });

  it("como mucho n-1 transferencias y las transferencias saldan todo", () => {
    const rng = mulberry32(42);
    const people = ["a", "b", "c", "d", "e", "f"];
    for (let round = 0; round < 200; round++) {
      const expenses: ExpenseLike[] = [];
      for (let i = 0; i < 8; i++) {
        const payer = people[Math.floor(rng() * people.length)];
        const count = 1 + Math.floor(rng() * people.length);
        const shuffled = [...people].sort(() => rng() - 0.5).slice(0, count);
        expenses.push(expense(payer, 1 + Math.floor(rng() * 20_000), shuffled));
      }
      const balances = computeBalances(expenses, [], people);
      expect(balancesSum(balances)).toBe(0);

      const transfers = simplifyDebts(balances);
      expect(transfers.length).toBeLessThanOrEqual(people.length - 1);
      expect(transfers.every((t) => t.amountCents > 0 && t.from !== t.to)).toBe(true);

      const settled = computeBalances(expenses, asPayments(transfers), people);
      expect(Object.values(settled).every((v) => v === 0)).toBe(true);
    }
  });
});

describe("directDebts", () => {
  it("netea entre cada pareja", () => {
    const expenses = [
      expense("javi", 1000, ["javi", "amy"]), // amy debe 5 a javi
      expense("amy", 400, ["javi", "amy"]), // javi debe 2 a amy
    ];
    expect(directDebts(expenses)).toEqual([{ from: "amy", to: "javi", amountCents: 300 }]);
  });

  it("los pagos reducen la deuda directa y pueden invertirla", () => {
    const expenses = [expense("javi", 1000, ["amy"])];
    expect(directDebts(expenses, [{ fromUserId: "amy", toUserId: "javi", amountCents: 400 }])).toEqual([
      { from: "amy", to: "javi", amountCents: 600 },
    ]);
    expect(directDebts(expenses, [{ fromUserId: "amy", toUserId: "javi", amountCents: 1000 }])).toEqual([]);
    expect(directDebts(expenses, [{ fromUserId: "amy", toUserId: "javi", amountCents: 1200 }])).toEqual([
      { from: "javi", to: "amy", amountCents: 200 },
    ]);
  });

  it("el pagador no se debe a sí mismo", () => {
    expect(directDebts([expense("javi", 500, ["javi"])])).toEqual([]);
  });

  it("pagar las deudas directas deja todos los saldos a cero", () => {
    const rng = mulberry32(7);
    const people = ["a", "b", "c", "d", "e"];
    for (let round = 0; round < 100; round++) {
      const expenses: ExpenseLike[] = [];
      for (let i = 0; i < 6; i++) {
        const payer = people[Math.floor(rng() * people.length)];
        const shuffled = [...people].sort(() => rng() - 0.5).slice(0, 1 + Math.floor(rng() * 5));
        expenses.push(expense(payer, 1 + Math.floor(rng() * 9_999), shuffled));
      }
      const direct = directDebts(expenses);
      const settled = computeBalances(expenses, asPayments(direct), people);
      expect(Object.values(settled).every((v) => v === 0)).toBe(true);
    }
  });
});

describe("summarizeForUser", () => {
  it("separa lo que debo de lo que me deben", () => {
    const transfers = [
      { from: "amy", to: "javi", amountCents: 450 },
      { from: "javi", to: "pablo", amountCents: 200 },
      { from: "paula", to: "pablo", amountCents: 100 },
    ];
    const summary = summarizeForUser("javi", transfers);
    expect(summary.totalOwedToMeCents).toBe(450);
    expect(summary.totalIOweCents).toBe(200);
    expect(summary.iOwe).toHaveLength(1);
    expect(summary.owedToMe).toHaveLength(1);
  });
});

describe("escenario real: Arepas casa Javi", () => {
  it("cuatro personas deben 4,50 € cada una a Javi", () => {
    const debtors = ["cristian", "amy", "paula", "pablo"];
    const expenses = debtors.map((d) => ({
      paidBy: "javi",
      amountCents: 450,
      splits: [{ userId: d, amountCents: 450 }],
    }));
    const balances = computeBalances(expenses, [], ["javi", ...debtors]);
    expect(balances).toEqual({ javi: 1800, cristian: -450, amy: -450, paula: -450, pablo: -450 });
    expect(simplifyDebts(balances)).toHaveLength(4);

    // Cristian paga: su deuda desaparece y a Javi le deben 13,50 €
    const after = computeBalances(expenses, [{ fromUserId: "cristian", toUserId: "javi", amountCents: 450 }], [
      "javi",
      ...debtors,
    ]);
    expect(after.cristian).toBe(0);
    expect(after.javi).toBe(1350);
  });
});

/** PRNG determinista para tests reproducibles. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
