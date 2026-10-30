import "server-only";
import {
  computeBalances,
  directDebts,
  simplifyDebts,
  type Balances,
  type Transfer,
} from "@/lib/money";
import { groupBySection, listSections, loadLedger, type SectionRow } from "./ledger";
import { listUsers, userMap, type PublicUser } from "./users";

export type DebtMode = "simplificado" | "directo";

export function parseMode(value: string | string[] | undefined): DebtMode {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "directo" ? "directo" : "simplificado";
}

export interface SectionSummary {
  section: SectionRow;
  balances: Balances;
  transfers: Transfer[];
  movementCount: number;
}

export interface Overview {
  users: PublicUser[];
  usersById: Map<string, PublicUser>;
  sections: SectionSummary[];
  mode: DebtMode;
}

/** Saldos de todas las secciones (activas o archivadas) con el modo de deuda elegido. */
export async function buildOverview(mode: DebtMode, options: { includeArchived?: boolean } = {}): Promise<Overview> {
  const [users, sections, ledger] = await Promise.all([
    listUsers(),
    listSections({ includeArchived: options.includeArchived }),
    loadLedger(),
  ]);
  const groups = groupBySection(ledger);
  const userIds = users.map((u) => u.id);

  const summaries = sections.map((section) => {
    const group = groups.get(section.id) ?? { expenses: [], payments: [] };
    const balances = computeBalances(group.expenses, group.payments, userIds);
    const transfers =
      mode === "directo" ? directDebts(group.expenses, group.payments) : simplifyDebts(balances);
    return {
      section,
      balances,
      transfers,
      movementCount: group.expenses.length + group.payments.length,
    };
  });

  return { users, usersById: userMap(users), sections: summaries, mode };
}

/** Totales personales a partir del resumen de secciones. */
export function personalTotals(overview: Overview, userId: string) {
  let net = 0;
  const iOwe: (Transfer & { sectionId: string; sectionName: string })[] = [];
  const owedToMe: (Transfer & { sectionId: string; sectionName: string })[] = [];

  for (const summary of overview.sections) {
    net += summary.balances[userId] ?? 0;
    for (const t of summary.transfers) {
      const entry = { ...t, sectionId: summary.section.id, sectionName: summary.section.name };
      if (t.from === userId) iOwe.push(entry);
      else if (t.to === userId) owedToMe.push(entry);
    }
  }
  const sum = (list: Transfer[]) => list.reduce((acc, t) => acc + t.amountCents, 0);
  return {
    netCents: net,
    iOwe,
    owedToMe,
    totalIOweCents: sum(iOwe),
    totalOwedToMeCents: sum(owedToMe),
  };
}
