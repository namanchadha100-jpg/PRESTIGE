

// ==========================================
// TMDB API & DATA SETUP
// ==========================================
const TMDB_CONFIG = {
    API_KEY: "d1ff2e3c36c7bf5525d2891c5c3d1f30", 
    BASE_URL: "https://api.themoviedb.org/3",
    IMAGE_BASE: "https://image.tmdb.org/t/p/w500",
    BACKDROP_BASE: "https://image.tmdb.org/t/p/original"
};

const allMedia = [];

const genreMap = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary",
    18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War",
    37: "Western", 10759: "Action & Adventure", 10762: "Kids", 10765: "Sci-Fi & Fantasy"
};

async function fetchFromTMDB(endpoint, queryParams = {}) {
    if (!TMDB_CONFIG.API_KEY) return null;
    try {
        const url = new URL(`${TMDB_CONFIG.BASE_URL}${endpoint}`);
        url.searchParams.append("api_key", TMDB_CONFIG.API_KEY);
        Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));
        const response = await fetch(url.toString(), { headers: { "accept": "application/json" } });
        if (!response.ok) return null;
        return await response.json();
    } catch (e) { return null; }
}

function normalizeTMDBItem(item, forcedType = null) {
    if (!item) return null;
    const isTV = forcedType === 'series' || item.media_type === 'tv' || (!item.title && !!item.name);
    const rawDate = item.release_date || item.first_air_date || "";
    const ratingOut10 = item.vote_average || 0;
    
    return {
        id: `${isTV ? 'tmdb_tv_' : 'tmdb_movie_'}${item.id}`,
        tmdbId: item.id,
        type: isTV ? 'series' : 'movie',
        title: item.title || item.name || "Untitled",
        year: rawDate ? rawDate.split('-')[0] : "TBD",
        rating: isTV ? "TV-MA" : "PG-13",
        director: "Loading...",
        genres: (item.genre_ids || []).map(gid => genreMap[gid]).filter(Boolean).length ? (item.genre_ids || []).map(gid => genreMap[gid]).filter(Boolean) : ["Drama"],
        trailerId: "",
        poster: item.poster_path ? `${TMDB_CONFIG.IMAGE_BASE}${item.poster_path}` : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=80",
        backdrop: item.backdrop_path ? `${TMDB_CONFIG.BACKDROP_BASE}${item.backdrop_path}` : (item.poster_path ? `${TMDB_CONFIG.IMAGE_BASE}${item.poster_path}` : ""),
        cast: [],
        duration: isTV ? "Series" : "2h",
        releaseDate: rawDate || "TBD",
        synopsis: item.overview || "No overview available.",
        seasons: [],
        globalRating: (ratingOut10 / 2).toFixed(1),
        fans: item.vote_count ? `${item.vote_count.toLocaleString()} FANS` : "0 FANS",
        histogram: Array.from({length: 10}, (_, i) => Math.floor(Math.max(0, 1 - (Math.abs((i + 1) - ratingOut10) / 3)) * 80 + Math.random() * 10))
    };
}

async function loadTMDBContent() {
    try {
        const [
            trendM, trendS, upcomingM, 
            movies26, series26, 
            topM, topS, 
            nolanM, fincherM, hboS
        ] = await Promise.all([
            fetchFromTMDB('/trending/movie/week'),
            fetchFromTMDB('/trending/tv/week'),
            fetchFromTMDB('/movie/upcoming'),
            fetchFromTMDB('/discover/movie', { primary_release_year: 2026, sort_by: 'popularity.desc' }),
            fetchFromTMDB('/discover/tv', { first_air_date_year: 2026, sort_by: 'popularity.desc' }),
            fetchFromTMDB('/movie/top_rated'),
            fetchFromTMDB('/tv/top_rated'),
            fetchFromTMDB('/discover/movie', { with_crew: 525, sort_by: 'popularity.desc' }), // Christopher Nolan ID
            fetchFromTMDB('/discover/movie', { with_crew: 7467, sort_by: 'popularity.desc' }), // David Fincher ID
            fetchFromTMDB('/discover/tv', { with_networks: 49, sort_by: 'popularity.desc' }) // HBO Network ID
        ]);

        const mapData = (data, type) => (data?.results || []).map(item => normalizeTMDBItem(item, type)).filter(Boolean);
        
        let fetchedTrendM = mapData(trendM, 'movie');
        let fetchedTrendS = mapData(trendS, 'series');
        let fetchedUpM = mapData(upcomingM, 'movie');
        let fetchedM26 = mapData(movies26, 'movie');
        let fetchedS26 = mapData(series26, 'series');
        let fetchedTopM = mapData(topM, 'movie');
        let fetchedTopS = mapData(topS, 'series');
        let fetchedNolan = mapData(nolanM, 'movie');
        let fetchedFincher = mapData(fincherM, 'movie');
        let fetchedHbo = mapData(hboS, 'series');

        // Fallback for API block
        if (fetchedTrendM.length === 0) {
            const fallback = { id: 'fallback', type: 'movie', title: 'Network Error', year: '2026', poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500' };
            fetchedTrendM = [fallback, fallback]; fetchedM26 = [fallback]; fetchedTopM = [fallback]; fetchedNolan = [fallback]; fetchedFincher = [fallback];
            fetchedTrendS = [fallback]; fetchedS26 = [fallback]; fetchedTopS = [fallback]; fetchedHbo = [fallback];
        }

        const allFetched = [...fetchedTrendM, ...fetchedTrendS, ...fetchedUpM, ...fetchedM26, ...fetchedS26, ...fetchedTopM, ...fetchedTopS, ...fetchedNolan, ...fetchedFincher, ...fetchedHbo];
        
        allFetched.forEach(item => {
            if (!allMedia.some(m => m.id === item.id)) allMedia.push(item);
        });

        // Home Page Grids
        renderGrid('movies-grid', fetchedTrendM.slice(0, 16));
        renderGrid('series-grid', fetchedTrendS.slice(0, 16));
        renderGrid('upcoming-movies-grid', fetchedUpM.slice(0, 16));
        
        // Movies Tab Rows
        renderHorizontal('row-movies-trend', fetchedTrendM);
        renderHorizontal('row-movies-2026', fetchedM26);
        renderHorizontal('row-movies-top', fetchedTopM);
        renderHorizontal('row-movies-nolan', fetchedNolan);
        renderHorizontal('row-movies-fincher', fetchedFincher);
        
        // Series Tab Rows
        renderHorizontal('row-series-trend', fetchedTrendS);
        renderHorizontal('row-series-2026', fetchedS26);
        renderHorizontal('row-series-top', fetchedTopS);
        renderHorizontal('row-series-hbo', fetchedHbo);

    } catch (e) {
        console.error("TMDB Load Error:", e);
    }
}

// ==========================================
// STATE & STORAGE
// ==========================================
let activeItem = null;
let currentModalRating = 0;
let currentViewedListId = null;
let searchDebounceTimer = null;
let pickingFavContext = { type: 'movie', index: 0 };
let cropperInstance = null;
let tempAvatarBase64 = null;

let userProfile = { username: "Cinephile", email: "", age: "", address: "", gender: "Not Specified", bio: "", avatar: "", favFilms: [null, null, null, null], favSeries: [null, null, null, null] };
let userLogs = [];
let userWatchlist = [];
let userLists = [];
let userQuotes = [];
let loggingContext = { type: 'movie', episodeId: null, seasonNum: null, episodeNum: null, title: '' };
let userEpisodeRatings = {}; 
let userEpisodesWatched = {}; 

const cinematicQuotes = [
    { text: "I'm going to make him an offer he can't refuse.", source: "The Godfather (1972)" },
    { text: "The first rule of Fight Club is: You do not talk about Fight Club.", source: "Fight Club (1999)" },
    { text: "May the Force be with you.", source: "Star Wars (1977)" },
    { text: "Why so serious?", source: "The Dark Knight (2008)" },
    { text: "Here's looking at you, kid.", source: "Casablanca (1942)" },
    { text: "To infinity and beyond!", source: "Toy Story (1995)" },
    { text: "I'll be back.", source: "The Terminator (1984)" },
    { text: "You talkin' to me?", source: "Taxi Driver (1976)" },
    { text: "Life is like a box of chocolates. You never know what you're gonna get.", source: "Forrest Gump (1994)" },
    { text: "Not quite my tempo.", source: "Whiplash (2014)" }
];

function updateWelcomeBanner() {
    const welcomeText = document.getElementById('welcome-text');
    const welcomeQuote = document.getElementById('welcome-quote');
    if (!welcomeText || !welcomeQuote) return;

    // Optimistically check the local profile to prevent the 1-second flicker
    if (userProfile.username && userProfile.username !== "Cinephile") {
        welcomeText.innerText = `Welcome back, ${userProfile.username}`;
    } else {
        welcomeText.innerText = `Welcome to Prestige`;
    }

    if (welcomeQuote.innerHTML === "") {
        const randomQuote = cinematicQuotes[Math.floor(Math.random() * cinematicQuotes.length)];
        welcomeQuote.innerHTML = `"${randomQuote.text}" <span class="text-gray-500 text-xs md:text-sm font-semibold ml-2 not-italic">— ${randomQuote.source}</span>`;
    }
}



async function syncDatabase() {
    // Always save locally first so the app works instantly
    localStorage.setItem('prestige_profile', JSON.stringify(userProfile));
    localStorage.setItem('prestige_logs', JSON.stringify(userLogs));
    localStorage.setItem('prestige_watchlist', JSON.stringify(userWatchlist));
    localStorage.setItem('prestige_lists', JSON.stringify(userLists));
    localStorage.setItem('prestige_quotes', JSON.stringify(userQuotes));
    localStorage.setItem('prestige_progress', JSON.stringify({ ratings: userEpisodeRatings, watched: userEpisodesWatched }));

    // Safely attempt cloud sync in the background
    if (isLoggedIn && window.firebase && firebase.apps.length && firebase.auth().currentUser && db) {
        try {
            await db.collection('users').doc(firebase.auth().currentUser.uid).set({
                profile: userProfile,
                logs: userLogs,
                watchlist: userWatchlist,
                lists: userLists,
                quotes: userQuotes,
                progress: { ratings: userEpisodeRatings, watched: userEpisodesWatched },
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) { console.warn("Cloud sync failed (Check Firebase rules):", error); }
    }
}

// ==========================================
// FIREBASE AUTH & FIRESTORE
// ==========================================
let isLoggedIn = false;
let isSignUpMode = false;
let db = null;

const firebaseConfig = {
    apiKey: "AIzaSyDI_lxCqLa41h8UUycmu4TTWTpHle7CVZs",
    authDomain: "prestige-c8160.firebaseapp.com",
    projectId: "prestige-c8160",
    storageBucket: "prestige-c8160.firebasestorage.app",
    messagingSenderId: "171033994937",
    appId: "1:171033994937:web:6a7c7ba575b33e963c9d68"
};

try {
    // Safely initialize Firebase to prevent "App already exists" crashes
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        if (firebase.firestore) db = firebase.firestore();

        auth.onAuthStateChanged(async user => {
            isLoggedIn = !!user;
            if (user) {
                if (!userProfile.email) userProfile.email = user.email;
                if (userProfile.username === "Cinephile" && user.displayName) userProfile.username = user.displayName;
                
                // Fetch cloud data
                if (db) {
                    try {
                        const doc = await db.collection('users').doc(user.uid).get();
                        if (doc.exists) {
                            const data = doc.data();
                            if (data.profile) userProfile = { ...userProfile, ...data.profile };
                            if (data.logs) userLogs = data.logs;
                            if (data.watchlist) userWatchlist = data.watchlist;
                            if (data.lists) userLists = data.lists;
                            if (data.quotes) userQuotes = data.quotes;
                            if (data.progress) {
                                userEpisodeRatings = data.progress.ratings || {};
                                userEpisodesWatched = data.progress.watched || {};
                            }
                            
                            // Rehydrate favorite objects
                            const favsToLoad = [...(userProfile.favFilms || []), ...(userProfile.favSeries || [])];
                            favsToLoad.forEach(fav => {
                                if (fav && typeof fav === 'object' && fav.id && !allMedia.some(m => m.id === fav.id)) allMedia.push(fav);
                            });
                        }
                    } catch (error) { console.error("Cloud fetch error:", error); }
                }
                syncDatabase();
            } else {
                // Wipe data on logout
                userLogs = []; userWatchlist = []; userLists = []; userQuotes = []; userEpisodeRatings = {}; userEpisodesWatched = {};
                userProfile = { username: "Cinephile", email: "", age: "", address: "", gender: "Not Specified", bio: "", avatar: "", favFilms: [null, null, null, null], favSeries: [null, null, null, null] };
            }
            
            updateAuthUI();
            renderLogs(); renderWatchlist(); renderLists(); renderQuotes();
            if (document.getElementById('profile-section')?.classList.contains('block')) renderProfile();
            
            if (user && document.getElementById('auth-modal') && !document.getElementById('auth-modal').classList.contains('hidden')) {
                closeAuthModal();
                if (activeItem && document.getElementById('media-detail-section')?.classList.contains('block')) updateActionPanelUI(); 
            }
        });

        window.signInWithGoogle = async () => { try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); } catch (e) { showAuthError(e.message); } };
        window.handleAuthSubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const pass = document.getElementById('auth-password').value;
            try { if (isSignUpMode) await auth.createUserWithEmailAndPassword(email, pass); else await auth.signInWithEmailAndPassword(email, pass); } 
            catch (err) { showAuthError(err.message); }
        };
        window.logout = () => { auth.signOut(); closeMenus(); switchTab('home'); };
    } else {
        console.error("Firebase library not detected. Check HTML script tags.");
    }
} catch (e) {
    console.error("Firebase Initialization Error:", e);
}
function showAuthError(msg) { const el = document.getElementById('auth-error'); if(el) { el.innerText = msg; el.classList.remove('hidden'); } }
function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    document.getElementById('auth-error')?.classList.add('hidden');
    const title = document.getElementById('auth-title'), submitBtn = document.getElementById('auth-submit-btn'), toggleText = document.getElementById('auth-toggle-text'), toggleLink = document.getElementById('auth-toggle-link');
    if (isSignUpMode) { if(title) title.innerText = 'Create Account'; if(submitBtn) submitBtn.innerText = 'Sign Up'; if(toggleText) toggleText.innerText = 'Already have an account?'; if(toggleLink) toggleLink.innerText = 'Sign in.'; } 
    else { if(title) title.innerText = 'Sign In'; if(submitBtn) submitBtn.innerText = 'Sign In'; if(toggleText) toggleText.innerText = 'New to Prestige?'; if(toggleLink) toggleLink.innerText = 'Sign up now.'; }
}

function updateAuthUI() {
    const loggedOutView = document.getElementById('auth-logged-out'), loggedInView = document.getElementById('auth-logged-in'), privateLinks = document.querySelectorAll('.auth-required');
    if (isLoggedIn) {
        loggedOutView?.classList.add('hidden'); loggedInView?.classList.remove('hidden'); loggedInView?.classList.add('flex');
        privateLinks.forEach(link => link.style.display = 'block');
        const navAvatar = document.getElementById('navbar-avatar');
        if (navAvatar) navAvatar.src = userProfile.avatar || "https://ui-avatars.com/api/?name=User&background=1a1a1a&color=gray";
    } else {
        loggedOutView?.classList.remove('hidden'); loggedInView?.classList.add('hidden'); loggedInView?.classList.remove('flex');
        privateLinks.forEach(link => link.style.display = 'none');
    }
    
    updateWelcomeBanner(); // Add this line here
}

function openAuthModal() { closeMenus(); document.getElementById('auth-error')?.classList.add('hidden'); document.getElementById('auth-modal')?.classList.remove('hidden'); document.body.classList.add('modal-open'); }
function closeAuthModal() { document.getElementById('auth-modal')?.classList.add('hidden'); document.body.classList.remove('modal-open'); }

// ==========================================
// NAVIGATION & TABS
// ==========================================
function toggleSearch(e) {
    e.stopPropagation(); const input = document.getElementById('search-input'); if (!input) return;
    if (input.classList.contains('hidden')) { input.classList.remove('hidden'); input.classList.add('animate-slide-left'); input.focus(); } 
    else { input.classList.add('hidden'); input.classList.remove('animate-slide-left'); input.value = ''; handleSearch(''); }
}

function toggleMenu(event, menuId) {
    event.stopPropagation(); const menu = document.getElementById(menuId); if (!menu) return;
    const isHidden = menu.classList.contains('hidden'); closeMenus();
    if (isHidden) menu.classList.remove('hidden');
}

function closeMenus() { document.getElementById('notifications-menu')?.classList.add('hidden'); document.getElementById('profile-menu')?.classList.add('hidden'); closeListDropdown(); }
window.addEventListener('click', closeMenus);

function handleSearch(query) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(async () => {
        const cleanedQuery = (query || "").toLowerCase().trim();
        const isSearching = cleanedQuery.length > 0;
        let liveResults = [];
        if (isSearching) {
            const tmdbSearchResults = await fetchFromTMDB('/search/multi', { query: cleanedQuery, include_adult: false });
            if (tmdbSearchResults && tmdbSearchResults.results) {
                liveResults = tmdbSearchResults.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv').map(item => normalizeTMDBItem(item)).filter(Boolean);
                liveResults.forEach(item => { if (!allMedia.some(m => m.id === item.id)) allMedia.push(item); });
            }
        }
        const finalMovies = liveResults.filter(i => i.type === 'movie').concat(allMedia.filter(m => m.type === 'movie' && m.title.toLowerCase().includes(cleanedQuery) && !liveResults.some(r => r.id === m.id)));
        const finalSeries = liveResults.filter(i => i.type === 'series').concat(allMedia.filter(s => s.type === 'series' && s.title.toLowerCase().includes(cleanedQuery) && !liveResults.some(r => r.id === s.id)));

        renderGrid('movies-grid', finalMovies.slice(0, 16));
        renderGrid('series-grid', finalSeries.slice(0, 16));
        renderGrid('all-movies-grid', finalMovies);
        renderGrid('all-series-grid', finalSeries);
        
        const mWrap = document.getElementById('movies-container-wrapper'), sWrap = document.getElementById('series-container-wrapper'), uWrap = document.getElementById('upcoming-movies-container-wrapper');
        if (mWrap) mWrap.style.display = finalMovies.length ? 'block' : 'none';
        if (sWrap) sWrap.style.display = finalSeries.length ? 'block' : 'none';
        if (uWrap) uWrap.style.display = (!isSearching) ? 'block' : 'none';

        if (isSearching && !document.getElementById('home-section')?.classList.contains('block')) switchTab('home');
    }, 300);
}

let filterPages = { movie: 1, series: 1 };

async function applyFilters(type, isLoadMore = false) {
    const genreId = document.getElementById(`filter-genre-${type}`)?.value || 'all';
    const year = document.getElementById(`filter-year-${type}`)?.value || 'all';
    const rating = document.getElementById(`filter-rating-${type}`)?.value || 'all';
    const sortBy = document.getElementById(`filter-sort-${type}`)?.value || 'popularity.desc';
    
    const categoriesContainer = document.getElementById(`${type}-categories`);
    const filteredContainer = document.getElementById(`${type}-filtered-results`);
    const gridId = type === 'movie' ? 'all-movies-grid' : 'all-series-grid';
    const gridEl = document.getElementById(gridId);
    const loadMoreBtn = document.getElementById(`load-more-${type}`);

    if (!isLoadMore) {
        filterPages[type] = 1; // Reset to page 1 for new searches
        
        // If NO filters are applied, show the default horizontal rows
        if (genreId === 'all' && year === 'all' && rating === 'all' && sortBy === 'popularity.desc') {
            if (categoriesContainer) categoriesContainer.classList.remove('hidden');
            if (filteredContainer) filteredContainer.classList.add('hidden');
            if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
            return;
        }

        // Hide categories, show the grid, and display a loading spinner
        if (categoriesContainer) categoriesContainer.classList.add('hidden');
        if (filteredContainer) filteredContainer.classList.remove('hidden');
        if (gridEl) gridEl.innerHTML = `<div class="col-span-full py-12 text-center text-gray-500"><i class="fa-solid fa-spinner fa-spin text-3xl mb-3"></i><p>Searching global database...</p></div>`;
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
    } else {
        filterPages[type]++; // Increment page for Load More
        if (loadMoreBtn) loadMoreBtn.innerHTML = `<button class="bg-[#1a1a1a] text-gray-400 border border-gray-700 px-8 py-3 rounded-full text-sm font-bold shadow-lg flex items-center gap-2 cursor-wait"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</button>`;
    }

    // Build the TMDB API Query
    let queryParams = {
        sort_by: sortBy,
        include_adult: false,
        'vote_count.gte': 200,
        page: filterPages[type]
    };

    if (genreId !== 'all') queryParams.with_genres = genreId;
    if (rating !== 'all') queryParams['vote_average.gte'] = rating;
    
    if (year !== 'all') {
        const yearField = type === 'movie' ? 'primary_release_date' : 'first_air_date';
        if (year === '2020s') { queryParams[`${yearField}.gte`] = '2020-01-01'; queryParams[`${yearField}.lte`] = '2029-12-31'; } 
        else if (year === '2010s') { queryParams[`${yearField}.gte`] = '2010-01-01'; queryParams[`${yearField}.lte`] = '2019-12-31'; } 
        else if (year === 'older') { queryParams[`${yearField}.lte`] = '2009-12-31'; } 
        else { 
            if (type === 'movie') queryParams.primary_release_year = year; 
            else queryParams.first_air_date_year = year; 
        }
    }

    // Fetch the data
    const endpoint = type === 'movie' ? '/discover/movie' : '/discover/tv';
    const tmdbData = await fetchFromTMDB(endpoint, queryParams);
    
    let filtered = [];
    if (tmdbData && tmdbData.results) {
        filtered = tmdbData.results.map(item => normalizeTMDBItem(item, type)).filter(Boolean);
        filtered.forEach(item => { if (!allMedia.some(m => m.id === item.id)) allMedia.push(item); });
    }
    
    if (!isLoadMore) {
        if (filtered.length === 0) {
            if(gridEl) gridEl.innerHTML = `<div class="col-span-full py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-lg">No titles match these filters.</div>`;
        } else {
            renderGrid(gridId, filtered);
        }
    } else {
        if (filtered.length > 0) renderGrid(gridId, filtered, true); // True flag safely appends
    }

    // Manage Load More button visibility and reset its visual state
    if (loadMoreBtn) {
        if (tmdbData && tmdbData.total_pages > filterPages[type]) {
            loadMoreBtn.classList.remove('hidden');
            loadMoreBtn.innerHTML = `<button onclick="applyFilters('${type}', true)" class="bg-[#1a1a1a] hover:bg-gray-800 text-white border border-gray-700 px-8 py-3 rounded-full text-sm font-bold transition-colors shadow-lg flex items-center gap-2"><i class="fa-solid fa-chevron-down"></i> Load More</button>`;
        } else {
            loadMoreBtn.classList.add('hidden');
        }
    }
}
function clearFilters(type) {
    document.getElementById(`filter-genre-${type}`).value = 'all';
    document.getElementById(`filter-year-${type}`).value = 'all';
    document.getElementById(`filter-rating-${type}`).value = 'all';
    document.getElementById(`filter-sort-${type}`).value = 'popularity.desc';
    applyFilters(type);
}

async function recommendMedia(type) {
    const genreId = document.getElementById(`filter-genre-${type}`)?.value || 'all';
    const year = document.getElementById(`filter-year-${type}`)?.value || 'all';
    const rating = document.getElementById(`filter-rating-${type}`)?.value || 'all';
    
    let queryParams = {
        sort_by: 'popularity.desc', 
        include_adult: false,
        'vote_count.gte': 200
    };

    if (genreId !== 'all') queryParams.with_genres = genreId;
    if (rating !== 'all') queryParams['vote_average.gte'] = rating; 
    else queryParams['vote_average.gte'] = 6.5; // If no rating is set, default to decently rated stuff for a good recommendation
    
    if (year !== 'all') {
        const yearField = type === 'movie' ? 'primary_release_date' : 'first_air_date';
        if (year === '2020s') { queryParams[`${yearField}.gte`] = '2020-01-01'; queryParams[`${yearField}.lte`] = '2029-12-31'; }
        else if (year === '2010s') { queryParams[`${yearField}.gte`] = '2010-01-01'; queryParams[`${yearField}.lte`] = '2019-12-31'; }
        else if (year === 'older') { queryParams[`${yearField}.lte`] = '2009-12-31'; }
        else { if (type === 'movie') queryParams.primary_release_year = year; else queryParams.first_air_date_year = year; }
    }
    
    const endpoint = type === 'movie' ? '/discover/movie' : '/discover/tv';
    queryParams.page = Math.floor(Math.random() * 5) + 1; // Pull from a random page (1-5) of results so you don't always get the same #1 movie
    
    const tmdbData = await fetchFromTMDB(endpoint, queryParams);
    
    let pool = [];
    if (tmdbData && tmdbData.results && tmdbData.results.length > 0) {
        pool = tmdbData.results.map(item => normalizeTMDBItem(item, type)).filter(Boolean);
        pool.forEach(item => { if (!allMedia.some(m => m.id === item.id)) allMedia.push(item); });
    }
    
    if (pool.length === 0) {
        alert("No titles match your exact filters. Try clearing some filters first.");
        return;
    }
    
    const randomPick = pool[Math.floor(Math.random() * pool.length)];
    openMediaPage(randomPick.id);
}



function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(section => { section.classList.remove('block'); section.classList.add('hidden'); });
    const targetSection = document.getElementById(`${tabId}-section`);
    if (targetSection) { targetSection.classList.remove('hidden'); targetSection.classList.add('block'); }
    
    // Added 'roadmaps' to the array
    ['home', 'series', 'movies', 'lists', 'quotes', 'watchlist', 'log', 'profile', 'roadmaps'].forEach(nav => {
        const link = document.getElementById(`nav-${nav}`);
        if (link) { link.classList.toggle('text-white', nav === tabId); link.classList.toggle('text-gray-300', nav !== tabId); }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (tabId === 'lists') renderLists();
    if (tabId === 'quotes') renderQuotes();
    if (tabId === 'watchlist') renderWatchlist();
    if (tabId === 'log') renderLogs();
    if (tabId === 'profile') renderProfile();
    if (tabId === 'roadmaps') loadRoadmaps(); // Trigger the API fetch and render
    
    updateNavbarConfig();
}

function renderGrid(containerId, data, append = false) {
    const grid = document.getElementById(containerId); if (!grid) return;
    const html = (data || []).map(item => {
        if (!item) return '';
        const inWatchlist = userWatchlist.some(m => (typeof m === 'string' ? m : m.id) === item.id);
        const isWatched = userLogs.some(l => l.media && l.media.id === item.id);
        return `
        <div class="relative rounded-md overflow-hidden aspect-[2/3] cursor-pointer bg-[#111] shadow-md group border border-transparent transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_15px_30px_rgba(0,0,0,0.6)] hover:border-gray-700 animate-fade-in" onclick="openMediaPage('${item.id}')">
            <img src="${item.poster}" alt="${item.title}" class="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" loading="lazy">
            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#111]/95 backdrop-blur-md rounded-md px-3.5 py-2 flex gap-4 items-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-20 shadow-2xl border border-white/10" onclick="event.stopPropagation()">
                <svg onclick="toggleWatchedAction(event, '${item.id}', this)" class="w-4 h-4 cursor-pointer transition-transform duration-200 hover:scale-125 ${isWatched ? 'text-netflix-red drop-shadow-[0_0_8px_rgba(229,9,20,0.8)]' : 'text-gray-300 hover:text-white'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                <svg onclick="toggleLikedAction(event, '${item.id}', this)" class="w-4 h-4 cursor-pointer transition-transform duration-200 hover:scale-125 text-gray-300 hover:text-netflix-red" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                <svg onclick="toggleWatchlistAction('${item.id}', event, this)" title="Toggle Watchlist" class="w-4 h-4 cursor-pointer transition-transform duration-200 hover:scale-125 ${inWatchlist ? 'text-netflix-red drop-shadow-[0_0_8px_rgba(229,9,20,0.8)]' : 'text-gray-300 hover:text-white'}" fill="currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
            </div>
        </div>`;
    }).join('');
    
    if (append) grid.insertAdjacentHTML('beforeend', html);
    else grid.innerHTML = html;
}

function renderHorizontal(containerId, data) {
    const grid = document.getElementById(containerId); if (!grid) return;
    grid.innerHTML = (data || []).map(item => {
        if (!item) return '';
        const inWatchlist = userWatchlist.some(m => (typeof m === 'string' ? m : m.id) === item.id);
        const isWatched = userLogs.some(l => l.media && l.media.id === item.id);
        return `
        <div class="relative rounded-md overflow-hidden aspect-[2/3] flex-shrink-0 w-32 sm:w-40 md:w-48 cursor-pointer bg-[#111] shadow-md group border border-transparent transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_15px_30px_rgba(0,0,0,0.6)] hover:border-gray-700 snap-start animate-fade-in" onclick="openMediaPage('${item.id}')">
            <img src="${item.poster}" alt="${item.title}" class="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" loading="lazy">
            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#111]/95 backdrop-blur-md rounded-md px-3.5 py-2 flex gap-4 items-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-20 shadow-2xl border border-white/10" onclick="event.stopPropagation()">
                <svg onclick="toggleWatchedAction(event, '${item.id}', this)" class="w-4 h-4 cursor-pointer transition-transform duration-200 hover:scale-125 ${isWatched ? 'text-netflix-red drop-shadow-[0_0_8px_rgba(229,9,20,0.8)]' : 'text-gray-300 hover:text-white'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                <svg onclick="toggleLikedAction(event, '${item.id}', this)" class="w-4 h-4 cursor-pointer transition-transform duration-200 hover:scale-125 text-gray-300 hover:text-netflix-red" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                <svg onclick="toggleWatchlistAction('${item.id}', event, this)" title="Toggle Watchlist" class="w-4 h-4 cursor-pointer transition-transform duration-200 hover:scale-125 ${inWatchlist ? 'text-netflix-red drop-shadow-[0_0_8px_rgba(229,9,20,0.8)]' : 'text-gray-300 hover:text-white'}" fill="currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
            </div>
        </div>`;
    }).join('');
}

// ==========================================
// PROFILE PAGE & CROPPER
// ==========================================
function renderProfile() {
    if (!isLoggedIn) return switchTab('home');

    // SECURITY CHECK: Force arrays to exist even if Firestore dropped them
    if (!userProfile.favFilms || !Array.isArray(userProfile.favFilms)) userProfile.favFilms = [null, null, null, null];
    if (!userProfile.favSeries || !Array.isArray(userProfile.favSeries)) userProfile.favSeries = [null, null, null, null];
    while (userProfile.favFilms.length < 4) userProfile.favFilms.push(null);
    while (userProfile.favSeries.length < 4) userProfile.favSeries.push(null);

    // Render Basic Info
    document.getElementById('profile-avatar').src = userProfile.avatar || "https://ui-avatars.com/api/?name=User&background=1a1a1a&color=gray";
    document.getElementById('profile-username').innerText = userProfile.username || "User";
    document.getElementById('profile-bio').innerText = userProfile.bio || "No bio added yet.";
    document.getElementById('profile-location').innerHTML = `<i class="fa-solid fa-location-dot mr-1"></i> ${userProfile.address || "NA"}`;
    document.getElementById('profile-age').innerHTML = `<i class="fa-solid fa-calendar mr-1"></i> ${userProfile.age ? userProfile.age + ' yrs' : 'N/A'}`;

    // Safely calculate stats
    const safeLogs = Array.isArray(userLogs) ? userLogs : [];
    document.getElementById('stat-films').innerText = safeLogs.filter(l => l && l.media && String(l.media.id).includes('movie')).length;
    document.getElementById('stat-shows').innerText = safeLogs.filter(l => l && l.media && String(l.media.id).includes('tv')).length;
    document.getElementById('stat-lists').innerText = Array.isArray(userLists) ? userLists.length : 0;

    // Render Favorites
    renderFavSlots('profile-fav-films', userProfile.favFilms, 'movie');
    renderFavSlots('profile-fav-series', userProfile.favSeries, 'series');

    // Render Recent Activity
    const actContainer = document.getElementById('profile-activity');
    const recent = safeLogs.slice(0, 5);
    
    if (recent.length === 0) {
        actContainer.innerHTML = `<p class="text-gray-500 text-sm italic py-4">No recent activity.</p>`;
    } else {
        actContainer.innerHTML = recent.map(log => {
            if (!log || !log.media) return '';
            const stars = Array.from({length: 5}).map((_, i) => log.rating >= i + 1 ? `<i class="fa-solid fa-star text-netflix-red text-[8px]"></i>` : (log.rating > i ? `<i class="fa-solid fa-star-half-stroke text-netflix-red text-[8px]"></i>` : '')).join('');
            return `<div class="flex items-center gap-4 bg-[#1a1a1a] p-3 rounded hover:bg-[#222] transition-colors border border-gray-800"><img src="${log.media.poster}" class="w-10 rounded aspect-[2/3] object-cover cursor-pointer shadow" onclick="openMediaPage('${log.media.id}')"><div><h4 class="text-white text-sm font-bold cursor-pointer hover:text-netflix-red line-clamp-1" onclick="openMediaPage('${log.media.id}')">${log.media.title}</h4><div class="flex gap-[1px] mt-0.5">${stars}</div><span class="text-[10px] text-gray-500 uppercase tracking-widest block mt-1">${log.date}</span></div></div>`;
        }).join('');
    }

    // Trigger the Top Genres progress bar
    renderGenreAnalytics(); 
}

function renderFavSlots(containerId, dataArray, type) {
    const container = document.getElementById(containerId); 
    if (!container) return;
    
    // Ensure we are definitely working with an array of 4 items
    const safeArray = Array.isArray(dataArray) ? dataArray.slice(0, 4) : [null, null, null, null];
    
    container.innerHTML = safeArray.map((item, index) => {
        let mediaItem = typeof item === 'string' ? allMedia.find(m => m.id === item) : item;
        
        if (mediaItem && mediaItem.id) {
            return `<div class="relative aspect-[2/3] rounded-md overflow-hidden shadow-md group cursor-pointer border border-gray-700 hover:border-netflix-red transition-colors" onclick="openMediaPage('${mediaItem.id}')"><img src="${mediaItem.poster}" class="w-full h-full object-cover"><div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3"><button onclick="event.stopPropagation(); openFavPicker('${type}', ${index})" class="bg-gray-800 hover:bg-white hover:text-black text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"><i class="fa-solid fa-pen text-xs"></i></button><button onclick="event.stopPropagation(); removeFav('${type}', ${index})" class="bg-gray-800 hover:bg-netflix-red text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"><i class="fa-solid fa-trash text-xs"></i></button></div></div>`;
        }
        
        return `<div onclick="openFavPicker('${type}', ${index})" class="aspect-[2/3] rounded-md border-2 border-dashed border-gray-800 flex items-center justify-center cursor-pointer hover:border-gray-500 hover:bg-[#1a1a1a] transition-colors group"><i class="fa-solid fa-plus text-gray-700 text-2xl group-hover:text-gray-400 transition-colors"></i></div>`;
    }).join('');
}

function openEditProfileModal() {
    tempAvatarBase64 = userProfile.avatar || "";
    document.getElementById('edit-avatar-preview').src = tempAvatarBase64 || "https://ui-avatars.com/api/?name=User&background=1a1a1a&color=gray";
    document.getElementById('edit-avatar').value = ""; 
    document.getElementById('edit-username').value = userProfile.username;
    document.getElementById('edit-email').value = userProfile.email;
    document.getElementById('edit-age').value = userProfile.age;
    document.getElementById('edit-address').value = userProfile.address;
    document.getElementById('edit-gender').value = userProfile.gender;
    document.getElementById('edit-bio').value = userProfile.bio;
    document.getElementById('edit-profile-modal').classList.remove('hidden'); document.body.classList.add('modal-open');
}
function closeEditProfileModal() { document.getElementById('edit-profile-modal').classList.add('hidden'); document.body.classList.remove('modal-open'); }

function openCropper(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const image = document.getElementById('cropper-image'); image.src = e.target.result;
        document.getElementById('cropper-modal').classList.remove('hidden');
        if (cropperInstance) cropperInstance.destroy();
        cropperInstance = new Cropper(image, { aspectRatio: 1, viewMode: 1, background: false, autoCropArea: 1 });
    };
    reader.readAsDataURL(file);
}
function closeCropper() { document.getElementById('cropper-modal').classList.add('hidden'); if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; } document.getElementById('edit-avatar').value = ""; }
function applyCrop() {
    if (!cropperInstance) return;
    const canvas = cropperInstance.getCroppedCanvas({ width: 300, height: 300 });
    tempAvatarBase64 = canvas.toDataURL('image/jpeg', 0.8);
    document.getElementById('edit-avatar-preview').src = tempAvatarBase64;
    closeCropper();
}

function handleProfileSave(e) {
    e.preventDefault();
    userProfile.avatar = tempAvatarBase64;
    userProfile.username = document.getElementById('edit-username').value;
    userProfile.email = document.getElementById('edit-email').value;
    userProfile.age = document.getElementById('edit-age').value;
    userProfile.address = document.getElementById('edit-address').value;
    userProfile.gender = document.getElementById('edit-gender').value;
    userProfile.bio = document.getElementById('edit-bio').value;
    
    const navAvatar = document.getElementById('navbar-avatar');
    if (navAvatar) navAvatar.src = userProfile.avatar || "https://ui-avatars.com/api/?name=User&background=1a1a1a&color=gray";
    
    syncDatabase(); closeEditProfileModal(); renderProfile();
}

function openFavPicker(type, index) {
    pickingFavContext = { type, index };
    document.getElementById('fav-modal-title').innerText = `Pick a Favorite ${type === 'movie' ? 'Film' : 'Series'}`;
    document.getElementById('fav-search-input').value = '';
    document.getElementById('pick-fav-modal').classList.remove('hidden'); document.body.classList.add('modal-open'); handleFavSearch('');
}
function closeFavModal() { document.getElementById('pick-fav-modal').classList.add('hidden'); document.body.classList.remove('modal-open'); }

async function handleFavSearch(query) {
    const cleanedQuery = (query || "").toLowerCase().trim(), container = document.getElementById('fav-search-results');
    let results = [];
    const tmdbTargetType = pickingFavContext.type === 'series' ? 'tv' : 'movie';
    
    if (cleanedQuery) {
        const tmdbData = await fetchFromTMDB('/search/multi', { query: cleanedQuery, include_adult: false });
        if (tmdbData && tmdbData.results) {
            results = tmdbData.results.filter(i => i.media_type === tmdbTargetType).map(i => normalizeTMDBItem(i)).filter(Boolean);
            results.forEach(item => { if (!allMedia.some(m => m.id === item.id)) allMedia.push(item); });
        }
    } else {
        results = allMedia.filter(m => m.type === pickingFavContext.type).slice(0, 15);
    }
    if (results.length === 0) { container.innerHTML = '<p class="text-gray-500 text-sm col-span-full text-center py-8">No titles found.</p>'; return; }
    container.innerHTML = results.map(item => `<div onclick="selectFavorite('${item.id}')" class="relative aspect-[2/3] rounded overflow-hidden cursor-pointer border border-transparent hover:border-netflix-red group"><img src="${item.poster}" class="w-full h-full object-cover"><div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><span class="bg-netflix-red text-white text-[10px] font-bold px-2 py-1 rounded">SELECT</span></div></div>`).join('');
}
function selectFavorite(id) {
    const selectedItem = allMedia.find(m => m.id === id); if (!selectedItem) return;
    if (pickingFavContext.type === 'movie') userProfile.favFilms[pickingFavContext.index] = selectedItem; else userProfile.favSeries[pickingFavContext.index] = selectedItem;
    syncDatabase(); closeFavModal(); renderProfile();
}
function removeFav(type, index) { if (type === 'movie') userProfile.favFilms[index] = null; else userProfile.favSeries[index] = null; syncDatabase(); renderProfile(); }

// ==========================================
// DETAILS & LOGGING
// ==========================================
function switchMediaTab(tabName) {
    ['videos', 'backdrops', 'posters'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`), content = document.getElementById(`media-${t}`); if (!btn || !content) return;
        if (t === tabName) { btn.classList.add('text-white', 'border-netflix-red'); btn.classList.remove('hover:text-white', 'border-transparent', 'text-gray-500'); content.classList.remove('hidden'); } 
        else { btn.classList.remove('text-white', 'border-netflix-red'); btn.classList.add('hover:text-white', 'border-transparent', 'text-gray-500'); content.classList.add('hidden'); }
    });
}

let previousTab = 'home';
async function openMediaPage(id) {
    activeItem = allMedia.find(m => m.id === id); if (!activeItem) return;
    const currentActive = document.querySelector('.tab-content.block');
    if (currentActive && currentActive.id !== 'media-detail-section') previousTab = currentActive.id.replace('-section', '');

    const isSeries = activeItem.type === 'series';
    loggingContext = { type: 'movie' }; currentModalRating = 0; updateModalStars(0);
    
    document.getElementById('page-providers-container')?.classList.add('hidden'); document.getElementById('page-tagline')?.classList.add('hidden'); document.getElementById('page-related-section')?.classList.add('hidden'); document.getElementById('page-reviews-section')?.classList.add('hidden'); document.getElementById('page-media-section')?.classList.add('hidden');
    if(document.getElementById('page-providers')) document.getElementById('page-providers').innerHTML = ''; if(document.getElementById('page-reviews-list')) document.getElementById('page-reviews-list').innerHTML = '';
    
    const commentBox = document.getElementById('log-comment'), spoilerBox = document.getElementById('log-spoilers');
    if (commentBox) commentBox.value = ''; if (spoilerBox) spoilerBox.checked = false; document.getElementById('review-section')?.classList.add('hidden');

    if (isLoggedIn) {
        document.getElementById('page-logging-active')?.classList.remove('hidden'); document.getElementById('page-logging-prompt')?.classList.add('hidden');
        const rateSection = document.getElementById('page-master-stars')?.parentElement;
        if (isSeries) { document.getElementById('page-episodes-section')?.classList.remove('hidden'); if (rateSection) rateSection.classList.add('hidden'); } 
        else { document.getElementById('page-episodes-section')?.classList.add('hidden'); if (rateSection) rateSection.classList.remove('hidden'); }
        updateActionPanelUI();
    } else {
        document.getElementById('page-logging-active')?.classList.add('hidden'); document.getElementById('page-episodes-section')?.classList.add('hidden'); document.getElementById('page-logging-prompt')?.classList.remove('hidden');
    }

    document.getElementById('page-title').innerText = activeItem.title; document.getElementById('page-year').innerText = activeItem.year; document.getElementById('page-synopsis').innerText = activeItem.synopsis; document.getElementById('page-director').innerText = activeItem.director || 'Unknown'; document.getElementById('page-cast').innerText = (activeItem.cast || []).join(', ') || 'N/A'; document.getElementById('page-genres').innerText = (activeItem.genres || []).join(', ');
    
    const posterEl = document.getElementById('page-poster'), backdropEl = document.getElementById('page-backdrop');
    posterEl.style.opacity = '0'; backdropEl.style.opacity = '0'; posterEl.classList.add('transition-opacity', 'duration-500'); backdropEl.classList.add('transition-opacity', 'duration-500');
    posterEl.src = activeItem.poster; backdropEl.src = activeItem.backdrop;
    posterEl.onload = () => posterEl.style.opacity = '1'; backdropEl.onload = () => backdropEl.style.opacity = '0.3';
    
    document.getElementById('page-meta').innerHTML = `<span class="text-gray-300 border border-gray-600 px-1.5 py-0.5 rounded-sm text-xs font-bold">${activeItem.rating}</span><span class="text-gray-400"><i class="fa-regular fa-clock mr-1"></i> ${activeItem.duration}</span><span class="text-gray-400"><i class="fa-regular fa-calendar mr-1"></i> ${activeItem.releaseDate}</span>`;
    document.getElementById('page-global-rating').innerText = activeItem.globalRating; document.getElementById('page-fans').innerText = activeItem.fans;
    const maxBar = Math.max(...(activeItem.histogram || [1]), 1);
    document.getElementById('page-histogram').innerHTML = (activeItem.histogram || []).map((val) => `<div class="w-full bg-[#44505e] rounded-t-[1px]" style="height: ${(val / maxBar) * 100}%"></div>`).join('');
    switchTab('media-detail');

    if (activeItem.tmdbId) {
        const detailData = await fetchFromTMDB(isSeries ? `/tv/${activeItem.tmdbId}` : `/movie/${activeItem.tmdbId}`, { append_to_response: 'credits,videos,watch/providers,recommendations,reviews,images', include_image_language: 'en,null' });
        if (detailData) {
            if (!isSeries && detailData.runtime) activeItem.duration = `${Math.floor(detailData.runtime / 60)}h ${detailData.runtime % 60}m`;
            else if (isSeries && detailData.number_of_seasons) activeItem.duration = `${detailData.number_of_seasons} Season${detailData.number_of_seasons > 1 ? 's' : ''}`;
            if (detailData.credits) { const d = (detailData.credits.crew || []).find(c => c.job === 'Director') || (detailData.created_by && detailData.created_by[0]); activeItem.director = d ? (d.name || d) : 'Unknown'; activeItem.cast = (detailData.credits.cast || []).slice(0, 5).map(c => c.name); }
            if (detailData.genres) activeItem.genres = detailData.genres.map(g => g.name);
            document.getElementById('page-director').innerText = activeItem.director; document.getElementById('page-cast').innerText = activeItem.cast.join(', '); document.getElementById('page-genres').innerText = activeItem.genres.join(', ');
            if (detailData.tagline) { const el = document.getElementById('page-tagline'); if (el) { el.innerText = `"${detailData.tagline}"`; el.classList.remove('hidden'); } }
            if (detailData['watch/providers']?.results) {
                const providers = detailData['watch/providers'].results['IN'] || detailData['watch/providers'].results['US'];
                if (providers && (providers.flatrate || providers.rent || providers.buy)) {
                    const html = (providers.flatrate || providers.rent || providers.buy).slice(0, 4).map(p => `<img src="${TMDB_CONFIG.IMAGE_BASE}${p.logo_path}" alt="${p.provider_name}" class="w-9 h-9 rounded-md border border-gray-700 shadow-sm" title="${p.provider_name}">`).join('');
                    if (html) { document.getElementById('page-providers').innerHTML = html; document.getElementById('page-providers-container')?.classList.remove('hidden'); }
                }
            }
            if (detailData.videos?.results || detailData.images?.backdrops) {
                const videosList = detailData.videos?.results || []; const backdropsList = detailData.images?.backdrops || []; const postersList = detailData.images?.posters || [];
                if (videosList.length > 0 || backdropsList.length > 0 || postersList.length > 0) {
                    document.getElementById('page-media-section')?.classList.remove('hidden');
                    const cVid = document.getElementById('count-videos'), cBack = document.getElementById('count-backdrops'), cPost = document.getElementById('count-posters');
                    if(cVid) cVid.innerText = videosList.length; if(cBack) cBack.innerText = backdropsList.length; if(cPost) cPost.innerText = postersList.length;
                    const vidEl = document.getElementById('media-videos');
                    if(vidEl) vidEl.innerHTML = videosList.slice(0, 12).map(v => `<div class="bg-[#1a1a1a] rounded-lg overflow-hidden border border-gray-800 shadow-md"><div class="relative aspect-video bg-black"><iframe class="absolute top-0 left-0 w-full h-full" src="https://www.youtube.com/embed/${v.key}" frameborder="0" allowfullscreen loading="lazy"></iframe></div><div class="p-3"><p class="text-sm text-gray-300 font-medium truncate" title="${v.name}">${v.name}</p><p class="text-[10px] text-gray-500 uppercase mt-1">${v.type}</p></div></div>`).join('');
                    const backEl = document.getElementById('media-backdrops');
                    if(backEl) backEl.innerHTML = backdropsList.slice(0, 24).map(b => `<a href="${TMDB_CONFIG.BACKDROP_BASE}${b.file_path}" target="_blank" class="block w-64 md:w-80 flex-shrink-0 aspect-video rounded-md overflow-hidden border border-gray-800 hover:border-white transition-colors bg-gray-900 snap-start"><img src="${TMDB_CONFIG.IMAGE_BASE}${b.file_path}" class="w-full h-full object-cover" loading="lazy"></a>`).join('');
                    const postEl = document.getElementById('media-posters');
                    if(postEl) postEl.innerHTML = postersList.slice(0, 24).map(p => `<a href="${TMDB_CONFIG.BACKDROP_BASE}${p.file_path}" target="_blank" class="block w-32 md:w-44 flex-shrink-0 aspect-[2/3] rounded-md overflow-hidden border border-gray-800 hover:border-white transition-colors bg-gray-900 snap-start"><img src="${TMDB_CONFIG.IMAGE_BASE}${p.file_path}" class="w-full h-full object-cover" loading="lazy"></a>`).join('');
                    if (videosList.length > 0) switchMediaTab('videos'); else if (backdropsList.length > 0) switchMediaTab('backdrops'); else switchMediaTab('posters');
                }
            }
            if (detailData.reviews?.results.length > 0) {
                const el = document.getElementById('page-reviews-list');
                if (el) {
                    el.innerHTML = detailData.reviews.results.slice(0, 5).map(rev => `<div class="bg-[#1a1a1a] border border-gray-800 rounded-lg p-5 hover:bg-[#202020] transition-colors"><div class="flex items-center mb-3 border-b border-gray-800 pb-3"><div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mr-3 shrink-0"><i class="fa-solid fa-user text-xs text-gray-400"></i></div><h5 class="text-white font-bold text-sm flex items-center">Review by ${rev.author || 'Anonymous'} ${rev.author_details?.rating ? `<span class="bg-netflix-red text-white text-[10px] px-1.5 py-0.5 rounded ml-2 font-bold"><i class="fa-solid fa-star text-[8px]"></i> ${rev.author_details.rating}/10</span>` : ''}</h5></div><p class="text-gray-400 text-sm leading-relaxed">${(rev.content.length > 500 ? rev.content.substring(0, 500) + '...' : rev.content).replace(/\n/g, '<br>')}</p></div>`).join('');
                    document.getElementById('page-reviews-section')?.classList.remove('hidden');
                }
            }
            if (detailData.recommendations?.results.length > 0) {
                const recs = detailData.recommendations.results.slice(0, 7).map(item => normalizeTMDBItem(item, isSeries ? 'series' : 'movie')).filter(Boolean);
                recs.forEach(item => { if (!allMedia.some(m => m.id === item.id)) allMedia.push(item); });
                renderGrid('page-related-grid', recs); document.getElementById('page-related-section')?.classList.remove('hidden');
            }
            if (isSeries && detailData.seasons) activeItem.seasons = detailData.seasons.filter(s => s.season_number > 0).map(s => ({ seasonNumber: s.season_number, episodes: Array.from({ length: s.episode_count || 10 }, (_, i) => ({ episodeNumber: i + 1, title: `Episode ${i + 1}` })) }));
        }
    }
    if (isSeries) populateSeasonDropdown();
}

function closeMediaPage() { switchTab(previousTab); activeItem = null; closeListDropdown(); }

function updateActionPanelUI() {
    if (!activeItem) return;
    const isInWatchlist = userWatchlist.some(m => (typeof m === 'string' ? m : m.id) === activeItem.id);
    const watchBtn = document.getElementById('action-watchlist-btn'); if (watchBtn) watchBtn.className = `py-4 flex flex-col items-center justify-center gap-2 hover:bg-[#2a2a2a] transition-colors ${isInWatchlist ? 'text-netflix-red' : 'text-gray-400'}`;
    const isLogged = userLogs.some(l => l.media && l.media.id === activeItem.id);
    const logBtn = document.getElementById('action-log-btn'); if (logBtn) logBtn.className = `py-4 flex flex-col items-center justify-center gap-2 hover:bg-[#2a2a2a] transition-colors ${isLogged ? 'text-netflix-red' : 'text-gray-400'}`;
    const ratingLog = userLogs.find(l => l.media && l.media.id === activeItem.id && !l.media.title.includes(' - S'));
    currentModalRating = ratingLog ? ratingLog.rating : 0; updateModalStars(currentModalRating);
    const cb = document.getElementById('log-comment'), sc = document.getElementById('log-spoilers');
    if (cb) cb.value = ''; if (sc) sc.checked = false;
}

function updateModalStars(rating) {
    const stars = document.getElementById('page-master-stars'); if (!stars) return;
    Array.from(stars.children).forEach(star => {
        const starValue = parseInt(star.getAttribute('data-rating')); star.className = 'fa-solid cursor-pointer text-2xl '; 
        if (rating >= starValue) star.classList.add('fa-star', 'text-netflix-red');
        else if (rating === starValue - 0.5) star.classList.add('fa-star-half-stroke', 'text-netflix-red');
        else star.classList.add('fa-star', 'text-gray-600');
    });
}

document.querySelectorAll('#page-master-stars i').forEach(star => {
    star.addEventListener('mousemove', (e) => {
        if (!isLoggedIn || !activeItem) return;
        const rect = e.target.getBoundingClientRect(), isHalf = (e.clientX - rect.left) < (rect.width / 2), starIndex = parseInt(e.target.getAttribute('data-rating'));
        updateModalStars(isHalf ? starIndex - 0.5 : starIndex);
    });
    star.addEventListener('mouseleave', () => updateModalStars(currentModalRating));
    star.addEventListener('click', (e) => {
        if (!isLoggedIn || !activeItem) return;
        const rect = e.target.getBoundingClientRect(), isHalf = (e.clientX - rect.left) < (rect.width / 2), starIndex = parseInt(e.target.getAttribute('data-rating'));
        currentModalRating = isHalf ? starIndex - 0.5 : starIndex;
        let logIndex = userLogs.findIndex(l => l.media && l.media.id === activeItem.id && !l.media.title.includes(' - S'));
        if (logIndex > -1) userLogs[logIndex].rating = currentModalRating;
        else userLogs.unshift({ id: Date.now(), media: { id: activeItem.id, title: activeItem.title, poster: activeItem.poster, year: activeItem.year }, rating: currentModalRating, comment: "", spoilers: false, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) });
        syncDatabase(); renderLogs(); updateActionPanelUI();
    });
});

function toggleWatchlistAction(overrideId = null, event = null, iconEl = null) {
    if (event) event.stopPropagation(); if (!isLoggedIn) { openAuthModal(); return; }
    let targetId = overrideId || (activeItem ? activeItem.id : null); if (!targetId) return;
    let targetItem = allMedia.find(m => m.id === targetId); if (!targetItem) return;
    const index = userWatchlist.findIndex(m => (typeof m === 'string' ? m : m.id) === targetId);
    if (index > -1) { userWatchlist.splice(index, 1); if (iconEl) { iconEl.classList.remove('text-netflix-red'); iconEl.classList.add('text-gray-300'); } } 
    else { userWatchlist.push(targetItem); if (iconEl) { iconEl.classList.add('text-netflix-red'); iconEl.classList.remove('text-gray-300'); } }
    if (activeItem && activeItem.id === targetId) updateActionPanelUI(); syncDatabase(); renderWatchlist();
}

function toggleWatchedAction(event, overrideId = null, overrideIcon = null) {
    if (event) event.stopPropagation(); 
    if (!isLoggedIn) { openAuthModal(); return; }
    
    let targetId = overrideId || (activeItem ? activeItem.id : null); 
    if (!targetId) return;
    
    let targetItem = allMedia.find(m => m.id === targetId); 
    if (!targetItem) return;
    
    if (!userLogs.some(l => l.media && l.media.id === targetId)) {
        userLogs.unshift({ 
            id: Date.now(), 
            media: { id: targetItem.id, title: targetItem.title, poster: targetItem.poster, year: targetItem.year, genres: targetItem.genres }, 
            rating: 0, 
            comment: "", 
            spoilers: false, 
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
        });
        
        // Define watchIndex before checking it
        const watchIndex = userWatchlist.findIndex(m => (typeof m === 'string' ? m : m.id) === targetId);
        
        if (watchIndex > -1) { 
            userWatchlist.splice(watchIndex, 1); 
            if (overrideIcon && overrideIcon.parentElement?.children[2]) { 
                overrideIcon.parentElement.children[2].classList.remove('text-netflix-red'); 
                overrideIcon.parentElement.children[2].classList.add('text-gray-300'); 
            } 
        }
    } else { 
        userLogs = userLogs.filter(l => l.media && l.media.id !== targetId); 
    }
    
    syncDatabase(); 
    renderLogs(); 
    renderWatchlist();
    
    if (overrideIcon) { 
        overrideIcon.classList.toggle('text-netflix-red'); 
        overrideIcon.classList.toggle('text-gray-300'); 
    }
    if (activeItem && activeItem.id === targetId) updateActionPanelUI();
}

function toggleLikedAction(event, overrideId = null, overrideIcon = null) {
    if (event) event.stopPropagation(); if (!isLoggedIn) { openAuthModal(); return; }
    if (!overrideIcon) { const btn = document.getElementById('action-like-btn'); if (btn) { btn.classList.toggle('text-netflix-red'); btn.classList.toggle('text-gray-400'); } } 
    else { overrideIcon.classList.toggle('text-netflix-red'); overrideIcon.classList.toggle('text-gray-300'); }
}

function scrollToReview() { const revSec = document.getElementById('review-section'); if (revSec) { revSec.classList.remove('hidden'); revSec.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.getElementById('log-comment')?.focus(); } }

function populateSeasonDropdown() {
    const selector = document.getElementById('season-selector'); if (!selector) return;
    if (!activeItem?.seasons || activeItem.seasons.length === 0) { selector.innerHTML = '<option value="">No episode data</option>'; document.getElementById('episodes-list').innerHTML = '<p class="text-gray-500 text-sm p-4">Episodes coming soon.</p>'; return; }
    selector.innerHTML = activeItem.seasons.map(s => `<option value="${s.seasonNumber}">Season ${s.seasonNumber}</option>`).join(''); changeSeason(activeItem.seasons[0].seasonNumber);
}

async function changeSeason(seasonNum) {
    const season = (activeItem?.seasons || []).find(s => s.seasonNumber == seasonNum);
    const container = document.getElementById('episodes-list'); if (!season || !container) return;
    if (activeItem.tmdbId && (!season.fetchedDetails)) { const seasonData = await fetchFromTMDB(`/tv/${activeItem.tmdbId}/season/${seasonNum}`); if (seasonData?.episodes) { season.episodes = seasonData.episodes.map(ep => ({ episodeNumber: ep.episode_number, title: ep.name || `Episode ${ep.episode_number}` })); season.fetchedDetails = true; } }
    container.innerHTML = (season.episodes || []).map(ep => {
        const epId = `${activeItem.id}-s${seasonNum}-e${ep.episodeNumber}`, watched = userEpisodesWatched[epId] ? 'text-netflix-red' : 'text-gray-600', rating = userEpisodeRatings[epId] || 0;
        const stars = Array.from({length: 5}).map((_, i) => `<i class="fa-solid ${rating >= i + 1 ? 'fa-star text-netflix-red' : (rating > i ? 'fa-star-half-stroke text-netflix-red' : 'fa-star text-gray-600')} cursor-pointer px-0.5 hover:opacity-80" onclick="rateEpisodeInline('${epId}', ${i + 1}, event)"></i>`).join('');
        return `<div class="bg-[#1a1a1a] p-3 flex justify-between items-center hover:bg-[#222] border-b border-[#222]"><h4 class="text-gray-200 font-semibold text-xs">${ep.episodeNumber}. ${ep.title}</h4><div class="flex items-center gap-4"><i class="fa-solid fa-eye ${watched} hover:text-netflix-red cursor-pointer" onclick="toggleEpisodeWatched('${epId}', event, this)"></i><div class="flex text-[10px]">${stars}</div><button onclick="prepareEpisodeLog('${epId}', ${seasonNum}, ${ep.episodeNumber}, '${ep.title.replace(/'/g, "\\'")}')" class="text-[10px] bg-[#333] hover:bg-gray-600 text-white px-2 py-1 rounded font-bold uppercase">Log</button></div></div>`;
    }).join('');
}

function toggleEpisodeWatched(epId, event, icon) { event.stopPropagation(); if (!isLoggedIn) { openAuthModal(); return; } userEpisodesWatched[epId] = !userEpisodesWatched[epId]; icon.classList.toggle('text-netflix-red'); icon.classList.toggle('text-gray-600'); syncDatabase(); }
function rateEpisodeInline(epId, baseRating, event) { event.stopPropagation(); if (!isLoggedIn) { openAuthModal(); return; } const rect = event.target.getBoundingClientRect(), rating = ((event.clientX - rect.left) < (rect.width / 2)) ? baseRating - 0.5 : baseRating; userEpisodeRatings[epId] = rating; userEpisodesWatched[epId] = true; syncDatabase(); changeSeason(document.getElementById('season-selector').value); }
function prepareEpisodeLog(epId, sNum, eNum, epTitle) { if (!isLoggedIn) { openAuthModal(); return; } loggingContext = { type: 'episode', episodeId: epId, seasonNum: sNum, episodeNum: eNum, title: epTitle }; currentModalRating = userEpisodeRatings[epId] || 0; document.getElementById('log-heading').innerText = `Log S${sNum}:E${eNum} - ${epTitle}`; const revSec = document.getElementById('review-section'); if (revSec) { revSec.classList.remove('hidden'); revSec.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.getElementById('log-comment')?.focus(); } }

function saveLog() {
    if (!isLoggedIn || !activeItem) return;
    const cb = document.getElementById('log-comment'), sc = document.getElementById('log-spoilers'), comment = cb ? cb.value.trim() : '', spoilers = sc ? sc.checked : false;
    let logTitle = activeItem.title; const isEpisode = loggingContext.type === 'episode';
    const todayDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (isEpisode) { 
        logTitle = `${activeItem.title} - S${loggingContext.seasonNum}:E${loggingContext.episodeNum} "${loggingContext.title}"`; 
        userEpisodeRatings[loggingContext.episodeId] = currentModalRating; 
        userEpisodesWatched[loggingContext.episodeId] = true; 
        changeSeason(document.getElementById('season-selector').value); 
    }
    
    const existingLogIndex = userLogs.findIndex(l => l.media && l.media.id === activeItem.id && l.date === todayDate && !isEpisode);
    if (existingLogIndex > -1) {
        userLogs[existingLogIndex].rating = currentModalRating;
        userLogs[existingLogIndex].comment = comment;
        userLogs[existingLogIndex].spoilers = spoilers;
    } else {
        userLogs.unshift({ id: Date.now(), media: { id: activeItem.id, title: logTitle, poster: activeItem.poster, year: activeItem.year, genres: activeItem.genres }, rating: currentModalRating, comment: comment, spoilers: spoilers, date: todayDate });
    }
    
    syncDatabase(); renderLogs();
    if (isEpisode) { if (cb) cb.value = ''; currentModalRating = 0; updateModalStars(0); loggingContext = { type: 'movie' }; document.getElementById('log-heading').innerText = "Review"; } 
    else { if (cb) cb.value = ''; if (sc) sc.checked = false; updateActionPanelUI(); }
    document.getElementById('review-section')?.classList.add('hidden');
}

function renderLogs() {
    const container = document.getElementById('log-container'); if (!container) return;
    if (userLogs.length === 0) { container.innerHTML = `<div class="flex flex-col items-center justify-center py-20 opacity-50 border border-dashed border-gray-700 rounded-xl"><i class="fa-solid fa-book-open text-5xl mb-4 text-gray-500"></i><p class="text-gray-400 text-lg">No logs yet.</p></div>`; return; }
    container.innerHTML = userLogs.map(log => {
        if (!log?.media) return '';
        const starsHtml = Array.from({length: 5}).map((_, i) => log.rating >= i + 1 ? `<i class="fa-solid fa-star text-netflix-red text-[10px]"></i>` : (log.rating > i ? `<i class="fa-solid fa-star-half-stroke text-netflix-red text-[10px]"></i>` : `<i class="fa-solid fa-star text-gray-700 text-[10px]"></i>`)).join('');
        const commentHtml = log.comment ? `<p class="text-gray-400 text-sm mt-2 line-clamp-2">${log.spoilers ? `<span class="text-netflix-red font-bold text-[10px] uppercase tracking-wider mr-2">Spoiler</span>` : ''}${log.comment}</p>` : '';
        let sd = log.date; try { const parts = log.date.split(' '); if(parts.length === 3) sd = `<div class="text-xl font-light text-gray-200 mb-0.5">${parts[1].replace(',', '')}</div><div class="text-[9px] uppercase tracking-widest text-gray-500">${parts[0]} ${parts[2]}</div>`; } catch(e) {}
        return `<div class="bg-[#1a1a1a] border-b border-gray-800 py-3 px-4 md:px-6 flex items-center gap-4 md:gap-8 hover:bg-[#222] transition-colors relative group w-full rounded-sm"><button onclick="deleteLog(${log.id})" class="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-netflix-red p-2"><i class="fa-solid fa-trash"></i></button><div class="hidden md:flex flex-col items-center justify-center w-16 text-center border-r border-gray-800/50 pr-6">${sd}</div><img src="${log.media.poster}" class="w-10 md:w-14 rounded object-cover shadow-sm aspect-[2/3] cursor-pointer border border-gray-700 shrink-0" onclick="openMediaPage('${log.media.id}')"><div class="flex flex-col flex-grow justify-center py-1"><h3 class="text-white font-bold text-lg md:text-xl flex items-center gap-2 cursor-pointer hover:text-netflix-red font-serif line-clamp-1" onclick="openMediaPage('${log.media.id}')">${log.media.title} <span class="text-gray-500 text-sm font-normal font-sans ml-1">${log.media.year}</span></h3><div class="flex items-center gap-3 mt-1"><div class="flex gap-[1px]">${starsHtml}</div><span class="md:hidden text-gray-500 text-[10px] font-medium uppercase tracking-wider">${log.date}</span></div>${commentHtml}</div></div>`;
    }).join('');
}

function deleteLog(localId) { userLogs = userLogs.filter(l => l.id !== localId); syncDatabase(); renderLogs(); if (activeItem) updateActionPanelUI(); }

function renderWatchlist() {
    const container = document.getElementById('watchlist-container'); if (!container) return;
    const validItems = userWatchlist.map(item => typeof item === 'string' ? allMedia.find(m => m.id === item) : (item.id ? allMedia.find(m => m.id === item.id) || item : null)).filter(Boolean);
    if (validItems.length === 0) { container.innerHTML = `<div class="col-span-full flex flex-col items-center py-20 opacity-50 border border-dashed border-gray-700 rounded-xl"><i class="fa-solid fa-bookmark text-5xl mb-4 text-gray-500"></i><p class="text-gray-400 text-lg">Your watchlist is empty.</p></div>`; return; }
    container.innerHTML = validItems.map(item => `<div class="relative rounded-md overflow-hidden aspect-[2/3] cursor-pointer thumbnail-card bg-netflix-dark shadow-md group border-2 border-transparent transition-colors duration-300" onclick="openMediaPage('${item.id}')"><img src="${item.poster}" class="w-full h-full object-cover"><div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#111]/95 backdrop-blur-md rounded-md px-3.5 py-2 flex gap-4 items-center opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-2xl border border-white/10" onclick="event.stopPropagation()"><svg onclick="toggleWatchedAction(event, '${item.id}', this)" class="w-4 h-4 cursor-pointer transition-transform hover:scale-110 ${userLogs.some(l => l.media && l.media.id === item.id) ? 'text-netflix-red' : 'text-gray-300 hover:text-white'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg><svg onclick="toggleLikedAction(event, '${item.id}', this)" class="w-4 h-4 cursor-pointer transition-transform hover:scale-110 text-gray-300 hover:text-netflix-red" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg><svg onclick="toggleWatchlistAction('${item.id}', event, this)" class="w-4 h-4 cursor-pointer transition-transform hover:scale-110 text-netflix-red" fill="currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg></div></div>`).join('');
}

// ==========================================
// LISTS & QUOTES
// ==========================================
function openCreateQuoteModal() { if (!isLoggedIn) { openAuthModal(); return; } closeMenus(); document.getElementById('create-quote-modal')?.classList.remove('hidden'); document.body.classList.add('modal-open'); document.getElementById('create-quote-form')?.reset(); }
function closeCreateQuoteModal() { document.getElementById('create-quote-modal')?.classList.add('hidden'); document.body.classList.remove('modal-open'); }
function handleCreateQuote(e) { e.preventDefault(); const t = document.getElementById('quote-text').value.trim(), m = document.getElementById('quote-media').value.trim(), c = document.getElementById('quote-character').value.trim(); if (!t || !m) return; userQuotes.unshift({ id: 'q_' + Date.now(), text: t, media: m, character: c, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }); syncDatabase(); closeCreateQuoteModal(); renderQuotes(); }
function deleteQuote(localId) { userQuotes = userQuotes.filter(q => q.id !== localId); syncDatabase(); renderQuotes(); }

function renderQuotes() {
    const c = document.getElementById('quotes-container'); if (!c) return;
    if (!isLoggedIn) { c.innerHTML = `<div class="flex flex-col items-center py-20 opacity-50"><i class="fa-solid fa-lock text-5xl mb-4 text-gray-500"></i><button onclick="openAuthModal()" class="bg-netflix-red text-white px-6 py-2 rounded">Sign In</button></div>`; return; }
    if (userQuotes.length === 0) { c.innerHTML = `<div class="flex flex-col items-center py-20 opacity-50"><i class="fa-solid fa-quote-right text-5xl mb-4 text-gray-500"></i></div>`; return; }
    c.className = "flex flex-col gap-10 max-w-3xl mx-auto mt-8";
    c.innerHTML = userQuotes.map(q => `<div class="border-l-4 border-netflix-red pl-6 py-2 relative group"><button onclick="deleteQuote('${q.id}')" class="absolute -right-4 top-0 opacity-0 group-hover:opacity-100 text-red-500"><i class="fa-solid fa-trash"></i></button><p class="text-gray-200 text-xl font-light mb-4">"${q.text}"</p><div class="text-sm"><span class="text-white">${q.media}</span>${q.character ? `<span class="text-gray-500 ml-2 before:content-['—'] before:mr-2">${q.character}</span>` : ''}</div></div>`).join('');
}

function openCreateListModal() { if (!isLoggedIn) { openAuthModal(); return; } closeMenus(); document.getElementById('create-list-modal')?.classList.remove('hidden'); document.body.classList.add('modal-open'); }
function closeCreateListModal() { document.getElementById('create-list-modal')?.classList.add('hidden'); document.body.classList.remove('modal-open'); }
function handleCreateList(e) { e.preventDefault(); const title = document.getElementById('list-name').value.trim(), desc = document.getElementById('list-description').value.trim(); if (!title) return; userLists.push({ id: 'list_' + Date.now(), title, description: desc, items: [] }); syncDatabase(); closeCreateListModal(); renderLists(); }

function renderLists() {
    const c = document.getElementById('lists-container'); if (!c) return;
    if (!isLoggedIn) { c.innerHTML = `<div class="col-span-full flex flex-col items-center py-20 opacity-50 border border-gray-800"><button onclick="openAuthModal()" class="bg-netflix-red text-white px-6 py-2 rounded">Sign In</button></div>`; return; }
    if (userLists.length === 0) { c.innerHTML = `<div class="col-span-full flex flex-col items-center py-20 opacity-50 border border-dashed border-gray-700 rounded-xl"><i class="fa-solid fa-layer-group text-5xl mb-4 text-gray-500"></i></div>`; return; }
    c.innerHTML = userLists.map(list => {
        const preview = list.items.slice(0, 4).map(id => allMedia.find(m => m.id === id)).filter(Boolean);
        let html = preview.length > 0 ? preview.map((item, i) => `<img src="${item.poster}" class="w-16 h-24 object-cover rounded-md border-2 border-[#181818] z-[${4 - i}]">`).join('') : `<div class="w-16 h-24 bg-gray-800 rounded-md border-2 border-[#181818]"></div>`;
        return `<div onclick="openListView('${list.id}')" class="bg-[#181818] border border-gray-800 rounded-xl p-6 hover:bg-[#202020] cursor-pointer shadow-lg flex flex-col h-full"><h3 class="text-white font-bold text-xl mb-2 line-clamp-1">${list.title}</h3><p class="text-gray-400 text-sm mb-6 line-clamp-2 flex-grow">${list.description || ''}</p><div class="flex items-end justify-between mt-auto pt-4 border-t border-gray-800"><div class="flex -space-x-4">${html}</div><div class="text-xs text-gray-500 font-bold uppercase bg-black/40 px-3 py-1 rounded-full">${list.items.length} Items</div></div></div>`;
    }).join('');
}

function openListView(listId) {
    const list = userLists.find(l => l.id === listId); if (!list) return;
    currentViewedListId = listId; document.getElementById('list-detail-title').innerText = list.title; document.getElementById('list-detail-desc').innerText = list.description || '';
    const listMedia = list.items.map(itemId => allMedia.find(m => m.id === itemId)).filter(Boolean);
    if (listMedia.length > 0) renderGrid('list-detail-grid', listMedia); else document.getElementById('list-detail-grid').innerHTML = `<div class="col-span-full flex flex-col items-center py-20 opacity-50 border border-dashed border-gray-700 rounded-xl mt-4"><p class="text-gray-400 text-lg">Empty list.</p></div>`;
    switchTab('list-detail');
}

function openAddMediaModal() { if (!isLoggedIn) { openAuthModal(); return; } document.getElementById('add-media-modal')?.classList.remove('hidden'); document.body.classList.add('modal-open'); handleAddMediaSearch(''); }
function closeAddMediaModal() { document.getElementById('add-media-modal')?.classList.add('hidden'); document.body.classList.remove('modal-open'); }
async function handleAddMediaSearch(query) {
    const cleanedQuery = (query || "").toLowerCase().trim(), c = document.getElementById('add-media-results'), list = userLists.find(l => l.id === currentViewedListId); if (!list || !c) return;
    let res = [];
    if (cleanedQuery) {
        const tmdbData = await fetchFromTMDB('/search/multi', { query: cleanedQuery, include_adult: false });
        if (tmdbData && tmdbData.results) { res = tmdbData.results.filter(i => i.media_type === 'movie' || i.media_type === 'tv').map(i => normalizeTMDBItem(i)).filter(Boolean); res.forEach(item => { if (!allMedia.some(m => m.id === item.id)) allMedia.push(item); }); } 
        else res = allMedia.filter(m => (m.title && m.title.toLowerCase().includes(cleanedQuery)));
    } else res = allMedia.slice(0, 15);
    if (res.length === 0) { c.innerHTML = '<p class="text-gray-500 text-sm text-center py-8">No titles found.</p>'; return; }
    c.innerHTML = res.map(item => { const isInList = list.items.includes(item.id); return `<div class="flex items-center justify-between bg-[#1a1a1a] p-2.5 rounded hover:bg-[#222] border border-transparent hover:border-gray-700"><div class="flex items-center gap-3"><img src="${item.poster}" class="w-10 h-14 object-cover rounded shadow"><div><h4 class="text-white text-sm font-bold line-clamp-1">${item.title}</h4></div></div><button onclick="toggleMediaInCurrentList('${item.id}')" class="px-3.5 py-1.5 rounded text-xs font-bold transition-colors ${isInList ? 'bg-red-900/40 text-red-400' : 'bg-white text-black'}">${isInList ? 'Remove' : 'Add'}</button></div>`; }).join('');
}
function toggleMediaInCurrentList(itemId) {
    const list = userLists.find(l => l.id === currentViewedListId); if (!list) return;
    const index = list.items.indexOf(itemId); if (index > -1) list.items.splice(index, 1); else list.items.push(itemId);
    syncDatabase(); handleAddMediaSearch(document.getElementById('add-media-search')?.value || ''); openListView(currentViewedListId);
}

function toggleListDropdown(e) { e.stopPropagation(); if (!isLoggedIn) { openAuthModal(); return; } const d = document.getElementById('add-to-list-dropdown'); if (!d) return; const isHidden = d.classList.contains('hidden'); closeMenus(); if (isHidden) { populateListDropdown(); d.classList.remove('hidden'); } }
function closeListDropdown() { document.getElementById('add-to-list-dropdown')?.classList.add('hidden'); }
function populateListDropdown() {
    const c = document.getElementById('dropdown-lists-container'); if (!c) return;
    if (userLists.length === 0) { c.innerHTML = '<div class="px-4 py-3 text-sm text-gray-500 italic text-center">No lists created.</div>'; return; }
    c.innerHTML = userLists.map(list => { const isInList = activeItem && list.items.includes(activeItem.id); return `<button onclick="toggleItemInList('${list.id}', event)" class="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#2a2a2a] transition-colors flex items-center justify-between"><span class="truncate pr-2">${list.title}</span>${isInList ? '<i class="fa-solid fa-check text-netflix-red"></i>' : ''}</button>`; }).join('');
}
function toggleItemInList(listId, e) { e.stopPropagation(); if (!activeItem) return; const list = userLists.find(l => l.id === listId); if (!list) return; const itemIndex = list.items.indexOf(activeItem.id); if (itemIndex > -1) list.items.splice(itemIndex, 1); else list.items.push(activeItem.id); syncDatabase(); populateListDropdown(); }

// ==========================================
// INITIALIZATION
// ==========================================
window.onload = async () => {
    try {
        const savedProfile = localStorage.getItem('prestige_profile');
        if (savedProfile) {
            const parsedProfile = JSON.parse(savedProfile);
            userProfile = { ...userProfile, ...parsedProfile };
            
            // Safely inject saved favorites back into memory
            const favsToLoad = [...(userProfile.favFilms || []), ...(userProfile.favSeries || [])];
            favsToLoad.forEach(fav => {
                if (fav && typeof fav === 'object' && fav.id && !allMedia.some(m => m.id === fav.id)) {
                    allMedia.push(fav);
                }
            });
        }
        updateWelcomeBanner();

        const savedLogs = localStorage.getItem('prestige_logs'); if (savedLogs) userLogs = JSON.parse(savedLogs) || [];
        const savedWatchlist = localStorage.getItem('prestige_watchlist'); if (savedWatchlist) userWatchlist = JSON.parse(savedWatchlist) || [];
        const savedLists = localStorage.getItem('prestige_lists'); if (savedLists) userLists = JSON.parse(savedLists) || [];
        const savedQuotes = localStorage.getItem('prestige_quotes'); if (savedQuotes) userQuotes = JSON.parse(savedQuotes) || [];
        const savedProgress = localStorage.getItem('prestige_progress'); if (savedProgress) { const p = JSON.parse(savedProgress); userEpisodeRatings = p.ratings || {}; userEpisodesWatched = p.watched || {}; }
    } catch (e) {
        console.error("Local storage error (cleared bad data):", e);
    }

    renderLogs(); renderWatchlist(); renderLists(); renderQuotes(); fetchStoriesFromDatabase();
    await loadTMDBContent();
    
    // Fallback syncs
    const navAvatar = document.getElementById('navbar-avatar');
    if (navAvatar && userProfile.avatar) navAvatar.src = userProfile.avatar;
    
    // Explicitly make sure the home tab is showing
    switchTab('home');
};

function updateNavbarConfig() {
    const navbar = document.getElementById('navbar'); 
    if (!navbar) return;
    
    const isDetailView = document.getElementById('media-detail-section')?.classList.contains('block');
    const isScrolled = window.scrollY > 20;
    
    // Removed the border-b and border-white/5 classes from the second condition
    navbar.className = isDetailView && !isScrolled 
        ? "fixed w-full top-0 z-40 transition-all duration-300 bg-gradient-to-b from-[#141414]/90 to-transparent" 
        : "fixed w-full top-0 z-40 transition-all duration-300 bg-[#141414]/95 backdrop-blur-md";
}
window.addEventListener('scroll', updateNavbarConfig);

// ==========================================
// ROW NAVIGATION
// ==========================================
function scrollRow(rowId, direction) {
    const row = document.getElementById(rowId);
    if (row) {
        // Scrolls left (-1) or right (1) by 80% of the visible container width
        const scrollAmount = row.clientWidth * 0.8; 
        row.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
}

// ==========================================
// TOP GENRES ANALYTICS
// ==========================================

function renderGenreAnalytics() {
    const barContainer = document.getElementById('genre-bar-container');
    const legendContainer = document.getElementById('genre-legend');
    if (!barContainer || !legendContainer) return;

    const genreCounts = {};
    let total = 0;

    // Tally up every genre from everything the user has watched
    (userLogs || []).forEach(log => {
        if (!log || !log.media) return;
        
        // Try to get genres from the log first. If missing, look it up in allMedia (retroactive fix).
        let genresToCount = log.media.genres;
        if (!genresToCount && log.media.id) {
            const foundMedia = allMedia.find(m => m.id === log.media.id);
            if (foundMedia && foundMedia.genres) {
                genresToCount = foundMedia.genres;
            }
        }

        if (genresToCount && Array.isArray(genresToCount)) {
            genresToCount.forEach(g => {
                genreCounts[g] = (genreCounts[g] || 0) + 1;
                total++;
            });
        }
    });

    if (total === 0) {
        barContainer.innerHTML = '<div class="w-full h-full bg-gray-800"></div>';
        legendContainer.innerHTML = '<span class="text-gray-500">Log some movies to see your stats.</span>';
        return;
    }

    // Sort genres by highest count and pick the top 5
    const sortedGenres = Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a]).slice(0, 5);
    
    // Sleek red-to-grey gradient scale
    const colors = ['bg-netflix-red', 'bg-red-800', 'bg-gray-400', 'bg-gray-600', 'bg-gray-800'];

    let barHtml = '';
    let legendHtml = '';

    sortedGenres.forEach((genre, index) => {
        const pct = (genreCounts[genre] / total) * 100;
        const colorClass = colors[index] || 'bg-gray-900';
        
        // Build the segments of the progress bar
        barHtml += `<div style="width: ${pct}%" class="h-full ${colorClass} border-r-2 border-[#1a1a1a] last:border-0 hover:opacity-80 transition-opacity cursor-help" title="${genre}: ${Math.round(pct)}%"></div>`;
        
        // Build the dot and text legend directly below it
        legendHtml += `<div class="flex items-center gap-1.5 text-gray-300"><div class="w-2.5 h-2.5 rounded-sm ${colorClass}"></div> ${genre} <span class="text-gray-600 ml-0.5">${Math.round(pct)}%</span></div>`;
    });

    barContainer.innerHTML = barHtml;
    legendContainer.innerHTML = legendHtml;
}

// ==========================================
// RECENT STORIES / CLOUD FIRESTORE ENGINE
// ==========================================
let editorialDatabase = [];

async function fetchStoriesFromDatabase() {
    // 1. Local Backup (in case the cloud is empty or blocked)
    const backupStories = [
        { 
            id: 'story_1', tag: "Deep Dive", title: "Tender Buttons: Female friendship and bodily joy", author: "Prestige Editorial", 
            image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80", 
            content: "<p>The films of Agnès Varda find tenderness—and a bulwark against a world designed by men—in female friendship and bodily joy. Throughout her career, Varda's camera lingered on the spaces where women existed freely, unburdened by the male gaze. She did not merely document women; she collaborated with them, allowing their interior lives to shape the visual language of her cinema.</p><p>From the roaming, tragic freedom of <i>Vagabond</i> (1985) to the intimate, existential musicality of <i>Cleo from 5 to 7</i> (1962), Varda redefined what it meant to capture the female experience on film. Cleo's journey across Paris, waiting for a biopsy result, is less about the looming specter of death and more about a woman finally looking at the world, rather than simply being looked at.</p><blockquote class='border-l-4 border-netflix-red pl-5 italic my-8 text-gray-400 text-xl font-light'>\"I tried to be a joyful feminist, but I was very angry.\" — Agnès Varda</blockquote><p>Her work remains a cornerstone of feminist cinema, proving that joy and rebellion often go hand in hand. Even in her later documentary work, like <i>Faces Places</i>, Varda's deep empathy and curiosity about everyday working people—especially women in rural spaces—shone through. To watch a Varda film is to be reminded that the most profound cinematic moments often happen in the quietest, most unglamorous corners of our lives.</p>"
        },
        { 
            id: 'story_2', tag: "Interview", title: "Caleb Landry Jones on the Religion & Realism of 'Down the Arm of God'", author: "Festival Coverage", 
            image: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80", 
            content: "<p>This week on Locarno Meets, we sat down with the actor Caleb Landry Jones, star and producer of the gripping new film <i>Down the Arm of God</i>, which played on the Piazza Grande at Locarno. By some measures, one in every four people in America is unhoused, a subject confronted head-on by this powerful drama.</p><p>Jones spoke extensively about the grueling preparation process, the burden of portraying systemic failure, and how he collaborated with the director to ensure the film felt less like a Hollywood production and more like a necessary, urgent documentary. \"We didn't want to smooth out the edges,\" Jones explained over coffee. \"The reality of living on the margins is jagged, unpredictable, and often incredibly boring. We had to capture that waiting game.\"</p><p>The film, which received considerable acclaim from the audience and press upon its premiere, marks a turning point for Jones. Best known for intense supporting roles in <i>Get Out</i> and <i>Three Billboards Outside Ebbing, Missouri</i>, this leading performance anchors the narrative in a quiet, devastating realism that is already generating awards buzz for the winter season.</p>"
        },
        { 
            id: 'story_3', tag: "Analysis", title: "Why 'The Bear' Season 3 is a Masterclass in Kitchen Tension", author: "TV Critics", 
            image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80", 
            content: "<p>No show on television currently induces anxiety quite like <i>The Bear</i>. As the crew attempts to elevate their chaotic sandwich shop into a fine-dining establishment, the camera work gets tighter, the dialogue overlaps relentlessly, and the ticking clock becomes a character of its own. It is a show about grief masking itself as ambition.</p><p>Season 3 doubles down on this aesthetic, using extreme close-ups of ticking order printers, searing meat, and perfectly plated micro-greens to externalize Carmy's internal panic. The editing room must have felt like a war zone. Cuts happen at breakneck speed, perfectly synchronized with a blaring, anxiety-inducing jazz soundtrack that leaves the viewer breathless.</p><blockquote class='border-l-4 border-netflix-red pl-5 italic my-8 text-gray-400 text-xl font-light'>\"The kitchen is a microcosm of the human mind: hot, crowded, and always one slipped knife away from total disaster.\"</blockquote><p>Yet, amidst the chaos, there are moments of profound stillness. Sydney's solitary late-night recipe testing, Marcus's meticulous pastry architecture, and Richie's ongoing quest for purpose provide the emotional grounding the show desperately needs to keep from spinning off its axis. It is a brilliant, exhausting feat of television directing that demands to be swallowed whole.</p>"
        },
        { 
            id: 'story_4', tag: "List", title: "Ten Must-See Independent Films This Fall", author: "Prestige Staff", 
            image: "https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?auto=format&fit=crop&w=1200&q=80", 
            content: "<p>Shorter days and colder nights call for great movies. As the blockbuster season winds down, the festival darlings from Cannes, Sundance, and Venice are finally hitting local independent theaters and streaming platforms.</p><p>We have rounded up the most essential indie films to add to your watchlist this November. The trend this year leans heavily into surrealism and isolation. From quiet pastoral dramas shot on the sweeping coasts of Ireland, to kinetic, neon-drenched neo-noirs filmed on the nighttime streets of Tokyo, filmmakers are pushing the boundaries of traditional narrative structures.</p><p>Standouts include the A24-produced <i>Neon Ghosts</i>, a haunting exploration of digital grief, and the French critical darling <i>L'Heure Bleue</i>, a real-time romantic drama that unfolds entirely during a 90-minute train ride. Get your popcorn ready, update your watchlists, and prepare for a season of cinema that challenges as much as it entertains.</p>"
        },
        { 
            id: 'story_5', tag: "News", title: "AFI FEST 2026 Announces Grand Jury Award Winners", author: "Industry Updates", 
            image: "https://images.unsplash.com/photo-1533928298208-27ff66555d8d?auto=format&fit=crop&w=1200&q=80", 
            content: "<p>AFI announced today the Grand Jury Prize winners and Special Mentions for the 40th edition of AFI FEST presented by Canva. The Grand Jury Prize winners for Live Action Short, Documentary Short, and Animated Short will now be eligible for the Academy Awards next spring.</p><p>This year's slate featured a surprisingly heavy focus on analog filmmaking, with three of the top five winners shooting entirely on 16mm or 35mm film stock. This signals a strong, continued resurgence in traditional celluloid among young, emerging directors who are pushing back against the hyper-clean aesthetic of digital sensors.</p><blockquote class='border-l-4 border-netflix-red pl-5 italic my-8 text-gray-400 text-xl font-light'>\"The texture of film cannot be replicated by an algorithm. We are seeing a generation return to the physical chemistry of light and silver.\"</blockquote><p>The top prize of the night went to the breathtaking documentary short <i>Salt & Rust</i>, an unflinching look at the dying fishing communities along the North Atlantic coast. The festival will conclude this weekend with a special 50th-anniversary screening of Martin Scorsese's <i>Taxi Driver</i>.</p>"
        },
        { 
            id: 'story_6', tag: "Retrospective", title: "The Anatomy of a Scene: Inside Oppenheimer's Trinity Test", author: "Prestige Editorial", 
            image: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1200&q=80", 
            content: "<p>Christopher Nolan's insistence on practical effects reached its zenith during the recreation of the Trinity Test. Without using CGI, the production team utilized forced perspective, miniature sets, gasoline explosions, and magnesium flares to mimic the terrifying dawn of the atomic age.</p><p>But the true brilliance of the scene lies not in the visuals, but in its masterful sound design. By forcing the audience to sit in agonizing, dead silence while the fireball expands across the desert, Nolan accurately portrays the terrifying physics of light traveling faster than sound. The collective breath-holding in theaters worldwide was a testament to the power of subjective filmmaking.</p><p>When the shockwave finally hits, accompanied by Ludwig Göransson's thunderous, vibrating score, it shakes the viewer to their core. Cillian Murphy's hollow, devastated expression in the bunker seals the sequence, visually confirming that the world has irrevocably changed. It remains one of the most defining cinematic sequences of the decade.</p>"
        }
    ];

    // 2. If Firebase isn't loaded yet, use the backup immediately
    if (!db) {
        editorialDatabase = backupStories;
        renderStories();
        return;
    }

    // 3. Try to pull from Firebase
    try {
        const snapshot = await db.collection('editorial').get();
        editorialDatabase = [];
        
        snapshot.forEach(doc => {
            editorialDatabase.push({ id: doc.id, ...doc.data() });
        });
        
        // If the database is connected but empty, use the backup
        if (editorialDatabase.length === 0) {
            editorialDatabase = backupStories;
        }
        
        renderStories();
    } catch (error) {
        // If Firebase rules block access, use the backup
        console.warn("Cloud stories blocked by rules. Loading local stories instead.");
        editorialDatabase = backupStories;
        renderStories();
    }
}

function getDailyStories() {
    if (editorialDatabase.length === 0) return [];
    
    const today = new Date();
    // Creates a unique numerical seed based on today's exact date (YYYYMMDD)
    const seed = parseInt(`${today.getFullYear()}${today.getMonth()}${today.getDate()}`);
    const poolSize = editorialDatabase.length;
    
    // Safely return up to 4 stories (or fewer if your database is small)
    if (poolSize < 4) return editorialDatabase;
    
    return [
        editorialDatabase[(seed) % poolSize],
        editorialDatabase[(seed + 1) % poolSize],
        editorialDatabase[(seed + 2) % poolSize],
        editorialDatabase[(seed + 3) % poolSize]
    ];
}

function renderStories() {
    const grid = document.getElementById('recent-stories-grid');
    const dailyStories = getDailyStories();
    
    if (!grid || dailyStories.length === 0) return;
    
    grid.innerHTML = dailyStories.map(story => `
        <div onclick="openStoryPage('${story.id}')" class="flex flex-col group cursor-pointer outline-none">
            <div class="overflow-hidden rounded-md aspect-video mb-4 relative border border-gray-800 group-hover:border-gray-500 transition-colors shadow-lg">
                <img src="${story.image}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" loading="lazy">
                <div class="absolute top-2 left-2 bg-black/90 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded backdrop-blur-sm border border-gray-700">${story.tag}</div>
            </div>
            <h3 class="text-gray-200 font-serif font-bold text-lg leading-snug group-hover:text-netflix-red transition-colors">${story.title}</h3>
            <p class="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-2">${story.author}</p>
        </div>
    `).join('');
}

function openStoryPage(storyId) {
    const story = editorialDatabase.find(s => s.id === storyId);
    if (!story) return;
    
    document.getElementById('story-page-tag').innerText = story.tag || 'Editorial';
    document.getElementById('story-page-title').innerText = story.title || 'Untitled';
    document.getElementById('story-page-author').innerText = story.author || 'Prestige Staff';
    document.getElementById('story-page-date').innerText = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('story-page-image').src = story.image || '';
    document.getElementById('story-page-content').innerHTML = story.content || '';
    
    switchTab('story-detail');
}

// ==========================================
// DIRECTOR COMPLETIONIST ROADMAPS
// ==========================================
let directorFilmographies = {}; 
let directorSearchTimer = null;

async function handleDirectorSearch(query) {
    clearTimeout(directorSearchTimer);
    const container = document.getElementById('director-search-results');
    if (!container) return;
    
    if (!query.trim()) { 
        container.classList.add('hidden'); 
        return; 
    }

    directorSearchTimer = setTimeout(async () => {
        const data = await fetchFromTMDB('/search/person', { query: query.trim(), include_adult: false });
        if (data && data.results && data.results.length > 0) {
            const directors = data.results.filter(p => p.known_for_department === 'Directing').slice(0, 6);
            
            if (directors.length === 0) {
                container.innerHTML = '<div class="px-4 py-3 text-sm text-gray-500">No directors found.</div>';
            } else {
                container.innerHTML = directors.map(d => {
                    const safeName = d.name.replace(/'/g, "\\'");
                    const imgUrl = d.profile_path ? TMDB_CONFIG.IMAGE_BASE + d.profile_path : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(d.name);
                    return `
                        <div onclick="addDirectorToRoadmaps(${d.id}, '${safeName}')" class="px-4 py-2.5 hover:bg-[#333] cursor-pointer flex items-center gap-3 transition-colors border-b border-gray-800 last:border-0">
                            <img src="${imgUrl}" class="w-8 h-8 rounded-full object-cover border border-gray-700">
                            <span class="text-white text-sm font-bold">${d.name}</span>
                        </div>
                    `;
                }).join('');
            }
            container.classList.remove('hidden');
        }
    }, 400); 
}

async function addDirectorToRoadmaps(id, name) {
    if (!isLoggedIn) { 
        if (typeof openAuthModal === 'function') openAuthModal(); 
        return; 
    }
    if (typeof userProfile === 'undefined' || !userProfile) return;
    if (!userProfile.roadmaps) userProfile.roadmaps = [];
    
    if (!userProfile.roadmaps.some(r => r.id === id)) {
        userProfile.roadmaps.unshift({ id: id, name: name });
        if (typeof syncDatabase === 'function') syncDatabase(); 
    }
    
    const searchInput = document.getElementById('director-search-input');
    const searchResults = document.getElementById('director-search-results');
    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.classList.add('hidden');
    
    await loadRoadmaps();
}

async function removeDirector(id, event) {
    event.stopPropagation();
    if (!confirm("Are you sure you want to stop tracking this director?")) return;
    
    if (userProfile && userProfile.roadmaps) {
        userProfile.roadmaps = userProfile.roadmaps.filter(r => r.id !== id);
        if (typeof syncDatabase === 'function') syncDatabase();
    }
    await loadRoadmaps();
}

window.addEventListener('click', (e) => {
    const searchInput = document.getElementById('director-search-input');
    if (!searchInput) return;
    const searchWrapper = searchInput.parentElement;
    const searchResults = document.getElementById('director-search-results');
    
    if (searchWrapper && !searchWrapper.contains(e.target) && searchResults) {
        searchResults.classList.add('hidden');
    }
});

async function loadRoadmaps() {
    const container = document.getElementById('roadmaps-container');
    if (!container) return;
    
    if (typeof userProfile === 'undefined' || !userProfile) return;
    if (!userProfile.roadmaps) userProfile.roadmaps = [];
    
    if (userProfile.roadmaps.length === 0) {
        container.innerHTML = '<div class="text-center py-24 opacity-50 border border-dashed border-gray-800 rounded-xl"><i class="fa-solid fa-search text-3xl mb-4 text-gray-600"></i><p class="text-gray-500 text-sm font-medium tracking-wide">Search for a director above to start tracking.</p></div>';
        return;
    }

    container.innerHTML = '<div class="text-center py-20 text-gray-500"><i class="fa-solid fa-spinner fa-spin text-4xl mb-4 text-netflix-red"></i><p class="font-bold tracking-widest uppercase text-xs">Generating roadmaps from global database...</p></div>';
    
    for (const dir of userProfile.roadmaps) {
        if (!directorFilmographies[dir.name]) {
            const data = await fetchFromTMDB(`/person/${dir.id}/movie_credits`);
            if (data && data.crew) {
                let movies = data.crew
                    .filter(c => c.job === 'Director' && !c.video)
                    .sort((a, b) => new Date(a.release_date || '2099-01-01') - new Date(b.release_date || '2099-01-01'));
                
                const uniqueIds = new Set();
                movies = movies.filter(m => {
                    if (uniqueIds.has(m.id)) return false;
                    uniqueIds.add(m.id);
                    return true;
                });
                
                directorFilmographies[dir.name] = movies.map(m => {
                    if (typeof normalizeTMDBItem === 'function') {
                        return normalizeTMDBItem(m, 'movie');
                    }
                    return { id: m.id, title: m.title, poster: m.poster_path ? TMDB_CONFIG.IMAGE_BASE + m.poster_path : '', year: m.release_date ? m.release_date.substring(0,4) : '' };
                });
                
                if (typeof allMedia !== 'undefined') {
                    directorFilmographies[dir.name].forEach(item => {
                        if (!allMedia.some(media => media.id === item.id)) allMedia.push(item);
                    });
                }
            }
        }
    }
    renderRoadmapsUI();
}

function renderRoadmapsUI() {
    const container = document.getElementById('roadmaps-container');
    if (!container) return;
    
    if (typeof userProfile === 'undefined' || !userProfile || !userProfile.roadmaps || userProfile.roadmaps.length === 0) {
        container.innerHTML = '<div class="text-center py-24 opacity-50 border border-dashed border-gray-800 rounded-xl"><i class="fa-solid fa-search text-3xl mb-4 text-gray-600"></i><p class="text-gray-500 text-sm font-medium tracking-wide">Search for a director above to start tracking.</p></div>';
        return;
    }
    
    container.innerHTML = userProfile.roadmaps.map(dir => {
        const movies = directorFilmographies[dir.name] || [];
        if (movies.length === 0) return '';
        
        let watchedCount = 0;
        
        const movieHtml = movies.map(m => {
            const isWatched = typeof userLogs !== 'undefined' && userLogs && userLogs.some(l => l.media && l.media.id === m.id);
            if (isWatched) watchedCount++;
            
            const safeTitle = m.title ? m.title.replace(/'/g, "&#39;").replace(/"/g, "&quot;") : "Unknown Title";
            const safeYear = m.year || '';
            const posterSrc = m.poster || 'https://via.placeholder.com/200x300/111/444?text=No+Poster';
            
            return `
                <div class="relative rounded-sm aspect-[2/3] overflow-hidden group cursor-pointer bg-[#111] ${isWatched ? 'border border-gray-600' : 'opacity-40 hover:opacity-100 grayscale hover:grayscale-0'} transition-all duration-300" onclick="openMediaPage('${m.id}')">
                    <img src="${posterSrc}" class="w-full h-full object-cover">
                    ${isWatched ? `<div class="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-md rounded-full w-5 h-5 flex items-center justify-center border border-gray-500/50"><i class="fa-solid fa-check text-[9px] text-white"></i></div>` : ''}
                    <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 flex flex-col justify-end p-2 transition-opacity">
                        <span class="text-gray-100 text-[9px] font-bold uppercase tracking-wider leading-tight line-clamp-2">${safeTitle}</span>
                        <span class="text-netflix-red text-[9px] font-black mt-0.5">${safeYear}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        const progressPct = Math.round((watchedCount / movies.length) * 100) || 0;
        const isMaster = progressPct === 100;
        
        return `
            <div class="bg-[#121212] border border-gray-800 rounded-lg p-6 md:p-8 shadow-sm relative group">
                <button onclick="removeDirector(${dir.id}, event)" class="absolute top-6 right-6 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>

                <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-gray-800/60 pb-5">
                    <div>
                        <h3 class="text-2xl font-bold text-gray-100 tracking-tight mb-1">${dir.name}</h3>
                        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">${watchedCount} of ${movies.length} Films Logged</p>
                    </div>
                    <div class="flex items-center gap-4 w-full md:w-auto">
                        <div class="w-full md:w-48 h-1 bg-gray-900 rounded-full overflow-hidden">
                            <div class="h-full ${isMaster ? 'bg-netflix-red' : 'bg-gray-400'} transition-all duration-1000 ease-out" style="width: ${progressPct}%"></div>
                        </div>
                        <span class="text-xs font-bold tracking-wider ${isMaster ? 'text-netflix-red' : 'text-gray-400'} w-8 text-right">${progressPct}%</span>
                    </div>
                </div>

                <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-2 md:gap-2.5">
                    ${movieHtml}
                </div>
            </div>
        `;
    }).join('');
}