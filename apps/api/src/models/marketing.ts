import mongoose, { Schema } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

const bannerItemSchema = new Schema(
  {
    text: { type: String, required: true },
    tag: { type: String, default: 'INFO' },
    link: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

const marketingSettingsSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    tickerBanners: { type: [bannerItemSchema], default: [] },
    contactInfo: {
      email: { type: String, default: 'contact@katdestate.immo' },
      phone: { type: String, default: '+225 07 00 00 00 00' },
      whatsapp: { type: String, default: '+225 07 00 00 00 00' },
      address: { type: String, default: 'Abidjan, Cocody Riviera Palmeraie & Dakar, Plateau' },
      openingHours: { type: String, default: 'Lun - Sam : 08h00 - 18h30' },
      supportNote: { type: String, default: 'Assistance 24/7 pour les urgences locatives et signalements de quartier.' },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// Formulaire de message contact
const contactMessageSchema = new Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['NEW', 'READ', 'ARCHIVED'], default: 'NEW' },
  },
  { timestamps: true },
);

export type MarketingSettingsDocument = InferSchemaType<typeof marketingSettingsSchema> & { _id: mongoose.Types.ObjectId };
export type ContactMessageDocument = InferSchemaType<typeof contactMessageSchema> & { _id: mongoose.Types.ObjectId };

export const MarketingSettings =
  (mongoose.models.MarketingSettings as mongoose.Model<MarketingSettingsDocument>) ??
  mongoose.model<MarketingSettingsDocument>('MarketingSettings', marketingSettingsSchema);

export const ContactMessage =
  (mongoose.models.ContactMessage as mongoose.Model<ContactMessageDocument>) ??
  mongoose.model<ContactMessageDocument>('ContactMessage', contactMessageSchema);
