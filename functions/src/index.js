const admin = require('firebase-admin');

admin.initializeApp();

exports.generateQuestions = require('./ai/generateQuestions').generateQuestions;

const payments = require('./payments/sslcommerz');
exports.createPaymentSession = payments.createPaymentSession;
exports.sslcommerzCallback = payments.sslcommerzCallback;
