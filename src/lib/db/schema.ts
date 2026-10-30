import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*  Tablas de Better Auth (user / session / account / verification)            */
/*  Los nombres de propiedad deben coincidir con los campos de Better Auth.    */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // plugin username
  username: text("username").unique(),
  displayUsername: text("display_username"),
  // plugin admin
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  // campos propios
  color: text("color").notNull().default("#d79921"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/*  Límite de intentos de inicio de sesión por usuario                          */
/* -------------------------------------------------------------------------- */

export const loginThrottle = pgTable("login_throttle", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

/* -------------------------------------------------------------------------- */
/*  Dominio: secciones, gastos, repartos, pagos, comentarios, actividad         */
/* -------------------------------------------------------------------------- */

/** Cuenta con nombre dentro del grupo (p. ej. "Arepas casa Javi"). */
export const sections = pgTable("sections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const expenses = pgTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    sectionId: text("section_id")
      .notNull()
      .references(() => sections.id),
    title: text("title").notNull(),
    amountCents: integer("amount_cents").notNull(),
    expenseDate: date("expense_date", { mode: "string" }).notNull(),
    category: text("category").notNull(),
    paidBy: text("paid_by")
      .notNull()
      .references(() => user.id),
    splitType: text("split_type").notNull(),
    note: text("note"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by").references(() => user.id),
  },
  (t) => [
    index("expenses_section_idx").on(t.sectionId, t.expenseDate),
    index("expenses_paid_by_idx").on(t.paidBy),
    check("expenses_amount_nonneg", sql`${t.amountCents} >= 0`),
  ],
);

export const expenseSplits = pgTable(
  "expense_splits",
  {
    expenseId: text("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    /** Parte final en céntimos. */
    amountCents: integer("amount_cents").notNull(),
    /** Valor introducido: céntimos, puntos básicos o centésimas de participación. */
    weight: integer("weight").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.expenseId, t.userId] }),
    index("expense_splits_user_idx").on(t.userId),
    check("expense_splits_amount_nonneg", sql`${t.amountCents} >= 0`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    sectionId: text("section_id")
      .notNull()
      .references(() => sections.id),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => user.id),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => user.id),
    amountCents: integer("amount_cents").notNull(),
    paymentDate: date("payment_date", { mode: "string" }).notNull(),
    note: text("note"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by").references(() => user.id),
  },
  (t) => [
    index("payments_section_idx").on(t.sectionId, t.paymentDate),
    check("payments_amount_pos", sql`${t.amountCents} > 0`),
    check("payments_distinct_users", sql`${t.fromUserId} <> ${t.toUserId}`),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expenses.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("comments_expense_idx").on(t.expenseId, t.createdAt)],
);

export const activityLog = pgTable(
  "activity_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    /** created | updated | deleted | restored | password_reset | user_created ... */
    action: text("action").notNull(),
    /** expense | payment | comment | section | user */
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    sectionId: text("section_id").references(() => sections.id),
    /** Texto legible ya montado, p. ej. "Amy ha añadido «Pizza» (12,00 €)". */
    summary: text("summary").notNull(),
    /** Datos antes/después, solo visibles para el admin. */
    details: jsonb("details"),
    /** true: solo lo ve el admin (gestión de usuarios, contraseñas...). */
    adminOnly: boolean("admin_only").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_created_idx").on(t.createdAt),
    index("activity_section_idx").on(t.sectionId, t.createdAt),
    index("activity_entity_idx").on(t.entityType, t.entityId),
  ],
);
