import mongoose from 'mongoose';

// Subschema for comments inside chapters
const commentSchema = new mongoose.Schema({
  text: String,
  userId: String,
  userName: String,
  timestamp: Date,
}, { _id: false });

// Subschema for each chapter's content
const chapterSchema = new mongoose.Schema({
  pages: [String],
  comments: [commentSchema],
}, { _id: false });

const comicSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  info: { type: String, required: true },
  img: { type: String, required: true },
  pages: [String], // Global pages if any (optional)
  ratings: [Number],
  description: { type: String, required: true },
  chapters: {
    type: Map,
    of: chapterSchema,
    default: {},
  },
  genres: [String],
  comments: [commentSchema], // Global comic-level comments
});

export default mongoose.model('Comic', comicSchema);
