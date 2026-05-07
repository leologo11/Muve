import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const itemSchema = new mongoose.Schema({
  customerName:     { type: String, trim: true, default: '' },
  customerLastName: { type: String, trim: true, default: '' },
  customerPhone:    { type: String, trim: true, default: '' },
  address:          { type: String, required: true, trim: true },
  commune:          { type: String, trim: true, default: '' },
  price:            { type: Number, min: 0, default: 0 },
  lat:              { type: Number },
  lng:              { type: Number },
  note:             { type: String, trim: true, default: '' },
}, { _id: true });

const quoteSchema = new mongoose.Schema({
  quoteCode:   { type: String, unique: true, index: true },
  shareToken:  { type: String, unique: true, sparse: true, index: true },

  serviceType: {
    type: String,
    enum: ['flete', 'mudanza', 'paqueteria'],
    default: 'flete',
    index: true
  },
  origin:      { type: String, trim: true, default: '' },
  destination: { type: String, trim: true, default: '' },
  moveSize:    { type: String, trim: true, default: '' },

  status: {
    type: String,
    enum: ['draft', 'sent', 'submitted', 'approved', 'rejected'],
    default: 'draft'
  },

  tariffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tariff' },

  // Client / recipient
  clientCompany:  { type: String, trim: true, default: '' },
  contactPerson:  { type: String, trim: true, default: '' },
  contactEmail:   { type: String, trim: true, default: '' },
  contactPhone:   { type: String, trim: true, default: '' },

  deliveryDate:  { type: Date },
  adminNotes:    { type: String, trim: true, default: '' },
  clientNotes:   { type: String, trim: true, default: '' },

  items: [itemSchema],

  // After approval
  driverId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  convertedRouteId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
}, { timestamps: true });

quoteSchema.pre('save', function (next) {
  if (!this.quoteCode) {
    const d = new Date();
    const ds = d.toISOString().slice(0, 10).replace(/-/g, '');
    this.quoteCode = `MUVE-${ds}-${nanoid(4).toUpperCase()}`;
  }
  next();
});

export default mongoose.model('Quote', quoteSchema);
