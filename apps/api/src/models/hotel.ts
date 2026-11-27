import mongoose, { Schema, model, type InferSchemaType, type Model, type Types } from 'mongoose';

const models = mongoose.models;

export const HOTEL_ESTABLISHMENT_TYPES = [
  'HOTEL',
  'MOTEL',
  'HOSTEL',
  'RESIDENCE',
  'FURNISHED_APARTMENT',
] as const;

export type HotelEstablishmentType = (typeof HOTEL_ESTABLISHMENT_TYPES)[number];

export const HOTEL_ESTABLISHMENT_STATUSES = [
  'ACTIVE',
  'MAINTENANCE',
  'INACTIVE',
  'ARCHIVED',
] as const;

export type HotelEstablishmentStatus = (typeof HOTEL_ESTABLISHMENT_STATUSES)[number];

const photoSubSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false },
);

const hotelEstablishmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    type: {
      type: String,
      enum: HOTEL_ESTABLISHMENT_TYPES,
      default: 'HOTEL',
      required: true,
    },
    stars: { type: Number, min: 1, max: 5, default: 3 },
    description: { type: String, trim: true, maxlength: 3000, default: '' },
    address: { type: String, required: true, trim: true, maxlength: 240 },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    country: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
    latitude: { type: Number },
    longitude: { type: Number },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },
    photos: { type: [photoSubSchema], default: [] },
    amenities: { type: [String], default: [] },
    status: {
      type: String,
      enum: HOTEL_ESTABLISHMENT_STATUSES,
      default: 'ACTIVE',
      index: true,
    },
    totalRooms: { type: Number, min: 0, default: 0 },
    occupiedRooms: { type: Number, min: 0, default: 0 },
    estimatedMonthlyRevenue: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, maxlength: 12, default: 'FCFA' },
  },
  { timestamps: true },
);

hotelEstablishmentSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
hotelEstablishmentSchema.index({ organizationId: 1, ownerId: 1 });
hotelEstablishmentSchema.index({ location: '2dsphere' });

export type HotelEstablishmentDocument = InferSchemaType<typeof hotelEstablishmentSchema> & {
  _id: Types.ObjectId;
};

export const HotelEstablishment =
  (models.HotelEstablishment as Model<HotelEstablishmentDocument>) ??
  model<HotelEstablishmentDocument>('HotelEstablishment', hotelEstablishmentSchema);
