/**
 * YouTube Embed Player & YouTube Music Miniplayer
 * Supports youtube-nocookie.com domain and strict-origin-when-cross-origin referrerpolicy
 */

const EmbeddedMediaBox = {
  defaultVideoId: 'jfKfPfyJRdk',

  init(settings = {}) {
    settings = settings || {};
    const input = document.getElementById('youtubeUrlInput');
    const savedVideoId = settings.youtubeVideoId;
    const initialUrl = typeof savedVideoId === 'string' && savedVideoId
      ? savedVideoId
      : this.defaultVideoId;
    if (input) input.value = initialUrl.includes('://')
      ? initialUrl
      : `https://www.youtube.com/watch?v=${initialUrl}`;
    this.loadVideo(initialUrl);
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
      const message = document.getElementById('youtubePlayerMessage');
      if (message) {
        message.textContent = 'For embedded playback, run npm start and open http://localhost:3000.';
      }
    }
    this.bindEvents();
  },

  getEmbedUrl(value) {
    const trimmedValue = value.trim();
    if (/^[\w-]{11}$/.test(trimmedValue)) {
      return `https://www.youtube-nocookie.com/embed/${trimmedValue}`;
    }

    let url;
    try {
      url = new URL(
        trimmedValue.includes('://') ? trimmedValue : `https://${trimmedValue}`
      );
    } catch {
      return null;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    const allowedHosts = new Set([
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'music.youtube.com',
      'youtu.be',
      'www.youtu.be',
      'youtube-nocookie.com',
      'www.youtube-nocookie.com'
    ]);
    if (!allowedHosts.has(url.hostname)) return null;

    let videoId = url.searchParams.get('v');
    if (url.hostname.endsWith('youtu.be')) {
      videoId = url.pathname.split('/').filter(Boolean)[0] || null;
    } else if (!videoId) {
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(pathParts[0])) {
        videoId = pathParts[1] || null;
      }
    }

    const playlistId = url.searchParams.get('list');
    if (videoId && /^[\w-]{11}$/.test(videoId)) {
      const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
      if (playlistId && /^[\w-]+$/.test(playlistId)) {
        embedUrl.searchParams.set('list', playlistId);
      }
      return embedUrl.toString();
    }

    if (playlistId && /^[\w-]+$/.test(playlistId)) {
      const embedUrl = new URL('https://www.youtube-nocookie.com/embed/videoseries');
      embedUrl.searchParams.set('list', playlistId);
      return embedUrl.toString();
    }

    return null;
  },

  loadVideo(value) {
    const frame = document.getElementById('youtubePlayerFrame');
    const message = document.getElementById('youtubePlayerMessage');
    const embedUrl = this.getEmbedUrl(value);
    if (!embedUrl) {
      if (message) message.textContent = 'Enter a valid YouTube or YouTube Music song / playlist link.';
      return false;
    }

    if (frame) {
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      frame.src = embedUrl;
    }
    if (message) message.textContent = '';
    return true;
  },

  bindEvents() {
    const input = document.getElementById('youtubeUrlInput');
    const button = document.getElementById('loadYouTubeBtn');
    if (!input || !button) return;

    const load = () => this.loadVideo(input.value);
    button.addEventListener('click', load);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') load();
    });
  }
};
