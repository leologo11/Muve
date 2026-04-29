import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const routeSchema = new mongoose.Schema({
  // Unique route code: RT-YYYYMMDD-XXXX
  routeCode: {
    type: String,
    unique: true,
    index: true
  },

  name: { type: String, trim: true },
  date: { type: Date, required: true, default: Date.now },

  // Driver assigned to this route
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Company that contracted this route (optional)
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },

  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'cancelled'],
    default: 'draft'
  },

  // Cached stats (updated on package status change)
  stats: {
    total: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    collectedAmount: { type: Number, default: 0 }
  },

  // Pickup / starting point
  startPoint: {
    address: { type: String, trim: true },
    lat: { type: Number },
    lng: { type: Number }
  },

  notes: { type: String, trim: true }
}, { timestamps: true });

routeSchema.pre('save', function (next) {
  if (!this.routeCode) {
    const d = new Date(this.date);
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    this.routeCode = `RT-${dateStr}-${nanoid(4).toUpperCase()}`;
  }
  next();
});

export default mongoose.model('Route', routeSchema);
