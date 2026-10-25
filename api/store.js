// Single serverless endpoint: /api/store?action=register|reviews|review|delete|download
// Env vars (Vercel -> Settings -> Environment Variables):
//   FIREBASE_SERVICE_ACCOUNT  = full service-account JSON (one line)
//   ALLOWED_ORIGINS           = https://username.github.io,https://yourdomain.com  (comma separated)
//   APK_URL                   = (optional) direct APK link, used if APK_STORAGE_PATH not set
//   APK_STORAGE_PATH          = (optional) e.g. apk/StudyBuddyPro.apk  (private file in Firebase Storage)
//   FIREBASE_STORAGE_BUCKET   = (needed only with APK_STORAGE_PATH) e.g. myproject.appspot.com
const admin = require('firebase-admin');
const { FieldValue, AggregateField } = require('firebase-admin/firestore');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined
  });
}
const db = admin.firestore();

function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const o = req.headers.origin;
  if (o && allowed.includes(o)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

async function verify(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return await admin.auth().verifyIdToken(h.slice(7)); } catch (e) { return null; }
}

const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.query.action;
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const user = await verify(req);

  try {
    // ---------- public list (+ "mine" if logged in) ----------
    if (action === 'reviews' && req.method === 'GET') {
      const snap = await db.collection('reviews').orderBy('updatedAt', 'desc').limit(30).get();
      const reviews = snap.docs.map(d => {
        const x = d.data();
        return { name: x.name || 'User', photo: x.photo || '', rating: x.rating | 0, text: x.text || '', at: x.updatedAt ? x.updatedAt.toMillis() : 0 };
      });
      let avg = 0, count = 0;
      try {
        const agg = await db.collection('reviews').aggregate({ avg: AggregateField.average('rating'), n: AggregateField.count() }).get();
        const a = agg.data(); avg = a.avg || 0; count = a.n || 0;
      } catch (e) { count = reviews.length; avg = count ? reviews.reduce((t, r) => t + r.rating, 0) / count : 0; }
      let mine = null;
      if (user) {
        const m = await db.collection('reviews').doc(user.uid).get();
        if (m.exists) mine = { rating: m.data().rating | 0, text: m.data().text || '' };
      }
      return res.status(200).json({ reviews, avg, count, mine });
    }

    // everything below needs a valid Google login
    if (!user) return res.status(401).json({ error: 'login_required' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

    // ---------- registration (new user) / login tracking ----------
    if (action === 'register') {
      const ref = db.collection('store_users').doc(user.uid);
      const snap = await ref.get();
      const profile = { name: clean(user.name || '', 80), email: user.email || '', photo: user.picture || '' };
      if (!snap.exists) {
        await ref.set({ uid: user.uid, ...profile, createdAt: FieldValue.serverTimestamp(), lastLoginAt: FieldValue.serverTimestamp(), loginCount: 1, downloads: 0 });
        return res.status(200).json({ ok: true, isNew: true });
      }
      await ref.update({ ...profile, lastLoginAt: FieldValue.serverTimestamp(), loginCount: FieldValue.increment(1) });
      return res.status(200).json({ ok: true, isNew: false });
    }

    // ---------- write / update review ----------
    if (action === 'review') {
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'bad_rating' });
      const ref = db.collection('reviews').doc(user.uid);
      const old = await ref.get();
      if (old.exists && old.data().updatedAt && Date.now() - old.data().updatedAt.toMillis() < 8000)
        return res.status(429).json({ error: 'slow_down' });
      await ref.set({
        uid: user.uid,
        name: clean(user.name || 'User', 60) || 'User',   // name & photo come from the verified token, not the client
        photo: user.picture || '',
        rating,
        text: clean(body.text, 500),
        createdAt: old.exists ? old.data().createdAt : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ ok: true, updated: old.exists });
    }

    // ---------- delete own review ----------
    if (action === 'delete') {
      await db.collection('reviews').doc(user.uid).delete();
      return res.status(200).json({ ok: true });
    }

    // ---------- download: log + give APK link ----------
    if (action === 'download') {
      await db.collection('store_users').doc(user.uid).set(
        { downloads: FieldValue.increment(1), lastDownloadAt: FieldValue.serverTimestamp() }, { merge: true });
      let url = process.env.APK_URL || '';
      if (process.env.APK_STORAGE_PATH) {
        const [signed] = await admin.storage().bucket().file(process.env.APK_STORAGE_PATH).getSignedUrl({
          action: 'read',
          expires: Date.now() + 5 * 60 * 1000,
          responseDisposition: 'attachment; filename="StudyBuddyPro.apk"'
        });
        url = signed;
      }
      return res.status(200).json({ ok: true, url });
    }

    return res.status(400).json({ error: 'unknown_action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
};
