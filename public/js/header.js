/**
 * Header Module
 * Notion-Style visual banner with:
 * 1. STRICT TRUE FULL-CIRCLE profile avatar (avatar image & fallback initial)
 * 2. Banner image repositioning & dimension adjustment (drag / slider & save)
 * 3. Daily Random Text System:
 *    - Trigger: Daily timer triggering at 00:00 (midnight) based on local device timezone
 *    - API Action Block: Invokes external public REST API (api.adviceslip.com / dummyjson.com) live over the web
 *    - UI Refresh Binding: Binds response directly to #studioSubtitleText on load and at midnight
 */

const NotionHeader = {
  profileData: {},
  isRepositioning: false,
  tempCoverPos: 50,
  midnightTimerId: null,

  init(profile) {
    this.profileData = profile || {};
    const uid = (window.API && API.getUserId) ? API.getUserId() : 'guest-default';
    const localPos = localStorage.getItem(`studio_cover_pos_${uid}`);
    if (localPos !== null) {
      this.profileData.coverPosition = localPos;
    }
    this.render();
    this.initDailyApiTextSystem();
    this.bindEvents();
    this.bindRepositionEvents();
  },

  render() {
    const bannerImg = document.getElementById('notionBannerImg');
    const avatarWrapper = document.getElementById('notionAvatarWrapper');
    const avatarContainer = document.getElementById('notionAvatarContainer');
    const studioTitle = document.getElementById('studioTitleText');

    // 1. Cover Image and Repositioning position
    if (bannerImg) {
      if (this.profileData.coverUrl) {
        bannerImg.src = this.profileData.coverUrl;
      }
      const pos = this.profileData.coverPosition !== undefined ? this.profileData.coverPosition : 50;
      bannerImg.style.objectPosition = `center ${pos}%`;
    }

    // 2. Profile Avatar: STRICT TRUE FULL CIRCLE
    if (avatarWrapper) {
      avatarWrapper.style.cssText = 'border-radius: 50% !important; aspect-ratio: 1 / 1 !important; overflow: hidden !important; width: 68px !important; height: 68px !important;';
    }

    if (avatarContainer) {
      avatarContainer.style.cssText = 'border-radius: 50% !important; aspect-ratio: 1 / 1 !important; overflow: hidden !important; width: 100% !important; height: 100% !important;';

      if (this.profileData.avatarUrl) {
        avatarContainer.innerHTML = `
          <img 
            src="${this.profileData.avatarUrl}" 
            alt="Profile Photo" 
            class="w-full h-full object-cover rounded-full aspect-square block pointer-events-none select-none"
            style="border-radius: 50% !important; aspect-ratio: 1 / 1 !important; width: 100% !important; height: 100% !important; object-fit: cover !important;"
          />
        `;
      } else {
        const initial = (this.profileData.title || 'Student').trim().charAt(0).toUpperCase() || 'S';
        avatarContainer.innerHTML = `
          <div 
            class="w-full h-full rounded-full bg-stone-100 text-stone-800 font-bold flex items-center justify-center text-xl aspect-square select-none"
            style="border-radius: 50% !important; aspect-ratio: 1 / 1 !important; width: 100% !important; height: 100% !important;"
          >
            ${initial}
          </div>
        `;
      }
    }

    // 3. Studio Title
    if (studioTitle) {
      studioTitle.textContent = this.profileData.title || 'Student Design Studio';
    }
  },

  /**
   * Daily Random Text System
   * 1. Trigger: Timer scheduled for 00:00 midnight based on local device timezone
   * 2. API Action Block: Fetches a fresh phrase from public web REST APIs
   * 3. UI Refresh Binding: Updates #studioSubtitleText instantly
   */
  async initDailyApiTextSystem() {
    await this.refreshDailyPhrase(false);
    this.scheduleMidnightTimer();
  },

  scheduleMidnightTimer() {
    if (this.midnightTimerId) clearTimeout(this.midnightTimerId);

    const now = new Date();
    // Midnight 00:00:00 of the next calendar day in user's local timezone
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 100);
    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());

    this.midnightTimerId = setTimeout(async () => {
      // Midnight trigger fires: invoke external API data call and refresh UI
      await this.refreshDailyPhrase(true);
      // Re-arm for subsequent 24h cycle
      this.scheduleMidnightTimer();
    }, msUntilMidnight);
  },

  async fetchExternalRandomPhrase() {
    // Primary: Advice Slip Public REST API
    try {
      const res = await fetch('https://api.adviceslip.com/advice', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json?.slip?.advice) {
          return json.slip.advice;
        }
      }
    } catch (err) {
      console.warn('Primary advice API unreachable, trying fallback...', err);
    }

    // Fallback: DummyJSON Quotes Public REST API
    try {
      const res2 = await fetch('https://dummyjson.com/quotes/random', { cache: 'no-store' });
      if (res2.ok) {
        const json2 = await res2.json();
        if (json2?.quote) {
          return `"${json2.quote}" — ${json2.author || 'Unknown'}`;
        }
      }
    } catch (err2) {
      console.warn('Secondary quotes API unreachable:', err2);
    }

    // Offline resilient fallback
    return "Focus on being productive instead of busy. Consistency leads to mastery.";
  },

  async refreshDailyPhrase(forceFetch = false) {
    const subtitleEl = document.getElementById('studioSubtitleText');
    if (!subtitleEl) return;

    const todayDateKey = new Date().toISOString().slice(0, 10);
    const cacheKey = `daily_web_phrase_${todayDateKey}`;

    let phraseText = localStorage.getItem(cacheKey);

    // If midnight triggered or no cached phrase for today, call external REST API live
    if (!phraseText || forceFetch) {
      subtitleEl.textContent = "Updating daily phrase...";
      phraseText = await this.fetchExternalRandomPhrase();
      localStorage.setItem(cacheKey, phraseText);
    }

    // UI Refresh Binding
    subtitleEl.textContent = phraseText;
    subtitleEl.title = `Daily phrase live from web API • Refreshes daily at 00:00 local time`;
  },

  bindEvents() {
    // Open Change Cover Modal
    const changeCoverBtn = document.getElementById('changeCoverBtn');
    const coverModal = document.getElementById('coverModal');
    const closeCoverModalBtn = document.getElementById('closeCoverModalBtn');

    if (changeCoverBtn && coverModal) {
      changeCoverBtn.addEventListener('click', () => coverModal.classList.remove('hidden'));
    }
    if (closeCoverModalBtn && coverModal) {
      closeCoverModalBtn.addEventListener('click', () => coverModal.classList.add('hidden'));
    }

    // Cover File Upload (with automatic offline FileReader base64 fallback)
    const coverFileInput = document.getElementById('coverFileInput');
    if (coverFileInput) {
      coverFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const res = await API.uploadCover(file);
          if (res.success) {
            this.profileData.coverUrl = res.coverUrl;
            this.render();
            if (coverModal) coverModal.classList.add('hidden');
          }
        } catch (err) {
          alert('Failed to upload cover: ' + err.message);
        }
      });
    }

    // Custom Cover URL Submit
    const applyCoverUrlBtn = document.getElementById('applyCoverUrlBtn');
    const customCoverUrlInput = document.getElementById('customCoverUrlInput');
    if (applyCoverUrlBtn && customCoverUrlInput) {
      applyCoverUrlBtn.addEventListener('click', async () => {
        const url = customCoverUrlInput.value.trim();
        if (!url) return;
        this.profileData.coverUrl = url;
        this.render();
        await API.updateProfile({ coverUrl: url });
        customCoverUrlInput.value = '';
        if (coverModal) coverModal.classList.add('hidden');
      });
    }

    // Avatar Click (Open Avatar Modal)
    const avatarWrapper = document.getElementById('notionAvatarWrapper');
    const avatarModal = document.getElementById('avatarModal');
    const closeAvatarModalBtn = document.getElementById('closeAvatarModalBtn');

    if (avatarWrapper && avatarModal) {
      avatarWrapper.addEventListener('click', () => avatarModal.classList.remove('hidden'));
    }
    if (closeAvatarModalBtn && avatarModal) {
      closeAvatarModalBtn.addEventListener('click', () => avatarModal.classList.add('hidden'));
    }

    // Avatar File Upload
    const avatarFileInput = document.getElementById('avatarFileInput');
    if (avatarFileInput) {
      avatarFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const res = await API.uploadAvatar(file);
          if (res.success) {
            this.profileData.avatarUrl = res.avatarUrl;
            this.render();
            if (avatarModal) avatarModal.classList.add('hidden');
          }
        } catch (err) {
          alert('Failed to upload avatar: ' + err.message);
        }
      });
    }

    // Manual Refresh Dice Button for Daily Phrase (visual test trigger)
    const refreshPhraseBtn = document.getElementById('refreshDailyPhraseBtn');
    if (refreshPhraseBtn) {
      refreshPhraseBtn.addEventListener('click', async () => {
        refreshPhraseBtn.classList.add('animate-spin');
        await this.refreshDailyPhrase(true);
        setTimeout(() => refreshPhraseBtn.classList.remove('animate-spin'), 600);
      });
    }

    // Edit Title Modal
    const editStudioMetaBtn = document.getElementById('editStudioMetaBtn');
    const metaModal = document.getElementById('studioMetaModal');
    const closeMetaModalBtn = document.getElementById('closeStudioMetaModalBtn');
    const saveMetaBtn = document.getElementById('saveStudioMetaBtn');
    const editTitleInput = document.getElementById('editTitleInput');

    if (editStudioMetaBtn && metaModal) {
      editStudioMetaBtn.addEventListener('click', () => {
        if (editTitleInput) editTitleInput.value = this.profileData.title || '';
        metaModal.classList.remove('hidden');
      });
    }

    if (closeMetaModalBtn && metaModal) {
      closeMetaModalBtn.addEventListener('click', () => metaModal.classList.add('hidden'));
    }

    if (saveMetaBtn && metaModal) {
      saveMetaBtn.addEventListener('click', async () => {
        const title = editTitleInput.value.trim() || 'Student Design Studio';
        this.profileData.title = title;
        const uid = API.getUserId();
        localStorage.setItem(`studio_title_${uid}`, title);
        this.render();
        await API.updateProfile({ title });
        metaModal.classList.add('hidden');
      });
    }
  },

  /**
   * Banner Repositioning & Dimension Adjustment
   * Lets user drag the image vertically or use the slider, then saves the preference.
   */
  bindRepositionEvents() {
    const repositionBtn = document.getElementById('repositionCoverBtn');
    const repositionBar = document.getElementById('coverRepositionBar');
    const savePosBtn = document.getElementById('saveCoverPosBtn');
    const cancelPosBtn = document.getElementById('cancelCoverPosBtn');
    const posSlider = document.getElementById('coverPosSlider');
    const bannerContainer = document.getElementById('notionBannerContainer');
    const bannerImg = document.getElementById('notionBannerImg');

    if (!repositionBtn || !repositionBar || !bannerImg) return;

    // Start Repositioning Mode
    repositionBtn.addEventListener('click', () => {
      this.isRepositioning = true;
      this.tempCoverPos = parseFloat(this.profileData.coverPosition !== undefined ? this.profileData.coverPosition : 50);
      if (posSlider) posSlider.value = this.tempCoverPos;
      repositionBar.classList.remove('hidden');
      bannerImg.classList.add('cursor-grab');
    });

    // Slider adjustment
    if (posSlider) {
      posSlider.addEventListener('input', (e) => {
        if (!this.isRepositioning) return;
        this.tempCoverPos = parseFloat(e.target.value);
        bannerImg.style.objectPosition = `center ${this.tempCoverPos}%`;
      });
    }

    // Direct Mouse / Touch Dragging on the Banner
    let isDragging = false;
    let dragStartY = 0;
    let dragStartPos = 50;

    const onDragStart = (clientY) => {
      if (!this.isRepositioning) return;
      isDragging = true;
      dragStartY = clientY;
      dragStartPos = this.tempCoverPos;
      bannerImg.classList.remove('cursor-grab');
      bannerImg.classList.add('cursor-grabbing');
    };

    const onDragMove = (clientY) => {
      if (!isDragging || !this.isRepositioning) return;
      const deltaY = clientY - dragStartY;
      const containerHeight = bannerContainer ? bannerContainer.clientHeight : 240;
      const percentDelta = (deltaY / containerHeight) * 100;
      let newPos = Math.max(0, Math.min(100, dragStartPos - percentDelta));
      this.tempCoverPos = Math.round(newPos);
      bannerImg.style.objectPosition = `center ${this.tempCoverPos}%`;
      if (posSlider) posSlider.value = this.tempCoverPos;
    };

    const onDragEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      bannerImg.classList.remove('cursor-grabbing');
      bannerImg.classList.add('cursor-grab');
    };

    bannerContainer?.addEventListener('mousedown', (e) => onDragStart(e.clientY));
    window.addEventListener('mousemove', (e) => onDragMove(e.clientY));
    window.addEventListener('mouseup', onDragEnd);

    bannerContainer?.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) onDragStart(e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) onDragMove(e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchend', onDragEnd);

    // Save Position
    savePosBtn?.addEventListener('click', async () => {
      this.profileData.coverPosition = this.tempCoverPos;
      this.isRepositioning = false;
      repositionBar.classList.add('hidden');
      bannerImg.classList.remove('cursor-grab', 'cursor-grabbing');

      const uid = (window.API && API.getUserId) ? API.getUserId() : 'guest-default';
      localStorage.setItem(`studio_cover_pos_${uid}`, this.tempCoverPos);
      await API.updateProfile({ coverPosition: this.tempCoverPos });

      const toast = document.getElementById('globalToast');
      if (toast) {
        toast.textContent = 'Banner position saved!';
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
      }
    });

    // Cancel Position
    cancelPosBtn?.addEventListener('click', () => {
      this.isRepositioning = false;
      repositionBar.classList.add('hidden');
      bannerImg.classList.remove('cursor-grab', 'cursor-grabbing');
      const savedPos = this.profileData.coverPosition !== undefined ? this.profileData.coverPosition : 50;
      bannerImg.style.objectPosition = `center ${savedPos}%`;
      if (posSlider) posSlider.value = savedPos;
    });
  }
};
