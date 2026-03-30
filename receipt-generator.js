// receipt-generator.js
// Generates advance receipt PDF using PDFKit

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate advance receipt PDF for a booking
 * @param {Object} booking - booking object from bookings.json
 * @param {Object} pkg - package object from packages.json
 * @param {String} outputPath - file path to save the PDF
 * @returns {Promise<String>} - resolves with output path
 */
function generateAdvanceReceipt(booking, pkg, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const PURPLE = '#7C3AED';
    const DARK = '#1E1B4B';
    const GRAY = '#6B7280';
    const LIGHT_BG = '#F5F3FF';
    const WHITE = '#FFFFFF';

    // --- Header ---
    doc.rect(0, 0, doc.page.width, 130).fill(PURPLE);

    doc.fill(WHITE)
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('DP STUDIO', 50, 35);

    doc.fontSize(10)
      .font('Helvetica')
      .text('Professional Photography & Videography', 50, 68)
      .text('Kolkata, West Bengal | +91 98765 43210', 50, 83)
      .text('dpstudio@email.com', 50, 98);

    doc.fontSize(11)
      .font('Helvetica-Bold')
      .text('ADVANCE RECEIPT', doc.page.width - 200, 48, { width: 150, align: 'right' });

    // Receipt number & date
    const receiptNo = `RCP-${Date.now().toString().slice(-6)}`;
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    doc.fontSize(9)
      .font('Helvetica')
      .text(`Receipt No: ${receiptNo}`, doc.page.width - 200, 68, { width: 150, align: 'right' })
      .text(`Date: ${today}`, doc.page.width - 200, 83, { width: 150, align: 'right' });

    // --- CONFIRMED badge ---
    doc.roundedRect(doc.page.width - 155, 100, 105, 22, 11).fill('#10B981');
    doc.fill(WHITE).fontSize(9).font('Helvetica-Bold')
      .text('✓ CONFIRMED', doc.page.width - 150, 106, { width: 95, align: 'center' });

    doc.moveDown(4);

    // --- Customer Details ---
    const sectionY = 160;
    doc.roundedRect(50, sectionY, doc.page.width - 100, 110, 8).fill(LIGHT_BG);

    doc.fill(PURPLE).fontSize(10).font('Helvetica-Bold')
      .text('CUSTOMER DETAILS', 70, sectionY + 15);

    doc.fill(DARK).fontSize(11).font('Helvetica-Bold')
      .text(booking.customerName || 'N/A', 70, sectionY + 35);

    doc.fill(GRAY).fontSize(10).font('Helvetica');

    const leftCol = [
      ['Phone', booking.phone || 'N/A'],
      ['Email', booking.email || 'N/A'],
    ];
    const rightCol = [
      ['Event Type', booking.eventType || 'N/A'],
      ['Guest Count', booking.guestCount ? `${booking.guestCount} guests` : 'N/A'],
    ];

    leftCol.forEach(([label, value], i) => {
      doc.fill(GRAY).text(`${label}:`, 70, sectionY + 55 + i * 18);
      doc.fill(DARK).text(value, 200, sectionY + 55 + i * 18);
    });

    rightCol.forEach(([label, value], i) => {
      doc.fill(GRAY).text(`${label}:`, 330, sectionY + 55 + i * 18);
      doc.fill(DARK).text(value, 460, sectionY + 55 + i * 18);
    });

    // --- Package Details ---
    const pkgY = sectionY + 130;
    doc.roundedRect(50, pkgY, doc.page.width - 100, 130, 8).fill(LIGHT_BG);

    doc.fill(PURPLE).fontSize(10).font('Helvetica-Bold')
      .text('PACKAGE DETAILS', 70, pkgY + 15);

    doc.fill(DARK).fontSize(13).font('Helvetica-Bold')
      .text(pkg.name || 'N/A', 70, pkgY + 35);

    doc.fill(GRAY).fontSize(9).font('Helvetica')
      .text(pkg.description || '', 70, pkgY + 55, { width: doc.page.width - 160 });

    // Package includes
    const includes = [];
    if (pkg.includes) {
      if (pkg.includes.photography) includes.push('Photography');
      if (pkg.includes.videography) includes.push('Videography');
      if (pkg.includes.album) includes.push(`Album (${pkg.includes.albumPages} pages)`);
      if (pkg.includes.drone) includes.push('Drone Aerial');
      if (pkg.includes.highlightFilm) includes.push('Highlight Film');
    }

    doc.fill(DARK).fontSize(9)
      .text('Includes: ' + includes.join(' • '), 70, pkgY + 75, { width: doc.page.width - 160 });

    // Event date
    const eventDate = booking.eventDate
      ? new Date(booking.eventDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : 'TBD';

    doc.fill(GRAY).fontSize(10).font('Helvetica')
      .text('Event Date:', 70, pkgY + 100);
    doc.fill(DARK).font('Helvetica-Bold')
      .text(eventDate, 160, pkgY + 100);

    // --- Payment Summary ---
    const payY = pkgY + 150;
    doc.rect(50, payY, doc.page.width - 100, 140).fill(DARK);

    doc.fill(WHITE).fontSize(10).font('Helvetica-Bold')
      .text('PAYMENT SUMMARY', 70, payY + 15);

    const packageTotal = pkg.price || 0;
    const advancePaid = booking.advancePaid || 0;
    const remaining = packageTotal - advancePaid;

    const payRows = [
      ['Package Total', `₹${packageTotal.toLocaleString('en-IN')}`],
      ['Advance Paid', `₹${advancePaid.toLocaleString('en-IN')}`],
    ];

    payRows.forEach(([label, val], i) => {
      doc.fill(GRAY).fontSize(10).font('Helvetica')
        .text(label, 70, payY + 40 + i * 22);
      doc.fill(WHITE)
        .text(val, 0, payY + 40 + i * 22, { align: 'right', width: doc.page.width - 70 });
    });

    // Divider
    doc.strokeColor('#4C1D95').lineWidth(0.5)
      .moveTo(70, payY + 88).lineTo(doc.page.width - 70, payY + 88).stroke();

    // Remaining balance
    doc.fill('#FCD34D').fontSize(13).font('Helvetica-Bold')
      .text('Balance Remaining', 70, payY + 100);
    doc.fill('#FCD34D').fontSize(16)
      .text(`₹${remaining.toLocaleString('en-IN')}`, 0, payY + 98, { align: 'right', width: doc.page.width - 70 });

    // --- Notes ---
    const notesY = payY + 160;
    doc.fill(GRAY).fontSize(9).font('Helvetica')
      .text('• Advance payment is non-refundable after 7 days of booking.', 50, notesY)
      .text('• Remaining balance to be paid on or before the event date.', 50, notesY + 14)
      .text('• This is a computer-generated receipt and does not require a physical signature.', 50, notesY + 28);

    // --- Footer ---
    const footerY = doc.page.height - 80;
    doc.rect(0, footerY, doc.page.width, 80).fill(PURPLE);
    doc.fill(WHITE).fontSize(11).font('Helvetica-Bold')
      .text('Thank you for choosing DP Studio!', 50, footerY + 15, { align: 'center', width: doc.page.width - 100 });
    doc.fill('#C4B5FD').fontSize(9).font('Helvetica')
      .text('We look forward to capturing your beautiful memories.', 50, footerY + 33, { align: 'center', width: doc.page.width - 100 })
      .text(`Receipt: ${receiptNo} | Generated: ${today}`, 50, footerY + 50, { align: 'center', width: doc.page.width - 100 });

    doc.end();

    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

/**
 * Build WhatsApp message text for advance receipt
 */
function buildWhatsAppMessage(booking, pkg) {
  const packageTotal = pkg.price || 0;
  const advancePaid = booking.advancePaid || 0;
  const remaining = packageTotal - advancePaid;
  const eventDate = booking.eventDate
    ? new Date(booking.eventDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'TBD';

  return encodeURIComponent(
    `✨ *DP Studio — Advance Receipt* ✨\n\n` +
    `Dear *${booking.customerName}*,\n\n` +
    `Your booking is *confirmed*! Here are your details:\n\n` +
    `📦 *Package:* ${pkg.name}\n` +
    `📅 *Event Date:* ${eventDate}\n` +
    `💰 *Package Total:* ₹${packageTotal.toLocaleString('en-IN')}\n` +
    `✅ *Advance Paid:* ₹${advancePaid.toLocaleString('en-IN')}\n` +
    `⏳ *Balance Due:* ₹${remaining.toLocaleString('en-IN')}\n\n` +
    `Your receipt PDF is attached. Looking forward to capturing your special moments!\n\n` +
    `— DP Studio Team 📸`
  );
}

module.exports = { generateAdvanceReceipt, buildWhatsAppMessage };
