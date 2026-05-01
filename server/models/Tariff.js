import mongoose from 'mongoose';

const tariffSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  defaultPrice: { type: Number, default: 3500, min: 0 },
  items: [{
    commune: { type: String, required: true, trim: true },
    price:   { type: Number, required: true, min: 0 },
    zone:    { type: String, trim: true, default: '' }
  }]
}, { timestamps: true });

export default mongoose.model('Tariff', tariffSchema);
