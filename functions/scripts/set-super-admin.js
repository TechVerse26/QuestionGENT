// Usage: GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/set-super-admin.js <uid>
// Grants the platform-level superAdmin claim (read by firestore.rules). The user must sign in again afterwards.
const admin = require('firebase-admin');

admin.initializeApp();
const uid = process.argv[2];
if (!uid) { console.error('Pass the user uid as the first argument.'); process.exit(1); }
admin.auth().setCustomUserClaims(uid, { superAdmin: true }).then(() => { console.log(`superAdmin set for ${uid}`); process.exit(0); }).catch((e) => { console.error(e.message); process.exit(1); });
