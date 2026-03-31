// routes/studio.js
// Studio Catalogue + Portfolio + Booking API — MongoDB version

const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { Package, Portfolio, Offer, TvContent } = require('./studioModels');

// ─── Multer upload config ──────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../uploads/portfolio');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Smart portfolio sort ──────────────────────────────────────────────────
function smartSort(items) {
  return [...items].sort((a, b) => {
    const dateDiff = new Date(b.deliveredDate || 0) - new Date(a.deliveredDate || 0);
    if (dateDiff !== 0) return dateDiff;
    const tierOrder = { PKG004:0, PKG003:1, PKG002:2, PKG001:3 };
    const tierDiff  = (tierOrder[a.packageId] ?? 9) - (tierOrder[b.packageId] ?? 9);
    if (tierDiff !== 0) return tierDiff;
    const aRec = (a.tags||[]).includes('recommended') ? 0 : 1;
    const bRec = (b.tags||[]).includes('recommended') ? 0 : 1;
    return aRec - bRec;
  });
}

// ─── Most popular package ──────────────────────────────────────────────────
async function getMostPopularPackageId() {
  try {
    const Booking = require('./booking');
    const bookings = await Booking.find({}, { packageName: 1 }).lean();
    const counts = {};
    bookings.forEach(b => {
      if (b.packageName) counts[b.packageName] = (counts[b.packageName]||0)+1;
    });
    let max = 0, bestName = null;
    Object.entries(counts).forEach(([name, cnt]) => { if (cnt > max) { max=cnt; bestName=name; } });
    if (!bestName) return null;
    const pkg = await Package.findOne({ name: bestName }).lean();
    return pkg ? pkg._id.toString() : null;
  } catch { return null; }
}

// ─── Package Recommendation ────────────────────────────────────────────────
async function recommendPackage(eventType, guestCount) {
  const packages = await Package.find().lean();
  if (!packages.length) return null;
  const gc = parseInt(guestCount) || 0;
  const et = (eventType || '').toLowerCase();
  if ((et.includes('wedding') || et.includes('reception')) && gc > 300)
    return packages.find(p => p.tier === 'elite') || packages[packages.length-1];
  if ((et.includes('wedding') || et.includes('reception')) && gc > 150)
    return packages.find(p => p.tier === 'premium') || packages[packages.length-2];
  if (et.includes('wedding') || et.includes('anniversary') || gc > 50)
    return packages.find(p => p.tier === 'standard') || packages[1];
  return packages.find(p => p.tier === 'basic') || packages[0];
}

// ═══════════════════════════════════════════════════════════════════════════
//  PACKAGES
// ═══════════════════════════════════════════════════════════════════════════

router.get('/packages', async (req, res) => {
  try {
    const packages  = await Package.find().lean();
    const popularId = await getMostPopularPackageId();
    res.json({ success: true, data: packages.map(p => ({
      ...p, id: p._id.toString(),
      isMostPopular: p._id.toString() === popularId,
    }))});
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/packages/:id', async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id).lean();
    if (!pkg) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: { ...pkg, id: pkg._id.toString() } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/packages', async (req, res) => {
  try {
    const pkg = await Package.create(req.body);
    res.json({ success: true, data: { ...pkg.toObject(), id: pkg._id.toString() } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.put('/packages/:id', async (req, res) => {
  try {
    const pkg = await Package.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!pkg) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: { ...pkg, id: pkg._id.toString() } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/packages/:id', async (req, res) => {
  try {
    await Package.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  PORTFOLIO  ← KEY FIX: uses MongoDB findByIdAndUpdate with $set
// ═══════════════════════════════════════════════════════════════════════════

router.get('/portfolio', async (req, res) => {
  try {
    const items = await Portfolio.find({ showInPortfolio: true }).lean();
    res.json({ success: true, data: smartSort(items.map(p => ({ ...p, id: p._id.toString() }))) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/portfolio', async (req, res) => {
  try {
    const item = await Portfolio.create(req.body);
    res.json({ success: true, data: { ...item.toObject(), id: item._id.toString() } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PUT — uses $set so every field including coverImage is always written
router.put('/portfolio/:id', async (req, res) => {
  try {
    const item = await Portfolio.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: false }
    ).lean();
    if (!item) return res.status(404).json({ success: false, error: 'Portfolio item not found — check ID' });
    res.json({ success: true, data: { ...item, id: item._id.toString() } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/portfolio/:id', async (req, res) => {
  try {
    await Portfolio.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  OFFERS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/offers', async (req, res) => {
  try {
    const all  = await Offer.find().lean();
    const now  = new Date();
    const active = all.filter(o => {
      if (!o.active) return false;
      if (o.validUntil && new Date(o.validUntil) < now) return false;
      if (o.validFrom  && new Date(o.validFrom)  > now) return false;
      return true;
    });
    res.json({
      success: true,
      data: active.map(o => ({ ...o, id: o._id.toString() })),
      all:  all.map(o => ({ ...o, id: o._id.toString() })),
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/offers', async (req, res) => {
  try {
    const offer = await Offer.create(req.body);
    res.json({ success: true, data: { ...offer.toObject(), id: offer._id.toString() } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.put('/offers/:id', async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!offer) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: { ...offer, id: offer._id.toString() } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/offers/:id', async (req, res) => {
  try {
    await Offer.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  TV CONTENT
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_TV = {
  studioName: 'DP Studio & Light',
  tagline: 'Every moment, beautifully preserved.',
  contactPhone: '+91 90835 21201',
  slideshow: { imageDuration: 8000, videoDuration: 15000, autoRefreshInterval: 60000 },
  sections: ['portfolio', 'packages', 'offers'],
};

router.get('/tv-content', async (req, res) => {
  try {
    const configDoc = await TvContent.findOne({ key: 'config' }).lean();
    const config    = configDoc?.value || DEFAULT_TV;
    const portfolio = await Portfolio.find({ showInPortfolio: true }).lean();
    const packages  = await Package.find().lean();
    const offers    = await Offer.find({ active: true }).lean();
    const popularId = await getMostPopularPackageId();
    res.json({
      success: true, config,
      slides: {
        portfolio: smartSort(portfolio.map(p => ({ ...p, id: p._id.toString() }))),
        packages:  packages.map(p => ({ ...p, id: p._id.toString(), isMostPopular: p._id.toString() === popularId })),
        offers:    offers.map(o => ({ ...o, id: o._id.toString() })),
      }
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.put('/tv-content', async (req, res) => {
  try {
    await TvContent.findOneAndUpdate({ key: 'config' }, { key: 'config', value: req.body }, { upsert: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  UPLOAD
// ═══════════════════════════════════════════════════════════════════════════

router.post('/upload-demo', upload.array('files', 20), (req, res) => {
  try {
    const urls = req.files.map(f => `/uploads/portfolio/${f.filename}`);
    res.json({ success: true, urls });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  RECOMMENDATION
// ═══════════════════════════════════════════════════════════════════════════

router.get('/recommend', async (req, res) => {
  try {
    const pkg = await recommendPackage(req.query.eventType, req.query.guestCount);
    if (!pkg) return res.status(404).json({ success: false, error: 'No packages found' });
    res.json({ success: true, data: { ...pkg, id: pkg._id.toString() } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  ADVANCE RECEIPT
// ═══════════════════════════════════════════════════════════════════════════

router.post('/generate-receipt', async (req, res) => {
  try {
    const { bookingId } = req.body;
    const Booking = require('./booking');
    const booking = await Booking.findById(bookingId).lean();
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    let pkg = null;
    if (booking.packageId) pkg = await Package.findById(booking.packageId).lean();
    if (!pkg && booking.packageName) pkg = await Package.findOne({ name: booking.packageName }).lean();
    if (!pkg) pkg = { name: booking.packageName || 'Custom Package', price: booking.totalAmount || 0, includes: {} };

    const receiptsDir = path.join(__dirname, '../receipts');
    if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

    const { generateAdvanceReceipt, buildWhatsAppMessage } = require('../receipt-generator');
    const filename    = `receipt-${bookingId}-${Date.now()}.pdf`;
    const outputPath  = path.join(receiptsDir, filename);
    const bookingData = {
      customerName: booking.customerName,
      phone:        booking.customerPhone,
      eventType:    booking.eventType,
      eventDate:    booking.eventDate,
      guestCount:   booking.guestCount || '',
      advancePaid:  booking.advancePaid || 0,
    };

    await generateAdvanceReceipt(bookingData, pkg, outputPath);
    const phone  = (booking.customerPhone || '').replace(/\D/g, '');
    const waLink = `https://wa.me/${phone}?text=${buildWhatsAppMessage(bookingData, pkg)}`;
    res.json({ success: true, receiptUrl: `/receipts/${filename}`, whatsappLink: waLink });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
