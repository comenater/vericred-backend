const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const Credential = require("./credential");
const QRCode = require("qrcode");
const multer = require("multer");
const { createWorker } = require("tesseract.js");
const pdfParse = require("pdf-parse");
const { createCanvas } = require("canvas");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("SIH Backend is Running!");
});

// CREATE CREDENTIAL
app.post("/credentials", async (req, res) => {
  try {
    const credentialId =
      "VC-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

    const newCredential = new Credential({
      credentialId,
      studentName: req.body.studentName,
      credentialTitle: req.body.credentialTitle,
      institutionName: req.body.institutionName
    });

    const savedCredential = await newCredential.save();

    const verificationLink =
      `https://vericred-backend.onrender.com/verify/${credentialId}`;

    const qrCode = await QRCode.toDataURL(verificationLink);

    res.json({
      message: "Credential created successfully!",
      credential: savedCredential,
      qrCode
    });

  } catch (error) {
    res.status(500).json({
      message: "Error creating credential",
      error: error.message
    });
  }
});


// VERIFY CREDENTIAL
app.get("/verify/:credentialId", async (req, res) => {
  try {
   
    const credential = await Credential.findOne({
      credentialId: req.params.credentialId
    });

    if (!credential) {
      return res.status(404).json({
        verified: false,
        message: "Credential not found!"
      });
    }

    if (credential.verificationStatus === "Revoked") {
      return res.json({
        verified: false,
        message: "Credential has been revoked!",
        credential
      });
    }

    res.json({
      verified: true,
      message: "Credential is valid!",
      credential
    });

  } catch (error) {
    res.status(500).json({
      message: "Verification error",
      error: error.message
    });
  }
});

// GET ALL CREDENTIALS
app.get("/credentials", async (req, res) => {
  try {
    const credentials = await Credential.find();
    res.json(credentials);

  } catch (error) {
    res.status(500).json({
      message: "Error fetching credentials",
      error: error.message
    });
  }
});

// GET STUDENT CREDENTIALS
app.get("/student/:studentName/credentials", async (req, res) => {
  try {
    const credentials = await Credential.find({
      studentName: req.params.studentName
    });

    res.json({
      studentName: req.params.studentName,
      totalCredentials: credentials.length,
      credentials
    });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching student credentials",
      error: error.message
    });
  }
});

// UPLOAD DOCUMENT + TEXT EXTRACTION + OCR
app.post("/upload-document", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No document uploaded!"
      });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({
        message: "Please upload a PDF document!"
      });
    }

    const data = await pdfParse(req.file.buffer);
    let extractedText = data.text.trim();
    let extractionMethod = "PDF Text Extraction";

    if (extractedText.length < 50) {
      const pdfjsLib = await import(
        "pdfjs-dist/legacy/build/pdf.mjs"
      );

      extractionMethod = "OCR";

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(req.file.buffer)
      });

      const pdfDocument = await loadingTask.promise;

      const worker = await createWorker("eng");
      let ocrText = "";

      const pagesToProcess = Math.min(pdfDocument.numPages, 3);

      for (
        let pageNumber = 1;
        pageNumber <= pagesToProcess;
        pageNumber++
      ) {
        const page = await pdfDocument.getPage(pageNumber);

        const viewport = page.getViewport({
          scale: 2
        });

        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height)
        );

        const context = canvas.getContext("2d");

        await page.render({
          canvasContext: context,
          viewport
        }).promise;

        const imageBuffer = canvas.toBuffer("image/png");

        const {
          data: { text }
        } = await worker.recognize(imageBuffer);

        ocrText += text + "\n";
      }

      await worker.terminate();
      extractedText = ocrText.trim();
    }

    const studentNameMatch = extractedText.match(
      /(?:Student Name|Name)\s*[:\-]?\s*([A-Za-z ]+)/i
    );

    const credentialTitleMatch = extractedText.match(
      /(?:Certificate|Credential Title|Course)\s*[:\-]?\s*([A-Za-z0-9 ]+)/i
    );

    const institutionNameMatch = extractedText.match(
      /(?:Institution|Organization|Issued By)\s*[:\-]?\s*([A-Za-z0-9 &.,]+)/i
    );

    const extractedInfo = {
      studentName: studentNameMatch
        ? studentNameMatch[1].trim()
        : null,

      credentialTitle: credentialTitleMatch
        ? credentialTitleMatch[1].trim()
        : null,

      institutionName: institutionNameMatch
        ? institutionNameMatch[1].trim()
        : null
    };

    res.json({
      message: "Document processed successfully!",
      fileName: req.file.originalname,
      extractionMethod,
      extractedText,
      extractedInfo
    });

  } catch (error) {
    res.status(500).json({
      message: "Document processing error",
      error: error.message
    });
  }
});

// REVOKE
app.patch("/credentials/:credentialId/revoke", async (req, res) => {
  try {
    const credential = await Credential.findOneAndUpdate(
      { credentialId: req.params.credentialId },
      { verificationStatus: "Revoked" },
      { new: true }
    );

    if (!credential) {
      return res.status(404).json({
        message: "Credential not found!"
      });
    }

    res.json({
      message: "Credential revoked successfully!",
      credential
    });

  } catch (error) {
    res.status(500).json({
      message: "Error revoking credential",
      error: error.message
    });
  }
});

// GET SINGLE CREDENTIAL
app.get("/credentials/:credentialId", async (req, res) => {
  try {
    const credential = await Credential.findOne({
      credentialId: req.params.credentialId
    });

    if (!credential) {
      return res.status(404).json({
        message: "Credential not found!"
      });
    }

    res.json({ credential });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching credential",
      error: error.message
    });
  }
});

// UPDATE
app.put("/credentials/:credentialId", async (req, res) => {
  try {
    const credential = await Credential.findOneAndUpdate(
      { credentialId: req.params.credentialId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!credential) {
      return res.status(404).json({
        message: "Credential not found!"
      });
    }

    res.json({
      message: "Credential updated successfully!",
      credential
    });

  } catch (error) {
    res.status(500).json({
      message: "Error updating credential",
      error: error.message
    });
  }
});

// DELETE
app.delete("/credentials/:credentialId", async (req, res) => {
  try {
    const credential = await Credential.findOneAndDelete({
      credentialId: req.params.credentialId
    });

    if (!credential) {
      return res.status(404).json({
        message: "Credential not found!"
      });
    }

    res.json({
      message: "Credential deleted successfully!"
    });

  } catch (error) {
    res.status(500).json({
      message: "Error deleting credential",
      error: error.message
    });
  }
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected!");
    console.log("MongoDB readyState:", mongoose.connection.readyState);

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log("MongoDB connection error:", error);
  });
