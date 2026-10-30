/**
 * Saldos y deudas. Todo en céntimos enteros.
 *
 * Convención: saldo neto = lo que has pagado - lo que te corresponde pagar.
 *   saldo > 0  -> "te deben"
 *   saldo < 0  -> "debes"
 * Un pago de A a B suma a A y resta a B: equivale a un gasto pagado por A y
 * repartido al 100 % a B.
 */

export interface ExpenseLike {
  paidBy: string;
  amountCents: number;
  splits: { userId: string; amountCents: number }[];
}

export interface PaymentLike {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

export interface Transfer {
  from: string;
  to: string;
  amountCents: number;
}

export type Balances = Record<string, number>;

function add(map: Balances, userId: string, delta: number) {
  map[userId] = (map[userId] ?? 0) + delta;
}

/** Saldo neto por persona. Incluye a `userIds` aunque no tengan movimientos. */
export function computeBalances(
  expenses: ExpenseLike[],
  payments: PaymentLike[] = [],
  userIds: string[] = [],
): Balances {
  const balances: Balances = {};
  for (const id of userIds) balances[id] = 0;

  for (const expense of expenses) {
    add(balances, expense.paidBy, expense.amountCents);
    for (const split of expense.splits) {
      add(balances, split.userId, -split.amountCents);
    }
  }
  for (const payment of payments) {
    add(balances, payment.fromUserId, payment.amountCents);
    add(balances, payment.toUserId, -payment.amountCents);
  }
  return balances;
}

/** La suma de todos los saldos debe ser 0. */
export function balancesSum(balances: Balances): number {
  return Object.values(balances).reduce((acc, value) => acc + value, 0);
}

export function assertBalanced(balances: Balances): void {
  if (balancesSum(balances) !== 0) {
    throw new Error("Los saldos no suman 0: hay un gasto con repartos incoherentes.");
  }
}

/** Suma de dos conjuntos de saldos (p. ej. para el total entre secciones). */
export function mergeBalances(...all: Balances[]): Balances {
  const merged: Balances = {};
  for (const balances of all) {
    for (const [userId, value] of Object.entries(balances)) add(merged, userId, value);
  }
  return merged;
}

function sortTransfers(transfers: Transfer[]): Transfer[] {
  return transfers.sort(
    (a, b) =>
      b.amountCents - a.amountCents ||
      (a.from < b.from ? -1 : a.from > b.from ? 1 : 0) ||
      (a.to < b.to ? -1 : a.to > b.to ? 1 : 0),
  );
}

/**
 * Simplificación de deudas: empareja de forma voraz al mayor acreedor con el
 * mayor deudor hasta saldar todo. Genera como máximo n-1 transferencias.
 */
export function simplifyDebts(balances: Balances): Transfer[] {
  const byIdAsc = (a: [string, number], b: [string, number]) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;

  const creditors = Object.entries(balances)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || byIdAsc(a, b))
    .map(([id, value]) => ({ id, value }));
  const debtors = Object.entries(balances)
    .filter(([, value]) => value < 0)
    .sort((a, b) => a[1] - b[1] || byIdAsc(a, b))
    .map(([id, value]) => ({ id, value: -value }));

  const transfers: Transfer[] = [];
  while (creditors.length > 0 && debtors.length > 0) {
    // Los arrays se reordenan para tomar siempre al mayor de cada lado.
    creditors.sort((a, b) => b.value - a.value || (a.id < b.id ? -1 : 1));
    debtors.sort((a, b) => b.value - a.value || (a.id < b.id ? -1 : 1));
    const creditor = creditors[0];
    const debtor = debtors[0];
    const amount = Math.min(creditor.value, debtor.value);
    transfers.push({ from: debtor.id, to: creditor.id, amountCents: amount });
    creditor.value -= amount;
    debtor.value -= amount;
    if (creditor.value === 0) creditors.shift();
    if (debtor.value === 0) debtors.shift();
  }
  return transfers;
}

/**
 * Deudas directas: neto entre cada pareja de personas, sin reencaminar.
 * "Cristian debe 10 € a Javi" se mantiene aunque Javi deba a otra persona.
 */
export function directDebts(
  expenses: ExpenseLike[],
  payments: PaymentLike[] = [],
): Transfer[] {
  // owed[a][b] = lo que a debe a b (bruto, antes de netear)
  const owed = new Map<string, Map<string, number>>();
  const bump = (debtor: string, creditor: string, amount: number) => {
    if (debtor === creditor || amount === 0) return;
    const row = owed.get(debtor) ?? new Map<string, number>();
    row.set(creditor, (row.get(creditor) ?? 0) + amount);
    owed.set(debtor, row);
  };

  for (const expense of expenses) {
    for (const split of expense.splits) {
      bump(split.userId, expense.paidBy, split.amountCents);
    }
  }
  // Un pago de A a B reduce lo que A debe a B (o aumenta lo que B debe a A).
  for (const payment of payments) {
    bump(payment.toUserId, payment.fromUserId, payment.amountCents);
  }

  const transfers: Transfer[] = [];
  const seen = new Set<string>();
  for (const [a, row] of owed) {
    for (const [b, aOwesB] of row) {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const bOwesA = owed.get(b)?.get(a) ?? 0;
      const net = aOwesB - bOwesA;
      if (net > 0) transfers.push({ from: a, to: b, amountCents: net });
      else if (net < 0) transfers.push({ from: b, to: a, amountCents: -net });
    }
  }
  return sortTransfers(transfers);
}

/** Resumen personal a partir de una lista de transferencias. */
export function summarizeForUser(userId: string, transfers: Transfer[]) {
  const iOwe = transfers.filter((t) => t.from === userId);
  const owedToMe = transfers.filter((t) => t.to === userId);
  return {
    iOwe,
    owedToMe,
    totalIOweCents: iOwe.reduce((acc, t) => acc + t.amountCents, 0),
    totalOwedToMeCents: owedToMe.reduce((acc, t) => acc + t.amountCents, 0),
  };
}
