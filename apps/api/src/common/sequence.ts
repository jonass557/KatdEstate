import mongoose, { Schema, model, type Model } from 'mongoose';
const models = mongoose.models;

/**
 * Compteur atomique par organisation et par type de document.
 *
 * `findOneAndUpdate` + `$inc` garantit l'unicité même sous requêtes concurrentes :
 * deux factures créées en même temps ne peuvent pas obtenir le même numéro.
 */

const sequenceSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true },
  key: { type: String, required: true },
  value: { type: Number, required: true, default: 0 },
});
sequenceSchema.index({ organizationId: 1, key: 1 }, { unique: true, name: 'sequences_org_key_unique' });

const Sequence = (models.Sequence as Model<{ value: number }>) ?? model('Sequence', sequenceSchema);

export async function nextNumber(
  organizationId: string,
  prefix: string,
  date: Date = new Date(),
): Promise<string> {
  const year = date.getUTCFullYear();
  const key = `${prefix}-${year}`;
  const sequence = await Sequence.findOneAndUpdate(
    { organizationId, key },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  );
  return `${prefix}-${year}-${String(sequence.value).padStart(5, '0')}`;
}
