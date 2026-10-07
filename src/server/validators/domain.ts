import { z } from "zod";

export const businessIdSchema = z.string().uuid();

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

export const customerUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

export const membershipInviteSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["OWNER", "EMPLOYEE"]).default("EMPLOYEE"),
}).strict();

export const membershipRoleSchema = z.object({
  role: z.enum(["OWNER", "EMPLOYEE"]),
}).strict();

export const imageSchema = z.string().max(400_000).refine((value) => value === "" || /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(value), "La imagen no es válida.");

export const businessCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  legalName: z.string().trim().max(160).optional(),
  taxId: z.string().trim().max(40).optional(),
  kind: z.enum(["STORE", "SERVICE"]),
  image: imageSchema.optional(),
}).strict();

export const businessImageSchema = z.object({
  image: imageSchema,
}).strict();

export const userProfileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(320).optional(),
  password: z.string().min(12).max(128).optional(),
  image: imageSchema.optional(),
}).strict().refine((value) => value.name !== undefined || value.email !== undefined || value.password !== undefined || value.image !== undefined, {
  message: "Debe enviar al menos un campo para actualizar.",
});

export const productSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  priceMinor: z.number().int().nonnegative().max(2_147_483_647),
  costMinor: z.number().int().nonnegative().max(2_147_483_647).optional(),
  stock: z.number().int().nonnegative().max(2_147_483_647).default(0),
  minimumStock: z.number().int().nonnegative().max(2_147_483_647).default(0),
}).strict();

export const productUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  catalogKind: z.enum(["SUPPLY", "TOOL"]).optional(),
  category: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  priceMinor: z.number().int().nonnegative().max(2_147_483_647),
  costMinor: z.number().int().nonnegative().max(2_147_483_647).optional(),
  minimumStock: z.number().int().nonnegative().max(2_147_483_647),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
}).strict();

export const stockItemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  catalogKind: z.enum(["SUPPLY", "TOOL"]),
  description: z.string().trim().max(2000).optional(),
  costMinor: z.number().int().nonnegative().max(2_147_483_647).optional(),
  stock: z.number().int().nonnegative().max(2_147_483_647).default(0),
  minimumStock: z.number().int().nonnegative().max(2_147_483_647).default(0),
}).strict();

export const inventoryAdjustmentSchema = z.object({
  quantity: z.number().int().min(-2_147_483_647).max(2_147_483_647).refine((value) => value !== 0, "El ajuste no puede ser cero."),
  reason: z.string().trim().max(500).optional(),
}).strict();

const saleDiscountSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("NONE") }).strict(),
  z.object({ kind: z.literal("PERCENT"), percent: z.number().positive().max(100) }).strict(),
  z.object({ kind: z.literal("PRICE"), priceMinor: z.number().int().nonnegative().max(2_147_483_647) }).strict(),
]);

export const serviceSaleSchema = z.object({
  customerId: z.string().uuid(),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountMinor: z.number().int().positive().max(2_147_483_647),
  place: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2000),
  discount: saleDiscountSchema.optional(),
}).strict();

export const saleSchema = z.object({
  customerId: z.string().uuid().optional(),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive().max(100_000) }).strict()).min(1).max(100),
  discount: saleDiscountSchema.optional(),
}).strict().superRefine((sale, context) => {
  const ids = sale.items.map((item) => item.productId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: ["items"], message: "Cada producto debe aparecer una sola vez." });
});

const orderLineSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().positive().max(100_000) }).strict();

function rejectRepeatedProducts(items: Array<{ productId: string }>, context: { addIssue: (issue: { code: "custom"; path: string[]; message: string }) => void }) {
  const ids = items.map((item) => item.productId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: ["items"], message: "Cada producto debe aparecer una sola vez." });
}

export const productOrderCreateSchema = z.object({
  customerId: z.string().uuid(),
  kind: z.literal("PRODUCT"),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(orderLineSchema).min(1).max(100),
}).strict().superRefine((order, context) => rejectRepeatedProducts(order.items, context));

export const productOrderUpdateSchema = z.object({
  customerId: z.string().uuid(),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(orderLineSchema).min(1).max(100),
}).strict().superRefine((order, context) => rejectRepeatedProducts(order.items, context));

export const customerOrderSchema = z.object({
  customerId: z.string().uuid(),
  kind: z.enum(["PRODUCT", "SERVICE"]),
  title: z.string().trim().min(1).max(160),
  productId: z.string().uuid().optional(),
  quantity: z.number().int().positive().max(100_000).default(1),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountMinor: z.number().int().nonnegative().max(2_147_483_647).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

export const customerOrderStatusSchema = z.object({
  status: z.enum(["SCHEDULED", "DONE", "CANCELLED"]),
}).strict();

export const serviceReservationSchema = z.object({
  customerId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountMinor: z.number().int().positive().max(2_147_483_647),
  place: z.string().trim().min(1).max(160),
}).strict();

export const serviceReservationUpdateSchema = z.object({
  customerId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160).optional(),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amountMinor: z.number().int().positive().max(2_147_483_647).optional(),
  place: z.string().trim().min(1).max(160).optional(),
  status: z.enum(["SCHEDULED", "DONE", "CANCELLED"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Sin cambios.");

export const orderPaymentSchema = z.object({
  amountMinor: z.number().int().positive().max(2_147_483_647),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]),
}).strict();

export const supplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(["PRODUCT", "SUPPLY", "TOOL", "SERVICE", "OTHER"]).default("OTHER"),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  taxId: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

export const expenseSchema = z.object({
  supplierId: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(180),
  category: z.string().trim().max(120).optional(),
  amountMinor: z.number().int().positive().max(2_147_483_647),
  expenseDate: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

const taskItemTextSchema = z.string().trim().min(1).max(160);

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  items: z.array(taskItemTextSchema).max(50).optional(),
}).strict();

export const taskUpdateSchema = z.object({
  status: z.enum(["OPEN", "DONE", "ARCHIVED"]).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  addItem: taskItemTextSchema.optional(),
  itemId: z.string().uuid().optional(),
  done: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (Object.keys(value).length === 0) context.addIssue({ code: "custom", message: "Debe enviar al menos un cambio." });
  const toggling = value.itemId !== undefined || value.done !== undefined;
  if (value.itemId !== undefined && value.done === undefined) context.addIssue({ code: "custom", path: ["done"], message: "Indicá si el ítem queda hecho." });
  if (value.done !== undefined && value.itemId === undefined) context.addIssue({ code: "custom", path: ["itemId"], message: "Indicá qué ítem se tilda." });
  const editingTask = value.status !== undefined || value.title !== undefined || value.description !== undefined || value.assigneeId !== undefined || value.dueDate !== undefined;
  if (toggling && (editingTask || value.addItem !== undefined)) context.addIssue({ code: "custom", message: "El tilde del ítem se envía solo." });
  if (value.addItem !== undefined && editingTask) context.addIssue({ code: "custom", message: "El ítem nuevo se envía solo." });
});

export const fiscalProfileSchema = z.object({
  legalName: z.string().trim().min(1).max(160),
  cuit: z.string().trim().min(11).max(20),
  pointOfSale: z.number().int().min(1).max(9999),
  ivaCondition: z.enum(["MONOTRIBUTO", "RESPONSABLE_INSCRIPTO"]),
  environment: z.enum(["HOMOLOGACION", "PRODUCCION"]),
  certificatePem: z.string().max(20000).optional(),
  privateKeyPem: z.string().max(20000).optional(),
}).strict();