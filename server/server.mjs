import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import multer from 'multer';
import axios from 'axios';
import connectDB from './config/db.mjs';
import comicRoutes from './routes/comics.js';

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors({
  origin: [process.env.VITE_FRONTEND_URL || 'http://localhost:3000'],
}));
app.use(express.json());

// Connect to MongoDB
await connectDB();

// Upload endpoint
app.post('/upload', upload.array('images'), async (req, res) => {
  try {
    const { comicName, chapterNum } = req.body;
    const chapterKey = `Chapter${chapterNum}`;
    const files = req.files;

    const imageUrls = await Promise.all(
      files.map(async (file, index) => {
        const formData = new FormData();
        formData.append('file', {
          uri: file.path,
          name: file.originalname,
          type: file.mimetype,
        });
        formData.append('upload_preset', process.env.CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', `comics/${comicName}/${chapterKey}`);
        formData.append('public_id', `${index}-${file.originalname}`);

        const response = await axios.post(
          `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
          formData
        );
        return response.data.secure_url;
      })
    );

    const comic = await Comic.findOneAndUpdate(
      { title: comicName },
      { $set: { [`chapters.${chapterKey}`]: imageUrls } },
      { upsert: true, new: true }
    );

    res.json({ message: 'Chapter uploaded successfully', comic });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload chapter' });
  }
});

// Delete endpoint
app.delete('/delete-chapter', async (req, res) => {
  try {
    const { comicName, chapterNum } = req.body;
    const chapterKey = `Chapter${chapterNum}`;

    const comic = await Comic.findOne({ title: comicName });
    if (!comic) return res.status(404).json({ error: 'Comic not found' });

    const imageUrls = comic.chapters.get(chapterKey) || [];
    await Promise.all(
      imageUrls.map(async (url) => {
        const publicId = url.split('/').slice(-1)[0].split('.')[0];
        await axios.post(
          `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/destroy`,
          { public_id: `comics/${comicName}/${chapterKey}/${publicId}` },
          { headers: { Authorization: `Basic ${Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString('base64')}` } }
        );
      })
    );

    await Comic.updateOne(
      { title: comicName },
      { $unset: { [`chapters.${chapterKey}`]: "" } }
    );

    res.json({ message: 'Chapter deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete chapter' });
  }
});

// Comic routes
app.use('/api/comics', comicRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});