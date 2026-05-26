import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  qty2:      { type: Number, required: true, min: 2, default: 4 },
  qty3:      { type: Number, required: true, min: 3, default: 8 },
  mode:      { type: String, enum: ['flat', 'pct'], default: 'flat' },
  discount2: { type: Number, required: true, min: 0, default: 0 },
  discount3: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });

export default mongoose.model('TierTemplate', schema);
