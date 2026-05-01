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
    enum: ['pendiente', 'entregado', 'no-entregado', 'devuelto', 'eliminado'],
    default: 'pendiente'
  },
  failReason: { type: String, trim: true },
  note: { type: String, trim: true },

  // Photos stored on Cloudinary (max 2)
  photoUrl: { type: String },
  photoPublicId: { type: String },
  photoUploadedAt: { type: Date },
  photo2Url: { type: String },
  photo2PublicId: { type: String },
  photo2UploadedAt: { type: Date },

  // AI import flags — field names Claude flagged as uncertain/unreadable
  aiFlags: { type: [String], default: [] },

  // Timestamps for delivery events
  deliveredAt: { type: Date },
  deliveredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

packageSchema.index({ routeId: 1 });
packageSchema.index({ routeId: 1, status: 1 });
packageSchema.index({ routeId: 1, order: 1 });
packageSchema.index({ createdAt: -1 });

export default mongoose.model('Package', packageSchema);
