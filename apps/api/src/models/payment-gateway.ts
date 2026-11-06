import mongoose, { Schema } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

const timestamps = true;

// 1. Configuration Ikeepay
const ikeepayConfigSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    publicKey: { type: String, required: true, trim: true },
    secretKey: { type: String, required: true, trim: true },
    environment: { type: String, enum: ['SANDBOX', 'LIVE'], default: 'LIVE' },
    isActive: { type: Boolean, default: true },
    webhookSecret: { type: String, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps },
);

ikeepayConfigSchema.index({ organizationId: 1 }, { unique: true });

// 2. Journal des transactions Ikeepay
const ikeepayTransactionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    external_reference: { type: String, required: true, unique: true, index: true },
    provider_reference: { type: String, index: true },
    type: { type: String, enum: ['payin', 'payout'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'XOF' },
    country: { type: String, required: true, default: 'CI' },
    phoneNumber: { type: String, required: true },
    operator: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    purpose: {
      type: String,
      enum: [
        'RENT_PAYMENT',
        'CHEFFERIE_COMMISSION',
        'SUBSCRIPTION_PAYMENT',
        'MARKETPLACE_DEPOSIT',
        'OTHER',
      ],
      required: true,
    },
    referenceId: { type: String },
    customerEmail: { type: String },
    paymentLink: { type: String },
    description: { type: String },
    rawWebhookPayload: { type: Schema.Types.Mixed },
    verifiedAt: { type: Date },
  },
  { timestamps },
);

ikeepayTransactionSchema.index({ organizationId: 1, createdAt: -1 });

export type IkeepayConfigDocument = InferSchemaType<typeof ikeepayConfigSchema> & {
  _id: mongoose.Types.ObjectId;
};
export type IkeepayTransactionDocument = InferSchemaType<typeof ikeepayTransactionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const IkeepayConfig =
  (mongoose.models.IkeepayConfig as mongoose.Model<IkeepayConfigDocument>) ??
  mongoose.model<IkeepayConfigDocument>('IkeepayConfig', ikeepayConfigSchema);

export const IkeepayTransaction =
  (mongoose.models.IkeepayTransaction as mongoose.Model<IkeepayTransactionDocument>) ??
  mongoose.model<IkeepayTransactionDocument>('IkeepayTransaction', ikeepayTransactionSchema);
