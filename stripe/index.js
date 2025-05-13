const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// სატესტო ფუნქცია — რომ დაინახო მუშაობს თუ არა ყველაფერი
exports.helloWorld = functions.https.onRequest((req, res) => {
  res.send("🔥 Firebase Function is working! Hello, Lexo!");
});
