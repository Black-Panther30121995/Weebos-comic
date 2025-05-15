import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'weebos_comics',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 1080, height: 1920, crop: 'limit' }],
  },
});

const upload = multer({ storage });

export default upload;
