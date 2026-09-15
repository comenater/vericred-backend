const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { readCertificate } = require("./ocrService");

const app = express();
app.use(cors());

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.send(`
    <h2>VeriCred OCR</h2>
    <form action="/upload" method="POST" enctype="multipart/form-data">
      <input type="file" name="certificate" required />
      <button type="submit">Upload Certificate</button>
    </form>
  `);
});

app.post("/upload", upload.single("certificate"), async (req, res) => {
  const data = await readCertificate(req.file.path);

  const certificateRecords = {
  "TEST-001": {
    name: "Test Student",
    event: "Web Development Workshop",
    date: "11 September 2026"
  },
  "ABC-102": {
    name: "Test Student",
    event: "Web Development Workshop",
    date: "11 September 2026"
  },
  "VC-2026-001": {
    name: "Test Student",
    event: "Web Development Workshop",
    date: "11 September 2026"
  }
};

  const record = certificateRecords[data.certificateId.trim()];

let status;

if (!record) {
  status = "INVALID";
} else if (
  record.name === data.name &&
  record.event === data.event &&
  record.date === data.date
) {
  status = "VERIFIED";
} else {
  status = "SUSPECTED TAMPERING";
}
  res.send(`
    <h2>VeriCred Verification</h2>
    <p><b>Name:</b> ${data.name}</p>
    <p><b>Certificate ID:</b> ${data.certificateId}</p>
    <p><b>Event:</b> ${data.event}</p>
    <p><b>Date:</b> ${data.date}</p>

    <h3 style="color:${
  status === "VERIFIED"
    ? "green"
    : status === "SUSPECTED TAMPERING"
    ? "orange"
    : "red"
}">
  ${status}
</h3>
  `);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});