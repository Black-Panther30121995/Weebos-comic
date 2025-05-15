import React, { useState, useRef, useEffect, useContext } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { ThemeContext } from "../context/ThemeContext";

export default function Upload() {
  const { title } = useParams();
  const { currentUser, userRole } = useAuth();
  const { theme } = useContext(ThemeContext);
  const [selectedComic, setSelectedComic] = useState(title || "");
  const [chapterNum, setChapterNum] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [comicsData, setComicsData] = useState({});
  const [selectedChapterToDelete, setSelectedChapterToDelete] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const uploadButtonRef = useRef(null);
  const deleteButtonRef = useRef(null);
  const [uploadButtonWidth, setUploadButtonWidth] = useState(0);
  const [deleteButtonWidth, setDeleteButtonWidth] = useState(0);

  const CLOUDINARY_CLOUD_NAME = "dzvd0wfym";
  const CLOUDINARY_UPLOAD_PRESET = "comic_upload";
  const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  if (!currentUser || userRole !== "publisher") {
    return <Navigate to="/" />;
  }

  useEffect(() => {
    const fetchComics = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/comics`);
        const comics = response.data.reduce((acc, comic) => {
          acc[comic.title] = comic;
          return acc;
        }, {});
        setComicsData(comics);
      } catch (error) {
        console.error("Failed to fetch comics:", error);
      }
    };
    fetchComics();
  }, []);

  useEffect(() => {
    if (uploadButtonRef.current && !uploading) {
      setUploadButtonWidth(uploadButtonRef.current.offsetWidth);
    }
    if (deleteButtonRef.current && !deleting) {
      setDeleteButtonWidth(deleteButtonRef.current.offsetWidth);
    }
  }, [uploading, deleting]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length > 0) {
      setImageFiles(imageFiles);
    } else {
      alert("Please drop a folder containing images.");
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length > 0) {
      setImageFiles(imageFiles);
    } else {
      alert("Please select a folder containing images.");
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComic) {
      alert("Please select a comic to upload a chapter for.");
      return;
    }

    const chapterKey = `Chapter${chapterNum}`;

    if (!chapterNum || imageFiles.length === 0) {
      alert("Please fill the chapter number and drop a folder of images.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      let comicExists = false;
      try {
        const comicResponse = await axios.get(`${import.meta.env.VITE_API_URL}/comics/${encodeURIComponent(selectedComic)}`);
        comicExists = !!comicResponse.data;
        setUploadProgress(5);
      } catch (err) {
        if (err.response?.status !== 404) throw err;
      }

      if (!comicExists) {
        console.log('Creating new comic:', selectedComic);
        await axios.post(`${import.meta.env.VITE_API_URL}/comics`, {
          title: selectedComic,
          info: "Default info",
          img: "https://via.placeholder.com/150",
          pages: [],
          ratings: [],
          description: "A comic created via upload.",
          chapters: {},
          genres: comicsData[selectedComic]?.genres || [],
          comments: [],
        });
        setUploadProgress(10);
      }

      const sortedImageFiles = [...imageFiles].sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)?.[0] || "0", 10);
        const numB = parseInt(b.name.match(/\d+/)?.[0] || "0", 10);
        return numA - numB;
      });

      const totalImages = sortedImageFiles.length;
      const progressPerImage = 85 / totalImages; // 85% for uploads, 10% for comic creation, 5% for final patch
      let uploadedImages = 0;

      const imageUrls = await Promise.all(
        sortedImageFiles.map(async (file, index) => {
          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
            formData.append("folder", `comics/${selectedComic}/${chapterKey}`);
            const fileName = file.name.replace(/\.[^/.]+$/, '');
            formData.append("public_id", `${index}-${fileName}`);
            const response = await axios.post(CLOUDINARY_API_URL, formData);
            const url = response.data.secure_url;
            if (typeof url !== 'string' || !url.startsWith('https://')) {
              throw new Error(`Invalid Cloudinary URL for ${file.name}: ${url}`);
            }
            uploadedImages += 1;
            setUploadProgress(Math.min(10 + uploadedImages * progressPerImage, 95));
            return url;
          } catch (error) {
            console.error(`Failed to upload ${file.name} to Cloudinary:`, error);
            return null;
          }
        })
      );

      const validImageUrls = imageUrls.filter(url => typeof url === 'string' && url.startsWith('https://'));
      console.log('Cloudinary URLs:', validImageUrls);

      if (validImageUrls.length === 0) {
        throw new Error('No valid image URLs were generated from Cloudinary');
      }

      const patchPayload = {
        chapters: { [chapterKey]: { pages: validImageUrls, comments: [] } }
      };
      console.log('PATCH Payload:', patchPayload);

      await axios.patch(
        `${import.meta.env.VITE_API_URL}/comics/${encodeURIComponent(selectedComic)}`,
        patchPayload
      );

      setUploadProgress(100);

      const updatedResponse = await axios.get(`${import.meta.env.VITE_API_URL}/comics/${encodeURIComponent(selectedComic)}`);
      setComicsData((prev) => ({
        ...prev,
        [selectedComic]: updatedResponse.data,
      }));

      alert("Chapter uploaded successfully!");
      setChapterNum("");
      setImageFiles([]);
    } catch (error) {
      console.error("Upload failed:", error);
      let errorMessage = `Failed to upload chapter: ${error.message}`;
      if (error.response) {
        errorMessage = `Server error: ${error.response.status} ${error.response.data?.error || error.message}`;
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error: Could not connect to the backend server.";
      }
      alert(errorMessage);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500); // Delay to show 100% briefly
    }
  };

  const handleDelete = async () => {
    if (!selectedComic || !selectedChapterToDelete) {
      alert("Please select a comic and chapter to delete.");
      return;
    }

    setDeleting(true);
    setDeleteProgress(0);
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const chapterKey = `Chapter${selectedChapterToDelete}`;
      console.log(`Deleting chapter ${chapterKey} for comic: ${selectedComic}`);

      // Fetch comic to get image URLs
      const comicResponse = await axios.get(`${apiUrl}/comics/${encodeURIComponent(selectedComic)}`);
      const chapter = comicResponse.data.chapters[chapterKey];
      if (!chapter) {
        throw new Error('Chapter not found');
      }
      const imageUrls = chapter.pages || [];
      setDeleteProgress(10);

      const totalImages = imageUrls.length;
      const progressPerImage = totalImages > 0 ? 80 / totalImages : 0;
      let deletedImages = 0;

      // Delete images from Cloudinary
      await Promise.all(
        imageUrls.map(async (url) => {
          try {
            const publicId = url.split('/').slice(-1)[0].split('.')[0];
            await axios.post(
              `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
              { public_id: `comics/${selectedComic}/${chapterKey}/${publicId}` },
              {
                headers: {
                  Authorization: `Basic ${btoa(`${process.env.REACT_APP_CLOUDINARY_API_KEY}:${process.env.REACT_APP_CLOUDINARY_API_SECRET}`)}`
                }
              }
            );
            deletedImages += 1;
            setDeleteProgress(Math.min(10 + deletedImages * progressPerImage, 90));
          } catch (error) {
            console.error(`Failed to delete image ${url}:`, error);
          }
        })
      );

      // Delete chapter from backend
      const deleteResponse = await axios.delete(
        `${apiUrl}/comics/${encodeURIComponent(selectedComic)}/chapter/${chapterKey}`
      );
      console.log('Delete Response:', deleteResponse.data);
      setDeleteProgress(100);

      // Update local state
      setComicsData((prev) => {
        const updatedChapters = { ...prev[selectedComic].chapters };
        delete updatedChapters[chapterKey];
        return {
          ...prev,
          [selectedComic]: { ...prev[selectedComic], chapters: updatedChapters },
        };
      });

      alert("Chapter and associated images deleted successfully!");
      setSelectedChapterToDelete("");
    } catch (error) {
      console.error("Delete failed:", error);
      let errorMessage = "Failed to delete chapter and images";
      if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error: Could not connect to the backend server.";
      } else if (error.response) {
        errorMessage = `Server error: ${error.response.data.error || error.message}`;
      }
      alert(`${errorMessage}. Please try again or contact support.`);
    } finally {
      setTimeout(() => {
        setDeleting(false);
        setDeleteProgress(0);
      }, 500); // Delay to show 100% briefly
    }
  };

  const getSortedChapters = (chapters) => {
    return Object.keys(chapters || {}).sort((a, b) => {
      const aNum = parseInt(a.replace("Chapter", ""), 10);
      const bNum = parseInt(b.replace("Chapter", ""), 10);
      return aNum - bNum;
    });
  };

  return (
    <div
      className={`w-full min-h-screen flex flex-col items-center py-8 ${
        theme === "dark" ? "bg-gray-900 text-gray-200" : "bg-gray-100 text-gray-900"
      }`}
    >
      <h1
        className={`text-3xl font-bold font-nunito mb-8 ${
          theme === "dark" ? "text-white" : "text-gray-900"
        }`}
      >
        Manage Comic Chapters
      </h1>

      <div className="w-full max-w-md flex flex-col gap-6">
        <div>
          <label
            htmlFor="selectComic"
            className={`text-lg mb-2 block ${theme === "dark" ? "text-white" : "text-gray-900"}`}
          >
            Select Comic
          </label>
          <select
            id="selectComic"
            value={selectedComic}
            onChange={(e) => {
              setSelectedComic(e.target.value);
              setChapterNum("");
              setImageFiles([]);
              setSelectedChapterToDelete("");
            }}
            className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
              theme === "dark"
                ? "bg-gray-700 text-gray-200 border-gray-600 focus:ring-teal-500"
                : "bg-gray-200 text-gray-900 border-gray-300 focus:ring-teal-600"
            }`}
          >
            <option value="">-- Select a Comic --</option>
            {Object.keys(comicsData).map((comic) => (
              <option key={comic} value={comic}>
                {comic}
              </option>
            ))}
          </select>
        </div>

        {selectedComic && (
          <>
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
              <div>
                <label
                  htmlFor="chapterNum"
                  className={`text-lg mb-2 block ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  Chapter Number (for {selectedComic})
                </label>
                <input
                  id="chapterNum"
                  type="number"
                  value={chapterNum}
                  onChange={(e) => setChapterNum(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                    theme === "dark"
                      ? "bg-gray-700 text-gray-200 border-gray-600 focus:ring-teal-500"
                      : "bg-gray-200 text-gray-900 border-gray-300 focus:ring-teal-600"
                  }`}
                  placeholder="e.g., 1"
                  min="1"
                />
              </div>
              <div>
                <label
                  className={`text-lg mb-2 block ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  Upload Image Folder
                </label>
                <div
                  className={`w-full h-40 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer ${
                    dragActive
                      ? "border-teal-500 bg-teal-900 bg-opacity-20"
                      : theme === "dark"
                      ? "border-gray-600 text-gray-400"
                      : "border-gray-400 text-gray-600"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={handleClick}
                >
                  {imageFiles.length > 0 ? (
                    <p>{imageFiles.length} images selected</p>
                  ) : (
                    <p>Drag and drop a folder of images here or click to select</p>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  webkitdirectory="true"
                />
              </div>
              <button
                type="submit"
                disabled={uploading}
                ref={uploadButtonRef}
                style={uploading ? { width: `${uploadButtonWidth}px` } : {}}
                className={`w-full px-6 py-3 rounded-lg transition-colors duration-300 shadow-md relative overflow-hidden ${
                  theme === "dark"
                    ? `bg-teal-600 text-white hover:bg-teal-700 ${uploading ? "bg-transparent" : ""}`
                    : `bg-teal-500 text-white hover:bg-teal-600 ${uploading ? "bg-transparent" : ""}`
                }`}
              >
                {uploading ? (
                  <>
                    <div
                      className="absolute inset-0 bg-teal-500 transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                    <span className="relative z-10 text-white">{Math.round(uploadProgress)}%</span>
                  </>
                ) : (
                  "Upload Chapter"
                )}
              </button>
            </form>

            <div className="flex flex-col gap-6 mt-6">
              <h2
                className={`text-2xl font-bold font-nunito ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                Delete a Chapter
              </h2>
              <div>
                <label
                  htmlFor="deleteChapter"
                  className={`text-lg mb-2 block ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  Select Chapter to Delete (from {selectedComic})
                </label>
                <select
                  id="deleteChapter"
                  value={selectedChapterToDelete}
                  onChange={(e) => setSelectedChapterToDelete(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                    theme === "dark"
                      ? "bg-gray-700 text-gray-200 border-gray-600 focus:ring-teal-500"
                      : "bg-gray-200 text-gray-900 border-gray-300 focus:ring-teal-600"
                  }`}
                >
                  <option value="">-- Select a Chapter --</option>
                  {getSortedChapters(comicsData[selectedComic]?.chapters).map((chapter) => (
                    <option key={chapter} value={chapter.replace("Chapter", "")}>
                      {chapter}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleDelete}
                disabled={deleting}
                ref={deleteButtonRef}
                style={deleting ? { width: `${deleteButtonWidth}px` } : {}}
                className={`w-full px-6 py-3 rounded-lg transition-colors duration-300 shadow-md relative overflow-hidden ${
                  theme === "dark"
                    ? `bg-red-600 text-white hover:bg-red-700 ${deleting ? "bg-transparent" : ""}`
                    : `bg-red-500 text-white hover:bg-red-600 ${deleting ? "bg-transparent" : ""}`
                }`}
              >
                {deleting ? (
                  <>
                    <div
                      className="absolute inset-0 bg-red-500 transition-all duration-300 ease-out"
                      style={{ width: `${deleteProgress}%` }}
                    ></div>
                    <span className="relative z-10 text-white">{Math.round(deleteProgress)}%</span>
                  </>
                ) : (
                  "Delete Chapter"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}