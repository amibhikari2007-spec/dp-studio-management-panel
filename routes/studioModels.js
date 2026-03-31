// routes/studioModels.js
// Mongoose models for Studio Catalogue + Portfolio system

const mongoose = require('mongoose');

// ── Package ────────────────────────────────────────────────────────────────
const PackageSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  tier:        { type: String, default: 'standard' },
  price:       { type: Number, default: 0 },
  description: { type: String, default: '' },
  color:       { type: String, default: '#7C3AED' },
  recommended: { type: Boolean, default: false },
  eventTypes:  [String],
  includes: {
    photography:   { type: Boolean, default: false },
    videography:   { type: Boolean, default: false },
    album:         { type: Boolean, default: false },
    albumPages:    { type: Number, default: 0 },
    drone:         { type: Boolean, default: false },
    highlightFilm: { type: Boolean, default: false },
    baseHours:     { type: Number, default: 0 },
    extraHours:    { type: Number, default: 0 },
  }
}, { timestamps: true });

// ── Portfolio ──────────────────────────────────────────────────────────────
const PortfolioSchema = new mongoose.Schema({
  title:           { type: String, required: true },
  eventType:       { type: String, default: 'wedding' },
  packageId:       { type: String, default: '' },
  date:            { type: String, default: '' },
  deliveredDate:   { type: String, default: '' },
  isDemo:          { type: Boolean, default: false },
  showInPortfolio: { type: Boolean, default: true },
  status:          { type: String, default: 'Delivered' },
  images:          [String],
  coverImage:      { type: String, default: '' },
  videoUrl:        { type: String, default: '' },
  tags:            [String],
  description:     { type: String, default: '' },
  guestCount:      { type: Number, default: 0 },
}, { timestamps: true });

// ── Offer ──────────────────────────────────────────────────────────────────
const OfferSchema = new mongoose.Schema({
  title:        { type: String, required: true },
  subtitle:     { type: String, default: '' },
  discount:     { type: Number, default: 0 },
  discountType: { type: String, default: 'percentage' },
  appliesTo:    [String],
  validFrom:    { type: String, default: '' },
  validUntil:   { type: String, default: '' },
  active:       { type: Boolean, default: true },
  bgColor:      { type: String, default: '#7C3AED' },
  textColor:    { type: String, default: '#FFFFFF' },
  badgeText:    { type: String, default: 'OFFER' },
}, { timestamps: true });

// ── TV Content config ──────────────────────────────────────────────────────
const TvContentSchema = new mongoose.Schema({
  key:   { type: String, default: 'config' },
  value: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = {
  Package:   mongoose.models.Package   || mongoose.model('Package',   PackageSchema),
  Portfolio: mongoose.models.Portfolio || mongoose.model('Portfolio', PortfolioSchema),
  Offer:     mongoose.models.Offer     || mongoose.model('Offer',     OfferSchema),
  TvContent: mongoose.models.TvContent || mongoose.model('TvContent', TvContentSchema),
};
