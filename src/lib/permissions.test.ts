import { describe, expect, it } from "vitest";
import {
  canAdminister,
  canDeleteComment,
  canDeletePayment,
  canEditSection,
  canModifyExpense,
  canRegisterPayment,
  type Actor,
} from "./permissions";

const admin: Actor = { id: "javi", role: "admin" };
const amy: Actor = { id: "amy", role: "member" };
const pablo: Actor = { id: "pablo", role: "member" };

describe("gastos", () => {
  it("el miembro solo modifica los suyos", () => {
    expect(canModifyExpense(amy, { createdBy: "amy", category: "comida" })).toBe(true);
    expect(canModifyExpense(amy, { createdBy: "pablo", category: "comida" })).toBe(false);
  });

  it("el admin modifica cualquiera", () => {
    expect(canModifyExpense(admin, { createdBy: "amy", category: "comida" })).toBe(true);
  });

  it("las deudas iniciales solo las modifica el admin, aunque las creara un miembro", () => {
    expect(canModifyExpense(amy, { createdBy: "amy", category: "deuda_inicial" })).toBe(false);
    expect(canModifyExpense(admin, { createdBy: "amy", category: "deuda_inicial" })).toBe(true);
  });
});

describe("pagos", () => {
  it("lo registra el pagador, el receptor o el admin", () => {
    const payment = { fromUserId: "amy", toUserId: "javi" };
    expect(canRegisterPayment(amy, payment)).toBe(true);
    expect(canRegisterPayment({ id: "javi", role: "member" }, payment)).toBe(true);
    expect(canRegisterPayment(pablo, payment)).toBe(false);
    expect(canRegisterPayment(admin, { fromUserId: "amy", toUserId: "pablo" })).toBe(true);
  });

  it("lo deshace quien lo registró o el admin", () => {
    expect(canDeletePayment(amy, { createdBy: "amy" })).toBe(true);
    expect(canDeletePayment(pablo, { createdBy: "amy" })).toBe(false);
    expect(canDeletePayment(admin, { createdBy: "amy" })).toBe(true);
  });
});

describe("secciones, comentarios y administración", () => {
  it("secciones: creador o admin", () => {
    expect(canEditSection(amy, { createdBy: "amy" })).toBe(true);
    expect(canEditSection(pablo, { createdBy: "amy" })).toBe(false);
    expect(canEditSection(admin, { createdBy: "amy" })).toBe(true);
  });

  it("comentarios: autor o admin", () => {
    expect(canDeleteComment(amy, { userId: "amy" })).toBe(true);
    expect(canDeleteComment(pablo, { userId: "amy" })).toBe(false);
    expect(canDeleteComment(admin, { userId: "amy" })).toBe(true);
  });

  it("solo el admin administra", () => {
    expect(canAdminister(admin)).toBe(true);
    expect(canAdminister(amy)).toBe(false);
  });
});
