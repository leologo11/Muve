import mongoose from 'mongoose';
import crypto from 'crypto';

const credentialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  keyId: { type: String, required: true, unique: true, index: true },
  secretHash: { type: String, required: true },
  prefix: { type: String, required: true },
  revoked: { type: Boolean, default: false, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastUsedAt: { type: Date },
  revokedAt: { type: Date },
}, { timestamps: true });

credentialSchema.statics.generatePair = function () {
  const keyId = `muve_${crypto.randomBytes(8).toString('hex')}`;
  const secret = `sk_muve_${crypto.randomBytes(24).toString('hex')}`;
  const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
  return { keyId, secret, secretHash, prefix: secret.slice(0, 16) };
};

credentialSchema.set('toJSON', {
  transform: (_, obj) => {
    delete obj.secretHash;
    return obj;
  }
});

export default mongoose.model('Credential', credentialSchema);
