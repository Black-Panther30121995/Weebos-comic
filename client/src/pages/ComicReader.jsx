import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { ThemeContext } from "../context/ThemeContext";

export default function ComicReader() {
  const { title, chapter } = useParams();
  const navigate = useNavigate();
  const { currentUser, userRole, signInWithGoogle } = useAuth();
  const { theme } = useContext(ThemeContext);
  const decodedTitle = decodeURIComponent(title || "");

  const [comicData, setComicData] = useState({
    title: decodedTitle,
    img: null,
    chapters: {},
    description: null,
    ratings: [],
    info: "",
    comments: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRating, setUserRating] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    const fetchComicData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/comics/${encodeURIComponent(decodedTitle)}`);
        const data = response.data;
        setComicData(data);
        setComments(chapter ? data.chapters?.[chapter]?.comments || [] : data.comments || []);
        setError(null);
      } catch (err) {
        setError("Failed to load comic data.");
      } finally {
        setLoading(false);
      }
    };

    fetchComicData();

    if (!currentUser) {
      const timer = setTimeout(() => setShowAuthModal(true), 30000);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/comics/${encodeURIComponent(decodedTitle)}`);
        const data = response.data;
        setComments(chapter ? data.chapters?.[chapter]?.comments || [] : data.comments || []);
      } catch (err) {
        console.error("Failed to fetch comments:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [decodedTitle, currentUser, chapter]);

  const handleBack = () => navigate("/");
  const handleUpload = () => navigate(`/upload/${encodeURIComponent(decodedTitle)}`);
  const handleChapterClick = (chapterKey) => navigate(`/comic/${encodeURIComponent(decodedTitle)}/${chapterKey}`);

  const calculateAverageRating = () => {
    if (!comicData.ratings?.length) return 0;
    return (comicData.ratings.reduce((acc, r) => acc + r, 0) / comicData.ratings.length).toFixed(1);
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      setShowAuthModal(false);
    } catch (error) {
      alert(`Sign-in failed: ${error.message}`);
    }
  };

  const handleRatingSubmit = async (star) => {
    if (!currentUser) {
      alert("Please sign in to rate this comic.");
      setShowAuthModal(true);
      return;
    }

    try {
      const response = await axios.patch(`${import.meta.env.VITE_API_URL}/comics/${encodeURIComponent(decodedTitle)}/ratings`, {
        rating: star,
      });
      setComicData(response.data);
      setUserRating(0);
    } catch (error) {
      alert("Failed to submit rating: " + error.message);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Please sign in to post a comment.");
      setShowAuthModal(true);
      return;
    }
    if (!newComment.trim()) {
      alert("Please enter a comment.");
      return;
    }

    try {
      const commentData = {
        text: newComment,
        userId: currentUser.uid,
        userName: currentUser.displayName || "Anonymous",
        timestamp: new Date().toISOString(),
      };
      const response = await axios.patch(`${import.meta.env.VITE_API_URL}/comics/${encodeURIComponent(decodedTitle)}/comments`, {
        comment: commentData,
        chapter,
      });
      setComicData(response.data);
      setComments(chapter ? response.data.chapters?.[chapter]?.comments || [] : response.data.comments || []);
      setNewComment("");
    } catch (error) {
      alert("Failed to post comment: " + error.message);
    }
  };

  const handleDeleteComment = async (comment) => {
    if (!currentUser || currentUser.uid !== comment.userId) {
      alert("You can only delete your own comments.");
      return;
    }

    try {
      const response = await axios.patch(`${import.meta.env.VITE_API_URL}/comics/${encodeURIComponent(decodedTitle)}/comments`, {
        comment,
        chapter,
        action: "remove",
      });
      setComicData(response.data);
      setComments(chapter ? response.data.chapters?.[chapter]?.comments || [] : response.data.comments || []);
    } catch (error) {
      alert("Failed to delete comment: " + error.message);
    }
  };

  const getSortedChapters = (chapters) => {
    return Object.keys(chapters || {})
      .map((chapter) => ({
        key: chapter,
        num: parseInt(chapter.replace("Chapter", ""), 10),
      }))
      .sort((a, b) => a.num - b.num)
      .map((item) => item.key);
  };

  const chapterKeys = getSortedChapters(comicData.chapters);

  return (
    <div className={`w-full min-h-screen flex flex-col items-center ${theme === "dark" ? "bg-gray-900 text-gray-200" : "bg-gray-100 text-gray-900"}`}>
      {/* Auth Modal */}
      {showAuthModal && !currentUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className={`p-6 rounded-lg shadow-lg max-w-md ${theme === "dark" ? "bg-gray-800 text-gray-200" : "bg-white text-gray-900"}`}>
            <h2 className="text-xl font-bold mb-4">Sign Up or Log In</h2>
            <button
              onClick={handleGoogleSignIn}
              className={`w-full px-4 py-2 rounded-lg mb-4 ${theme === "dark" ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-500 hover:bg-blue-600"} text-white`}
            >
              Sign Up with Google
            </button>
            <button
              onClick={() => setShowAuthModal(false)}
              className={`w-full px-4 py-2 rounded-lg ${theme === "dark" ? "bg-gray-600 hover:bg-gray-700" : "bg-gray-400 hover:bg-gray-500"} text-white`}
            >
              Not Now
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="w-full max-w-4xl flex flex-col items-center py-8">
        <div className={`w-full flex items-center justify-between px-6 py-4 mb-6 ${theme === "dark" ? "bg-gray-800" : "bg-gray-200"}`}>
          <button
            onClick={handleBack}
            className={`px-4 py-2 rounded-lg ${theme === "dark" ? "bg-teal-800 hover:bg-teal-900" : "bg-teal-600 hover:bg-teal-800"} text-white`}
          >
            Back to Home
          </button>

          <div className="relative flex-grow text-center max-w-xs mx-4">
            <select
              value={chapter || ""}
              onChange={(e) => handleChapterClick(e.target.value)}
              className={`w-full px-4 py-2 rounded-lg shadow-md font-medium focus:outline-none focus:ring-2 ${
                theme === "dark"
                  ? "bg-gray-700 text-gray-200 hover:bg-gray-600 focus:ring-teal-500"
                  : "bg-gray-300 text-gray-900 hover:bg-gray-400 focus:ring-teal-600"
              }`}
            >
              <option value="" disabled>
                Select Chapter
              </option>
              {chapterKeys.map((chapterKey) => (
                <option key={chapterKey} value={chapterKey}>
                  {chapterKey}
                </option>
              ))}
            </select>
          </div>

          {currentUser && userRole === "publisher" && (
            <button
              onClick={handleUpload}
              className={`px-4 py-2 rounded-lg ${theme === "dark" ? "bg-teal-700 hover:bg-teal-800" : "bg-teal-500 hover:bg-teal-600"} text-white`}
            >
              Upload Chapters
            </button>
          )}
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : (
          <>
            {!chapter && comicData.img && (
              <div className="w-full max-w-md mb-8">
                <img
                  src={comicData.img}
                  alt={`${decodedTitle} Cover`}
                  className="w-full rounded-lg shadow-xl object-contain hover:scale-105 transition-transform duration-300"
                />
                <div className="mt-4 text-center">
                  <div className="flex justify-center gap-2 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        onClick={() => setUserRating(star)}
                        onDoubleClick={() => handleRatingSubmit(star)}
                        className={`text-4xl cursor-pointer ${
                          star <= userRating
                            ? "text-yellow-400"
                            : theme === "dark"
                            ? "text-gray-500 hover:text-yellow-300"
                            : "text-gray-300 hover:text-yellow-400"
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="text-sm">{userRating > 0 ? "Double-click to submit" : "Rate this comic!"}</p>
                  <p>
                    Average Rating: {calculateAverageRating()} / 5 ({comicData.ratings?.length || 0} ratings)
                  </p>
                </div>
              </div>
            )}

            {!chapter && comicData.description && (
              <p className="text-lg italic text-center max-w-2xl mb-8">{comicData.description}</p>
            )}

            {chapter ? (
              comicData.chapters[chapter]?.pages?.length > 0 ? (
                comicData.chapters[chapter].pages.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Page ${index + 1}`}
                    className="w-full lg shadow-md"
                    loading="lazy"
                  />
                ))
              ) : (
                <p>No pages available for this chapter.</p>
              )
            ) : (
              <div className="flex flex-wrap justify-center gap-4 mb-8 max-h-64 overflow-y-auto">
                {chapterKeys.map((chapterKey) => (
                  <button
                    key={chapterKey}
                    onClick={() => handleChapterClick(chapterKey)}
                    className={`px-4 py-2 rounded-lg ${
                      theme === "dark" ? "bg-teal-700 hover:bg-teal-800" : "bg-teal-600 hover:bg-teal-700"
                    } text-white`}
                  >
                    {chapterKey}
                  </button>
                ))}
              </div>
            )}

            <div className="w-full max-w-2xl mt-8">
              <h3 className="text-xl font-bold mb-4">Comments {chapter ? `for ${chapter}` : "for Comic"}</h3>

              <form onSubmit={handleCommentSubmit} className="flex flex-col gap-4 mb-6">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className={`w-full p-3 rounded-lg border focus:outline-none focus:ring-2 resize-none ${
                    theme === "dark"
                      ? "bg-gray-700 text-gray-200 border-gray-600 focus:ring-teal-500"
                      : "bg-gray-200 text-gray-900 border-gray-300 focus:ring-teal-600"
                  }`}
                  rows="3"
                />
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-lg self-end ${
                    theme === "dark" ? "bg-teal-600 hover:bg-teal-700 text-white" : "bg-teal-500 hover:bg-teal-600 text-white"
                  }`}
                >
                  Post Comment
                </button>
              </form>

              <div className="space-y-4">
                {comments.length > 0 ? (
                  comments.map((comment, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg shadow-md flex justify-between items-start ${
                        theme === "dark" ? "bg-gray-800" : "bg-gray-200"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold">{comment.userName}</p>
                        <p>{comment.text}</p>
                        <p className="text-xs text-gray-500">{new Date(comment.timestamp).toLocaleString()}</p>
                      </div>
                      {currentUser && currentUser.uid === comment.userId && (
                        <button
                          onClick={() => handleDeleteComment(comment)}
                          className={`text-sm px-2 py-1 rounded-lg ${
                            theme === "dark" ? "bg-red-600 hover:bg-red-700" : "bg-red-500 hover:bg-red-600"
                          } text-white`}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p>No comments yet.</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
