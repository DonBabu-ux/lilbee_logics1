import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import { db, auth } from "./config/firebase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------------
// Serve Frontend
// ---------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------------------
// Auth Routes
// ---------------------
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    const usersRef = db.ref("users");
    const snapshot = await usersRef.orderByChild("email").equalTo(email).once("value");

    if (snapshot.exists()) return res.status(400).json({ error: "Email already exists" });

    const userRecord = await auth.createUser({ email, password });

    const newUser = {
      uid: userRecord.uid,
      email,
      name: name || "",
      phone: phone || "",
      role: "user",
      avatar: "",
      isBanned: false,
      joinedAt: Date.now()
    };

    await usersRef.child(userRecord.uid).set(newUser);
    res.json(newUser);
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email } = req.body;
    const usersRef = db.ref("users");
    const snapshot = await usersRef.orderByChild("email").equalTo(email).once("value");

    if (!snapshot.exists()) return res.status(401).json({ error: "Invalid credentials" });

    const user = Object.values(snapshot.val())[0];
    res.json(user);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------
// Posts Routes
// ---------------------
app.get("/api/posts", async (req, res) => {
  try {
    const postsRef = db.ref("posts");
    const snapshot = await postsRef.orderByChild("timestamp").once("value");

    const posts = [];
    if (snapshot.exists()) snapshot.forEach(child => posts.unshift(child.val()));

    res.json(posts);
  } catch (error) {
    console.error("Get posts error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/posts", async (req, res) => {
  try {
    const { uid, email, content } = req.body;

    const userSnapshot = await db.ref(`users/${uid}`).once("value");
    if (userSnapshot.exists() && userSnapshot.val().isBanned)
      return res.status(403).json({ error: "You are banned from posting" });

    const newPost = {
      id: Date.now().toString(),
      uid,
      email,
      content,
      timestamp: Date.now()
    };

    await db.ref(`posts/${newPost.id}`).set(newPost);
    res.json(newPost);
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------
// Users Routes
// ---------------------
app.get("/api/users", async (req, res) => {
  try {
    const snapshot = await db.ref("users").once("value");
    const users = snapshot.exists() ? Object.values(snapshot.val()) : [];
    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------
// Chat Routes
// ---------------------
app.get("/api/chat", async (req, res) => {
  try {
    const snapshot = await db.ref("chat").orderByChild("timestamp").once("value");
    const messages = snapshot.exists() ? Object.values(snapshot.val()) : [];
    res.json(messages);
  } catch (error) {
    console.error("Get chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { uid, email, msg } = req.body;
    const newMsg = { id: Date.now().toString(), uid, email, msg, timestamp: Date.now() };
    await db.ref(`chat/${newMsg.id}`).set(newMsg);
    res.json(newMsg);
  } catch (error) {
    console.error("Send chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------
// Start server
// ---------------------
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

export default app;
