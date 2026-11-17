// SSLCommerz checkout (sandbox by default). Written against the public SSLCommerz integration docs;
// it has NOT been exercised end-to-end. Test it with SSLCommerz sandbox credentials before going live.
// bKash and Nagad adapters are not implemented.
const admin = require('firebase-admin');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const { requirePermission } = require('../security/authz');

const STORE_ID = defineSecret('SSLC_STORE_ID');
const STORE_PASS = defineSecret('SSLC_STORE_PASS');
const APP_URL = defineString('APP_URL');                 // e.g. https://your-app.vercel.app
const CALLBACK_BASE_URL = defineString('CALLBACK_BASE_URL'); // URL of the sslcommerzCallback function
const LIVE = defineString('SSLC_LIVE', { default: 'false' });

// Mirror of src/constants/plans.js (BDT per month)
const PRICES = { starter: 500, professional: 1500, institution: 4000 };
const base = () => (LIVE.value() === 'true' ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com');

exports.createPaymentSession = onCall({ secrets: [STORE_ID, STORE_PASS] }, async (request) => {
  const { institutionId, plan } = request.data || {};
  await requirePermission(request, institutionId, 'billing.manage');
  const amount = PRICES[plan];
  if (!amount) throw new HttpsError('failed-precondition', 'This plan cannot be bought online.');

  const db = admin.firestore();
  const inst = (await db.doc(`institutions/${institutionId}`).get()).data() || {};
  if (!inst.phone || !inst.email) throw new HttpsError('failed-precondition', 'Add the institution phone number and email in Settings before paying.');

  const tranId = `EM${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  await db.doc(`payments/${tranId}`).set({ institutionId, plan, amount, currency: 'BDT', status: 'pending', provider: 'sslcommerz', createdBy: request.auth.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });

  const cb = (s) => `${CALLBACK_BASE_URL.value()}?status=${s}`;
  const body = new URLSearchParams({
    store_id: STORE_ID.value(), store_passwd: STORE_PASS.value(), total_amount: String(amount), currency: 'BDT', tran_id: tranId,
    success_url: cb('success'), fail_url: cb('fail'), cancel_url: cb('cancel'), ipn_url: cb('ipn'),
    cus_name: inst.name || 'Institution', cus_email: inst.email, cus_add1: inst.address || 'N/A', cus_city: 'N/A', cus_country: 'Bangladesh', cus_phone: inst.phone,
    shipping_method: 'NO', product_name: `EXAM MASTER ${plan}`, product_category: 'Software', product_profile: 'non-physical-goods',
  });
  const res = await fetch(`${base()}/gwprocess/v4/api.php`, { method: 'POST', body });
  const json = await res.json().catch(() => ({}));
  if (!json.GatewayPageURL) throw new HttpsError('internal', 'The payment provider did not return a payment page.');
  return { url: json.GatewayPageURL };
});

exports.sslcommerzCallback = onRequest({ secrets: [STORE_ID, STORE_PASS] }, async (req, res) => {
  const status = String(req.query.status || '');
  const b = req.body || {};
  const back = (s) => res.redirect(303, `${APP_URL.value()}/app/subscription?payment=${s}`);
  if (status !== 'success' && status !== 'ipn') { back(status === 'cancel' ? 'cancel' : 'fail'); return; }

  const db = admin.firestore();
  const payRef = db.doc(`payments/${String(b.tran_id || '')}`);
  const pay = await payRef.get();
  if (!pay.exists || !b.val_id) { back('fail'); return; }

  // Never trust the browser redirect: ask SSLCommerz to validate the transaction server-side.
  const url = `${base()}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(b.val_id)}&store_id=${encodeURIComponent(STORE_ID.value())}&store_passwd=${encodeURIComponent(STORE_PASS.value())}&format=json`;
  const v = await (await fetch(url)).json().catch(() => ({}));
  const p = pay.data();
  const valid = ['VALID', 'VALIDATED'].includes(v.status) && v.tran_id === pay.id && Number(v.amount) === Number(p.amount) && v.currency_type === 'BDT';
  if (!valid) { await payRef.update({ status: 'failed', checkedAt: admin.firestore.FieldValue.serverTimestamp() }); back('fail'); return; }

  await db.runTransaction(async (tx) => {
    const cur = await tx.get(payRef);
    if (cur.data().status === 'paid') return; // idempotent
    const now = admin.firestore.Timestamp.now();
    const end = admin.firestore.Timestamp.fromMillis(now.toMillis() + 30 * 24 * 3600 * 1000);
    tx.update(payRef, { status: 'paid', valId: b.val_id, paidAt: now });
    tx.set(db.doc(`subscriptions/${p.institutionId}`), { plan: p.plan, status: 'active', periodStart: now, periodEnd: end, paymentId: pay.id });
    tx.update(db.doc(`institutions/${p.institutionId}`), { plan: p.plan });
    tx.set(db.collection('notifications').doc(), { institutionId: p.institutionId, userId: p.createdBy, createdBy: 'system', type: 'subscription', title: 'Subscription activated', body: p.plan, link: '/app/subscription', read: false, createdAt: now });
  });
  back('success');
});
