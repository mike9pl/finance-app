const push = require("web-push");
const express = require("express");
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors({
   origin: 'https://localhost:8080',
   credentials: true
}));
app.use(express.json());
app.use(express.static("."));

mongoose.connect('mongodb://localhost:27017/finance-app').then(() => {
  console.log("Connected to MongoDB");
}).catch(err => {
  console.error("MongoDB connection error:", err)});

const Subscription = mongoose.model('Subscription', {
  endpoint: String,
  keys: Object
});

const Transaction = mongoose.model('Transaction', {
  description: String,
  amount: Number,
  balance: Number,
  type: String, // 'income' or 'expense'
  date: String
});

//web-push
let vapidkey = {
  publicKey: 'BOIl0ZJ_8UB0qY8qOUV92c8EnDjcrgEZpjSWPkgy1vCfvLQVkpBaow1tN4kvwEe2pWmaRXwN7f8IQ8hD9ylXMpo',
  privateKey: 'Jr_NIFEEdMrpDy1wM7cBfb8o4aDaLHp6qfRYW-JdSmA'
};
push.setVapidDetails(
  "mailto:hello@example.com",
  vapidkey.publicKey,
  vapidkey.privateKey
);

let subscription = [];
app.get("/subscription", (_req, res) => res.json(subscription));
app.post("/subscription", async (req, res) => {
  // Sprawdza dane subskrypcji
  if (!req.body.endpoint || !req.body.keys) {
    console.log("Invalid subscription data");
    return res.status(400).end();
  }
  try {
    //Sprawdza czy subskrypcja już istnieje w MongoDB
    const exists = await Subscription.findOne({ endpoint: req.body.endpoint });
    if (exists) {
      console.log("Subscription already exists in MongoDB");
      // Sprawdza czy subskrypacja jest również w tablicy
      if (!subscription.some(s => s.endpoint === req.body.endpoint)) {
        subscription.push(exists);
      }
      return res.status(200).end();
    }
    // Save subscription to MongoDB
    const newSubscription = new Subscription(req.body);
    await newSubscription.save();
    // Dodaje subskrypcję do tablicy tylko po pomyślnym zapisie i jeśli nie istnieje
    if (!subscription.some(s => s.endpoint === req.body.endpoint)) {
      subscription.push(req.body);
    }
    console.log("Subscription saved to MongoDB");
    console.log("New subscription:", req.body);
    res.status(201).end();

  } catch (err) {
    if (err.status === 409) {
      console.log("Subscription already exists in MongoDB");
      return res.status(409).end();
    }
    if (err.status === 410) {
      console.log("Subscription is gone (410)");
      return res.status(410).end();
    }
    console.error("Error saving subscription:", err);
    return res.status(500).end();
  }
});
// Wysyła powiadomienie, gdy dodana zostanie nowa transakcja
app.post('/api/transaction', async (req, res) => {
  try {
    const newTrans = new Transaction(req.body);
    newTrans.balance = 0; // Inicjalizuje saldo
    const transactions = await Transaction.find({}).sort({ date: -1 });
    if (transactions.length > 0) {
      const lastTransaction = transactions[0]; // Oblicza saldo na podstawie ostatniej transakcji
      newTrans.balance = lastTransaction.balance + (newTrans.type === 'income' ? newTrans.amount : -newTrans.amount);
    } else {
      // Jeśli nie ma żadnych transakcji, ustawia saldo na kwotę (dla przychodu) lub na minus (dla wydatku)
      newTrans.balance = newTrans.type === 'income' ? newTrans.amount : -newTrans.amount;
    }
    await newTrans.save();

    var value = newTrans.type === 'income' ? newTrans.amount : -newTrans.amount;
    const subs = await Subscription.find({endpoint: {$in: subscription.map(s => s.endpoint)}});
    for (const sub of subs) {
      push.sendNotification(sub, JSON.stringify({
        title: 'Nowa Transakcja',
        body: `${newTrans.description}: ${value} zł`
      })).catch(err => console.error('Błąd powiadomienia push:', err));
    }
    res.status(201).json({ success: true, transaction: newTrans });
  } catch (err) {
    console.error("Błąd zapisu transakcji:", err);
    res.status(500).json({ success: false, error: "Nie udało się zapisać transakcji" });
  }
});

// Pobiera wszystkie transakcje
app.get('/api/transactions', async (_req, res) => {
  try {
    const transactions = await Transaction.find({});
    res.json(transactions);
  } catch (err) {
    console.error("Błąd pobierania transakcji:", err);
    res.status(500).json({ success: false, error: "Nie udało się pobrać transakcji" });
  }
});

app.listen(5000, () =>
  console.log("Serwer uruchomiony na http://localhost:5000")
);
