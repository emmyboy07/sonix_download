const API_BASE_URL = 'https://your-deployed-backend.com'; // Change this to your actual backend URL

async function searchMovies() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    clearError();
    showLoading(true);

    try {
        const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
        const results = await response.json();
        
        if (results.error) throw new Error(results.error);
        displayResults(results);
        
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

async function startDownload(magnet) {
    clearError();
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/download?magnet=${encodeURIComponent(magnet)}`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        setupPlayer(data.fileName, data.infoHash);
        trackProgress(data.infoHash);
    
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

function setupPlayer(fileName, infoHash) {
    document.getElementById('playerContainer').classList.remove('hidden');
    const streamUrl = `${API_BASE_URL}/stream/${infoHash}?file=${encodeURIComponent(fileName)}`;
    document.getElementById('videoSource').src = streamUrl;
    document.getElementById('videoPlayer').load();
}

function trackProgress(infoHash) {
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/progress/${infoHash}`);
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            document.getElementById('progress').textContent = Math.round(data.progress);
            document.getElementById('status').textContent = data.done ? 'Ready' : 'Downloading...';

            if (data.done) clearInterval(interval);
        } catch (error) {
            console.error('Progress tracking error:', error);
            clearInterval(interval);
        }
    }, 1000);
}

async function fetchDownloadedMovies() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/downloaded-movies`);
        const movies = await response.json();
        displayMovies(movies);
    } catch (error) {
        console.error('Error fetching movies:', error);
    }
}

function displayMovies(movies) {
    const container = document.getElementById('movieList');
    container.innerHTML = movies.map(movie => `
        <div class="movie-card">
            <h3>${movie}</h3>
            <button onclick="playMovie('${movie}')">Watch</button>
        </div>
    `).join('');
}

function playMovie(movie) {
    document.getElementById('playerContainer').classList.remove('hidden');
    document.getElementById('videoSource').src = `${API_BASE_URL}/stream-movie?file=${encodeURIComponent(movie)}`;
    document.getElementById('videoPlayer').load();
}

// UI Helpers
function showLoading(show) {
    document.getElementById('searchInput').disabled = show;
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
}

function clearError() {
    document.getElementById('errorMessage').textContent = '';
}
