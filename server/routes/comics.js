import express from 'express';
import Comic from '../models/Comic.js';
import upload from '../middlewares/upload.js';
import { v2 as cloudinary } from 'cloudinary';

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Test Cloudinary configuration
router.get('/test-cloudinary', async (req, res) => {
  try {
    const result = await cloudinary.api.ping();
    console.log('Cloudinary ping result:', JSON.stringify(result, null, 2));
    res.json({ success: true, result });
  } catch (err) {
    console.error('Cloudinary ping failed:', JSON.stringify(err, null, 2));
    res.status(500).json({ error: 'Cloudinary ping failed: ' + err.message });
  }
});

// Test public_id parsing
router.post('/test-public-id', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  const match = url.match(/\/v\d+\/(.+?)(?:\.\w+)+$/);
  const publicId = match ? match[1] : null;
  console.log('Test public_id - URL:', url, 'Public ID:', publicId);
  res.json({ url, publicId });
});

// Get all comics
router.get('/', async (req, res) => {
  try {
    const comics = await Comic.find();
    res.json(comics);
  } catch (err) {
    console.error('Error fetching comics:', err);
    res.status(500).json({ error: 'Failed to fetch comics: ' + err.message });
  }
});

// Get comic by title
router.get('/:title', async (req, res) => {
  try {
    const comic = await Comic.findOne({ title: decodeURIComponent(req.params.title) });
    if (!comic) return res.status(404).json({ error: 'Comic not found' });
    res.json(comic);
  } catch (err) {
    console.error('Error fetching comic:', err);
    res.status(500).json({ error: 'Failed to fetch comic: ' + err.message });
  }
});

// Add or update comic
router.post('/', async (req, res) => {
  try {
    const comicData = req.body;
    console.log('Creating/Updating comic:', comicData.title);
    const comic = await Comic.findOneAndUpdate(
      { title: comicData.title },
      comicData,
      { upsert: true, new: true }
    );
    res.json(comic);
  } catch (err) {
    console.error('Error saving comic:', err);
    res.status(500).json({ error: 'Failed to save comic: ' + err.message });
  }
});

// Update comic chapters
router.patch('/:title', async (req, res) => {
  try {
    const { chapters } = req.body;
    console.log('PATCH Request - Title:', decodeURIComponent(req.params.title));
    console.log('PATCH chapters:', JSON.stringify(chapters, null, 2));

    if (!chapters || typeof chapters !== 'object') {
      console.log('Validation failed: Invalid chapters payload');
      return res.status(400).json({ error: 'Invalid chapters payload' });
    }

    const update = {};
    for (const [chapterKey, chapterData] of Object.entries(chapters)) {
      console.log(`Processing chapter: ${chapterKey}`);
      if (!chapterData.pages || !Array.isArray(chapterData.pages)) {
        console.log(`Validation failed: Invalid pages array for ${chapterKey}`);
        return res.status(400).json({ error: `Invalid pages array for chapter ${chapterKey}` });
      }
      const validPages = chapterData.pages.filter(page => typeof page === 'string' && page.startsWith('https://'));
      if (validPages.length !== chapterData.pages.length) {
        console.log(`Validation failed: Non-string or invalid URLs in pages for ${chapterKey}`);
        return res.status(400).json({ error: `Non-string or invalid URLs in pages for chapter ${chapterKey}` });
      }
      update[`chapters.${chapterKey}`] = {
        pages: validPages,
        comments: Array.isArray(chapterData.comments) ? chapterData.comments : []
      };
    }
    console.log('Update object:', JSON.stringify(update, null, 2));

    const comic = await Comic.findOne({ title: decodeURIComponent(req.params.title) });
    if (!comic) {
      console.log('Comic not found:', decodeURIComponent(req.params.title));
      return res.status(404).json({ error: 'Comic not found' });
    }
    console.log('Existing comic:', JSON.stringify(comic, null, 2));

    const updatedComic = await Comic.findOneAndUpdate(
      { title: decodeURIComponent(req.params.title) },
      { $set: update },
      { new: true, runValidators: true }
    );
    console.log('Updated comic:', JSON.stringify(updatedComic, null, 2));

    res.json(updatedComic);
  } catch (err) {
    console.error('Error updating comic chapters:', err);
    res.status(500).json({ error: `Failed to update comic chapters: ${err.message}` });
  }
});

// Update comic ratings
router.patch('/:title/ratings', async (req, res) => {
  try {
    const { rating } = req.body;
    const comic = await Comic.findOneAndUpdate(
      { title: decodeURIComponent(req.params.title) },
      { $push: { ratings: rating } },
      { new: true }
    );
    if (!comic) return res.status(404).json({ error: 'Comic not found' });
    res.json(comic);
  } catch (err) {
    console.error('Error updating rating:', err);
    res.status(500).json({ error: 'Failed to update rating: ' + err.message });
  }
});

// Add or remove comment
router.patch('/:title/comments', async (req, res) => {
  try {
    const { comment, chapter, action } = req.body;
    let update;
    if (action === 'remove') {
      update = chapter
        ? { $pull: { [`chapters.${chapter}.comments`]: { text: comment.text, userId: comment.userId } } }
        : { $pull: { comments: { text: comment.text, userId: comment.userId } } };
    } else {
      update = chapter
        ? { $push: { [`chapters.${chapter}.comments`]: comment } }
        : { $push: { comments: comment } };
    }
    const comic = await Comic.findOneAndUpdate(
      { title: decodeURIComponent(req.params.title) },
      update,
      { new: true }
    );
    if (!comic) return res.status(404).json({ error: 'Comic not found' });
    res.json(comic);
  } catch (err) {
    console.error('Error updating comment:', err);
    res.status(500).json({ error: 'Failed to update comment: ' + err.message });
  }
});

// Delete chapter and associated Cloudinary images
router.delete('/:title/chapter/:chapter', async (req, res) => {
  try {
    const title = decodeURIComponent(req.params.title);
    const chapter = req.params.chapter;
    console.log(`Deleting chapter ${chapter} for comic: ${title}`);

    // Validate Cloudinary configuration
    console.log('Validating Cloudinary configuration...');
    try {
      const pingResult = await cloudinary.api.ping();
      console.log('Cloudinary ping successful:', JSON.stringify(pingResult, null, 2));
    } catch (pingErr) {
      console.error('Cloudinary configuration invalid:', JSON.stringify(pingErr, null, 2));
      throw new Error('Invalid Cloudinary configuration: ' + pingErr.message);
    }

    // Find comic and get chapter pages
    const comic = await Comic.findOne({ title });
    if (!comic) {
      console.log('Comic not found:', title);
      return res.status(404).json({ error: 'Comic not found' });
    }
    console.log('Comic document:', JSON.stringify(comic, null, 2));
    console.log('Raw chapters Map:', JSON.stringify([...(comic.chapters || new Map())], null, 2));

    // Access chapters Map
    const chaptersMap = comic.chapters || new Map();
    const chapterData = chaptersMap.get(chapter);
    const pages = chapterData?.pages || [];
    console.log(`Pages to delete from Cloudinary (${pages.length}):`, JSON.stringify(pages, null, 2));

    // Extract public IDs
    const publicIds = pages
      .filter(url => typeof url === 'string' && url.startsWith('https://res.cloudinary.com'))
      .map(url => {
        const match = url.match(/\/v\d+\/(.+?)(?:\.\w+)+$/);
        if (!match) {
          console.log(`Invalid URL format: ${url}`);
          return null;
        }
        const publicId = match[1];
        console.log(`Extracted public_id: ${publicId} from ${url}`);
        return publicId;
      })
      .filter(id => id);

    console.log(`Cloudinary public IDs (${publicIds.length}):`, JSON.stringify(publicIds, null, 2));

    // Delete images from Cloudinary in batches
    if (publicIds.length > 0) {
      console.log('Attempting to delete resources from Cloudinary by public IDs...');
      const batchSize = 100; // Cloudinary allows up to 100 IDs per request
      const batches = [];
      for (let i = 0; i < publicIds.length; i += batchSize) {
        batches.push(publicIds.slice(i, i + batchSize));
      }

      const deletionResults = [];
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} IDs)`);
        let attempts = 0;
        const maxAttempts = 3;
        let batchResult = null;

        while (attempts < maxAttempts && !batchResult) {
          attempts++;
          try {
            batchResult = await cloudinary.api.delete_resources(
              batch,
              { resource_type: 'image', invalidate: true }
            );
            console.log(`Batch ${batchIndex + 1} deletion result (attempt ${attempts}):`, JSON.stringify(batchResult, null, 2));
            deletionResults.push(batchResult);
            break;
          } catch (cloudinaryErr) {
            console.error(`Batch ${batchIndex + 1} deletion failed (attempt ${attempts}):`, JSON.stringify(cloudinaryErr, null, 2));
            if (attempts === maxAttempts) {
              console.error(`Max attempts reached for batch ${batchIndex + 1}`);
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Check if all resources were deleted
      const deletedCount = deletionResults.reduce((count, result) => {
        return count + Object.values(result.deleted || {}).filter(status => status === 'deleted').length;
      }, 0);
      console.log(`Total resources deleted: ${deletedCount}/${publicIds.length}`);

      // Fallback: Delete by folder prefix if not all deleted
      if (deletedCount < publicIds.length) {
        console.log('Some resources not deleted, attempting delete by folder prefix...');
        const folderPrefix = `comics/${title}/${chapter}`;
        console.log(`Deleting all resources in folder: ${folderPrefix}`);
        try {
          const folderResult = await cloudinary.api.delete_resources_by_prefix(
            folderPrefix,
            { resource_type: 'image', invalidate: true }
          );
          console.log('Cloudinary folder deletion result:', JSON.stringify(folderResult, null, 2));
        } catch (folderErr) {
          console.error('Error deleting by folder prefix:', JSON.stringify(folderErr, null, 2));
        }
      }
    } else {
      console.log('No valid public IDs to delete from Cloudinary');
      // Precautionary folder deletion
      const folderPrefix = `comics/${title}/${chapter}`;
      console.log(`Attempting precautionary folder deletion: ${folderPrefix}`);
      try {
        const folderResult = await cloudinary.api.delete_resources_by_prefix(
          folderPrefix,
          { resource_type: 'image', invalidate: true }
        );
        console.log('Precautionary folder deletion result:', JSON.stringify(folderResult, null, 2));
      } catch (folderErr) {
        console.error('Error in precautionary folder deletion:', JSON.stringify(folderErr, null, 2));
      }
    }

    // Delete chapter from MongoDB
    console.log(`Removing chapter ${chapter} from MongoDB...`);
    const updatedComic = await Comic.findOneAndUpdate(
      { title },
      { $unset: { [`chapters.${chapter}`]: "" } },
      { new: true }
    );

    if (!updatedComic) {
      console.log('Failed to update comic after deletion');
      return res.status(404).json({ error: 'Comic not found after deletion' });
    }

    console.log('Chapter deleted from MongoDB:', chapter);
    console.log('Updated comic:', JSON.stringify(updatedComic, null, 2));
    res.json(updatedComic);
  } catch (err) {
    console.error('Error deleting chapter:', JSON.stringify(err, null, 2));
    res.status(500).json({ error: `Failed to delete chapter: ${err.message}` });
  }
});

// Upload chapter image to Cloudinary
router.post('/:title/chapter/:chapter', upload.single('image'), async (req, res) => {
  try {
    const imageUrl = req.file.path;
    const { title, chapter } = req.params;
    const comic = await Comic.findOneAndUpdate(
      { title: decodeURIComponent(title) },
      { $set: { [`chapters.${chapter}.pages`]: [imageUrl] } },
      { new: true }
    );
    if (!comic) return res.status(404).json({ error: 'Comic not found' });
    res.json({ message: 'Chapter uploaded successfully', comic });
  } catch (err) {
    console.error('Error uploading chapter image:', err);
    res.status(500).json({ error: 'Failed to upload chapter image: ' + err.message });
  }
});

export default router;