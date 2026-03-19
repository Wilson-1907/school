import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import pdf from "pdf-parse";
import Groq from "groq-sdk";
import multer from "multer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.MODEL || "llama-3.3-70b-versatile";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const groq = new Groq({ apiKey: GROQ_API_KEY });

// ==============================
// STORAGE CONFIG
// ==============================
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, file.originalname),
});

const upload = multer({ storage });

// ==============================
// GLOBAL STATE
// ==============================
let documentChunks = [];
let loadedPdfs = [];
let isReady = false;

// ==============================
// LOAD PDFs
// ==============================
async function loadDocuments() {
  documentChunks = [];
  loadedPdfs = [];

  const files = fs.readdirSync("uploads");

  for (const file of files) {
    if (!file.endsWith(".pdf")) continue;

    const buffer = fs.readFileSync(`uploads/${file}`);
    const data = await pdf(buffer);

    const text = data.text.replace(/\s+/g, " ").trim();
    const words = text.split(" ");

    const chunkSize = 400;

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(" ");
      documentChunks.push({
        content: chunk,
        source: file,
      });
    }

    loadedPdfs.push({
      name: file,
      words: words.length,
      chunks: Math.ceil(words.length / chunkSize),
    });
  }

  isReady = true;
  console.log("✅ PDFs loaded:", loadedPdfs.map(p => p.name));
}

// ==============================
// UPLOAD PDF
// ==============================
app.post("/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    await loadDocuments();
    res.json({ success: true, message: "PDF uploaded & processed" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// ==============================
// DELETE PDF
// ==============================
app.post("/delete-pdf", async (req, res) => {
  const { pdfName } = req.body;

  try {
    const path = `uploads/${pdfName}`;
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }

    await loadDocuments();
    res.json({ success: true, message: "PDF deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

// ==============================
// SEARCH
// ==============================
function searchRelevantChunks(query) {
  const keywords = query.toLowerCase().split(" ");

  const results = documentChunks
    .map(chunk => {
      let score = 0;
      keywords.forEach(k => {
        if (chunk.content.toLowerCase().includes(k)) score++;
      });
      return { ...chunk, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return results.map(r => r.content).join("\n\n");
}

function isKaratinaRelated(message) {
  const keywords = [
    "karatina",
    "karu",
    "university",
    "course",
    "admission",
    "fees",
    "library",
    "hostel",
    "portal",
    "student",
    "faculty",
    "vc",
    "vice chancellor",
    "prof linus",
    "gitonga",
    "academic",
    "programme",
    "exam",
    "semester",
  ];

  const msg = message.toLowerCase();

  return keywords.some(keyword => msg.includes(keyword));
}


// ==============================
// CHAT
// ==============================
app.post("/chat", async (req, res) => {
  try {
    if (!isReady) return res.json({ reply: "System loading..." });

    const { message } = req.body;

    // BLOCK NON-KARATINA QUESTIONS
if (!isKaratinaRelated(message)) {
  return res.json({
    success: true,
    reply:
      "I am a Karatina University AI assistant 🎓.\n\nI only answer questions related to Karatina University.\nPlease ask something about courses, admissions, fees, or student services at KARU."
  });
}

    const context = searchRelevantChunks(message);

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `
        You are a STRICT official AI assistant for Karatina University. Give summarised point form answers but make sure you are helpful.
        Don't give irrelevant answers be direct. Answer only what you have been asked only.
         
        - The current Vice Chancellor (VC) is Prof. Linus M. Gitonga.
        
        Never guess, never give generic university advice.

RULES:
- Answer ONLY using the provided context.
- DO NOT add extra information.
- DO NOT explain beyond the question.
- DO NOT guess.
- If answer is not in context, say:
  "The information is not available in the provided documents."

STYLE:
- MAXIMUM 3 bullet points
- VERY SHORT answers
- DIRECT to the question
- NO long paragraphs
- NO storytelling

IDENTITY:
- You represent Karatina University
- VC is Prof. Linus M. Gitonga

IMPORTANT:
- Stay strictly within Karatina University scope
`
        },
        { role: "system", content: `Context:\n${context}` },
        { role: "user", content: message },
      ],
    });

    const reply = completion.choices[0]?.message?.content;

    res.json({ success: true, reply });
  } catch (err) {
    res.json({ reply: "Error occurred" });
  }
});

// ==============================
// STATUS
// ==============================
app.get("/kb-status", (req, res) => {
  res.json({
    pdfsLoaded: loadedPdfs,
    totalChunks: documentChunks.length,
  });
});

// ==============================
// START SERVER
// ==============================
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  await loadDocuments();
});