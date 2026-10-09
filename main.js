
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { createServer } = require('http');
const { randomBytes, createHash } = require('crypto');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'spotify-config.json'), 'utf8')
);

const redirectUri = 'http://127.0.0.1:8888/callback';
const scopes = [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-modify-playback-state'
].join(' ');

let accessToken = null;
let refreshToken = null;
let tokenExpiresAt = 0;

function createWindow() {
    const win = new BrowserWindow({
        width: 400,
        height: 250,
        resizable: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile('index.html');
}

async function connectSpotify() {
    if (!config.clientId || config.clientId.includes('ВСТАВЬ_')) {
        throw new Error('Проверь Client ID в spotify-config.json');
    }

    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256')
        .update(verifier)
        .digest('base64url');
    const state = randomBytes(16).toString('hex');

    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('code_challenge', challenge);

    const server = createServer(async (req, res) => {
        const url = new URL(req.url, redirectUri);

        if (url.pathname !== '/callback') {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        if (url.searchParams.get('state') !== state) {
            res.writeHead(400);
            res.end('Invalid state. You can close this window.');
            return;
        }

        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error || !code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('Spotify authorization failed. You can close this window.');
            return;
        }

        try {
            const response = await fetch(
                'https://accounts.spotify.com/api/token',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        client_id: config.clientId,
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: redirectUri,
                        code_verifier: verifier
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error_description || data.error || 'Token error');
            }

            accessToken = data.access_token;
            refreshToken = data.refresh_token || refreshToken;
            tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000;

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h2>Spotify connected!</h2><p>You can close this window.</p>');

            resolveAuth();
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Could not connect to Spotify. Return to the widget and try again.');
            rejectAuth(err);
        }
    });

    let resolveAuth;
    let rejectAuth;

    const result = new Promise((resolve, reject) => {
        resolveAuth = resolve;
        rejectAuth = reject;
    });

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(8888, '127.0.0.1', resolve);
    });

    try {
        await shell.openExternal(authUrl.toString());
        await result;
        return { success: true };
    } finally {
        server.close();
    }
}

async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiresAt) {
        return accessToken;
    }

    if (!refreshToken) {
        throw new Error('Сначала подключи Spotify');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: config.clientId,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error_description || 'Не удалось обновить токен');
    }

    accessToken = data.access_token;
    refreshToken = data.refresh_token || refreshToken;
    tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000;

    return accessToken;
}

async function spotifyRequest(endpoint, options = {}) {
    const token = await getAccessToken();

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers
        }
    });

    if (response.status === 204) {
        return null;
    }

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Spotify API ${response.status}: ${message}`);
    }

    return response.json();
}

ipcMain.handle('spotify:connect', connectSpotify);

ipcMain.handle('spotify:current-track', async () => {
    const data = await spotifyRequest('/me/player/currently-playing');

    if (!data || !data.item) {
        return null;
    }

    return {
        title: data.item.name,
        artist: data.item.artists.map(artist => artist.name).join(', '),
        album: data.item.album.name,
        cover: data.item.album.images[0]?.url || null,
        isPlaying: data.is_playing
    };
});

ipcMain.handle('spotify:control', async (_event, action) => {
    const endpoints = {
        play: ['/me/player/play', 'PUT'],
        pause: ['/me/player/pause', 'PUT'],
        next: ['/me/player/next', 'POST'],
        previous: ['/me/player/previous', 'POST']
    };

    if (!endpoints[action]) {
        throw new Error('Неизвестная команда');
    }

    const [endpoint, method] = endpoints[action];
    await spotifyRequest(endpoint, { method });

    return { success: true };
});

app.whenReady().then(createWindow);
