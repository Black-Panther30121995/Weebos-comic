import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import ComicSlider from '../components/ComicSlider';
import ComicCard from '../components/ComicCard';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import '../styles/GenreBar.css';

export default function Home() {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { currentUser, userRole, setUserRole, signInWithGoogle } = useAuth();
  const [comicList, setComicList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newComicName, setNewComicName] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newInfo, setNewInfo] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newGenres, setNewGenres] = useState('');
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [publisherPassword, setPublisherPassword] = useState('');

  // Derive genres from MongoDB comicList
  const genres = [...new Set(comicList.flatMap((comic) => comic.genres || []))].sort();

  useEffect(() => {
    const fetchComics = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/comics`);
        setComicList(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching comics from MongoDB:', err);
        setError('Failed to load comics. Please try again later.');
        setLoading(false);
      }
    };
    fetchComics();

    if (!currentUser) {
      const timer = setTimeout(() => setShowAuthPrompt(true), 30000);
      return () => clearTimeout(timer);
    }
  }, [currentUser]);

  useEffect(() => {
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      const filtered = comicList.filter((comic) =>
        comic.title.toLowerCase().includes(queryLower) ||
        (comic.genres || []).some((genre) => genre.toLowerCase().includes(queryLower))
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery, comicList]);

  const featuredComics = comicList.slice(0, 3);
  const categorizedComics = {
    Thriller: comicList.filter((comic) =>
      ['MoonChild', 'Flawless', 'Bastard', 'Pigpen', 'Ghost Teller'].includes(comic.title)
    ),
    Romance: comicList.filter((comic) =>
      ['Mafia Nanny', 'I am the Villain', 'Your Smile is A Trap', 'When Jasy Whistles', 'Lore Olympus'].includes(comic.title)
    ),
    Action: comicList.filter((comic) =>
      ['Eleceed', 'Omniscient Reader', 'Tower Of God', 'Return Of The Crazy Demon', 'Lookism'].includes(comic.title)
    ),
  };

  const handleComicClick = (comic) => {
    setSearchQuery('');
    setSuggestions([]);
    navigate(`/comic/${encodeURIComponent(comic.title)}`);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleUploadComic = async (e) => {
    e.preventDefault();
    if (!newComicName || !newImageUrl || !newInfo || !newDescription || !newGenres) {
      alert('Please fill in all fields: title, image URL, info, description, and genres.');
      return;
    }

    // Validate image URL
    const isValidUrl = (url) => /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(url);
    if (!isValidUrl(newImageUrl)) {
      alert('Please provide a valid image URL (e.g., https://example.com/image.jpg).');
      return;
    }

    try {
      // Convert genres string to array
      const genresArray = newGenres
        .split(',')
        .map((genre) => genre.trim())
        .filter((genre) => genre);

      if (genresArray.length === 0) {
        alert('Please provide at least one valid genre.');
        return;
      }

      const comicData = {
        title: newComicName,
        img: newImageUrl,
        info: newInfo,
        description: newDescription,
        genres: genresArray,
        pages: ['https://via.placeholder.com/800x1200?text=' + encodeURIComponent(newComicName) + '+Page+1'],
        ratings: [],
        comments: [],
        chapters: {},
      };

      // Post to MongoDB
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/comics`, comicData);
      console.log('Comic added to MongoDB:', response.data);
      alert('Comic added successfully!');
      setNewComicName('');
      setNewImageUrl('');
      setNewInfo('');
      setNewDescription('');
      setNewGenres('');
      setShowUploadModal(false);

      // Refresh comic list
      const updatedResponse = await axios.get(`${import.meta.env.VITE_API_URL}/comics`);
      setComicList(updatedResponse.data);
    } catch (err) {
      console.error('Error adding comic to MongoDB:', err);
      let errorMessage = 'Failed to add comic: ' + err.message;
      if (err.response) {
        errorMessage = `Server error: ${err.response.status} ${err.response.data?.error || err.message}`;
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error: Could not connect to the backend server.';
      }
      alert(errorMessage);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (publisherPassword === '30121995') {
      await setUserRole('publisher');
      setPublisherPassword('');
    } else {
      alert('Incorrect password. Please try again.');
    }
  };

  const handleGenreClick = (genre) => {
    navigate(`/genre/${encodeURIComponent(genre)}`);
  };

  if (error && !loading) {
    return (
      <div className="flex flex-col min-h-screen bg-red-500 text-white">
        <p className="text-center mt-8">Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 mx-auto px-4 py-2 bg-teal-600 text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main
        className={`w-full flex-grow flex flex-col items-center transition-colors duration-300 ${
          theme === 'dark' ? 'bg-gray-900 text-gray-200' : 'bg-gray-100 text-gray-900'
        }`}
      >
        {currentUser && userRole === 'publisher' && (
          <div className="w-full flex justify-end px-6 pt-4">
            <button
              onClick={() => setShowUploadModal(true)}
              className={`px-4 py-2 rounded-lg shadow-md transition-colors duration-200 ${
                theme === 'dark'
                  ? 'bg-teal-600 hover:bg-teal-700 text-white'
                  : 'bg-teal-500 hover:bg-teal-600 text-white'
              }`}
            >
              Upload Comic
            </button>
          </div>
        )}

        {showAuthPrompt && !currentUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
            <div
              className={`p-6 rounded-lg shadow-lg w-full max-w-md ${
                theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-900'
              }`}
            >
              <h2 className="text-xl font-bold mb-4">Please Sign Up or Sign In</h2>
              <button
                onClick={() => {
                  setShowAuthPrompt(false);
                  document.querySelector('.signup-btn')?.click();
                }}
                className={`w-full px-4 py-2 rounded-lg mb-4 ${
                  theme === 'dark'
                    ? 'bg-teal-600 hover:bg-teal-700 text-white'
                    : 'bg-teal-500 hover:bg-teal-600 text-white'
                }`}
              >
                Sign Up
              </button>
              <button
                onClick={() => {
                  setShowAuthPrompt(false);
                  document.querySelector('.signin-btn')?.click();
                }}
                className={`w-full px-4 py-2 rounded-lg mb-4 ${
                  theme === 'dark'
                    ? 'bg-teal-600 hover:bg-teal-700 text-white'
                    : 'bg-teal-500 hover:bg-teal-600 text-white'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={signInWithGoogle}
                className={`w-full px-4 py-2 rounded-lg mb-4 ${
                  theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                Sign In with Google
              </button>
              <button
                onClick={() => setShowAuthPrompt(false)}
                className={`w-full px-4 py-2 rounded-lg ${
                  theme === 'dark'
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-gray-400 hover:bg-gray-500 text-white'
                }`}
              >
                Not Now
              </button>
            </div>
          </div>
        )}

        {currentUser && userRole === 'publisher-pending' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
            <div
              className={`p-6 rounded-lg shadow-lg w-full max-w-md ${
                theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-900'
              }`}
            >
              <h2 className="text-xl font-bold mb-4">Enter Publisher Password</h2>
              <form onSubmit={handlePasswordSubmit}>
                <input
                  type="password"
                  value={publisherPassword}
                  onChange={(e) => setPublisherPassword(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border mb-4 ${
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-200 border-gray-600'
                      : 'bg-gray-100 text-gray-900 border-gray-300'
                  }`}
                  placeholder="Password"
                />
                <button
                  type="submit"
                  className={`w-full px-4 py-2 rounded-lg ${
                    theme === 'dark'
                      ? 'bg-teal-600 hover:bg-teal-700 text-white'
                      : 'bg-teal-500 hover:bg-teal-600 text-white'
                  }`}
                >
                  Submit
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="w-full flex flex-col items-center">
          <div className="w-full max-w-2xl mt-6 px-4 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search comics by title or genre..."
              className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                theme === 'dark'
                  ? 'bg-gray-800 text-gray-200 border-gray-700'
                  : 'bg-white text-gray-900 border-gray-300'
              }`}
            />
            {suggestions.length > 0 && (
              <div
                className={`absolute w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10 ${
                  theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-900'
                }`}
              >
                {suggestions.map((comic) => (
                  <div
                    key={comic.title}
                    onClick={() => handleComicClick(comic)}
                    className={`flex items-center px-4 py-2 cursor-pointer hover:bg-opacity-10 hover:bg-teal-500 transition-colors duration-200 ${
                      theme === 'dark' ? 'hover:bg-teal-700' : 'hover:bg-teal-100'
                    }`}
                  >
                    {comic.img ? (
                      <img
                        src={comic.img}
                        alt={`${comic.title} thumbnail`}
                        className="w-10 h-10 object-cover rounded mr-3"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-500 rounded mr-3 flex items-center justify-center text-white">
                        N/A
                      </div>
                    )}
                    <span>{comic.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {genres.length > 0 && (
            <div className="w-full overflow-hidden bg-gray-800 py-2 mt-4">
              <div className="genre-bar flex space-x-6 animate-marquee">
                {genres.map((genre) => (
                  <span
                    key={genre}
                    onClick={() => handleGenreClick(genre)}
                    className={`px-4 py-2 whitespace-nowrap cursor-pointer text-white hover:text-teal-300`}
                  >
                    {genre}
                  </span>
                ))}
                {genres.map((genre) => (
                  <span
                    key={`${genre}-duplicate`}
                    onClick={() => handleGenreClick(genre)}
                    className={`px-4 py-2 whitespace-nowrap cursor-pointer text-white hover:text-teal-300`}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {currentUser && userRole === 'publisher' && showUploadModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
              <div
                className={`p-6 rounded-lg shadow-lg w-full max-w-md ${
                  theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-900'
                }`}
              >
                <h2 className="text-xl font-bold mb-4">Upload New Comic</h2>
                <form onSubmit={handleUploadComic} className="flex flex-col gap-4">
                  <div>
                    <label htmlFor="newComicName" className="block mb-1">
                      Comic Title
                    </label>
                    <input
                      id="newComicName"
                      type="text"
                      value={newComicName}
                      onChange={(e) => setNewComicName(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-200 border-gray-600'
                          : 'bg-gray-100 text-gray-900 border-gray-300'
                      }`}
                      placeholder="e.g., Bastard"
                    />
                  </div>
                  <div>
                    <label htmlFor="newImageUrl" className="block mb-1">
                      Image URL
                    </label>
                    <input
                      id="newImageUrl"
                      type="text"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-200 border-gray-600'
                          : 'bg-gray-100 text-gray-900 border-gray-300'
                      }`}
                      placeholder="e.g., https://example.com/image.jpg"
                    />
                  </div>
                  <div>
                    <label htmlFor="newInfo" className="block mb-1">
                      Info (Short Description)
                    </label>
                    <input
                      id="newInfo"
                      type="text"
                      value={newInfo}
                      onChange={(e) => setNewInfo(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-200 border-gray-600'
                          : 'bg-gray-100 text-gray-900 border-gray-300'
                      }`}
                      placeholder="e.g., A thrilling story about..."
                    />
                  </div>
                  <div>
                    <label htmlFor="newDescription" className="block mb-1">
                      Description (Detailed)
                    </label>
                    <textarea
                      id="newDescription"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none ${
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-200 border-gray-600'
                          : 'bg-gray-100 text-gray-900 border-gray-300'
                      }`}
                      placeholder="e.g., This comic follows the story of..."
                      rows="4"
                    />
                  </div>
                  <div>
                    <label htmlFor="newGenres" className="block mb-1">
                      Genres (Comma-separated)
                    </label>
                    <input
                      id="newGenres"
                      type="text"
                      value={newGenres}
                      onChange={(e) => setNewGenres(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-200 border-gray-600'
                          : 'bg-gray-100 text-gray-900 border-gray-300'
                      }`}
                      placeholder="e.g., Thriller,Romance,Action"
                    />
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="submit"
                      className={`flex-1 px-4 py-2 rounded-lg ${
                        theme === 'dark'
                          ? 'bg-teal-600 hover:bg-teal-700 text-white'
                          : 'bg-teal-500 hover:bg-teal-600 text-white'
                      }`}
                    >
                      Add Comic
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className={`flex-1 px-4 py-2 rounded-lg ${
                        theme === 'dark'
                          ? 'bg-gray-600 hover:bg-gray-700 text-white'
                          : 'bg-gray-400 hover:bg-gray-500 text-white'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-center mt-8 text-white">Loading comics...</p>
          ) : error ? (
            <p className="text-red-400 mt-8 text-center">{error}</p>
          ) : (
            <>
              <section className="w-full mt-8">
                <ComicSlider comics={featuredComics} theme={theme} />
              </section>
              {Object.entries(categorizedComics).map(([category, comicsList]) => (
                <section key={category} className="mt-12 w-full max-w-5xl">
                  <h2 className="text-2xl font-bold mb-4 text-center">{category}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pb-3">
                    {comicsList.length > 0 ? (
                      comicsList.map((comic) => (
                        <ComicCard key={comic.title} comic={comic} onClick={handleComicClick} theme={theme} />
                      ))
                    ) : (
                      <p className="col-span-full text-center">No comics available in this category</p>
                    )}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
}