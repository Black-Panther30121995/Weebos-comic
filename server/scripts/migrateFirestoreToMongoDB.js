import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import mongoose from 'mongoose';
import Comic from '../models/Comic.js';
import dotenv from 'dotenv';
import connectDB from '../config/db.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('MONGODB_URI:', process.env.MONGODB_URI);

// Initialize Firebase Admin with service account
const serviceAccount = path.resolve(__dirname, '../../server/weebos-31f97-firebase-adminsdk-fbsvc-9204f3528e.json');
const app = initializeApp({
  credential: cert(serviceAccount),
});
const firestore = getFirestore(app);

async function migrateFirestoreToMongoDB() {
  try {
    await connectDB();
    console.log('MongoDB connected');

    const comicsSnapshot = await firestore.collection('comics').get();
    const comics = comicsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    for (const comic of comics) {
      const comicData = {
        title: comic.id,
        info: comic.info || '',
        img: comic.img || '',
        pages: comic.pages || [],
        ratings: comic.ratings || [],
        description: comic.description || '',
        genres: comic.genres || [],
        comments: comic.comments || [],
        chapters: new Map(),  // Initialize an empty Map for chapters
      };

      // Ensure chapters are properly formatted as a Map
      for (const [chapterName, chapterData] of Object.entries(comic.chapters || {})) {
        const chapter = {
          pages: chapterData.pages || [],  // Cloudinary image URLs or page data
          comments: chapterData.comments || [], // Initialize comments if not provided
        };

        comicData.chapters.set(chapterName, chapter); // Add the formatted chapter to the Map
      }

      await Comic.findOneAndUpdate(
        { title: comicData.title },
        comicData,
        { upsert: true, new: true }
      );
      console.log(`Migrated comic: ${comicData.title}`);
    }

    console.log('Migration completed');
    mongoose.connection.close();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateFirestoreToMongoDB();
