import { describe, expect, it } from "vitest";
import { businessCreateSchema, customerOrderSchema, customerSchema, customerUpdateSchema, expenseSchema, fiscalProfileSchema, inventoryAdjustmentSchema, membershipInviteSchema, membershipRoleSchema, productSchema, productUpdateSchema, saleSchema, serviceSaleSchema, supplierSchema, taskSchema, userProfileUpdateSchema } from "@/server/validators/domain";

describe("domain input validation", () => {
  it("accepts a valid product with minor-unit pricing", () => {
    expect(productSchema.safeParse({ name: "Remera", priceMinor: 280000, stock: 20, minimumStock: 5 }).success).toBe(true);
  });

  it("rejects negative stock and unknown fields", () => {
    expect(productSchema.safeParse({ name: "Remera", priceMinor: 100, stock: -1, minimumStock: 0, role: "ADMIN" }).success).toBe(false);
  });

  it("rejects a sale with duplicate products", () => {
    const result = saleSchema.safeParse({ paymentMethod: "TRANSFER", items: [{ productId: "00000000-0000-0000-0000-000000000001", quantity: 1 }, { productId: "00000000-0000-0000-0000-000000000001", quantity: 2 }] });
    expect(result.success).toBe(false);
  });

  it("requires a customer name", () => {
    expect(customerSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("accepts product updates and non-zero inventory adjustments", () => {
    expect(productUpdateSchema.safeParse({ name: "Remera", priceMinor: 100, minimumStock: 2, status: "ACTIVE" }).success).toBe(true);
    expect(inventoryAdjustmentSchema.safeParse({ quantity: -3, reason: "Merma" }).success).toBe(true);
    expect(inventoryAdjustmentSchema.safeParse({ quantity: 0 }).success).toBe(false);
  });

  it("accepts valid updates for customer profile", () => {
    expect(customerUpdateSchema.safeParse({ name: "Ana López", email: "ana@test.com", phone: "+54 9 11 1111", notes: "Cliente recurrente" }).success).toBe(true);
    expect(customerUpdateSchema.safeParse({ name: "", phone: "123" }).success).toBe(false);
  });

  it("accepts valid team invite and role updates", () => {
    expect(membershipInviteSchema.safeParse({ email: "team@example.com", role: "EMPLOYEE" }).success).toBe(true);
    expect(membershipRoleSchema.safeParse({ role: "OWNER" }).success).toBe(true);
    expect(membershipInviteSchema.safeParse({ email: "bad-email", role: "OWNER" }).success).toBe(false);
  });

  it("accepts valid user profile updates and rejects empty payloads", () => {
    expect(userProfileUpdateSchema.safeParse({ name: "María García", email: "maria@test.com" }).success).toBe(true);
    expect(userProfileUpdateSchema.safeParse({ password: "short" }).success).toBe(false);
    expect(userProfileUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts business creation payloads and rejects empty names", () => {
    expect(businessCreateSchema.safeParse({ name: "La Esquina", kind: "STORE" }).success).toBe(true);
    expect(businessCreateSchema.safeParse({ name: "Barra Norte", kind: "SERVICE" }).success).toBe(true);
    expect(businessCreateSchema.safeParse({ name: "La Esquina" }).success).toBe(false);
    expect(businessCreateSchema.safeParse({ name: "" , kind: "STORE" }).success).toBe(false);
  });

  it("accepts suppliers and positive expenses", () => {
    expect(supplierSchema.safeParse({ name: "Distribuidora Sur", type: "SUPPLY", email: "compras@test.com" }).success).toBe(true);
    expect(expenseSchema.safeParse({ description: "Compra de insumos", amountMinor: 1250000 }).success).toBe(true);
    expect(expenseSchema.safeParse({ description: "Compra", amountMinor: 0 }).success).toBe(false);
  });

  it("accepts a fiscal profile and rejects a short CUIT", () => {
    expect(fiscalProfileSchema.safeParse({ legalName: "Casa Norte", cuit: "20111111112", pointOfSale: 1, ivaCondition: "MONOTRIBUTO", environment: "HOMOLOGACION" }).success).toBe(true);
    expect(fiscalProfileSchema.safeParse({ legalName: "Casa Norte", cuit: "20", pointOfSale: 1, ivaCondition: "MONOTRIBUTO", environment: "HOMOLOGACION" }).success).toBe(false);
  });

  it("accepts a manual service sale and rejects one without a place", () => {
    expect(serviceSaleSchema.safeParse({ customerId: "00000000-0000-4000-8000-000000000001", paymentMethod: "TRANSFER", serviceDate: "2026-11-02", amountMinor: 45000000, place: "Salón Norte", description: "Barra de tragos, 4 horas" }).success).toBe(true);
    expect(serviceSaleSchema.safeParse({ customerId: "00000000-0000-4000-8000-000000000001", paymentMethod: "TRANSFER", serviceDate: "2026-11-02", amountMinor: 45000000, place: "", description: "Barra" }).success).toBe(false);
  });

  it("accepts a dated product order and rejects a service without a title", () => {
    expect(customerOrderSchema.safeParse({ customerId: "00000000-0000-4000-8000-000000000001", kind: "PRODUCT", title: "Remera", quantity: 2, scheduledFor: "2026-10-03" }).success).toBe(true);
    expect(customerOrderSchema.safeParse({ customerId: "00000000-0000-4000-8000-000000000001", kind: "SERVICE", title: "Arreglo", scheduledFor: "2026-10-03" }).success).toBe(true);
    expect(customerOrderSchema.safeParse({ customerId: "00000000-0000-4000-8000-000000000001", kind: "SERVICE", title: "", scheduledFor: "mañana" }).success).toBe(false);
  });

  it("accepts tasks with optional assignment and rejects empty titles", () => {
    expect(taskSchema.safeParse({ title: "Revisar stock" }).success).toBe(true);
    expect(taskSchema.safeParse({ title: "" }).success).toBe(false);
  });
});