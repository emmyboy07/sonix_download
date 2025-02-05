require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { scrape1337x } = require('./scraper');
const WebTorrent = require('webtorrent');
const path = require('path');
const sanitize = require('sanitize-html');

const app = express();
const client = new WebTorrent();
const PORT = process.env.PORT || 3000;
const activeTorrents = new Map();

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(express.static('public'));

// Search for torrents
app.get('/api/search', async (req, res) => {
    try {
        const query = sanitize(req.query.q);
        if (!query) return res.status(400).json({ error: 'Search query required' });

        console.log(`Searching for: ${query}`);
        const results = await scrape1337x(query);
        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search' });
    }
});

// Download a torrent
app.get('/api/download', async (req, res) => {
    try {
        const magnet = sanitize(req.query.magnet);
        if (!magnet) return res.status(400).json({ error: 'Magnet link required' });

        console.log(`Adding torrent: ${magnet.slice(0, 50)}...`);
        const torrent = client.add(magnet, { path: process.env.DOWNLOAD_DIR || './downloads' });

        activeTorrents.set(torrent.infoHash, torrent);

        torrent.on('ready', () => {
            console.log(`Torrent ready: ${torrent.infoHash}`);
            const videoFile = torrent.files.find(file => file.name.match(/\.(mp4|mkv|avi)$/));

            if (!videoFile) return res.status(404).json({ error: 'No video file found' });
            res.json({ infoHash: torrent.infoHash, fileName: videoFile.name });
        });

        torrent.on('error', error => {
            console.error('Torrent error:', error);
            res.status(500).json({ error: 'Torrent download failed' });
        });
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

// Track download progress
app.get('/api/progress/:infoHash', (req, res) => {
    const torrent = activeTorrents.get(req.params.infoHash);
    if (!torrent) return res.status(404).json({ error: 'Torrent not found' });

    res.json({
        progress: Math.round(torrent.progress * 100),
        done: torrent.done
    });
});

// Stream a torrent file
app.get('/stream/:infoHash', (req, res) => {
    const torrent = activeTorrents.get(req.params.infoHash);
    if (!torrent) return res.status(404).send('Torrent not found');

    const file = torrent.files.find(f => f.name === req.query.file);
    if (!file) return res.status(404).send('File not found');

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    
    const stream = file.createReadStream();
    
    stream.pipe(res);

    // Handle stream errors
    stream.on('error', (error) => {
        console.error('Streaming error:', error);
        res.end(); // End the response safely
    });

    res.on('close', () => {
        console.log('Stream closed by client');
        stream.destroy(); // Ensure cleanup
    });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
