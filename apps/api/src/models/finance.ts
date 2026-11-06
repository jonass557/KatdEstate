import mongoose, { Schema, model, type InferSchemaType, type Model, type Types } from 'mongoose';
const models = mongoose.models;
import {
  DEPOSIT_TRANSACTION_TYPES,
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  RENT_SCHEDULE_STATUSES,
} from '@rentflow/shared';

const timestamps = true;
const org = { type: Schema.Types.ObjectId, ref: 'Organization', required: true } as const;

const rentScheduleSchema = new Schema(
  {
    organizationId: org,
    leaseId: { type: Schema.Types.ObjectId, ref: 'Lease', required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    periodStart: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    amountDueMinor: { type: Number, required: true, min: 0 },
    amountPaidMinor: { type: Number, required: true, min: 0, default: 0 },
    penaltyMinor: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, required: true, uppercase: true, length: 3 },
    status: { type: String, enum: RENT_SCHEDULE_STATUSES, default: 'PENDING', index: true },
    cancelledReason: { type: String, maxlength: 500 },
  },
  { timestamps },
);
rentScheduleSchema.index(
  { organizationId: 1, leaseId: 1, dueDate: 1 },
  { unique: true, name: 'schedules_org_lease_due_unique' },
);
rentScheduleSchema.index(
  { organizationId: 1, status: 1, dueDate: 1 },
  { name: 'schedules_org_status_due' },
);

const invoiceItemSchema = new Schema(
  {
    label: { type: String, required: true, maxlength: 200 },
    amountMinor: { type: Number, required: true, min: 0 },
    category: { type: String, maxlength: 80 },
  },
  { _id: false },
);

const invoiceSchema = new Schema(
  {
    organizationId: org,
    number: { type: String, required: true },
    rentScheduleId: { type: Schema.Types.ObjectId, ref: 'RentSchedule' },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
    dueDate: { type: Date },
    items: { type: [invoiceItemSchema], default: [] },
    totalMinor: { type: Number, required: true, min: 0 },
    amountPaidMinor: { type: Number, min: 0, default: 0 },
    currency: { type: String, required: true },
    status: { type: String, enum: INVOICE_STATUSES, default: 'ISSUED' },
  },
  { timestamps },
);
invoiceSchema.index(
  { organizationId: 1, number: 1 },
  { unique: true, name: 'invoices_org_number_unique' },
);

const paymentSchema = new Schema(
  {
    organizationId: org,
    number: { type: String, required: true },
    rentScheduleId: { type: Schema.Types.ObjectId, ref: 'RentSchedule', required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'CONFIRMED' },
    paidAt: { type: Date, required: true },
    reference: { type: String, maxlength: 120 },
    note: { type: String, maxlength: 500 },
    idempotencyKey: { type: String, required: true },
    reconciledAt: { type: Date },
    refundedAmountMinor: { type: Number, min: 0, default: 0 },
    refundReason: { type: String, maxlength: 500 },
  },
  { timestamps },
);
paymentSchema.index(
  { organizationId: 1, idempotencyKey: 1 },
  { unique: true, name: 'payments_org_idempotency_unique' },
);
paymentSchema.index({ organizationId: 1, paidAt: -1 }, { name: 'payments_org_date' });

const receiptSchema = new Schema(
  {
    organizationId: org,
    number: { type: String, required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
receiptSchema.index(
  { organizationId: 1, number: 1 },
  { unique: true, name: 'receipts_org_number_unique' },
);

const depositTransactionSchema = new Schema(
  {
    organizationId: org,
    leaseId: { type: Schema.Types.ObjectId, ref: 'Lease', required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    type: { type: String, enum: DEPOSIT_TRANSACTION_TYPES, required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true },
    note: { type: String, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
depositTransactionSchema.index({ organizationId: 1, leaseId: 1 }, { name: 'deposits_org_lease' });

export type RentScheduleDocument = InferSchemaType<typeof rentScheduleSchema> & {
  _id: Types.ObjectId;
};
export type InvoiceDocument = InferSchemaType<typeof invoiceSchema> & { _id: Types.ObjectId };
export type PaymentDocument = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId };
export type ReceiptDocument = InferSchemaType<typeof receiptSchema> & { _id: Types.ObjectId };

export const RentSchedule =
  (models.RentSchedule as Model<RentScheduleDocument>) ??
  model<RentScheduleDocument>('RentSchedule', rentScheduleSchema);
export const Invoice =
  (models.Invoice as Model<InvoiceDocument>) ?? model<InvoiceDocument>('Invoice', invoiceSchema);
export const Payment =
  (models.Payment as Model<PaymentDocument>) ?? model<PaymentDocument>('Payment', paymentSchema);
export const Receipt =
  (models.Receipt as Model<ReceiptDocument>) ?? model<ReceiptDocument>('Receipt', receiptSchema);
export const DepositTransaction =
  (models.DepositTransaction as Model<InferSchemaType<typeof depositTransactionSchema>>) ??
  model('DepositTransaction', depositTransactionSchema);
