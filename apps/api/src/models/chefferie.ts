import mongoose, { Schema } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

// 1. Paramètres des commissions de la Chefferie
const chefferieCommissionSettingsSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    neighborhoodId: {
      type: Schema.Types.ObjectId,
      ref: 'GeoNeighborhood',
      required: true,
      index: true,
    },
    cityId: { type: Schema.Types.ObjectId, ref: 'GeoCity' },
    houseSalePercent: { type: Number, default: 3, min: 0, max: 50 },
    houseRentPercent: { type: Number, default: 10, min: 0, max: 50 },
    landSalePercent: { type: Number, default: 5, min: 0, max: 50 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

chefferieCommissionSettingsSchema.index({ organizationId: 1, neighborhoodId: 1 }, { unique: true });

// 2. Vente de Maison
const houseSaleTransactionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    transactionNumber: { type: String, required: true, unique: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'GeoCity', required: true },
    neighborhoodId: {
      type: Schema.Types.ObjectId,
      ref: 'GeoNeighborhood',
      required: true,
      index: true,
    },
    blockId: { type: Schema.Types.ObjectId, ref: 'GeoBlock', required: true, index: true },
    residenceId: { type: Schema.Types.ObjectId, ref: 'QuartierResidence' },
    houseDescription: { type: String, required: true },
    address: { type: String, required: true },
    landmark: { type: String },

    formerOwner: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      nationalIdNumber: { type: String },
      address: { type: String },
    },
    newBuyer: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      nationalIdNumber: { type: String },
      address: { type: String },
    },

    salePriceMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'XOF' },
    commissionPercent: { type: Number, required: true, min: 0 },
    commissionDueMinor: { type: Number, required: true, min: 0 },
    commissionPaidMinor: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PARTIAL', 'PAID'],
      default: 'PENDING',
      index: true,
    },
    transactionDate: { type: Date, default: Date.now },

    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    certificateId: { type: Schema.Types.ObjectId, ref: 'ChefferieCertificate' },
    certificateNumber: { type: String },

    history: [
      {
        action: { type: String, required: true },
        performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        date: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
    notes: { type: String },
  },
  { timestamps: true },
);

houseSaleTransactionSchema.index({ organizationId: 1, neighborhoodId: 1, createdAt: -1 });

// 3. Location de Maison
const houseRentalRecordSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    rentalNumber: { type: String, required: true, unique: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'GeoCity', required: true },
    neighborhoodId: {
      type: Schema.Types.ObjectId,
      ref: 'GeoNeighborhood',
      required: true,
      index: true,
    },
    blockId: { type: Schema.Types.ObjectId, ref: 'GeoBlock', required: true, index: true },
    residenceId: { type: Schema.Types.ObjectId, ref: 'QuartierResidence' },
    houseDescription: { type: String, required: true },
    address: { type: String, required: true },

    owner: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      nationalIdNumber: { type: String },
    },
    tenant: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      profession: { type: String },
    },

    rentAmountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'XOF' },
    rentalDurationMonths: { type: Number, default: 12, min: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date },

    commissionPercent: { type: Number, required: true, min: 0 },
    commissionDueMinor: { type: Number, required: true, min: 0 },
    commissionPaidMinor: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PARTIAL', 'PAID'],
      default: 'PENDING',
      index: true,
    },

    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    certificateId: { type: Schema.Types.ObjectId, ref: 'ChefferieCertificate' },
    certificateNumber: { type: String },

    history: [
      {
        action: { type: String, required: true },
        performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        date: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
    notes: { type: String },
  },
  { timestamps: true },
);

houseRentalRecordSchema.index({ organizationId: 1, neighborhoodId: 1, createdAt: -1 });

// 4. Vente de Terrain (Transactions Foncières)
const landSaleTransactionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    transactionNumber: { type: String, required: true, unique: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'GeoCity', required: true },
    neighborhoodId: {
      type: Schema.Types.ObjectId,
      ref: 'GeoNeighborhood',
      required: true,
      index: true,
    },
    blockId: { type: Schema.Types.ObjectId, ref: 'GeoBlock', required: true, index: true },
    plotNumber: { type: String },
    locationText: { type: String, required: true },
    surfaceM2: { type: Number, required: true, min: 1 },

    initialOwner: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      nationalIdNumber: { type: String },
    },
    newBuyer: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      nationalIdNumber: { type: String },
    },

    salePriceMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'XOF' },
    commissionPercent: { type: Number, required: true, min: 0 },
    commissionDueMinor: { type: Number, required: true, min: 0 },
    commissionPaidMinor: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PARTIAL', 'PAID'],
      default: 'PENDING',
      index: true,
    },
    transactionDate: { type: Date, default: Date.now },
    boundaryCoordinates: [
      {
        lat: { type: Number },
        lng: { type: Number },
      },
    ],

    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    certificateId: { type: Schema.Types.ObjectId, ref: 'ChefferieCertificate' },
    certificateNumber: { type: String },

    history: [
      {
        action: { type: String, required: true },
        performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        date: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
    notes: { type: String },
  },
  { timestamps: true },
);

landSaleTransactionSchema.index({ organizationId: 1, neighborhoodId: 1, createdAt: -1 });

// 5. Certificat Officiel délivré par la Chefferie
const chefferieCertificateSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    certificateNumber: { type: String, required: true, unique: true },
    operationType: {
      type: String,
      enum: ['HOUSE_SALE', 'HOUSE_RENTAL', 'LAND_SALE'],
      required: true,
      index: true,
    },
    transactionId: { type: Schema.Types.ObjectId, required: true, index: true },
    transactionNumber: { type: String, required: true },

    chefferieName: { type: String, required: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'GeoCity', required: true },
    neighborhoodId: { type: Schema.Types.ObjectId, ref: 'GeoNeighborhood', required: true },
    blockId: { type: Schema.Types.ObjectId, ref: 'GeoBlock', required: true },

    parties: {
      partyA: { type: String, required: true }, // Vendeur ou Bailleur
      partyARole: { type: String, required: true },
      partyAPhone: { type: String },
      partyB: { type: String, required: true }, // Acquéreur ou Locataire
      partyBRole: { type: String, required: true },
      partyBPhone: { type: String },
    },

    propertyDetails: {
      description: { type: String, required: true },
      address: { type: String, required: true },
      surfaceM2: { type: Number },
      plotNumber: { type: String },
    },

    financialDetails: {
      transactionAmountMinor: { type: Number, required: true },
      commissionPaidMinor: { type: Number, default: 0 },
      currency: { type: String, default: 'XOF' },
    },

    operationDate: { type: Date, required: true },
    issuedDate: { type: Date, default: Date.now },

    signatoryName: { type: String, required: true },
    signatoryTitle: { type: String, default: 'Chef de Quartier / Chef Traditionnel' },
    isSigned: { type: Boolean, default: true },
    signatureImageUrl: { type: String },
    isStamped: { type: Boolean, default: true },
    stampImageUrl: { type: String },

    verificationCode: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'REVOKED'],
      default: 'ISSUED',
      index: true,
    },
    pdfUrl: { type: String },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

chefferieCertificateSchema.index({ organizationId: 1, certificateNumber: 1 });
chefferieCertificateSchema.index({ organizationId: 1, verificationCode: 1 });

export const ChefferieCommissionSettings = mongoose.model(
  'ChefferieCommissionSettings',
  chefferieCommissionSettingsSchema,
);
export const HouseSaleTransaction = mongoose.model(
  'HouseSaleTransaction',
  houseSaleTransactionSchema,
);
export const HouseRentalRecord = mongoose.model('HouseRentalRecord', houseRentalRecordSchema);
export const LandSaleTransaction = mongoose.model('LandSaleTransaction', landSaleTransactionSchema);
export const ChefferieCertificate = mongoose.model(
  'ChefferieCertificate',
  chefferieCertificateSchema,
);

export type ChefferieCommissionSettingsDoc = InferSchemaType<
  typeof chefferieCommissionSettingsSchema
>;
export type HouseSaleTransactionDoc = InferSchemaType<typeof houseSaleTransactionSchema>;
export type HouseRentalRecordDoc = InferSchemaType<typeof houseRentalRecordSchema>;
export type LandSaleTransactionDoc = InferSchemaType<typeof landSaleTransactionSchema>;
export type ChefferieCertificateDoc = InferSchemaType<typeof chefferieCertificateSchema>;
