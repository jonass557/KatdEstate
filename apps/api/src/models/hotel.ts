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

// ============================================================================
// Connected Hotel Operational Models (Rooms, Reservations, Payments, Restaurant, Services, Activity)
// ============================================================================

const hotelRoomSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    establishmentId: { type: Schema.Types.ObjectId, ref: 'HotelEstablishment', required: true, index: true },
    roomNumber: { type: String, required: true, trim: true },
    categoryName: { type: String, default: 'Standard', trim: true },
    floor: { type: Number, default: 1 },
    pricePerNight: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'FCFA' },
    status: {
      type: String,
      enum: ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'],
      default: 'AVAILABLE',
      index: true,
    },
    amenities: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type HotelRoomDocument = InferSchemaType<typeof hotelRoomSchema> & { _id: Types.ObjectId };
export const HotelRoom =
  (models.HotelRoom as Model<HotelRoomDocument>) ??
  model<HotelRoomDocument>('HotelRoom', hotelRoomSchema);

const hotelReservationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    establishmentId: { type: Schema.Types.ObjectId, ref: 'HotelEstablishment', required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'HotelRoom' },
    roomNumber: { type: String, trim: true },
    guestName: { type: String, required: true, trim: true },
    guestEmail: { type: String, trim: true, lowercase: true },
    guestPhone: { type: String, trim: true },
    source: {
      type: String,
      enum: ['DIRECT', 'OTA', 'CORPORATE', 'WALK_IN'],
      default: 'DIRECT',
    },
    checkInDate: { type: Date, required: true, index: true },
    checkOutDate: { type: Date, required: true, index: true },
    nights: { type: Number, min: 1, default: 1 },
    totalAmount: { type: Number, min: 0, default: 0 },
    paidAmount: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'FCFA' },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'],
      default: 'CONFIRMED',
      index: true,
    },
  },
  { timestamps: true },
);

export type HotelReservationDocument = InferSchemaType<typeof hotelReservationSchema> & {
  _id: Types.ObjectId;
};
export const HotelReservation =
  (models.HotelReservation as Model<HotelReservationDocument>) ??
  model<HotelReservationDocument>('HotelReservation', hotelReservationSchema);

const hotelPaymentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    establishmentId: { type: Schema.Types.ObjectId, ref: 'HotelEstablishment', required: true, index: true },
    reservationId: { type: Schema.Types.ObjectId, ref: 'HotelReservation' },
    guestName: { type: String, trim: true, default: 'Client' },
    amount: { type: Number, min: 0, required: true },
    currency: { type: String, default: 'FCFA' },
    method: {
      type: String,
      enum: ['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'],
      default: 'MOBILE_MONEY',
    },
    category: {
      type: String,
      enum: ['ROOM', 'RESTAURANT', 'SERVICE'],
      default: 'ROOM',
    },
    status: {
      type: String,
      enum: ['PAID', 'PENDING', 'REFUNDED'],
      default: 'PAID',
      index: true,
    },
    paidAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true },
);

export type HotelPaymentDocument = InferSchemaType<typeof hotelPaymentSchema> & {
  _id: Types.ObjectId;
};
export const HotelPayment =
  (models.HotelPayment as Model<HotelPaymentDocument>) ??
  model<HotelPaymentDocument>('HotelPayment', hotelPaymentSchema);

const hotelRestaurantOrderSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    establishmentId: { type: Schema.Types.ObjectId, ref: 'HotelEstablishment', required: true, index: true },
    reservationId: { type: Schema.Types.ObjectId, ref: 'HotelReservation' },
    roomNumber: { type: String, trim: true },
    label: { type: String, trim: true, default: 'Commande Restaurant' },
    totalAmount: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'FCFA' },
    status: {
      type: String,
      enum: ['PENDING', 'PREPARING', 'SERVED', 'PAID'],
      default: 'PENDING',
    },
    orderedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

export type HotelRestaurantOrderDocument = InferSchemaType<typeof hotelRestaurantOrderSchema> & {
  _id: Types.ObjectId;
};
export const HotelRestaurantOrder =
  (models.HotelRestaurantOrder as Model<HotelRestaurantOrderDocument>) ??
  model<HotelRestaurantOrderDocument>('HotelRestaurantOrder', hotelRestaurantOrderSchema);

const hotelExtraServiceOrderSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    establishmentId: { type: Schema.Types.ObjectId, ref: 'HotelEstablishment', required: true, index: true },
    reservationId: { type: Schema.Types.ObjectId, ref: 'HotelReservation' },
    serviceName: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['SPA', 'LAUNDRY', 'SHUTTLE', 'PARKING', 'OTHER'],
      default: 'OTHER',
    },
    amount: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'FCFA' },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'PAID'],
      default: 'PENDING',
    },
  },
  { timestamps: true },
);

export type HotelExtraServiceOrderDocument = InferSchemaType<typeof hotelExtraServiceOrderSchema> & {
  _id: Types.ObjectId;
};
export const HotelExtraServiceOrder =
  (models.HotelExtraServiceOrder as Model<HotelExtraServiceOrderDocument>) ??
  model<HotelExtraServiceOrderDocument>('HotelExtraServiceOrder', hotelExtraServiceOrderSchema);

const hotelActivityLogSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    establishmentId: { type: Schema.Types.ObjectId, ref: 'HotelEstablishment', required: true, index: true },
    type: { type: String, trim: true, default: 'SYSTEM' },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    actorName: { type: String, trim: true, default: 'Système' },
    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'ALERT'],
      default: 'INFO',
    },
  },
  { timestamps: true },
);

export type HotelActivityLogDocument = InferSchemaType<typeof hotelActivityLogSchema> & {
  _id: Types.ObjectId;
};
export const HotelActivityLog =
  (models.HotelActivityLog as Model<HotelActivityLogDocument>) ??
  model<HotelActivityLogDocument>('HotelActivityLog', hotelActivityLogSchema);
