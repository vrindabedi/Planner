/**
 * inject-ytmusic.js
 * Isolated CSS and DOM injection script for embedded YouTube / YouTube Music.
 * Hides standard YouTube top header, banners, and video player canvas,
 * leaving only the song list, library, search bar, and media playback controls visible.
 */

(function () {
  function applyStyles() {
    if (document.getElementById('ytm-custom-minimal-injector')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'ytm-custom-minimal-injector';
    styleEl.textContent = `
      /* ============================================================
         1. Hide Standard Video Canvas, Ambient Glow & Big Video Windows
         ============================================================ */
      #player-page ytd-player,
      #player,
      .html5-video-player video,
      #cinematics,
      #movie_player .ytp-chrome-top,
      #movie_player .ytp-pause-overlay,
      ytmusic-player-page #player,
      ytmusic-player[player-ui-state="FULLSCREEN"],
      .song-media-window,
      ytd-player #container {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        max-height: 0 !important;
        opacity: 0 !important;
      }

      /* ============================================================
         2. Hide Standard YouTube Top Header / Masthead & Clutter
         ============================================================ */
      #masthead-container,
      ytd-masthead,
      #header.ytd-app,
      ytmusic-nav-bar #left-content ytmusic-logo,
      #guide-wrapper,
      ytd-mini-guide-renderer,
      #chips-wrapper,
      ytmusic-guide-section-renderer[is-divider],
      .ytmusic-nav-bar-extra {
        display: none !important;
      }

      /* Remove top margin left behind by hidden masthead */
      #page-manager,
      ytd-app,
      ytmusic-app,
      #content,
      #main-panel {
        margin-top: 0 !important;
        padding-top: 0 !important;
      }

      /* ============================================================
         3. Keep Search Bar Prominent & Usable at the Top
         ============================================================ */
      ytmusic-search-box,
      #center.ytd-masthead,
      ytd-searchbox {
        display: flex !important;
        position: sticky !important;
        top: 0 !important;
        z-index: 9999 !important;
        background: #0f0f0f !important;
        padding: 8px 16px !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      /* ============================================================
         4. Ensure Bottom Media Controls & Player Bar are Always Visible
         ============================================================ */
      ytmusic-player-bar,
      #player-bar-background,
      .ytmusic-player-bar {
        display: flex !important;
        visibility: visible !important;
        z-index: 10000 !important;
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        background: #181818 !important;
        border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
      }

      /* ============================================================
         5. Keep Playlists, Song Lists, & Library Clean and Scrollable
         ============================================================ */
      ytmusic-browse-response,
      #contents.ytmusic-section-list-renderer,
      #contents.ytd-item-section-renderer,
      #items.ytmusic-grid-renderer {
        padding-bottom: 96px !important; /* Reserve clearance for bottom controls */
      }

      /* Subtle scrollbars */
      ::-webkit-scrollbar {
        width: 6px !important;
      }
      ::-webkit-scrollbar-thumb {
        background: #333 !important;
        border-radius: 4px !important;
      }
    `;

    if (document.head) {
      document.head.appendChild(styleEl);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.head.appendChild(styleEl);
      });
    }
  }

  // Run immediately and whenever YouTube dynamically swaps page states
  applyStyles();
  window.addEventListener('DOMContentLoaded', applyStyles);
  window.addEventListener('yt-page-data-updated', applyStyles);
  window.addEventListener('yt-navigate-finish', applyStyles);

  // Periodic safeguard for YouTube Single Page Application navigations
  setInterval(applyStyles, 1500);
})();

