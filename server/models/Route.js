import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const routeSchema = new mongoose.Schema({
  routeCode: { type: String, unique: true, index: true },
  name: { type: String, trim: true },
  date: { type: Date, required: true, default: Date.now },

  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },

  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'cancelled'],
    default: 'active'
  },

  // Client company info (the business contracting the delivery)
  clientCompany: {
    name: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    contactPhone: { type: String, trim: true }
  },

  // Invoice / payment tracking
  invoice: {
    status: {
      type: String,
      enum: ['none', 'pending', 'net30', 'paid', 'overdue'],
      default: 'none'
    },
    amount: { type: Number },
    invoiceDate: { type: Date },
    dueDate: { type: Date },
    notes: { type: String, trim: true }
  },

  // Pickup / starting point (bodega)
  startPoint: {
    address: { type: String, trim: true },
    lat: { type: Number },
    lng: { type: Number }
  },

  // Cached stats
  stats: {
    total: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    collectedAmount: { type: Number, default: 0 }
  },

  notes: { type: String, trim: true }
}, { timestamps: true });

routeSchema.pre('save', function (next) {
  if (!this.routeCode) {
    const d = new Date(this.date);
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    this.routeCode = `RT-${dateStr}-${nanoid(4).toUpperCase()}`;
  }
  // Auto-set due date for net30
  if (this.invoice?.status === 'net30' && this.invoice?.invoiceDate && !this.invoice?.dueDate) {
    const due = new Date(this.invoice.invoiceDate);
    due.setDate(due.getDate() + 30);
    this.invoice.dueDate = due;
  }
  next();
});

export default mongoose.model('Route', routeSchema);
