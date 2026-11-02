import mongoose, { Schema, model, type InferSchemaType, type Model, type Types } from 'mongoose';
const models = mongoose.models;
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_EVENTS,
  TRANSACTION_DIRECTIONS,
  UTILITY_TYPES,
  VENDOR_TRADES,
} from '@rentflow/shared';

const timestamps = true;
const org = { type: Schema.Types.ObjectId, ref: 'Organization', required: true } as const;

const vendorSchema = new Schema(
  {
    organizationId: org,
    name: { type: String, required: true, trim: true, maxlength: 160 },
    trade: { type: String, enum: VENDOR_TRADES, required: true },
    phone: { type: String, maxlength: 32 },
    email: { type: String, maxlength: 160 },
    notes: { type: String, maxlength: 2_000 },
    deletedAt: { type: Date },
  },
  { timestamps },
);
vendorSchema.index({ organizationId: 1, trade: 1 }, { name: 'vendors_org_trade' });

const maintenanceTicketSchema = new Schema(
  {
    organizationId: org,
    category: { type: String, required: true, maxlength: 80 },
    title: { type: String, required: true, maxlength: 160 },
    description: { type: String, maxlength: 4_000 },
    priority: { type: String, enum: MAINTENANCE_PRIORITIES, default: 'MEDIUM', index: true },
    status: { type: String, enum: MAINTENANCE_STATUSES, default: 'OPEN', index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    buildingId: { type: Schema.Types.ObjectId, ref: 'Building' },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    photos: { type: [{ fileId: { type: Schema.Types.ObjectId, ref: 'StoredFile' } }], default: [] },
    estimatedCostMinor: { type: Number, min: 0 },
    actualCostMinor: { type: Number, min: 0 },
    currency: { type: String, uppercase: true },
    scheduledAt: { type: Date },
    completedAt: { type: Date },
    vendorInvoiceFileId: { type: Schema.Types.ObjectId, ref: 'StoredFile' },
    deletedAt: { type: Date },
  },
  { timestamps },
);
maintenanceTicketSchema.index(
  { organizationId: 1, status: 1, priority: 1 },
  { name: 'tickets_org_status_priority' },
);

const maintenanceTaskSchema = new Schema(
  {
    organizationId: org,
    ticketId: { type: Schema.Types.ObjectId, ref: 'MaintenanceTicket', required: true },
    title: { type: String, required: true, maxlength: 160 },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    done: { type: Boolean, default: false },
  },
  { timestamps },
);
maintenanceTaskSchema.index({ organizationId: 1, ticketId: 1 }, { name: 'tasks_org_ticket' });

/** Historique append-only des changements d'un ticket. */
const maintenanceEventSchema = new Schema(
  {
    organizationId: org,
    ticketId: { type: Schema.Types.ObjectId, ref: 'MaintenanceTicket', required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, required: true, maxlength: 60 },
    message: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
maintenanceEventSchema.index({ ticketId: 1, createdAt: 1 }, { name: 'maintenance_events_ticket_date' });

const transactionSchema = new Schema(
  {
    organizationId: org,
    direction: { type: String, enum: TRANSACTION_DIRECTIONS, required: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, uppercase: true },
    date: { type: Date, required: true },
    label: { type: String, required: true, maxlength: 200 },
    note: { type: String, maxlength: 2_000 },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    buildingId: { type: Schema.Types.ObjectId, ref: 'Building' },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    payee: { type: String, trim: true, maxlength: 160 },
    receiptFileId: { type: Schema.Types.ObjectId, ref: 'StoredFile' },
    status: { type: String, enum: EXPENSE_STATUSES, default: 'APPROVED', index: true },
    rejectionReason: { type: String, maxlength: 500 },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps },
);
transactionSchema.index({ organizationId: 1, date: -1 }, { name: 'transactions_org_date' });
transactionSchema.index(
  { organizationId: 1, direction: 1, category: 1 },
  { name: 'transactions_org_direction_category' },
);

const utilityMeterSchema = new Schema(
  {
    organizationId: org,
    type: { type: String, enum: UTILITY_TYPES, required: true },
    label: { type: String, required: true, maxlength: 160 },
    serialNumber: { type: String, maxlength: 80 },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    buildingId: { type: Schema.Types.ObjectId, ref: 'Building' },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    anomalyMultiplier: { type: Number, required: true, default: 2 },
    deletedAt: { type: Date },
  },
  { timestamps },
);
utilityMeterSchema.index({ organizationId: 1, type: 1 }, { name: 'meters_org_type' });

const utilityReadingSchema = new Schema(
  {
    organizationId: org,
    meterId: { type: Schema.Types.ObjectId, ref: 'UtilityMeter', required: true },
    previousIndex: { type: Number, required: true, min: 0 },
    currentIndex: { type: Number, required: true, min: 0 },
    consumption: { type: Number, required: true, min: 0 },
    readAt: { type: Date, required: true },
    photoFileId: { type: Schema.Types.ObjectId, ref: 'StoredFile' },
    abnormal: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
utilityReadingSchema.index({ organizationId: 1, meterId: 1, readAt: -1 }, { name: 'readings_org_meter_date' });

const utilityBillSchema = new Schema(
  {
    organizationId: org,
    meterId: { type: Schema.Types.ObjectId, ref: 'UtilityMeter', required: true },
    readingId: { type: Schema.Types.ObjectId, ref: 'UtilityReading', required: true },
    number: { type: String, required: true },
    consumption: { type: Number, required: true },
    unitPriceMinor: { type: Number, required: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true },
    dueDate: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
utilityBillSchema.index({ organizationId: 1, number: 1 }, { unique: true, name: 'utility_bills_org_number_unique' });

const notificationSchema = new Schema(
  {
    organizationId: org,
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    event: { type: String, enum: NOTIFICATION_EVENTS, required: true },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
    subject: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5_000 },
    status: { type: String, enum: NOTIFICATION_DELIVERY_STATUSES, required: true },
    /** Empêche d'envoyer deux fois la même notification pour le même fait déclencheur. */
    idempotencyKey: { type: String, required: true },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
notificationSchema.index(
  { organizationId: 1, idempotencyKey: 1, channel: 1 },
  { unique: true, name: 'notifications_idempotency_unique' },
);
notificationSchema.index({ recipientUserId: 1, createdAt: -1 }, { name: 'notifications_recipient_date' });

const notificationTemplateSchema = new Schema(
  {
    organizationId: org,
    event: { type: String, enum: NOTIFICATION_EVENTS, required: true },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
    subject: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5_000 },
  },
  { timestamps },
);
notificationTemplateSchema.index(
  { organizationId: 1, event: 1, channel: 1 },
  { unique: true, name: 'templates_org_event_channel_unique' },
);

const notificationPreferenceSchema = new Schema(
  {
    organizationId: org,
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: String, enum: NOTIFICATION_EVENTS, required: true },
    channels: { type: [{ type: String, enum: NOTIFICATION_CHANNELS }], default: [] },
  },
  { timestamps },
);
notificationPreferenceSchema.index(
  { organizationId: 1, userId: 1, event: 1 },
  { unique: true, name: 'preferences_org_user_event_unique' },
);

/**
 * File de travaux planifiés.
 *
 * Le verrou `lockedUntil` permet à une seule instance de traiter un travail, et
 * sa péremption permet la reprise après un crash. `idempotencyKey` empêche de
 * planifier deux fois le même travail.
 */
const jobSchema = new Schema(
  {
    type: { type: String, required: true, maxlength: 80 },
    runAt: { type: Date, required: true },
    idempotencyKey: { type: String, required: true },
    payload: { type: Schema.Types.Mixed },
    lockedUntil: { type: Date },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, maxlength: 500 },
    finishedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
jobSchema.index({ idempotencyKey: 1 }, { unique: true, name: 'jobs_idempotency_unique' });
jobSchema.index({ finishedAt: 1, runAt: 1 }, { name: 'jobs_pending_run' });

const internalMessageSchema = new Schema(
  {
    organizationId: org,
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User' },
    category: { type: String, default: 'GENERAL' },
    subject: { type: String, required: true, maxlength: 160 },
    body: { type: String, required: true, maxlength: 5_000 },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
    ticketId: { type: Schema.Types.ObjectId, ref: 'MaintenanceTicket' },
    replies: [
      {
        senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        body: { type: String, required: true, maxlength: 5_000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deletedAt: { type: Date },
  },
  { timestamps },
);
internalMessageSchema.index({ organizationId: 1, createdAt: -1 }, { name: 'messages_org_created' });

export const Vendor = (models.Vendor as Model<InferSchemaType<typeof vendorSchema>>) ?? model('Vendor', vendorSchema);
export const MaintenanceTicket =
  (models.MaintenanceTicket as Model<InferSchemaType<typeof maintenanceTicketSchema> & { _id: Types.ObjectId }>) ??
  model('MaintenanceTicket', maintenanceTicketSchema);
export const MaintenanceTask =
  (models.MaintenanceTask as Model<InferSchemaType<typeof maintenanceTaskSchema>>) ??
  model('MaintenanceTask', maintenanceTaskSchema);
export const MaintenanceEvent =
  (models.MaintenanceEvent as Model<InferSchemaType<typeof maintenanceEventSchema>>) ??
  model('MaintenanceEvent', maintenanceEventSchema);
export const Transaction =
  (models.Transaction as Model<InferSchemaType<typeof transactionSchema> & { _id: Types.ObjectId }>) ??
  model('Transaction', transactionSchema);
export const UtilityMeter =
  (models.UtilityMeter as Model<InferSchemaType<typeof utilityMeterSchema> & { _id: Types.ObjectId }>) ??
  model('UtilityMeter', utilityMeterSchema);
export const UtilityReading =
  (models.UtilityReading as Model<InferSchemaType<typeof utilityReadingSchema>>) ??
  model('UtilityReading', utilityReadingSchema);
export const UtilityBill =
  (models.UtilityBill as Model<InferSchemaType<typeof utilityBillSchema>>) ??
  model('UtilityBill', utilityBillSchema);
export const Notification =
  (models.Notification as Model<InferSchemaType<typeof notificationSchema>>) ??
  model('Notification', notificationSchema);
export const NotificationTemplate =
  (models.NotificationTemplate as Model<InferSchemaType<typeof notificationTemplateSchema>>) ??
  model('NotificationTemplate', notificationTemplateSchema);
export const NotificationPreference =
  (models.NotificationPreference as Model<InferSchemaType<typeof notificationPreferenceSchema>>) ??
  model('NotificationPreference', notificationPreferenceSchema);
export const Job = (models.Job as Model<InferSchemaType<typeof jobSchema> & { _id: Types.ObjectId }>) ?? model('Job', jobSchema);
export const InternalMessage =
  (models.InternalMessage as Model<InferSchemaType<typeof internalMessageSchema> & { _id: Types.ObjectId }>) ??
  model('InternalMessage', internalMessageSchema);
