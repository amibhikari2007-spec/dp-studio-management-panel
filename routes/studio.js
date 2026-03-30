// routes/studio.js
// Studio Catalogue + Portfolio + Booking API routes

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { generateAdvanceReceipt, buildWhatsAppMessage } = require('../receipt-generator');

// ─── Data file paths ───────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '../data');
const UPLOADS_DIR = path.join(__dirname, '../uploads/portfolio');

const paths = {
  packages:  path.join(DATA_DIR, 'packages.json'),
  portfolio: path.join(DATA_DIR, 'portfolio.json'),
  offers:    path.join(DATA_DIR, 'offers.json'),
  tvContent: path.join(DATA_DIR, 'tv-content.json'),
  bookings:  path.join(DATA_DIR, 'bookings.json'),
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const readJSON  = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJSON = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));
const ensureFile = (p, def) => { if (!fs.existsSync(p)) writeJSON(p, def); };

// Ensure all data files exist
ensureFile(paths.packages,  []);
ensureFile(paths.portfolio, []);
ensureFile(paths.offers,    []);
ensureFile(paths.bookings,  []);
ensureFile(paths.tvContent, {});

// Ensure uploads folder
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer config for demo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Smart portfolio sort ──────────────────────────────────────────────────
function smartSortPortfolio(items) {
  return [...items].sort((a, b) => {
    // 1. latest delivered first
    const dateDiff = new Date(b.deliveredDate || 0) - new Date(a.deliveredDate || 0);
    if (dateDiff !== 0) return dateDiff;
    // 2. premium package work
    const tierOrder = { PKG004: 0, PKG003: 1, PKG002: 2, PKG001: 3 };
    const tierDiff = (tierOrder[a.packageId] ?? 9) - (tierOrder[b.packageId] ?? 9);
    if (tierDiff !== 0) return tierDiff;
    // 3. recommended tagged work
    const aRec = (a.tags || []).includes('recommended') ? 0 : 1;
    const bRec = (b.tags || []).includes('recommended') ? 0 : 1;
    return aRec - bRec;
  });
}

// ─── Most popular package detector ────────────────────────────────────────
function getMostPopularPackageId() {
  try {
    const bookings = readJSON(paths.bookings);
    const counts = {};
    bookings.forEach(b => { if (b.packageId) counts[b.packageId] = (counts[b.packageId] || 0) + 1; });
    let max = 0, bestId = null;
    Object.entries(counts).forEach(([id, cnt]) => { if (cnt > max) { max = cnt; bestId = id; } });
    return bestId;
  } catch { return null; }
}

// ─── Package recommendation engine ────────────────────────────────────────
function recommendPackage(eventType, guestCount) {
  const packages = readJSON(paths.packages);
  const gc = parseInt(guestCount) || 0;
  const et = (eventType || '').toLowerCase();

  if ((et.includes('wedding') || et.includes('reception')) && gc > 300) {
    return packages.find(p => p.id === 'PKG004') || packages[packages.length - 1];
  }
  if ((et.includes('wedding') || et.includes('reception')) && gc > 150) {
    return packages.find(p => p.id === 'PKG003') || packages[packages.length - 2];
  }
  if (et.includes('wedding') || et.includes('anniversary') || gc > 50) {
    return packages.find(p => p.id === 'PKG002') || packages[1];
  }
  return packages.find(p => p.id === 'PKG001') || packages[0];
}

// ═══════════════════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/packages — list all packages, with most-popular badge
router.get('/packages', (req, res) => {
  try {
    const packages = readJSON(paths.packages);
    const popularId = getMostPopularPackageId();
    const result = packages.map(p => ({
      ...p,
      isMostPopular: p.id === popularId,
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/packages/:id — single package
router.get('/packages/:id', (req, res) => {
  try {
    const packages = readJSON(paths.packages);
    const pkg = packages.find(p => p.id === req.params.id);
    if (!pkg) return res.status(404).json({ success: false, error: 'Package not found' });
    res.json({ success: true, data: pkg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/packages — create package (admin)
router.post('/packages', (req, res) => {
  try {
    const packages = readJSON(paths.packages);
    const newPkg = { id: `PKG${Date.now()}`, ...req.body };
    packages.push(newPkg);
    writeJSON(paths.packages, packages);
    res.json({ success: true, data: newPkg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/packages/:id — update package (admin)
router.put('/packages/:id', (req, res) => {
  try {
    const packages = readJSON(paths.packages);
    const idx = packages.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Package not found' });
    packages[idx] = { ...packages[idx], ...req.body };
    writeJSON(paths.packages, packages);
    res.json({ success: true, data: packages[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/packages/:id
router.delete('/packages/:id', (req, res) => {
  try {
    let packages = readJSON(paths.packages);
    packages = packages.filter(p => p.id !== req.params.id);
    writeJSON(paths.packages, packages);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Portfolio ─────────────────────────────────────────────────────────────

// GET /api/portfolio — smart sorted portfolio
router.get('/portfolio', (req, res) => {
  try {
    const portfolio = readJSON(paths.portfolio);

    // Auto-include delivered bookings with showInPortfolio flag
    let bookings = [];
    try { bookings = readJSON(paths.bookings); } catch {}
    const packages = readJSON(paths.packages);

    const fromBookings = bookings
      .filter(b => b.status === 'Delivered' && b.showInPortfolio === true)
      .map(b => {
        const pkg = packages.find(p => p.id === b.packageId) || {};
        return {
          id: `AUTO-${b.id}`,
          title: `${b.customerName} — ${b.eventType}`,
          eventType: b.eventType,
          packageId: b.packageId,
          date: b.eventDate,
          deliveredDate: b.deliveredDate || b.eventDate,
          isDemo: false,
          showInPortfolio: true,
          status: 'Delivered',
          images: b.portfolioImages || [],
          coverImage: (b.portfolioImages || [])[0] || '',
          tags: pkg.tier === 'premium' || pkg.tier === 'elite' ? ['premium'] : [],
          description: `${b.eventType} — ${b.guestCount || '?'} guests`,
          guestCount: b.guestCount,
        };
      });

    // Merge, de-dupe by id
    const existingIds = new Set(portfolio.map(p => p.id));
    const merged = [
      ...portfolio.filter(p => p.showInPortfolio !== false),
      ...fromBookings.filter(p => !existingIds.has(p.id)),
    ];

    const sorted = smartSortPortfolio(merged);
    res.json({ success: true, data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/portfolio — add portfolio item (admin)
router.post('/portfolio', (req, res) => {
  try {
    const portfolio = readJSON(paths.portfolio);
    const item = { id: `PF${Date.now()}`, ...req.body };
    portfolio.push(item);
    writeJSON(paths.portfolio, portfolio);
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/portfolio/:id
router.put('/portfolio/:id', (req, res) => {
  try {
    const portfolio = readJSON(paths.portfolio);
    const idx = portfolio.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });
    portfolio[idx] = { ...portfolio[idx], ...req.body };
    writeJSON(paths.portfolio, portfolio);
    res.json({ success: true, data: portfolio[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/portfolio/:id
router.delete('/portfolio/:id', (req, res) => {
  try {
    let portfolio = readJSON(paths.portfolio);
    portfolio = portfolio.filter(p => p.id !== req.params.id);
    writeJSON(paths.portfolio, portfolio);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Offers ────────────────────────────────────────────────────────────────

// GET /api/offers — active offers
router.get('/offers', (req, res) => {
  try {
    const offers = readJSON(paths.offers);
    const active = offers.filter(o => {
      if (!o.active) return false;
      const now = new Date();
      if (o.validUntil && new Date(o.validUntil) < now) return false;
      if (o.validFrom && new Date(o.validFrom) > now) return false;
      return true;
    });
    res.json({ success: true, data: active, all: offers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/offers — create offer
router.post('/offers', (req, res) => {
  try {
    const offers = readJSON(paths.offers);
    const offer = { id: `OFF${Date.now()}`, ...req.body };
    offers.push(offer);
    writeJSON(paths.offers, offers);
    res.json({ success: true, data: offer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/offers/:id
router.put('/offers/:id', (req, res) => {
  try {
    const offers = readJSON(paths.offers);
    const idx = offers.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });
    offers[idx] = { ...offers[idx], ...req.body };
    writeJSON(paths.offers, offers);
    res.json({ success: true, data: offers[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/offers/:id
router.delete('/offers/:id', (req, res) => {
  try {
    let offers = readJSON(paths.offers);
    offers = offers.filter(o => o.id !== req.params.id);
    writeJSON(paths.offers, offers);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── TV Content ────────────────────────────────────────────────────────────

// GET /api/tv-content — full TV slideshow data
router.get('/tv-content', (req, res) => {
  try {
    const config   = readJSON(paths.tvContent);
    const portfolio = readJSON(paths.portfolio).filter(p => p.showInPortfolio !== false);
    const packages  = readJSON(paths.packages);
    const offers    = readJSON(paths.offers).filter(o => o.active);
    const popularId = getMostPopularPackageId();

    res.json({
      success: true,
      config,
      slides: {
        portfolio: smartSortPortfolio(portfolio),
        packages:  packages.map(p => ({ ...p, isMostPopular: p.id === popularId })),
        offers,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/tv-content — update TV config
router.put('/tv-content', (req, res) => {
  try {
    writeJSON(paths.tvContent, req.body);
    res.json({ success: true, data: req.body });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Demo Upload ────────────────────────────────────────────────────────────

// POST /api/upload-demo — upload portfolio images
router.post('/upload-demo', upload.array('files', 20), (req, res) => {
  try {
    const urls = req.files.map(f => `/uploads/portfolio/${f.filename}`);
    res.json({ success: true, urls });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Package Recommendation ────────────────────────────────────────────────

// GET /api/recommend?eventType=wedding&guestCount=350
router.get('/recommend', (req, res) => {
  try {
    const { eventType, guestCount } = req.query;
    const recommended = recommendPackage(eventType, guestCount);
    res.json({ success: true, data: recommended });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Advance Receipt Generator ─────────────────────────────────────────────

// POST /api/generate-receipt
router.post('/generate-receipt', async (req, res) => {
  try {
    const { bookingId } = req.body;
    const bookings = readJSON(paths.bookings);
    const packages  = readJSON(paths.packages);

    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const pkg = packages.find(p => p.id === booking.packageId);
    if (!pkg) return res.status(404).json({ success: false, error: 'Package not found' });

    const receiptDir = path.join(__dirname, '../receipts');
    if (!fs.existsSync(receiptDir)) fs.mkdirSync(receiptDir, { recursive: true });

    const filename   = `receipt-${bookingId}-${Date.now()}.pdf`;
    const outputPath = path.join(receiptDir, filename);

    await generateAdvanceReceipt(booking, pkg, outputPath);

    const waText = buildWhatsAppMessage(booking, pkg);
    const waLink = `https://wa.me/${(booking.phone || '').replace(/\D/g, '')}?text=${waText}`;

    res.json({
      success:    true,
      receiptUrl: `/receipts/${filename}`,
      whatsappLink: waLink,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
