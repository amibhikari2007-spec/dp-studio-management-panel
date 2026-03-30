/**
 * DP Studio — Invoice Auto-fill Patch
 * 
 * ADD THIS SCRIPT to your existing invoices.html (before closing </body>)
 * It reads ?package=PKG_ID&extraHours=N&extraPages=N from the URL
 * and auto-fills the invoice form fields.
 *
 * FIELD IDs to have in your invoices.html form:
 *   #inv-service-name    — text input / select for service/package name
 *   #inv-package-id      — hidden input for package ID
 *   #inv-price           — number input for price
 *   #inv-description     — textarea for description
 *   #inv-photography     — checkbox for photography
 *   #inv-videography     — checkbox for videography
 *   #inv-album           — checkbox for album
 *   #inv-drone           — checkbox for drone
 *   #inv-highlight       — checkbox for highlight film
 *
 * If your field IDs differ, adjust the mapping below.
 */

(async function dpInvoiceAutoFill() {
  const params = new URLSearchParams(window.location.search);
  const pkgId     = params.get('package');
  const extraHrs  = parseInt(params.get('extraHours') || '0');
  const extraPgs  = parseInt(params.get('extraPages')  || '0');

  if (!pkgId) return; // No package param → do nothing

  // ── Fetch package data ──────────────────────────────────────────────────
  let pkg;
  try {
    const res = await fetch(`/api/packages/${pkgId}`);
    const data = await res.json();
    if (!data.success || !data.data) return;
    pkg = data.data;
  } catch (e) {
    console.warn('DP Studio: Could not auto-fill invoice — package not found:', pkgId);
    return;
  }

  // ── Calculate total ─────────────────────────────────────────────────────
  const PRICES_EXTRA = { hour: 2500, page: 150 };
  const total = (pkg.price || 0)
    + (extraHrs * PRICES_EXTRA.hour)
    + (extraPgs * PRICES_EXTRA.page);

  // ── Build description ────────────────────────────────────────────────────
  const inc = pkg.includes || {};
  const lines = [
    `Package: ${pkg.name} (${pkg.tier})`,
    inc.photography  ? '• Photography'               : null,
    inc.videography  ? '• Videography'               : null,
    inc.album        ? `• Album (${inc.albumPages} pages)` : null,
    inc.drone        ? '• Drone Aerial'              : null,
    inc.highlightFilm ? '• Highlight Film'           : null,
    `• ${inc.baseHours || 0} hours coverage`,
    extraHrs > 0     ? `• +${extraHrs} extra hours`  : null,
    extraPgs > 0     ? `• +${extraPgs} extra pages`  : null,
  ].filter(Boolean).join('\n');

  // ── Fill fields ─────────────────────────────────────────────────────────
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === 'checkbox') el.checked = !!value;
      else el.value = value;
      // Trigger change events for any reactive UI
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  setVal('inv-service-name', pkg.name);
  setVal('inv-package-id',   pkg.id);
  setVal('inv-price',        total);
  setVal('inv-description',  lines);
  setVal('inv-photography',  inc.photography);
  setVal('inv-videography',  inc.videography);
  setVal('inv-album',        inc.album);
  setVal('inv-drone',        inc.drone);
  setVal('inv-highlight',    inc.highlightFilm);

  // Also try common alternative field names
  setVal('serviceName',   pkg.name);
  setVal('packageName',   pkg.name);
  setVal('amount',        total);
  setVal('totalAmount',   total);
  setVal('serviceAmount', total);

  // ── Show confirmation banner ─────────────────────────────────────────────
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed; top:72px; left:50%; transform:translateX(-50%);
    background:#7C3AED; color:#fff; padding:10px 24px; border-radius:8px;
    font-family:'DM Sans',sans-serif; font-size:13px; z-index:9999;
    box-shadow:0 4px 16px rgba(124,58,237,0.4);
    animation: slideIn 0.4s ease;
  `;
  banner.innerHTML = `✨ <strong>${pkg.name}</strong> auto-filled — ₹${total.toLocaleString('en-IN')}`;
  document.head.insertAdjacentHTML('beforeend', `<style>@keyframes slideIn{from{opacity:0;top:56px}to{opacity:1;top:72px}}</style>`);
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 4000);

  console.log('[DP Studio] Invoice auto-filled:', { package: pkg.name, total, extraHrs, extraPgs });
})();
