const mongoose = require("mongoose");

const interrogationTurnSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    revealedClueIds: { type: [String], default: [] },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const gameSessionSchema = new mongoose.Schema(
  {
    caseId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, index: true },
    discoveredClueIds: { type: [String], default: [] },
    interrogations: {
      type: Map,
      of: [interrogationTurnSchema],
      default: () => new Map(),
    },
    exploredObjectIds: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["active", "won", "lost"],
      default: "active",
      index: true,
    },
    accusedSuspectId: { type: String, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("GameSession", gameSessionSchema);
