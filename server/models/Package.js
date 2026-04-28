import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const packageSchema = new mongoose.Schema({
  // Unique public-facing ID customers can use to track
  trackingId: {
    type: String,
    default: () => 'PKG-' + nanoid(8).toUpperCase(),
    unique: true,
    index: true
  },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },

  // Customer info
  customerName: { type: String, required: true, trim: true },
  customerLastName: { type: String, trim: true },
  customerPhone: { type: String, trim: true },
  address: { type: String, required: true, trim: true },
  commune: { type: String, trim: true },
  aptFloor: { type: String, trim: true },
  zone: { type: String, trim: true },
  price: { type: Number, default: 0 },

  // Geo coordinates
  lat: { type: Number },
  lng: { type: Number },

  // Order within the route
  order: { type: Number, default: 0 },

  // Delivery status
  status: {
    type: String,
    enum: ['pendiente', 'entregado', 'no-entregado', 'eliminado'],
    default: 'pendiente'
  },
  failReason: { type: String, trim: true },
  note: { type: String, trim: true },

  // Photo stored on Cloudinary
  photoUrl: { type: String },
  photoPublicId: { type: String },
  photoUploadedAt: { type: Date },

  // Timestamps for delivery events
  deliveredAt: { type: Date },
  deliveredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Package', packageSchema);
