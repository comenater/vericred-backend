const mongoose = require("mongoose");

const credentialSchema = new mongoose.Schema({
  credentialId: {
    type: String,
    required: true,
    unique: true
  },

  studentName: {
    type: String,
    required: true
  },

  credentialTitle: {
    type: String,
    required: true
  },

  institutionName: {
    type: String,
    required: true
  },

  issueDate: {
    type: Date,
    default: Date.now
  },

  verificationStatus: {
  type: String,
  enum: ["Verified", "Revoked"],
  default: "Verified"
}
});

const Credential = mongoose.model("Credential", credentialSchema);

module.exports = Credential;