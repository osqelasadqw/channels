const functions = require("firebase-functions"); // ✅ ეს გაკლია
const admin = require("firebase-admin");         // ✅ ეს გაკლია
admin.initializeApp();                           // ✅ ინიციალიზაცია

require("dotenv").config();                      // ✅ ეს სწორად გაქვს
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); // ✅
const cors = require('cors')({ 
  origin: ['http://localhost:3000', 'https://channel-market.vercel.app'],
  credentials: true
});  // CORS მხარდაჭერა ლოკალჰოსტისთვის

// დავამატოთ ფუნქცია, რომელიც დაგვიბრუნებს ბაზის URL-ს
const getBaseUrl = () => {
  const websiteUrl = process.env.WEBSITE_URL;
  // თუ გვაქვს გარემოს ცვლადი, გამოვიყენოთ ის
  if (websiteUrl) {
    console.log(`Using env WEBSITE_URL: ${websiteUrl}`);
    return websiteUrl;
  }
  
  // სერვერის Node.js გარემოს შემოწმება
  const nodeEnv = process.env.NODE_ENV || 'development';
  console.log(`Current NODE_ENV: ${nodeEnv}`);
  
  // თუ დეველოპმენტ გარემოში ვართ, ვიყენებთ ლოკალურ URL-ს
  if (nodeEnv === 'development') {
    console.log('Using localhost URL for development');
    return 'http://localhost:3000';
  }
  
  // VERCEL_URL გარემოს ცვლადი, რომელიც ავტომატურად დაყენებულია Vercel-ზე
  if (process.env.VERCEL_URL) {
    const vercelUrl = `https://${process.env.VERCEL_URL}`;
    console.log(`Using Vercel automatic URL: ${vercelUrl}`);
    return vercelUrl;
  }
  
  // წინააღმდეგ შემთხვევაში ვიყენებთ მთავარ პროდაქშენ URL-ს
  console.log('Falling back to hardcoded production URL');
  return 'https://channel-market.vercel.app';
};

exports.createPaymentSession = functions.https.onCall(async (data, context) => {
  // onCall ფუნქციები ავტომატურად მხარს უჭერენ CORS-ს
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const chatId = data.chatId;
  if (!chatId) {
    throw new functions.https.HttpsError("invalid-argument", "chatId is required.");
  }
  
  // ვცადოთ დავადგინოთ წყარო/origin მოთხოვნისთვის
  console.log("Callable function context:", context);
  console.log("Request raw data:", data);
  
  // ვცადოთ გამოვიყენოთ origin-ი, თუ არის
  let baseUrl;
  if (data.origin) {
    console.log(`Using provided origin from request: ${data.origin}`);
    baseUrl = data.origin;
  } else {
    baseUrl = getBaseUrl();
  }
  
  const chatRef = admin.firestore().collection("chats").doc(chatId);
  const chatSnap = await chatRef.get();

  if (!chatSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Chat not found.");
  }

  const chatData = chatSnap.data();
  const feeAmount = chatData.feeAmount;

  if (!feeAmount || typeof feeAmount !== "number") {
    throw new functions.https.HttpsError("invalid-argument", "Invalid or missing feeAmount.");
  }

  const successUrl = `${baseUrl}/my-chats?chatId=${chatId}&payment=success`;
  const cancelUrl = `${baseUrl}/my-chats?chatId=${chatId}&payment=cancelled`;
  
  console.log(`Using base URL: ${baseUrl}`);
  console.log(`Setting success URL to: ${successUrl}`);
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: feeAmount,
        product_data: {
          name: "Escrow Transaction Fee",
        },
      },
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      chatId,
      paidBy: context.auth.uid,
    },
  });

  await chatRef.update({
    paymentSessionId: session.id,
    paymentSessionCreatedAt: Date.now(),
  });

  return { url: session.url };
});

// დამატებით ვქმნით HTTP ვერსიას იმავე ფუნქციის, რომელიც მკაფიოდ მართავს CORS-ს
exports.createPaymentSessionHttp = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // აუთენტიფიკაციის შემოწმება
      if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        res.status(403).send({ error: 'Unauthorized' });
        return;
      }

      // ლოგი HTTP მოთხოვნის შესახებ
      console.log(`HTTP request headers:`, req.headers);
      console.log(`HTTP request origin:`, req.headers.origin || req.headers.referer || 'Unknown');
      
      // დავამატოთ ახალი URL-ის განსაზღვრის ლოგიკა
      let baseUrl;
      
      // ვცადოთ მივიღოთ origin მოთხოვნიდან
      if (req.headers.origin) {
        baseUrl = req.headers.origin;
      } else if (req.headers.referer) {
        // თუ origin არ არის, ვცადოთ referer
        const url = new URL(req.headers.referer);
        baseUrl = `${url.protocol}//${url.host}`;
      } else {
        // თუ ვერცერთი ვერ ვიპოვეთ, გამოვიყენოთ ჩვენი ფუნქცია
        baseUrl = getBaseUrl();
      }
      
      console.log(`Determined base URL from request: ${baseUrl}`);

      // ვალიდაცია და ლოგიკა
      const chatId = req.body.chatId;
      if (!chatId) {
        res.status(400).send({ error: 'chatId is required' });
        return;
      }

      const chatRef = admin.firestore().collection("chats").doc(chatId);
      const chatSnap = await chatRef.get();

      if (!chatSnap.exists) {
        res.status(404).send({ error: 'Chat not found' });
        return;
      }

      const chatData = chatSnap.data();
      const feeAmount = chatData.feeAmount;

      if (!feeAmount || typeof feeAmount !== "number") {
        res.status(400).send({ error: 'Invalid or missing feeAmount' });
        return;
      }

      const successUrl = `${baseUrl}/my-chats?chatId=${chatId}&payment=success`;
      const cancelUrl = `${baseUrl}/my-chats?chatId=${chatId}&payment=cancelled`;
      
      console.log(`HTTP handler using base URL: ${baseUrl}`);
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [{
          price_data: {
            currency: "usd",
            unit_amount: feeAmount,
            product_data: {
              name: "Escrow Transaction Fee",
            },
          },
          quantity: 1,
        }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          chatId,
          paidBy: req.body.userId,
        },
      });

      await chatRef.update({
        paymentSessionId: session.id,
        paymentSessionCreatedAt: Date.now(),
      });

      res.status(200).send({ url: session.url });
    } catch (error) {
      console.error('Error creating payment session:', error);
      res.status(500).send({ error: error.message });
    }
  });
});

// Stripe webhook ფუნქცია გადახდის დასასრულებლად
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  
  try {
    // Stripe webhook secret (უნდა დავაყენოთ Firebase-ის გარემოს ცვლადებში)
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!stripeWebhookSecret) {
      console.error('Stripe webhook secret is missing');
      return res.status(500).send({ error: 'Webhook configuration error' });
    }
    
    // Stripe-ის მოვლენის დამუშავება და მისი ავთენტიფიკაცია
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        stripeWebhookSecret
      );
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // მოვლენის ტიპის შემოწმება - მხოლოდ დასრულებული გადახდები
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // მეტადატა, რომელიც შეიცავს chatId-ს და მომხმარებლის ID-ს
      const { chatId, paidBy } = session.metadata;
      
      if (!chatId) {
        console.error('No chatId in session metadata');
        return res.status(400).send({ error: 'Missing chatId in metadata' });
      }
      
      try {
        // ჩატის მონაცემების მიღება
        const chatRef = admin.firestore().collection('chats').doc(chatId);
        const chatSnap = await chatRef.get();
        
        if (!chatSnap.exists) {
          console.error(`Chat with ID ${chatId} not found`);
          return res.status(404).send({ error: 'Chat not found' });
        }
        
        const chatData = chatSnap.data();
        
        // ვაახლებთ ჩატის მდგომარეობას
        await chatRef.update({
          paymentCompleted: true,
          paymentCompletedAt: Date.now(),
          paymentStatus: 'completed',
          paymentId: session.payment_intent || session.id
        });
        
        // დამატებით ვაგზავნით შეტყობინებას ჩატში
        const rtdbMessagesRef = admin.database().ref(`messages/${chatId}`);
        await rtdbMessagesRef.push({
          text: "🟢 Payment has been successfully processed. The escrow agent will be notified automatically.",
          senderId: "system",
          senderName: "System",
          timestamp: Date.now(),
          isSystem: true
        });
        
        // ვაგზავნით ნოტიფიკაციას ადმინისტრატორისთვის
        await admin.firestore().collection('admin_notifications').add({
          type: 'payment_completed',
          chatId,
          productId: chatData.productId,
          productName: chatData.productName,
          buyerId: paidBy,
          paymentSessionId: session.id,
          paymentAmount: session.amount_total,
          createdAt: Date.now(),
          read: false,
          priority: 'high',
          needsAction: true,
          status: 'new'
        });
        
        // აგრეთვე ვაგზავნით რეალურ დროში მონაცემებს, რომ ადმინის ინტერფეისი დაუყოვნებლივ განახლდეს
        const adminNotificationsRef = admin.database().ref('adminNotifications');
        await adminNotificationsRef.push({
          type: 'payment_completed',
          chatId,
          productName: chatData.productName,
          timestamp: Date.now()
        });
        
        console.log(`Payment for chat ${chatId} completed successfully`);
        return res.status(200).send({ received: true });
        
      } catch (err) {
        console.error('Error processing successful payment webhook:', err);
        return res.status(500).send({ error: err.message });
      }
    }
    
    // სხვა მოვლენების დამუშავება შეგვიძლია აქ დავამატოთ
    
    return res.status(200).send({ received: true });
    
  } catch (err) {
    console.error('Unhandled webhook error:', err);
    return res.status(500).send({ error: err.message });
  }
});
