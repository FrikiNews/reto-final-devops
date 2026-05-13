const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nombre:   { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  empresa:  { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa' },
  rol:      { type: String, enum: ['admin', 'usuario'], default: 'usuario' },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Never expose password
userSchema.set('toJSON', {
  transform: (_doc, ret) => { delete ret.password; return ret; },
});

module.exports = mongoose.model('User', userSchema);
