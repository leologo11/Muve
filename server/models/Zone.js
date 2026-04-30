import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true },
  price:  { type: Number, required: true, min: 0 },
  color:  { type: String, default: '#5c35cc' },
  source: { type: String, enum: ['commune', 'custom'], default: 'custom' },
  polygon: {
    type:        { type: String, enum: ['Polygon'], required: true, default: 'Polygon' },
    coordinates: { type: [[[Number]]], required: true }
  }
}, { timestamps: true });

export default mongoose.model('Zone', schema);
