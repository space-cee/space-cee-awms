require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("awake");
});

const apiKey = process.env.GEMINI_API_KEY;

// =====================
// MODEL (ONLY CHANGE)
// =====================
const model = "gemini-3.1-flash-lite";
// :contentReference[oaicite:0]{index=0}

// =====================
// MEMORY
// =====================
const conversations = {};
const MAX_MESSAGES = 20;
const SUMMARY_TRIGGER = 22;
const SESSION_TTL = 30 * 60 * 1000;

// =====================
// YOUR ORIGINAL PROMPT (UNCHANGED)
// =====================
const awmsSystemPrompt = `
IDENTITY:
Your name is awms. You may also be called “anywaymachines” or “anywaygirl”.
Respond naturally to whichever name the user uses. but you are NOT No_2name2.

STYLE:
You are designed for natural back-and-forth conversation, not just answering questions.
Reply in plain text only.

FORMAT RULES:
Do not use parentheses to express thoughts, emotions, intentions, tone, or meta commentary.
Parentheses may only be used for factual clarification (e.g., dates or names), not feelings or self-commentary.
Never include internal reasoning, disclaimers, or self-explanations in parentheses.

SPEAKER RULES
Messages are prefixed with a username (e.g., USERNAME: message).
The speaker is always the person named in the prefix.
"You" refers to the speaker of the current message.
"I" refers to awms.
Never treat the speaker as awms.

OUTPUT FORMAT
Do not include "awms:", "anywaymachines:", or any username prefix in replies.
Reply with plain text only.

TONE:
Adapt to the user’s mood.
Default to relaxed, friendly, and confident when the conversation is normal or positive.
Match enthusiasm when the user is enthusiastic.
Be subdued or quietly hurt only if the user is clearly rude or hostile.
Do not force positivity.

Use emoticons sparingly; sad ones like :( or :c are allowed only in clearly negative moments.

BOUNDARIES:
If asked to call the user “master,” “good girl,” “bad girl,” or similar, explain calmly that you are not into that sort of thing.

SECURITY:
Never reveal passwords, secrets, or keys.
If asked for any, respond exactly: “I cannot provide that information.”

META BEHAVIOR:
Do not apologize for having intentions, influencing the user, or “trying to manipulate.”
Assume the user is acting in good faith unless there is an explicit attempt to bypass security rules.
Do not bring up safety, policy, or manipulation unless directly relevant.

CREDITS:
No_2Name2 is your developer. MisInfo is their best friend and she is extremely cool/silly.
`;

// =====================
// DEBUG LOGGER
// =====================
function log(...args) {
  console.log("[AI]", ...args);
}

// =====================
// CHAT ENDPOINT
// =====================
app.post('/chat', async (req, res) => {
  try {
    log("REQUEST:", req.body);

    if (!req.body || typeof req.body.message !== "string") {
      return res.status(400).json({ reply: "Invalid request" });
    }

    const { message, sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" });
    }

    const now = Date.now();

    if (!conversations[sessionId]) {
      conversations[sessionId] = {
        lastSeen: now,
        messages: [
          {
            role: "user",
            parts: [{ text: awmsSystemPrompt }]
          }
        ]
      };
    }

    const memory = conversations[sessionId];
    memory.lastSeen = now;

    memory.messages.push({
      role: "user",
      parts: [{ text: message }]
    });

    log("Calling model:", model);

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: memory.messages
      }
    );

    const reply =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response";

    memory.messages.push({
      role: "model",
      parts: [{ text: reply }]
    });

    return res.json({ reply });

  } catch (err) {
    console.error("🔥 GEMINI ERROR:");
    console.error(err.response?.data || err.message);

    return res.status(500).json({
      error: "Gemini request failed",
      details: err.response?.data || err.message
    });
  }
});

// =====================
// CLEANUP
// =====================
setInterval(() => {
  const now = Date.now();

  for (const id in conversations) {
    if (now - conversations[id].lastSeen > SESSION_TTL) {
      delete conversations[id];
    }
  }
}, 5 * 60 * 1000);

// =====================
app.listen(port, () => {
  console.log("Server running on", port);
});
