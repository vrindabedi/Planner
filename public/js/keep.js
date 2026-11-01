/**
 * Google Keep Style Notes Grid Module
 * Full Keep card aesthetics, expandable creator bar, reading/editing modal,
 * fields for reminders, YouTube/Spotify player links, direct text, and checklists.
 */

const KeepNotes = {
  notes: [],
  selectedColor: '#FFFFFF',
  isPinned: false,
  activeNoteId: null,
  creatorImageDataUrl: null,  // holds base64 image for new note
  modalImageDataUrl: null,    // holds base64 image for modal edit

  init(notes) {
    this.notes = notes || [];
    this.render();
    this.bindEvents();
  },

  render() {
    const pinnedGrid = document.getElementById('pinnedNotesGrid');
    const otherGrid = document.getElementById('otherNotesGrid');
    const pinnedSection = document.getElementById('pinnedNotesSection');
    const otherSection = document.getElementById('otherNotesSection');
    const countBadge = document.getElementById('notesCountBadge');

    if (countBadge) countBadge.textContent = this.notes.length;

    const pinnedNotes = this.notes.filter(n => n.pinned);
    const otherNotes = this.notes.filter(n => !n.pinned);

    if (pinnedSection) {
      pinnedSection.style.display = pinnedNotes.length > 0 ? 'block' : 'none';
    }

    if (pinnedGrid) {
      pinnedGrid.innerHTML = pinnedNotes.map(n => this.renderNoteCardHtml(n)).join('');
    }

    if (otherGrid) {
      if (this.notes.length === 0) {
        otherGrid.innerHTML = `
          <div class="col-span-full py-12 text-center text-stone-400 text-xs rounded-2xl border-2 border-dashed border-stone-200/80 bg-white/50">
            <p class="font-medium text-stone-600">No notes yet</p>
            <p class="text-[11px] text-stone-400 mt-0.5">Use "Take a note..." above to add your first note</p>
          </div>
        `;
      } else {
        otherGrid.innerHTML = otherNotes.map(n => this.renderNoteCardHtml(n)).join('');
      }
    }

    lucide.createIcons();
    this.bindCardClicks();
  },

  renderNoteCardHtml(n) {
    const isDark = n.color === '#18181B' || n.color === '#1E293B';
    const textColor = isDark ? 'text-stone-100' : 'text-stone-800';
    const subtextColor = isDark ? 'text-stone-400' : 'text-stone-500';
    const borderColor = isDark ? 'border-stone-700' : 'border-stone-200/80';

    // Checklist preview HTML
    let checklistHtml = '';
    if (n.checklist && n.checklist.length > 0) {
      checklistHtml = `
        <div class="mt-2 space-y-1">
          ${n.checklist.map(item => `
            <label class="flex items-start gap-2 text-xs cursor-pointer select-none" onclick="event.stopPropagation()">
              <input type="checkbox" data-note-id="${n.id}" data-item-id="${item.id}" class="keep-check-item mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-0" ${item.done ? 'checked' : ''} />
              <span class="${item.done ? 'line-through opacity-50' : ''} ${textColor}">${this.escapeHtml(item.text)}</span>
            </label>
          `).join('')}
        </div>
      `;
    }

    // Code snippet preview HTML
    let codeHtml = '';
    if (n.code) {
      codeHtml = `
        <div class="mt-2.5 p-2 rounded-lg bg-stone-900 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-stone-800" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between text-[10px] text-stone-500 mb-1 border-b border-stone-800 pb-0.5">
            <span>${n.codeLang || 'code'}</span>
            <span class="text-stone-400">snippet</span>
          </div>
          <pre><code>${this.escapeHtml(n.code)}</code></pre>
        </div>
      `;
    }

    // Media / Image preview HTML
    let imageHtml = '';
    if (n.imageUrl) {
      imageHtml = `
        <div class="w-full mb-3 rounded-xl overflow-hidden bg-black/5 aspect-[4/3]">
          <img src="${n.imageUrl}" alt="Note attachment" class="w-full h-full object-cover object-center" />
        </div>
      `;
    }

    // Embedded Player / Link Badge HTML
    let playerLinkHtml = '';
    if (n.playerLink) {
      const isSpotify = n.playerLink.includes('spotify');
      const isYt = n.playerLink.includes('youtube') || n.playerLink.includes('youtu.be');
      const badgeIcon = isSpotify ? '🎧 Spotify' : (isYt ? '▶ YouTube' : '🔗 Link');
      playerLinkHtml = `
        <div class="mt-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${isDark ? 'bg-stone-800 text-stone-200' : 'bg-stone-100 text-stone-700'} text-[11px] font-medium" onclick="event.stopPropagation()">
          <span>${badgeIcon}</span>
          <a href="${n.playerLink}" target="_blank" rel="noopener noreferrer" class="truncate hover:underline text-blue-500 font-mono text-[10px]">${this.escapeHtml(n.playerLink)}</a>
        </div>
      `;
    }

    // Reminder Alarm Badge HTML
    let alarmHtml = '';
    if (n.alarmTime) {
      const alarmDate = new Date(n.alarmTime);
      const formattedTime = alarmDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const repeatText = (n.alarmRepeat && n.alarmRepeat !== 'none') ? ` • ${n.alarmRepeat}` : '';
      alarmHtml = `
        <div class="mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer hover:bg-rose-100 transition" onclick="event.stopPropagation(); KeepNotes.openAlarmModal('${n.id}')" title="Reminder alarm set for ${formattedTime}. Click to change.">
          <i data-lucide="bell" class="w-3 h-3 fill-rose-600 text-rose-600"></i>
          <span>${formattedTime}${repeatText}</span>
        </div>
      `;
    }

    return `
      <div 
        class="keep-card relative rounded-2xl p-4 border ${borderColor} shadow-xs cursor-pointer group flex flex-col justify-between break-inside-avoid w-full"
        style="background-color: ${n.color || '#FFFFFF'};"
        data-note-id="${n.id}"
      >
        <div>
          ${imageHtml}
          
          <div class="flex items-start justify-between gap-2">
            <h4 class="font-bold text-sm ${textColor} leading-snug">${this.escapeHtml(n.title || '')}</h4>
            <button 
              class="keep-pin-btn p-1 rounded-md text-stone-400 hover:text-stone-900 transition opacity-0 group-hover:opacity-100 ${n.pinned ? '!opacity-100 text-stone-900' : ''}" 
              data-id="${n.id}"
              title="${n.pinned ? 'Unpin' : 'Pin'}"
              onclick="event.stopPropagation(); KeepNotes.togglePin('${n.id}')"
            >
              <i data-lucide="pin" class="w-3.5 h-3.5 ${n.pinned ? 'fill-current' : ''}"></i>
            </button>
          </div>

          ${n.body ? `<p class="mt-1 text-xs ${subtextColor} whitespace-pre-wrap leading-relaxed">${this.escapeHtml(n.body)}</p>` : ''}
          ${checklistHtml}
          ${codeHtml}
          ${playerLinkHtml}
          ${alarmHtml}
        </div>

        <!-- Keep Card Hover Action Toolbar -->
        <div class="pt-3 mt-3 border-t ${isDark ? 'border-stone-800' : 'border-stone-200/60'} flex items-center justify-between text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()">
          <div class="flex items-center gap-1">
            <!-- Reminder Button -->
            <button class="p-1 hover:text-stone-700 rounded" title="Set Reminder" onclick="KeepNotes.openAlarmModal('${n.id}')">
              <i data-lucide="bell-plus" class="w-3.5 h-3.5"></i>
            </button>
            <!-- Change Color -->
            <button class="p-1 hover:text-stone-700 rounded" title="Change Color" onclick="KeepNotes.cycleColor('${n.id}')">
              <i data-lucide="palette" class="w-3.5 h-3.5"></i>
            </button>
            <!-- Add Player Link -->
            <button class="p-1 hover:text-stone-700 rounded" title="Edit Note" onclick="KeepNotes.openEditModal('${n.id}')">
              <i data-lucide="square-pen" class="w-3.5 h-3.5"></i>
            </button>
          </div>

          <button class="p-1 hover:text-rose-600 rounded transition" title="Delete Note" onclick="KeepNotes.deleteNote('${n.id}')">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  },

  bindCardClicks() {
    document.querySelectorAll('.keep-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.noteId;
        this.openEditModal(id);
      });
    });

    // Checkbox clicks inside cards
    document.querySelectorAll('.keep-check-item').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const noteId = e.target.dataset.noteId;
        const itemId = e.target.dataset.itemId;
        const isChecked = e.target.checked;
        const note = this.notes.find(n => n.id === noteId);
        if (note && note.checklist) {
          const item = note.checklist.find(i => i.id === itemId);
          if (item) {
            item.done = isChecked;
            await API.updateNote(noteId, { checklist: note.checklist });
            this.render();
          }
        }
      });
    });
  },

  bindEvents() {
    const creatorBox = document.getElementById('keepCreatorBox');
    const titleInput = document.getElementById('newNoteTitle');
    const bodyInput = document.getElementById('newNoteBody');
    const mediaInput = document.getElementById('newNotePlayerLink');
    const expandedArea = document.getElementById('keepCreatorExpanded');
    const saveBtn = document.getElementById('saveNewNoteBtn');
    const closeBtn = document.getElementById('closeKeepCreatorBtn');
    const imagePreviewContainer = document.getElementById('noteCreatorImagePreview');
    const imagePreviewEl = document.getElementById('noteCreatorImageEl');

    // Expand creator on click/focus
    const expand = () => {
      if (expandedArea) expandedArea.classList.remove('hidden');
    };
    if (bodyInput) bodyInput.addEventListener('focus', expand);
    if (titleInput) titleInput.addEventListener('focus', expand);

    // Creator image file upload
    const imageInput = document.getElementById('noteCreatorImageInput');
    if (imageInput) {
      imageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        expand();
        const res = await API.uploadNoteImage(file);
        if (res.success) {
          this.creatorImageDataUrl = res.imageUrl;
          if (imagePreviewEl) imagePreviewEl.src = res.imageUrl;
          if (imagePreviewContainer) imagePreviewContainer.classList.remove('hidden');
        }
      });
    }

    // Ctrl+V paste image anywhere on page
    document.addEventListener('paste', async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          expand();
          const res = await API.uploadNoteImage(file);
          if (res.success) {
            this.creatorImageDataUrl = res.imageUrl;
            if (imagePreviewEl) imagePreviewEl.src = res.imageUrl;
            if (imagePreviewContainer) imagePreviewContainer.classList.remove('hidden');
            // Focus the creator
            if (bodyInput) bodyInput.focus();
          }
          break;
        }
      }
    });

    // Close / Collapse creator
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (expandedArea) expandedArea.classList.add('hidden');
        this.creatorImageDataUrl = null;
        if (imagePreviewEl) imagePreviewEl.src = '';
        if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
      });
    }

    // Toggle Code block
    const toggleCodeBtn = document.getElementById('toggleCodeSnippetBtn');
    const codeBlock = document.getElementById('codeSnippetCreatorBlock');
    if (toggleCodeBtn && codeBlock) {
      toggleCodeBtn.addEventListener('click', () => {
        codeBlock.classList.toggle('hidden');
      });
    }

    // Toggle Reminder Alarm section
    const toggleReminderBtn = document.getElementById('toggleNoteReminderBtn');
    const reminderContainer = document.getElementById('noteReminderInputContainer');
    if (toggleReminderBtn && reminderContainer) {
      toggleReminderBtn.addEventListener('click', () => {
        reminderContainer.classList.toggle('hidden');
      });
    }

    // Toggle Media Link input
    const toggleMediaLinkBtn = document.getElementById('toggleMediaLinkBtn');
    const mediaLinkContainer = document.getElementById('mediaLinkInputContainer');
    if (toggleMediaLinkBtn && mediaLinkContainer) {
      toggleMediaLinkBtn.addEventListener('click', () => {
        mediaLinkContainer.classList.toggle('hidden');
      });
    }

    // Pin Toggle in creator
    const pinBtn = document.getElementById('pinNewNoteBtn');
    if (pinBtn) {
      pinBtn.addEventListener('click', () => {
        this.isPinned = !this.isPinned;
        pinBtn.classList.toggle('text-stone-900', this.isPinned);
        pinBtn.classList.toggle('text-stone-400', !this.isPinned);
      });
    }

    // Color pickers in creator
    document.querySelectorAll('.note-color-pick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectedColor = e.target.dataset.color || '#FFFFFF';
        if (creatorBox) {
          creatorBox.style.backgroundColor = this.selectedColor;
        }
      });
    });

    // Save New Note
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        const body = bodyInput.value.trim();
        const playerLink = mediaInput ? mediaInput.value.trim() : '';
        const code = document.getElementById('newNoteCode') ? document.getElementById('newNoteCode').value : '';
        const codeLang = document.getElementById('codeLanguageSelect') ? document.getElementById('codeLanguageSelect').value : 'javascript';
        const alarmTimeInput = document.getElementById('newNoteAlarmTime');
        const alarmRepeatSelect = document.getElementById('newNoteAlarmRepeat');

        const alarmTime = (alarmTimeInput && alarmTimeInput.value) ? new Date(alarmTimeInput.value).toISOString() : null;
        const alarmRepeat = alarmRepeatSelect ? alarmRepeatSelect.value : 'none';

        if (!title && !body && !code && !playerLink && !this.creatorImageDataUrl && !alarmTime) {
          if (expandedArea) expandedArea.classList.add('hidden');
          return;
        }

        const newNoteData = {
          title,
          body,
          color: this.selectedColor,
          pinned: this.isPinned,
          playerLink,
          code,
          codeLang,
          imageUrl: this.creatorImageDataUrl || '',
          alarmTime: alarmTime,
          alarmRepeat: alarmRepeat,
          alarmDismissed: false,
          tags: ['General']
        };

        const res = await API.createNote(newNoteData);
        if (res.success && res.note) {
          this.notes.unshift(res.note);
        }

        // Reset Creator
        titleInput.value = '';
        bodyInput.value = '';
        if (mediaInput) mediaInput.value = '';
        if (document.getElementById('newNoteCode')) document.getElementById('newNoteCode').value = '';
        if (alarmTimeInput) alarmTimeInput.value = '';
        if (alarmRepeatSelect) alarmRepeatSelect.value = 'none';
        if (reminderContainer) reminderContainer.classList.add('hidden');
        this.selectedColor = '#FFFFFF';
        this.isPinned = false;
        this.creatorImageDataUrl = null;
        const imagePreviewEl = document.getElementById('noteCreatorImageEl');
        const imagePreviewContainer = document.getElementById('noteCreatorImagePreview');
        if (imagePreviewEl) imagePreviewEl.src = '';
        if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
        if (creatorBox) creatorBox.style.backgroundColor = '#FFFFFF';
        if (expandedArea) expandedArea.classList.add('hidden');
        const codeBlock = document.getElementById('codeSnippetCreatorBlock');
        const mediaLinkContainer = document.getElementById('mediaLinkInputContainer');
        if (codeBlock) codeBlock.classList.add('hidden');
        if (mediaLinkContainer) mediaLinkContainer.classList.add('hidden');

        this.render();
      });
    }

    // Search Notes Filter
    const searchNotesInput = document.getElementById('searchNotesInput');
    if (searchNotesInput) {
      searchNotesInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
          this.render();
          return;
        }
        const filtered = this.notes.filter(n =>
          (n.title && n.title.toLowerCase().includes(query)) ||
          (n.body && n.body.toLowerCase().includes(query)) ||
          (n.code && n.code.toLowerCase().includes(query)) ||
          (n.tags && n.tags.some(t => t.toLowerCase().includes(query)))
        );
        this.renderFiltered(filtered);
      });
    }

    // Note Modal Save & Close
    const modalCloseBtn = document.getElementById('closeNoteModalBtn');
    const modalSaveBtn = document.getElementById('saveNoteModalBtn');
    const modalDeleteBtn = document.getElementById('deleteNoteFromModalBtn');

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => this.closeEditModal());
    if (modalSaveBtn) modalSaveBtn.addEventListener('click', () => this.saveEditModalChanges());
    if (modalDeleteBtn) {
      modalDeleteBtn.addEventListener('click', () => {
        if (this.activeNoteId) {
          this.deleteNote(this.activeNoteId);
          this.closeEditModal();
        }
      });
    }
  },

  renderFiltered(filteredNotes) {
    const pinnedGrid = document.getElementById('pinnedNotesGrid');
    const otherGrid = document.getElementById('otherNotesGrid');
    const pinnedSection = document.getElementById('pinnedNotesSection');

    if (pinnedSection) pinnedSection.style.display = 'none';
    if (pinnedGrid) pinnedGrid.innerHTML = '';
    if (otherGrid) {
      otherGrid.innerHTML = filteredNotes.map(n => this.renderNoteCardHtml(n)).join('');
    }
    lucide.createIcons();
    this.bindCardClicks();
  },

  async togglePin(id) {
    const note = this.notes.find(n => n.id === id);
    if (!note) return;
    note.pinned = !note.pinned;
    await API.updateNote(id, { pinned: note.pinned });
    this.render();
  },

  async cycleColor(id) {
    const colors = ['#FFFFFF', '#FEF3C7', '#FEE2E2', '#DCFCE7', '#E0F2FE', '#F3E8FF', '#18181B'];
    const note = this.notes.find(n => n.id === id);
    if (!note) return;
    const curIdx = colors.indexOf(note.color);
    const nextColor = colors[(curIdx + 1) % colors.length];
    note.color = nextColor;
    await API.updateNote(id, { color: nextColor });
    this.render();
  },

  async deleteNote(id) {
    if (!confirm('Are you sure you want to delete this note?')) return;
    await API.deleteNote(id);
    this.notes = this.notes.filter(n => n.id !== id);
    this.render();
  },

  openAlarmModal(id) {
    const note = this.notes.find(n => n.id === id);
    if (!note) return;
    if (window.AudioAlarmModal) {
      window.AudioAlarmModal.open('note', id, note.title, note.alarmTime);
    }
  },

  // Full Note Modal (Read & Edit full text, links, checklists, code)
  openEditModal(id) {
    const note = this.notes.find(n => n.id === id);
    if (!note) return;
    this.activeNoteId = id;

    const modal = document.getElementById('noteDetailModal');
    const modalBox = document.getElementById('noteDetailModalBox');
    const titleInput = document.getElementById('modalNoteTitle');
    const bodyInput = document.getElementById('modalNoteBody');
    const mediaInput = document.getElementById('modalNotePlayerLink');
    const codeArea = document.getElementById('modalNoteCode');
    const codeContainer = document.getElementById('modalNoteCodeContainer');
    const previewContainer = document.getElementById('modalMediaPreviewContainer');

    if (modalBox) modalBox.style.backgroundColor = note.color || '#FFFFFF';
    if (titleInput) titleInput.value = note.title || '';
    if (bodyInput) bodyInput.value = note.body || '';
    if (mediaInput) mediaInput.value = note.playerLink || '';

    if (codeArea && codeContainer) {
      if (note.code) {
        codeContainer.classList.remove('hidden');
        codeArea.value = note.code;
      } else {
        codeContainer.classList.add('hidden');
        codeArea.value = '';
      }
    }

    // Media preview in modal
    if (previewContainer) {
      if (note.playerLink) {
        let embed = '';
        if (note.playerLink.includes('youtube.com/watch?v=') || note.playerLink.includes('youtu.be/')) {
          const ytId = note.playerLink.split('v=')[1]?.split('&')[0] || note.playerLink.split('youtu.be/')[1];
          embed = `<div class="aspect-video w-full rounded-xl overflow-hidden mt-3"><iframe class="w-full h-full" src="https://www.youtube.com/embed/${ytId}" frameborder="0" allowfullscreen></iframe></div>`;
        } else if (note.playerLink.includes('spotify.com')) {
          const spotifyEmbed = note.playerLink.replace('open.spotify.com/', 'open.spotify.com/embed/');
          embed = `<iframe class="w-full rounded-xl mt-3" src="${spotifyEmbed}" height="152" frameborder="0" allow="encrypted-media"></iframe>`;
        }
        previewContainer.innerHTML = embed;
      } else {
        previewContainer.innerHTML = '';
      }
    }

    if (modal) modal.classList.remove('hidden');

    // Bind modal image input
    const modalImageInput = document.getElementById('modalNoteImageInput');
    if (modalImageInput) {
      modalImageInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const res = await API.uploadNoteImage(file);
        if (res.success) {
          this.modalImageDataUrl = res.imageUrl;
          const preview = document.getElementById('modalNoteImagePreview');
          if (preview) preview.textContent = 'Image attached';
          // Also show image in modal preview
          if (previewContainer) {
            previewContainer.innerHTML = `<div class="rounded-xl overflow-hidden max-h-48 mt-2"><img src="${res.imageUrl}" class="w-full object-cover"/></div>`;
          }
        }
      };
    }
  },

  closeEditModal() {
    const modal = document.getElementById('noteDetailModal');
    if (modal) modal.classList.add('hidden');
    this.activeNoteId = null;
    this.modalImageDataUrl = null;
    const preview = document.getElementById('modalNoteImagePreview');
    if (preview) preview.textContent = '';
    const modalImageInput = document.getElementById('modalNoteImageInput');
    if (modalImageInput) modalImageInput.value = '';
  },

  async saveEditModalChanges() {
    if (!this.activeNoteId) return;
    const note = this.notes.find(n => n.id === this.activeNoteId);
    if (!note) return;

    const title = document.getElementById('modalNoteTitle').value;
    const body = document.getElementById('modalNoteBody').value;
    const playerLink = document.getElementById('modalNotePlayerLink').value;
    const codeEl = document.getElementById('modalNoteCode');
    const code = codeEl ? codeEl.value : note.code || '';

    note.title = title;
    note.body = body;
    note.playerLink = playerLink;
    note.code = code;

    // Apply any new image from modal
    if (this.modalImageDataUrl) {
      note.imageUrl = this.modalImageDataUrl;
      this.modalImageDataUrl = null;
    }

    await API.updateNote(this.activeNoteId, { title, body, playerLink, code, imageUrl: note.imageUrl || '' });
    this.closeEditModal();
    this.render();
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

