import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'driver', 'company', 'customer'],
    required: true
  },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  active: { type: Boolean, default: true },
  phone: { type: String, trim: true },
  // Driver-specific
  vehicle: { type: String, trim: true },
  licensePlate: { type: String, trim: true },
  // Company-specific
  companyName: { type: String, trim: true },
  rut: { type: String, trim: true },

  // Real-time GPS location (drivers only — updated by watchPosition)
  location: {
    lat:       { type: Number },
    lng:       { type: Number },
    heading:   { type: Number },   // degrees from true north (0–360)
    speed:     { type: Number },   // m/s
    accuracy:  { type: Number },   // meters
    updatedAt: { type: Date }
  }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (_, obj) => { delete obj.password; return obj; }
});

export default mongoose.model('User', userSchema);
