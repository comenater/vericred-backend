const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const Credential = require("./credential");
const QRCode = require("qrcode");
const multer = require("multer");
const { createWorker } = require("tesseract.js");
const pdfParse = require("pdf-parse");
const pdfPoppler = require("pdf-poppler");
const fs = require("fs");
const path = require("path");
const os = require("os");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();

app.use(express.json());
app.use(cors());
app.get("/", (req, res) => {
  res.send("SIH Backend is Running!");
});

const PORT = 5000;

app.post("/credentials", async (req, res) => {
  try {
    const credentialId =
      "VC-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

    const newCredential = new Credential({
      credentialId: credentialId,
      studentName: req.body.studentName,
      credentialTitle: req.body.credentialTitle,
      institutionName: req.body.institutionName
    });

    const savedCredential = await newCredential.save();

    const verificationLink = `http://localhost:5000/verify/${credentialId}`;

const qrCode = await QRCode.toDataURL(verificationLink);

    res.json({
  message: "Credential created successfully!",
  credential: savedCredential,
  qrCode: qrCode
});

  } catch (error) {
    res.status(500).json({
      message: "Error creating credential",
      error: error.message
    });
  }
});

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
    credential: credential
  });
}
res.json({
      verified: true,
      message: "Credential is valid!",
      credential: credential
    });
  } catch (error) {
    res.status(500).json({
      message: "Verification error",
      error: error.message
    });
  }
});

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

app.get("/student/:studentName/credentials", async (req, res) => {
  try {
    const credentials = await Credential.find({
      studentName: req.params.studentName
    });

    res.json({
      studentName: req.params.studentName,
      totalCredentials: credentials.length,
      credentials: credentials
    });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching student credentials",
      error: error.message
    });
  }
});

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
    const extractedText = data.text;

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
  studentName: studentNameMatch ? studentNameMatch[1].trim() : null,
  credentialTitle: credentialTitleMatch ? credentialTitleMatch[1].trim() : null,
  institutionName: institutionNameMatch ? institutionNameMatch[1].trim() : null
};

    res.json({
      message: "Document processed successfully!",
      fileName: req.file.originalname,
      extractedText: data.text,
      extractedInfo: extractedInfo
    });

  } catch (error) {
    res.status(500).json({
      message: "Document processing error",
      error: error.message
    });
  }
});

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
      credential: credential
    });
  } catch (error) {
    res.status(500).json({
      message: "Error revoking credential",
      error: error.message
    });
  }
});
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

    res.json({
      credential: credential
    });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching credential",
      error: error.message
    });
  }
});

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
      credential: credential
    });

  } catch (error) {
    res.status(500).json({
      message: "Error updating credential",
      error: error.message
    });
  }
});


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
  .then(() => console.log("MongoDB Connected!"))
  .catch((error) => console.log("MongoDB connection error:", error));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
