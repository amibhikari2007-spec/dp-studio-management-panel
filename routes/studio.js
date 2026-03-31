// routes/studio.js — MongoDB + Cloudinary version

const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { Readable } = require('stream');

// ── Body parser at router level (fixes req.body empty issue) ───────────────
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

const { Package, Portfolio, Offer, TvContent } = require('./studioModels');

// ── Cloudinary config (reads from Render environment variables) ─────────────
cloudinary.config({
  cloud_name: process.env.dmbvvjuft,
  api_key:    process.env.435998745188711,
  api_secret: process.env.XaYc-KGyw8IUrJ1Rznn1Gqv7PPY,
});

// ── Multer — memory storage (no disk, straight to Cloudinary) ──────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP, GIF allowed'));
  }
});

// ── Upload buffer to Cloudinary ─────────────────────────────────────────────
function uploadToCloudinary(buffer, originalname) {
  return new Promise((resolve, reject) => {
    const filename = path.parse(originalname).name.replace(/[^a-zA-Z0-9]/g, '_');
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'dp-studio/portfolio',
        public_id: `${Date.now()}_${filename}`,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function withId(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id = obj._id ? obj._id.toString() : '';
  return obj;
}

function parseArr(val) {
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function smartSort(items) {
  return [...items].sort((a, b) => {
    const dd = new Date(b.deliveredDate||0) - new Date(a.deliveredDate||0);
    if (dd !== 0) return dd;
    const to = { PKG004:0, PKG003:1, PKG002:2, PKG001:3 };
    const td = (to[a.packageId]??9) - (to[b.packageId]??9);
    if (td !== 0) return td;
    return ((a.tags||[]).includes('recommended')?0:1) - ((b.tags||[]).includes('recommended')?0:1);
  });
}

async function getMostPopularPackageId() {
  try {
    const Booking = require('./booking');
    const bookings = await Booking.find({}, { packageName:1 }).lean();
    const counts = {};
    bookings.forEach(b => { if (b.packageName) counts[b.packageName] = (counts[b.packageName]||0)+1; });
    let max = 0, bestName = null;
    Object.entries(counts).forEach(([n,c]) => { if (c > max) { max=c; bestName=n; } });
    if (!bestName) return null;
    const pkg = await Package.findOne({ name: bestName }).lean();
    return pkg ? pkg._id.toString() : null;
  } catch { return null; }
}

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
    res.json({ success:true, data: packages.map(p => ({
      ...p, id: p._id.toString(),
      isMostPopular: p._id.toString() === popularId,
    }))});
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

router.get('/packages/:id', async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id).lean();
    if (!pkg) return res.status(404).json({ success:false, error:'Not found' });
    res.json({ success:true, data:{ ...pkg, id:pkg._id.toString() } });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

router.post('/packages', async (req, res) => {
  try {
    const pkg = await Package.create(req.body);
    res.json({ success:true, data:withId(pkg) });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

router.put('/packages/:id', async (req, res) => {
  try {
    const pkg = await Package.findByIdAndUpdate(
      req.params.id, { $set: req.body },
      { new:true, runValidators:false }
    ).lean();
    if (!pkg) return res.status(404).json({ success:false, error:'Not found' });
    res.json({ success:true, data:{ ...pkg, id:pkg._id.toString() } });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

router.delete('/packages/:id', async (req, res) => {
  try {
    await Package.findByIdAndDelete(req.params.id);
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  PORTFOLIO
// ═══════════════════════════════════════════════════════════════════════════

router.get('/portfolio', async (req, res) => {
  try {
    const items = await Portfolio.find({ showInPortfolio:true }).lean();
    res.json({ success:true, data: smartSort(items.map(p=>({...p, id:p._id.toString()}))) });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

router.post('/portfolio', async (req, res) => {
  try {
    const b = req.body;
    const imagesList = parseArr(b.images);
    const coverImage = (b.coverImage||'').trim() || imagesList[0] || '';
    const data = {
      title:           (b.title         || '').trim(),
      eventType:       (b.eventType     || 'wedding'),
      packageId:       (b.packageId     || ''),
      date:            (b.date          || ''),
      deliveredDate:   (b.deliveredDate || ''),
      guestCount:      parseInt(b.guestCount) || 0,
      description:     (b.description   || '').trim(),
      coverImage,
      images:          imagesList,
      tags:            parseArr(b.tags),
      isDemo:          b.isDemo === true || b.isDemo === 'true',
      showInPortfolio: b.showInPortfolio !== false && b.showInPortfolio !== 'false',
      status:          (b.status        || 'Delivered'),
      videoUrl:        (b.videoUrl      || ''),
    };
    const item = await Portfolio.create(data);
    res.json({ success:true, data:withId(item) });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

router.put('/portfolio/:id', async (req, res) => {
  try {
    const b = req.body;
    const update = {};
    if (b.title           !== undefined) update.title           = (b.title||'').trim();
    if (b.eventType       !== undefined) update.eventType       = b.eventType;
    if (b.packageId       !== undefined) update.packageId       = b.packageId;
    if (b.date            !== undefined) update.date            = b.date;
    if (b.deliveredDate   !== undefined) update.deliveredDate   = b.deliveredDate;
    if (b.guestCount      !== undefined) update.guestCount      = parseInt(b.guestCount)||0;
    if (b.description     !== undefined) update.description     = (b.description||'').trim();
    if (b.images          !== undefined) update.images          = parseArr(b.images);
    if (b.tags            !== undefined) update.tags            = parseArr(b.tags);
    if (b.isDemo          !== undefined) update.isDemo          = b.isDemo === true || b.isDemo === 'true';
    if (b.showInPortfolio !== undefined) update.showInPortfolio = b.showInPortfolio !== false && b.showInPortfolio !== 'false';
    if (b.status          !== undefined) update.status          = b.status;
    if (b.videoUrl        !== undefined) update.videoUrl        = b.videoUrl;
    if (b.coverImage      !== undefined) {
      update.coverImage = (b.coverImage||'').trim();
      // Auto-fill cover from images if left empty
      if (!update.coverImage && update.images && update.images.length)
        update.coverImage = update.images[0];
    }
    const item = await Portfolio.findByIdAndUpdate(
      req.params.id, { $set: update },
      { new:true, runValidators:false }
    ).lean();
    if (!item) return res.status(404).json({ success:false, error:'Portfolio item not found' });
    res.json({ success:true, data:{ ...item, id:item._id.toString() } });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

router.delete('/portfolio/:id', async (req, res) => {
  try {
    await Portfolio.findByIdAndDelete(req.params.id);
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  UPLOAD → CLOUDINARY (permanent URLs, never deleted on redeploy)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/upload-demo', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success:false, error:'No files received' });
    }

    // Check Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({
        success: false,
        error: 'CLOUDINARY_CLOUD_NAME not set in environment variables'
      });
    }

    // Upload all files in parallel to Cloudinary
    const uploadPromises = req.files.map(file =>
      uploadToCloudinary(file.buffer, file.originalname)
    );

    const urls = await Promise.all(uploadPromises);

    res.json({ success:true, urls });
  } catch(err) {
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ success:false, error: err.message });
  }
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
      data: active.map(o=>({...o, id:o._id.toString()})),
      all:  all.map(o=>({...o, id:o._id.toString()})),
    });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

router.post('/offers', async (req, res) => {
  try {
    const offer = await Offer.create(req.body);
    res.json({ success:true, data:withId(offer) });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

router.put('/offers/:id', async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(
      req.params.id, { $set: req.body },
      { new:true, runValidators:false }
    ).lean();
    if (!offer) return res.status(404).json({ success:false, error:'Not found' });
    res.json({ success:true, data:{ ...offer, id:offer._id.toString() } });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

router.delete('/offers/:id', async (req, res) => {
  try {
    await Offer.findByIdAndDelete(req.params.id);
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  TV CONTENT
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_TV = {
  studioName:'DP Studio & Light', tagline:'Every moment, beautifully preserved.',
  contactPhone:'+91 90835 21201',
  slideshow:{ imageDuration:8000, videoDuration:15000, autoRefreshInterval:60000 },
  sections:['portfolio','packages','offers'],
};

router.get('/tv-content', async (req, res) => {
  try {
    const configDoc = await TvContent.findOne({ key:'config' }).lean();
    const config    = configDoc?.value || DEFAULT_TV;
    const portfolio = await Portfolio.find({ showInPortfolio:true }).lean();
    const packages  = await Package.find().lean();
    const offers    = await Offer.find({ active:true }).lean();
    const popularId = await getMostPopularPackageId();
    res.json({
      success:true, config,
      slides:{
        portfolio: smartSort(portfolio.map(p=>({...p,id:p._id.toString()}))),
        packages:  packages.map(p=>({...p,id:p._id.toString(),isMostPopular:p._id.toString()===popularId})),
        offers:    offers.map(o=>({...o,id:o._id.toString()})),
      }
    });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

router.put('/tv-content', async (req, res) => {
  try {
    await TvContent.findOneAndUpdate(
      { key:'config' }, { key:'config', value:req.body }, { upsert:true }
    );
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  RECOMMENDATION
// ═══════════════════════════════════════════════════════════════════════════

router.get('/recommend', async (req, res) => {
  try {
    const pkg = await recommendPackage(req.query.eventType, req.query.guestCount);
    if (!pkg) return res.status(404).json({ success:false, error:'No packages found' });
    res.json({ success:true, data:{ ...pkg, id:pkg._id.toString() } });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  ADVANCE RECEIPT
// ═══════════════════════════════════════════════════════════════════════════

router.post('/generate-receipt', async (req, res) => {
  try {
    const { bookingId } = req.body;
    const Booking = require('./booking');
    const booking = await Booking.findById(bookingId).lean();
    if (!booking) return res.status(404).json({ success:false, error:'Booking not found' });

    let pkg = null;
    if (booking.packageId) pkg = await Package.findById(booking.packageId).lean();
    if (!pkg && booking.packageName) pkg = await Package.findOne({ name:booking.packageName }).lean();
    if (!pkg) pkg = { name: booking.packageName||'Custom Package', price:booking.totalAmount||0, includes:{} };

    const receiptsDir = path.join(__dirname, '../receipts');
    if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive:true });

    const { generateAdvanceReceipt, buildWhatsAppMessage } = require('../receipt-generator');
    const filename   = `receipt-${bookingId}-${Date.now()}.pdf`;
    const outputPath = path.join(receiptsDir, filename);
    const bookingData = {
      customerName: booking.customerName,
      phone:        booking.customerPhone,
      eventType:    booking.eventType,
      eventDate:    booking.eventDate,
      guestCount:   booking.guestCount || '',
      advancePaid:  booking.advancePaid || 0,
    };

    await generateAdvanceReceipt(bookingData, pkg, outputPath);
    const phone  = (booking.customerPhone||'').replace(/\D/g,'');
    const waLink = `https://wa.me/${phone}?text=${buildWhatsAppMessage(bookingData, pkg)}`;
    res.json({ success:true, receiptUrl:`/receipts/${filename}`, whatsappLink:waLink });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

module.exports = router;
