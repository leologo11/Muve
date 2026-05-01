import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  rut:           { type: String, trim: true },          // RUT / NIT / tax ID
  address:       { type: String, trim: true },
  contactPerson: { type: String, trim: true },
  contactEmail:  { type: String, trim: true },
  contactPhone:  { type: String, trim: true },
  notes:         { type: String, trim: true },
  active:        { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Company', companySchema);
