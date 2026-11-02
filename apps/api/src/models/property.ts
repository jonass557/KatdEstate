import mongoose, { Schema, model, type InferSchemaType, type Model, type Types } from 'mongoose';
const models = mongoose.models;
import { PROPERTY_STATUSES, PROPERTY_TYPES, UNIT_STATUSES, UNIT_TYPES } from '@rentflow/shared';

const timestamps = true;
const org = { type: Schema.Types.ObjectId, ref: 'Organization', required: true } as const;

const photoSchema = new Schema(
  { fileId: { type: Schema.Types.ObjectId, ref: 'StoredFile', required: true } },
  { _id: false },
);

const propertySchema = new Schema(
  {
    organizationId: org,
    name: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: PROPERTY_TYPES, default: 'BUILDING', index: true },
    address: { type: String, required: true, trim: true, maxlength: 240 },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    country: { type: String, required: true, uppercase: true, length: 2 },
    description: { type: String, maxlength: 4_000 },
    status: { type: String, enum: PROPERTY_STATUSES, default: 'ACTIVE', index: true },
    owner: { type: String, maxlength: 160 },
    manager: { type: String, maxlength: 160 },
    acquisitionDate: { type: Date },
    value: { type: Number, min: 0 },
    photos: { type: [photoSchema], default: [] },
    documents: { type: [photoSchema], default: [] },
    deletedAt: { type: Date },
  },
  { timestamps },
);
propertySchema.index({ organizationId: 1, name: 1 }, { name: 'properties_org_name' });
propertySchema.index({ organizationId: 1, city: 1 }, { name: 'properties_org_city' });
propertySchema.index({ organizationId: 1, type: 1 }, { name: 'properties_org_type' });

const buildingSchema = new Schema(
  {
    organizationId: org,
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 240 },
    floors: { type: Number, min: 0 },
    deletedAt: { type: Date },
  },
  { timestamps },
);
buildingSchema.index({ organizationId: 1, propertyId: 1 }, { name: 'buildings_org_property' });

const unitSchema = new Schema(
  {
    organizationId: org,
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    buildingId: { type: Schema.Types.ObjectId, ref: 'Building' },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    number: { type: String, trim: true, maxlength: 32 },
    floor: { type: Number },
    type: { type: String, enum: UNIT_TYPES, required: true },
    surfaceM2: { type: Number, min: 0 },
    bedrooms: { type: Number, min: 0 },
    bathrooms: { type: Number, min: 0 },
    rentAmountMinor: { type: Number, required: true, min: 0 },
    chargesAmountMinor: { type: Number, required: true, min: 0, default: 0 },
    depositAmountMinor: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, enum: UNIT_STATUSES, default: 'AVAILABLE', index: true },
    description: { type: String, maxlength: 4_000 },
    photos: { type: [photoSchema], default: [] },
    documents: { type: [photoSchema], default: [] },
    amenities: { type: [String], default: [] },
    deletedAt: { type: Date },
  },
  { timestamps },
);
unitSchema.index({ organizationId: 1, propertyId: 1, status: 1 }, { name: 'units_org_property_status' });
unitSchema.index({ organizationId: 1, type: 1 }, { name: 'units_org_type' });

export type PropertyDocument = InferSchemaType<typeof propertySchema> & { _id: Types.ObjectId };
export type BuildingDocument = InferSchemaType<typeof buildingSchema> & { _id: Types.ObjectId };
export type UnitDocument = InferSchemaType<typeof unitSchema> & { _id: Types.ObjectId };

export const Property =
  (models.Property as Model<PropertyDocument>) ?? model<PropertyDocument>('Property', propertySchema);
export const Building =
  (models.Building as Model<BuildingDocument>) ?? model<BuildingDocument>('Building', buildingSchema);
export const Unit = (models.Unit as Model<UnitDocument>) ?? model<UnitDocument>('Unit', unitSchema);
