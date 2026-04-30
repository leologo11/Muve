import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  commune: { type: String, required: true, unique: true, trim: true },
  price:   { type: Number, required: true, min: 0 },
  zone:    { type: String, trim: true, default: '' }
}, { timestamps: true });

export default mongoose.model('PriceConfig', schema);
