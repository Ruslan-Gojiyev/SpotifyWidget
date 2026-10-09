Spotify Widget

A lightweight desktop widget for controlling Spotify playback on Windows.

**Current version:** `v0.1.0-alpha`

This project is in early alpha development. Bugs and incomplete features are expected.

Features

- Display the currently playing track and artist.
- Display album artwork.
- Skip to the next or previous track.
- Play and pause playback.
- Spotify Web API integration.

Requirements

- Windows 10 or Windows 11.
- [Node.js](https://nodejs.org/) and npm.
- A Spotify account.
- A Spotify application registered in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

How to run

 1. Download the project

Click **Code → Download ZIP** on this repository page and extract the archive.

 2. Install dependencies

Open a terminal in the project folder and run:

```bash
npm install
```

 3. Configure Spotify

Create an application in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and obtain its Client ID.

Add this Redirect URI to the application settings:

`http://127.0.0.1:8888/callback`

Create a local `spotify-config.json` file in the project root. Use the exact configuration format expected by the application.

This file is intentionally excluded from the repository.

### 4. Start the widget

Run:

```bash
npm start
```

Follow the Spotify authorization prompts if they appear.

Built with

- Electron
- JavaScript
- HTML and CSS
- Spotify Web API
- Node.js

Roadmap

- Standalone Windows executable (`.exe`).
- Improved interface and visual design.
- UI customization.
- Support for additional music streaming services.

Project status

**Alpha** — intended primarily for experimentation and testing while development continues.

License

No separate license has been added yet.
