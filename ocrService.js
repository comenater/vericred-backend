const Tesseract = require("tesseract.js");

async function readCertificate(imagePath) {
  const result = await Tesseract.recognize(imagePath, "eng");
  const text = result.data.text;
  const cleanText = text.replace(/\s+/g, " ").trim();
  console.log("OCR TEXT:", text);

  const name = cleanText
  .split("has successfully participated in")[0]
  .split("This is to certify that")
  .pop()
  .trim() || "Not Found";
  const certificateId = cleanText.match(/Certificate ID:\s*([A-Z0-9-]+)/i)?.[1] || "Not Found";
  const date = cleanText.match(/Date:\s*(.+?)(?=\s+Certificate ID:|$)/i)?.[1] || "Not Found";
  const event = cleanText.match(/participated in\s+(.+?)(?=\s+ABC Institute|$)/i)?.[1] || "Not Found";
  const correctedEvent = event
  .replace(/\bVeb\b/gi, "Web")
  .replace(/[.,]+$/, "")
  .trim();
  return { name, certificateId, date, event: correctedEvent };
}

module.exports = { readCertificate };