// js/app.js - Main Application Controller & UI Renderer

class MessApp {
  constructor() {
    this.currentTab = 'my-meals';
    this.selectedMemberForPin = null;
    this.inspectingMemberId = null;
    this.selectedMonth = null;
    this.monthlyViewMode = 'cards'; // 'cards' | 'table'
  }

  async init() {
    // Apply saved dark mode preference before anything renders
    this.initDarkMode();

    // Set date input to today
    const today = window.messStorage.formatDate(new Date());
    const dateInput = document.getElementById('date-picker-input');
    if (dateInput) dateInput.value = today;

    // Set month picker
    const currentMonthStr = today.substring(0, 7); // YYYY-MM
    this.selectedMonth = currentMonthStr;
    const monthInput = document.getElementById('monthly-picker');
    if (monthInput) monthInput.value = currentMonthStr;

    // Subscribe to storage updates
    window.messStorage.subscribe(() => {
      this.render();
    });

    // Initialize storage & test Supabase
    await window.messStorage.init();

    // Check daily 24h session expiration periodically & on tab focus
    setInterval(() => this.checkDailySession(), 30000);
    window.addEventListener('focus', () => this.checkDailySession());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkDailySession();
      }
    });

    // If session has expired or no user is signed in upon opening, prompt PIN login
    if (!window.messStorage.state.currentUser) {
      setTimeout(() => this.openUserSwitcherModal(), 400);
    }

    // Initial render
    this.render();
  }

  /* ── Dark Mode ──────────────────────────────────────────────── */
  initDarkMode() {
    const saved = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved !== null ? saved === 'true' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
    this._updateDarkToggleIcon(isDark);
  }

  toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
    this._updateDarkToggleIcon(isDark);
  }

  _updateDarkToggleIcon(isDark) {
    const iconDark = document.getElementById('icon-dark');
    const iconLight = document.getElementById('icon-light');
    if (iconDark) iconDark.classList.toggle('hidden', !isDark);
    if (iconLight) iconLight.classList.toggle('hidden', isDark);
  }



  checkDailySession() {
    if (window.messStorage.state.currentUser && !window.messStorage.isSessionValid()) {
      window.messStorage.clearSession();
      this.showToast('Your daily session has expired. Please enter your PIN to continue.', 'info');
      this.openUserSwitcherModal();
    }
  }

  /* ── Tab Switching ──────────────────────────────────────────── */
  switchTab(tabId) {
    if (tabId === 'chef-corner') {
      const state = window.messStorage.state;
      const currentUser = state.currentUser;
      if (!currentUser || currentUser.role !== 'chef') {
        this.openChefAuthModal();
        return;
      }
    }
    this.executeSwitchTab(tabId);
  }

  executeSwitchTab(tabId) {
    this.currentTab = tabId;

    // Desktop tabs update
    document.querySelectorAll('.desktop-tab-link').forEach(el => {
      const isCurrent = el.id === `desktop-tab-${tabId}`;
      el.className = isCurrent
        ? 'desktop-tab-link py-3 font-semibold text-sm border-b-2 border-blue-600 text-blue-600 flex items-center gap-2'
        : 'desktop-tab-link py-3 font-medium text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-2';
    });

    // Mobile tabs update
    document.querySelectorAll('.mobile-tab-btn').forEach(el => {
      const isCurrent = el.id === `mobile-tab-${tabId}`;
      if (isCurrent) {
        el.className = 'mobile-tab-btn active-nav flex flex-col items-center justify-center py-1 rounded-xl text-blue-600 font-bold active-press transition-all';
      } else {
        el.className = 'mobile-tab-btn flex flex-col items-center justify-center py-1 rounded-xl text-slate-400 font-medium active-press transition-all';
      }
    });

    // Section visibility
    document.querySelectorAll('.tab-content').forEach(el => {
      el.classList.add('hidden');
    });
    const activeSection = document.getElementById(`tab-${tabId}`);
    if (activeSection) activeSection.classList.remove('hidden');

    if (tabId === 'monthly') {
      const [y, m] = this.selectedMonth.split('-').map(Number);
      if (window.messStorage.state.dbMode === 'supabase') {
        window.messStorage.syncMonthFromSupabase(y, m).then(() => this.renderMonthlySheetTab());
      }
    }

    this.render();
  }

  /* ── Date Navigation & Carousel ─────────────────────────────── */
  navigateDay(deltaDays) {
    const current = new Date(window.messStorage.state.currentDate + 'T00:00:00');
    current.setDate(current.getDate() + deltaDays);
    const newDateStr = window.messStorage.formatDate(current);
    
    const dateInput = document.getElementById('date-picker-input');
    if (dateInput) dateInput.value = newDateStr;
    
    window.messStorage.setCurrentDate(newDateStr);
  }

  onDatePicked(dateStr) {
    if (!dateStr) return;
    window.messStorage.setCurrentDate(dateStr);
  }

  selectDayFromCarousel(dateStr) {
    const dateInput = document.getElementById('date-picker-input');
    if (dateInput) dateInput.value = dateStr;
    window.messStorage.setCurrentDate(dateStr);
  }

  goToToday() {
    const today = window.messStorage.formatDate(new Date());
    const dateInput = document.getElementById('date-picker-input');
    if (dateInput) dateInput.value = today;
    window.messStorage.setCurrentDate(today);
  }

  renderDateCarousel() {
    const container = document.getElementById('date-carousel-strip');
    const monthLabel = document.getElementById('carousel-month-label');
    if (!container) return;

    const activeDateStr = window.messStorage.state.currentDate;
    const activeDate = new Date(activeDateStr + 'T00:00:00');
    const todayStr = window.messStorage.formatDate(new Date());

    if (monthLabel) {
      monthLabel.textContent = activeDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    // Generate 7-day pill strip centered around active date (-2 to +4)
    let html = '';
    for (let offset = -2; offset <= 4; offset++) {
      const d = new Date(activeDate);
      d.setDate(d.getDate() + offset);
      const dStr = window.messStorage.formatDate(d);
      const isSelected = (dStr === activeDateStr);
      const isToday = (dStr === todayStr);

      const dayName = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();

      html += `
        <button onclick="app.selectDayFromCarousel('${dStr}')" 
                class="date-pill px-3 py-1.5 rounded-2xl flex flex-col items-center justify-center shrink-0 active-press transition-all ${isSelected ? 'active' : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'}">
          <span class="pill-day text-[10px] font-semibold tracking-wider uppercase block ${isSelected ? 'text-blue-100' : 'text-slate-400'}">
            ${dayName}
          </span>
          <span class="text-sm font-extrabold mt-0.5 block leading-tight">
            ${dayNum}
          </span>
          ${isToday && !isSelected ? '<span class="w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5"></span>' : ''}
        </button>
      `;
    }

    container.innerHTML = html;
  }

  async onMonthPicked(monthStr) {
    if (!monthStr) return;
    this.selectedMonth = monthStr;
    const [y, m] = monthStr.split('-').map(Number);
    if (window.messStorage.state.dbMode === 'supabase') {
      await window.messStorage.syncMonthFromSupabase(y, m);
    }
    this.renderMonthlySheetTab();
  }

  setMonthlyView(mode) {
    this.monthlyViewMode = mode;
    const btnCards = document.getElementById('btn-view-cards');
    const btnTable = document.getElementById('btn-view-table');
    const cardsContainer = document.getElementById('monthly-mobile-cards-container');
    const tableContainer = document.getElementById('monthly-desktop-table-container');

    if (mode === 'cards') {
      if (btnCards) btnCards.className = 'px-2.5 py-1 rounded-md bg-white text-blue-600 shadow-xs transition-all';
      if (btnTable) btnTable.className = 'px-2.5 py-1 rounded-md text-slate-600 transition-all';
      if (cardsContainer) cardsContainer.classList.remove('hidden');
      if (tableContainer) {
        tableContainer.classList.add('hidden');
        tableContainer.classList.add('sm:block');
      }
    } else {
      if (btnCards) btnCards.className = 'px-2.5 py-1 rounded-md text-slate-600 transition-all';
      if (btnTable) btnTable.className = 'px-2.5 py-1 rounded-md bg-white text-blue-600 shadow-xs transition-all';
      if (cardsContainer) cardsContainer.classList.add('hidden');
      if (tableContainer) tableContainer.classList.remove('hidden');
    }
  }

  /* ── Master Render ──────────────────────────────────────────── */
  render() {
    this.renderHeader();
    this.renderDatabaseStatus();
    this.renderDateCarousel();

    if (this.currentTab === 'my-meals') {
      this.renderMyMealsTab();
    } else if (this.currentTab === 'chef-corner') {
      this.renderChefCornerTab();
    } else if (this.currentTab === 'monthly') {
      this.renderMonthlySheetTab();
    } else if (this.currentTab === 'members') {
      this.renderMembersTab();
    }
  }

  /* ── Header & User Profile ──────────────────────────────────── */
  renderHeader() {
    const state = window.messStorage.state;
    const user = state.currentUser;

    const avatarEl = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-display-role');
    const todayBadge = document.getElementById('btn-today-badge');

    if (user) {
      if (avatarEl) {
        avatarEl.textContent = user.name.charAt(0).toUpperCase();
        avatarEl.style.backgroundColor = user.avatar_color || '#2563EB';
      }
      if (nameEl) nameEl.textContent = user.name;
      if (roleEl) roleEl.textContent = user.role === 'chef' ? '👨‍🍳 Cook' : `Room ${user.room_no || '—'}`;
    } else {
      if (avatarEl) {
        avatarEl.textContent = '🔒';
        avatarEl.style.backgroundColor = '#64748B';
      }
      if (nameEl) nameEl.textContent = 'Sign In';
      if (roleEl) roleEl.textContent = 'Tap to Enter PIN';
    }

    const todayStr = window.messStorage.formatDate(new Date());
    if (todayBadge) {
      todayBadge.classList.toggle('hidden', state.currentDate === todayStr);
    }
  }

  /* ── Database Status Pill ───────────────────────────────────── */
  renderDatabaseStatus() {
    const state = window.messStorage.state;
    const dot = document.getElementById('db-status-dot');
    const text = document.getElementById('db-status-text');

    if (state.dbMode === 'supabase') {
      dot.className = 'w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-400';
      text.textContent = 'Cloud Synced';
      text.className = 'hidden sm:inline text-emerald-700 font-semibold';
    } else if (state.dbMode === 'needs_tables') {
      dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
      text.textContent = 'Setup SQL';
      text.className = 'hidden sm:inline text-amber-700 font-semibold';
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-blue-400';
      text.textContent = 'Local Mode';
      text.className = 'hidden sm:inline text-blue-700 font-semibold';
    }
  }

  /* ── TAB 1: MY MEALS ────────────────────────────────────────── */
  renderMyMealsTab() {
    const state = window.messStorage.state;
    const user = state.currentUser;
    const date = state.currentDate;

    // Welcome banner
    const welcomeName = document.getElementById('member-welcome-name');
    const dateDisplay = document.getElementById('member-date-display');
    const monthBadge = document.getElementById('member-month-total-badge');

    if (welcomeName) {
      welcomeName.textContent = user ? `Hello, ${user.name}!` : 'Session Locked';
    }
    if (dateDisplay) {
      const dObj = new Date(date + 'T00:00:00');
      const formatted = dObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      dateDisplay.textContent = user ? `Meal Schedule for ${formatted}` : `Daily PIN required to manage meal orders`;
    }

    // Monthly total count for current user
    if (monthBadge) {
      if (user) {
        const [y, m] = date.split('-').map(Number);
        const summary = window.messStorage.getMonthSummary(y, m);
        const userSummary = summary.membersSummary.find(item => item.member.id === user.id);
        monthBadge.textContent = userSummary ? userSummary.total : 0;
      } else {
        monthBadge.textContent = '🔒';
      }
    }

    const container = document.getElementById('member-meals-container');
    if (!container) return;

    if (!user) {
      container.innerHTML = `
        <div class="glass-card rounded-2xl p-8 text-center space-y-3">
          <div class="w-14 h-14 rounded-2xl bg-amber-50/80 text-amber-600 border border-amber-200/80 flex items-center justify-center text-2xl mx-auto shadow-xs">
            🔒
          </div>
          <div>
            <h3 class="font-bold text-slate-800 text-base">Daily Session Expired</h3>
            <p class="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Your 24-hour daily session has expired. Enter your 4-digit PIN to access your meal dashboard.</p>
          </div>
          <button onclick="app.openUserSwitcherModal()" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
            🔑 Enter PIN to Unlock
          </button>
        </div>
      `;
      return;
    }

    const stats = window.messStorage.getMealStatsForDate(date);

    let html = '';
    window.CONFIG.MEAL_SLOTS.forEach(slot => {
      const meal = window.messStorage.getMeal(user.id, date, slot.id);
      const cooking = window.messStorage.getCookingStatus(date, slot.id);
      const isLocked = cooking.status === 'done';
      const isChecked = meal.count > 0;
      const guestCount = meal.guest_count || 0;
      const slotStats = stats[slot.id];

      html += `
        <div class="glass-card glass-card-hover rounded-2xl ${isChecked ? 'border-blue-300 ring-2 ring-blue-500/20 shadow-md' : ''} p-4 transition-all">
          <div class="flex items-start justify-between gap-3">
            <!-- Meal Info -->
            <div class="flex items-start gap-3">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${isChecked ? 'bg-blue-50/80 text-blue-600' : 'bg-slate-100/70 text-slate-400'}">
                ${slot.icon}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-bold text-base text-slate-900">${slot.name}</h3>
                  ${isLocked 
                    ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/80 text-emerald-800 flex items-center gap-1">🔒 Cooked & Locked</span>' 
                    : (isChecked 
                        ? (meal.isAutoContinuous 
                            ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100/90 text-blue-800 flex items-center gap-1" title="Running continuously from previous day">🔄 Running Daily</span>' 
                            : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/80 text-emerald-800 flex items-center gap-1">✓ Eating Today</span>')
                        : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">✕ Off</span>')}
                </div>
                <p class="text-xs text-slate-400 mt-0.5">${slot.timeLabel}</p>
                ${cooking.menu_item ? `
                  <div class="mt-1.5 flex items-center gap-1.5 text-xs text-slate-700 font-medium bg-slate-50/70 px-2 py-1 rounded-md border border-slate-200/60">
                    <span class="text-amber-500">🍲 Menu:</span>
                    <span>${this.escapeHtml(cooking.menu_item)}</span>
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Big Checkbox / Toggle Button -->
            <div>
              ${isLocked ? `
                <button disabled class="meal-toggle-btn locked px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <span>🔒</span> Locked
                </button>
              ` : `
                <button onclick="app.toggleMealOrder('${user.id}', '${date}', '${slot.id}', ${!isChecked}, ${guestCount})" 
                        class="meal-toggle-btn ${isChecked ? 'active' : 'inactive'} px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 active-press transition-all">
                  <span>${isChecked ? '✓ Eating' : '✕ Off'}</span>
                </button>
              `}
            </div>
          </div>

          <!-- Guest Meals Counter (Only visible if eating & not locked) -->
          ${isChecked && !isLocked ? `
            <div class="mt-3 pt-3 border-t border-slate-100/80 flex items-center justify-between text-xs">
              <div class="text-slate-600">
                <span class="font-semibold text-slate-800">Guest Meals:</span>
                <span class="text-slate-500 ml-1">Have friends over?</span>
              </div>
              <div class="flex items-center gap-2 bg-white/60 p-1 rounded-xl border border-slate-200/80">
                <button onclick="app.changeGuestCount('${user.id}', '${date}', '${slot.id}', -1)" 
                        ${guestCount <= 0 ? 'disabled class="stepper-btn w-9 h-9 rounded-lg bg-slate-200/70 text-slate-400 cursor-not-allowed text-xs font-bold"' : 'class="stepper-btn w-9 h-9 rounded-lg bg-white shadow-xs text-slate-700 hover:bg-slate-100 text-sm font-bold active-press transition-all"'}>
                  -
                </button>
                <span class="w-7 text-center font-black text-slate-800 text-sm">${guestCount}</span>
                <button onclick="app.changeGuestCount('${user.id}', '${date}', '${slot.id}', 1)" 
                        class="stepper-btn w-9 h-9 rounded-lg bg-white shadow-xs text-blue-600 hover:bg-blue-50 text-sm font-bold active-press transition-all">
                  +
                </button>
              </div>
            </div>
          ` : ''}

          <!-- FOOD READY & PORTION DISTRIBUTION GUIDE -->
          ${isLocked ? `
            <div class="mt-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl text-xs space-y-1">
              <div class="flex items-center justify-between font-bold text-emerald-900">
                <span class="flex items-center gap-1.5">
                  <span class="text-sm">🍳</span> Food is Cooked & Ready to Eat!
                </span>
                <span class="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 text-[11px]">
                  ${cooking.cooked_meals_count} Portions Cooked
                </span>
              </div>
              <p class="text-emerald-800 leading-relaxed">
                The Chef prepared food for <strong>${slotStats.total} total meals</strong> (${slotStats.eaters.length} members eating).
                ${isChecked ? `
                  <span class="block mt-1 font-semibold text-teal-900 bg-white/70 px-2 py-1 rounded border border-emerald-200">
                    👉 Your Share: You ordered <strong>${meal.count} meal(s)</strong> (${meal.count === 1 ? '1 portion' : '1 self + ' + guestCount + ' guest portions'}). Please divide food accordingly!
                  </span>
                ` : `
                  <span class="block mt-1 text-slate-500">You did not order for this meal.</span>
                `}
              </p>
            </div>
          ` : `
            <div class="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Current Orders: <strong>${slotStats.total} members eating</strong></span>
              ${meal.count > 1 ? `<span class="text-blue-600 font-semibold">Total for you: ${meal.count} meals</span>` : ''}
            </div>
          `}
        </div>
      `;
    });

    container.innerHTML = html;
  }

  /* ── TAB 2: CHEF CORNER ─────────────────────────────────────── */
  renderChefCornerTab() {
    const state = window.messStorage.state;
    const date = state.currentDate;
    const stats = window.messStorage.getMealStatsForDate(date);

    // Total meals today calculation
    const totalToday = (stats.breakfast?.total || 0) + (stats.lunch?.total || 0) + (stats.dinner?.total || 0);
    const totalBadge = document.getElementById('chef-total-meals-today');
    if (totalBadge) totalBadge.textContent = totalToday;

    const container = document.getElementById('chef-slots-container');
    if (!container) return;

    let html = '';

    window.CONFIG.MEAL_SLOTS.forEach(slot => {
      const slotStats = stats[slot.id];
      const cooking = window.messStorage.getCookingStatus(date, slot.id);
      const isDone = cooking.status === 'done';
      const isCooking = cooking.status === 'cooking';

      html += `
        <div class="glass-card rounded-2xl ${isDone ? 'border-emerald-300 ring-1 ring-emerald-500/20' : ''} p-4 space-y-4">
          <!-- Slot Header -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100/80 pb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center text-xl font-bold">
                ${slot.icon}
              </div>
              <div>
                <h3 class="font-bold text-base text-slate-900">${slot.name}</h3>
                <p class="text-xs text-slate-400">${slot.timeLabel}</p>
              </div>
            </div>

            <!-- Total Meals Required Badge -->
            <div class="flex items-center gap-2 self-start sm:self-auto">
              <div class="bg-blue-50/80 border border-blue-200/80 px-3 py-1.5 rounded-xl text-center">
                <span class="text-[10px] uppercase font-bold text-blue-600 block leading-tight">Order Count</span>
                <span class="text-xl font-black text-blue-700">${slotStats.total} Meals</span>
              </div>

              ${isDone ? `
                <span class="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-100/80 text-emerald-800 border border-emerald-200/80 flex items-center gap-1">
                  ✓ Cooking Done
                </span>
              ` : `
                <span class="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-100/80 text-amber-800 border border-amber-200/80 flex items-center gap-1 pulse-badge">
                  ⏳ Orders Pending
                </span>
              `}
            </div>
          </div>

          <!-- Menu Item Input (What is chef cooking?) -->
          <div>
            <label class="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <span>🍲</span> Today's Menu / Dishes
            </label>
            <div class="flex gap-2">
              <input type="text" id="menu-input-${slot.id}" value="${this.escapeHtml(cooking.menu_item || '')}" 
                     placeholder="e.g. Chicken Curry, Dal, Plain Rice & Salad" 
                     class="w-full text-xs font-medium border-2 border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs focus:outline-none">
              <button onclick="app.saveMenuItem('${date}', '${slot.id}')" class="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-sm active-press shrink-0">
                Save
              </button>
            </div>
          </div>

          <!-- Eaters List Breakdown -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs font-bold text-slate-700">Members Eating (${slotStats.eaters.length}):</span>
              <span class="text-[11px] text-slate-400">Total Count: ${slotStats.total}</span>
            </div>
            
            ${slotStats.eaters.length > 0 ? `
              <div class="flex flex-wrap gap-1.5">
                ${slotStats.eaters.map(e => `
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span>${this.escapeHtml(e.member.name)}</span>
                    ${e.guestCount > 0 ? `<span class="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">+${e.guestCount} Guest</span>` : ''}
                  </span>
                `).join('')}
              </div>
            ` : `
              <p class="text-xs text-slate-400 italic">No members have ordered for this slot yet.</p>
            `}

            <!-- Skipped Members -->
            ${slotStats.skipped.length > 0 ? `
              <div class="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                <span>✕ Off (${slotStats.skipped.length}):</span>
                <span>${slotStats.skipped.map(m => this.escapeHtml(m.name)).join(', ')}</span>
              </div>
            ` : ''}
          </div>

          <!-- Chef Action Station: Cooking Done Button -->
          <div class="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="text-xs text-slate-500">
              ${isDone ? `
                <span class="text-emerald-700 font-medium">✓ Locked for members. Prepared: <strong>${cooking.cooked_meals_count} meals</strong>.</span>
              ` : `
                <span>When food is prepared, press "Cooking Done" to lock orders & notify members.</span>
              `}
            </div>

            <div class="flex items-center gap-2 w-full sm:w-auto">
              ${isDone ? `
                <button onclick="app.toggleChefCookingStatus('${date}', '${slot.id}', 'pending')" 
                        class="w-full sm:w-auto px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold active-press transition-all">
                  Reopen Orders
                </button>
              ` : `
                <button onclick="app.toggleChefCookingStatus('${date}', '${slot.id}', 'done')" 
                        class="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active-press">
                  <span>✓</span> Cooking Done (${slotStats.total} Meals)
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  /* ── TAB 3: MONTHLY SHEET ───────────────────────────────────── */
  renderMonthlySheetTab() {
    if (!this.selectedMonth) {
      const today = window.messStorage.formatDate(new Date());
      this.selectedMonth = today.substring(0, 7);
    }

    const [year, month] = this.selectedMonth.split('-').map(Number);
    const summary = window.messStorage.getMonthSummary(year, month);

    // KPI Summary
    const totalEl = document.getElementById('kpi-month-total');
    const avgEl = document.getElementById('kpi-month-daily-avg');
    const membersEl = document.getElementById('kpi-month-members');
    const guestsEl = document.getElementById('kpi-month-guests');

    const totalGuestMeals = summary.membersSummary.reduce((acc, curr) => acc + curr.guestTotal, 0);
    const dailyAvg = summary.daysInMonth > 0 ? (summary.grandTotalMeals / summary.daysInMonth).toFixed(1) : 0;

    if (totalEl) totalEl.textContent = summary.grandTotalMeals;
    if (avgEl) avgEl.textContent = dailyAvg;
    if (membersEl) membersEl.textContent = summary.membersSummary.length;
    if (guestsEl) guestsEl.textContent = totalGuestMeals;

    // Table Body
    const tbody = document.getElementById('monthly-table-body');
    if (!tbody) return;

    if (summary.membersSummary.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400 text-xs">No active mess members found.</td></tr>`;
      return;
    }

    let html = '';
    summary.membersSummary.forEach(row => {
      html += `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
            <div class="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style="background-color: ${row.member.avatar_color || '#3B82F6'}">
              ${row.member.name.charAt(0).toUpperCase()}
            </div>
            <span>${this.escapeHtml(row.member.name)}</span>
          </td>
          <td class="py-3 px-3 text-center text-xs text-slate-500">${row.member.room_no || '—'}</td>
          <td class="py-3 px-3 text-center text-xs font-medium text-slate-700">${row.breakfast}</td>
          <td class="py-3 px-3 text-center text-xs font-medium text-slate-700">${row.lunch}</td>
          <td class="py-3 px-3 text-center text-xs font-medium text-slate-700">${row.dinner}</td>
          <td class="py-3 px-3 text-center text-xs font-medium text-amber-600">${row.guestTotal > 0 ? `+${row.guestTotal}` : '0'}</td>
          <td class="py-3 px-4 text-right font-black text-blue-600 text-sm">${row.total}</td>
          <td class="py-3 px-3 text-center no-print">
            <button onclick="app.inspectMemberDaily('${row.member.id}', '${row.member.name}')" 
                    class="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-md text-xs font-semibold transition-all">
              Details
            </button>
          </td>
        </tr>
      `;
    });

    // Grand Total Row
    const grandBreakfast = summary.membersSummary.reduce((acc, curr) => acc + curr.breakfast, 0);
    const grandLunch = summary.membersSummary.reduce((acc, curr) => acc + curr.lunch, 0);
    const grandDinner = summary.membersSummary.reduce((acc, curr) => acc + curr.dinner, 0);

    html += `
      <tr class="bg-blue-50/50 font-bold border-t-2 border-slate-200">
        <td class="py-3.5 px-4 text-slate-900">MESS TOTAL</td>
        <td class="py-3.5 px-3 text-center text-slate-400">—</td>
        <td class="py-3.5 px-3 text-center text-slate-800">${grandBreakfast}</td>
        <td class="py-3.5 px-3 text-center text-slate-800">${grandLunch}</td>
        <td class="py-3.5 px-3 text-center text-slate-800">${grandDinner}</td>
        <td class="py-3.5 px-3 text-center text-amber-600">+${totalGuestMeals}</td>
        <td class="py-3.5 px-4 text-right text-base text-blue-700 font-black">${summary.grandTotalMeals}</td>
        <td class="py-3.5 px-3 text-center no-print">—</td>
      </tr>
    `;

    tbody.innerHTML = html;

    // Render Mobile Cards Container
    const mobileCardsContainer = document.getElementById('monthly-mobile-cards-container');
    if (mobileCardsContainer) {
      if (summary.membersSummary.length === 0) {
        mobileCardsContainer.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs glass-card rounded-2xl">No active mess members found.</div>`;
      } else {
        let cardsHtml = '';
        summary.membersSummary.forEach(row => {
          cardsHtml += `
            <div class="glass-card glass-card-hover rounded-2xl p-3.5 transition-all">
              <div class="flex items-center justify-between mb-2.5">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-xl text-white text-xs font-bold flex items-center justify-center uppercase shadow-xs" style="background-color: ${row.member.avatar_color || '#3B82F6'}">
                    ${row.member.name.charAt(0)}
                  </div>
                  <div>
                    <h4 class="font-bold text-slate-900 text-sm leading-tight">${this.escapeHtml(row.member.name)}</h4>
                    <span class="text-[11px] text-slate-400 font-medium">Room ${row.member.room_no || '—'}</span>
                  </div>
                </div>
                
                <div class="text-right">
                  <span class="text-lg font-black text-blue-600 block leading-none">${row.total}</span>
                  <span class="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Meals</span>
                </div>
              </div>

              <!-- Breakdown Grid -->
              <div class="grid grid-cols-4 gap-1.5 py-2 border-t border-b border-slate-100/80 text-center">
                <div class="bg-white/60 rounded-xl p-1.5 border border-slate-100/80">
                  <span class="block text-[10px] text-slate-400 font-semibold">🌅 Morn</span>
                  <span class="block text-xs font-bold text-slate-800">${row.breakfast}</span>
                </div>
                <div class="bg-white/60 rounded-xl p-1.5 border border-slate-100/80">
                  <span class="block text-[10px] text-slate-400 font-semibold">☀️ Lunch</span>
                  <span class="block text-xs font-bold text-slate-800">${row.lunch}</span>
                </div>
                <div class="bg-white/60 rounded-xl p-1.5 border border-slate-100/80">
                  <span class="block text-[10px] text-slate-400 font-semibold">🌙 Din</span>
                  <span class="block text-xs font-bold text-slate-800">${row.dinner}</span>
                </div>
                <div class="bg-amber-50/70 rounded-xl p-1.5 border border-amber-200/60">
                  <span class="block text-[10px] text-amber-600 font-semibold">👥 Guest</span>
                  <span class="block text-xs font-bold text-amber-800">${row.guestTotal > 0 ? '+' + row.guestTotal : '0'}</span>
                </div>
              </div>

              <div class="pt-2 flex items-center justify-between">
                <span class="text-[11px] text-slate-400">Monthly breakdown</span>
                <button onclick="app.inspectMemberDaily('${row.member.id}', '${row.member.name}')" 
                        class="px-3 py-1.5 bg-slate-100/80 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 active-press transition-all border border-slate-200/60">
                  <span>📅</span> Details →
                </button>
              </div>
            </div>
          `;
        });
        mobileCardsContainer.innerHTML = cardsHtml;
      }
    }
  }

  /* ── TAB 4: MEMBERS MANAGEMENT ──────────────────────────────── */
  renderMembersTab() {
    const container = document.getElementById('members-list-container');
    if (!container) return;

    const state = window.messStorage.state;
    const currentUser = state.currentUser;

    let html = '';
    state.members.forEach(m => {
      const isChef = m.role === 'chef';
      const isCurrent = currentUser && currentUser.id === m.id;

      html += `
        <div class="glass-card glass-card-hover rounded-2xl ${isCurrent ? 'border-blue-400 ring-2 ring-blue-500/20' : ''} p-3.5 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 rounded-2xl text-white font-bold flex items-center justify-center text-base shadow-sm shrink-0" style="background-color: ${m.avatar_color || '#3B82F6'}">
              ${isChef ? '👨‍🍳' : m.name.charAt(0).toUpperCase()}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h4 class="font-bold text-slate-900 text-sm truncate">${this.escapeHtml(m.name)}</h4>
                ${isCurrent ? '<span class="text-[9px] uppercase font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Active</span>' : ''}
              </div>
              <p class="text-xs text-slate-500 truncate">
                ${isChef ? 'Chef / Cook' : (m.room_no ? `Room: ${m.room_no}` : 'Room: Not set')}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <!-- Edit Button -->
            <button onclick="app.openEditMemberModal('${m.id}')" title="Edit Member & PIN" class="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active-press border border-slate-200/80 hover:border-blue-200">
              ✏️
            </button>

            <!-- Remove Button -->
            <button onclick="app.promptDeleteMember('${m.id}', '${this.escapeHtml(m.name)}')" title="Remove Member" class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active-press border border-slate-200/80 hover:border-rose-200">
              🗑️
            </button>

            <!-- Switch / Status Button -->
            ${isCurrent ? `
              <span class="text-xs font-bold text-emerald-600 px-2.5 py-1.5 bg-emerald-50/80 rounded-xl flex items-center gap-1 border border-emerald-200/80">
                ✓ Active
              </span>
            ` : `
              <button onclick="app.openPinSwitchForUser('${m.id}')" class="px-3 py-1.5 bg-white/70 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-xl text-xs font-semibold active-press transition-all flex items-center gap-1 border border-slate-200/70">
                <span>🔒</span> Switch
              </button>
            `}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  /* ── Member Daily Breakdown Inspector Modal ────────────────── */
  inspectMemberDaily(memberId, memberName) {
    const [year, month] = this.selectedMonth.split('-').map(Number);
    const summary = window.messStorage.getMonthSummary(year, month);
    const memberSummary = summary.membersSummary.find(item => item.member.id === memberId);
    if (!memberSummary) return;

    const modal = document.getElementById('modal-member-breakdown');
    const nameEl = document.getElementById('breakdown-member-name');
    const labelEl = document.getElementById('breakdown-month-label');
    const listEl = document.getElementById('breakdown-daily-list');

    nameEl.textContent = `${memberName}'s Meals`;
    labelEl.textContent = `${this.selectedMonth} • Total: ${memberSummary.total} Meals`;

    let html = '';
    for (let d = 1; d <= summary.daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = memberSummary.dailyBreakdown[dateStr] || { breakfast: 0, lunch: 0, dinner: 0, total: 0 };
      
      const dayObj = new Date(dateStr + 'T00:00:00');
      const dayName = dayObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

      html += `
        <div class="flex items-center justify-between py-2 px-3 rounded-lg ${dayData.total > 0 ? 'bg-blue-50/50' : 'bg-slate-50/40'} text-xs">
          <span class="font-semibold text-slate-700">${dayName}</span>
          <div class="flex items-center gap-2">
            <span class="text-[11px] text-slate-500">M: ${dayData.breakfast} | L: ${dayData.lunch} | D: ${dayData.dinner}</span>
            <span class="font-bold ${dayData.total > 0 ? 'text-blue-600' : 'text-slate-400'} w-6 text-right">${dayData.total}</span>
          </div>
        </div>
      `;
    }

    listEl.innerHTML = html;
    modal.classList.remove('hidden');
  }

  closeMemberBreakdownModal() {
    document.getElementById('modal-member-breakdown').classList.add('hidden');
  }

  /* ── User Switcher Modal & PIN ──────────────────────────────── */
  openUserSwitcherModal() {
    const modal = document.getElementById('modal-user-switcher');
    const list = document.getElementById('modal-member-pick-list');
    const pinBox = document.getElementById('pin-prompt-box');
    pinBox.classList.add('hidden');

    const state = window.messStorage.state;
    let html = '';

    state.members.forEach(m => {
      const isChef = m.role === 'chef';
      html += `
        <button onclick="app.selectUserForLogin('${m.id}')" 
                class="w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/70 hover:border-blue-500 hover:bg-blue-50/60 flex items-center justify-between text-left transition-all active-press">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center" style="background-color: ${m.avatar_color || '#3B82F6'}">
              ${isChef ? '👨‍🍳' : m.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <span class="font-semibold text-xs text-slate-800 block">${this.escapeHtml(m.name)}</span>
              <span class="text-[10px] text-slate-400 block">${isChef ? 'Cook' : `Room ${m.room_no || '—'}`}</span>
            </div>
          </div>
          <span class="text-xs text-blue-600 font-semibold">Select →</span>
        </button>
      `;
    });

    list.innerHTML = html;
    modal.classList.remove('hidden');
  }

  closeUserSwitcherModal() {
    document.getElementById('modal-user-switcher').classList.add('hidden');
    this.selectedMemberForPin = null;
  }

  selectUserForLogin(memberId) {
    const member = window.messStorage.state.members.find(m => m.id === memberId);
    if (!member) return;

    this.selectedMemberForPin = member;
    const pinBox = document.getElementById('pin-prompt-box');
    const targetName = document.getElementById('pin-target-name');
    const pinInput = document.getElementById('modal-pin-input');

    targetName.textContent = member.name;
    pinInput.value = '';
    pinBox.classList.remove('hidden');
    pinInput.focus();
  }

  confirmPinLogin() {
    if (!this.selectedMemberForPin) return;

    const inputPin = document.getElementById('modal-pin-input').value.trim();
    const correctPin = this.selectedMemberForPin.pin || '0000';
    if (inputPin === correctPin) {
      window.messStorage.setCurrentUser(this.selectedMemberForPin);
      this.closeUserSwitcherModal();
      this.showToast(`Logged in as ${this.selectedMemberForPin.name}`, 'success');

      // If user switched to chef, automatically switch to chef tab
      if (this.selectedMemberForPin.role === 'chef') {
        this.switchTab('chef-corner');
      }
    } else {
      this.showToast('Incorrect PIN. Please try again.', 'error');
    }
  }

  openPinSwitchForUser(memberId) {
    this.openUserSwitcherModal();
    this.selectUserForLogin(memberId);
  }

  quickSwitchUser(memberId) {
    // Prevent unauthenticated switching; always require PIN
    this.openPinSwitchForUser(memberId);
  }

  /* ── Add Member Modal ───────────────────────────────────────── */
  openAddMemberModal() {
    document.getElementById('modal-add-member').classList.remove('hidden');
  }

  closeAddMemberModal() {
    document.getElementById('modal-add-member').classList.add('hidden');
  }

  async handleAddMember(e) {
    e.preventDefault();
    const name = document.getElementById('new-member-name').value;
    const room = document.getElementById('new-member-room').value;
    const pin = document.getElementById('new-member-pin').value || '0000';
    const role = document.getElementById('new-member-role').value;

    if (!name.trim()) return;

    await window.messStorage.addMember(name, room, pin, role);
    this.closeAddMemberModal();
    this.showToast(`Added ${name} to mess members!`, 'success');
    e.target.reset();
  }

  /* ── Edit Member Modal (Requires Member PIN) ───────────────── */
  openEditMemberModal(memberId) {
    const member = window.messStorage.state.members.find(m => m.id === memberId);
    if (!member) return;

    document.getElementById('edit-member-id').value = member.id;
    document.getElementById('edit-member-name').value = member.name;
    document.getElementById('edit-member-room').value = member.room_no || '';
    document.getElementById('edit-member-role').value = member.role || 'member';
    document.getElementById('edit-member-new-pin').value = '';
    document.getElementById('edit-member-current-pin').value = '';

    const titleEl = document.getElementById('edit-modal-title');
    if (titleEl) titleEl.textContent = `Edit ${member.name}'s Profile`;

    const pinTargetLabel = document.getElementById('edit-pin-target-name');
    if (pinTargetLabel) pinTargetLabel.textContent = member.name;

    document.getElementById('modal-edit-member').classList.remove('hidden');
    setTimeout(() => {
      document.getElementById('edit-member-name').focus();
    }, 150);
  }

  openEditCurrentMemberModal() {
    const current = window.messStorage.state.currentUser;
    if (current) {
      this.openEditMemberModal(current.id);
    }
  }

  closeEditMemberModal() {
    document.getElementById('modal-edit-member').classList.add('hidden');
  }

  async handleSaveEditMember(e) {
    e.preventDefault();
    const id = document.getElementById('edit-member-id').value;
    const name = document.getElementById('edit-member-name').value.trim();
    const room_no = document.getElementById('edit-member-room').value.trim();
    const role = document.getElementById('edit-member-role').value;
    const newPin = document.getElementById('edit-member-new-pin').value.trim();
    const currentPin = document.getElementById('edit-member-current-pin').value.trim();

    const member = window.messStorage.state.members.find(m => m.id === id);
    if (!member) {
      this.showToast('Member not found.', 'error');
      return;
    }

    if (!name) {
      this.showToast('Name cannot be empty.', 'error');
      return;
    }

    // Security Check: Verify current member's PIN
    const requiredPin = member.pin || '0000';
    if (currentPin !== requiredPin) {
      this.showToast(`Incorrect PIN! You must enter ${member.name}'s current PIN to apply changes.`, 'error');
      const pinField = document.getElementById('edit-member-current-pin');
      if (pinField) {
        pinField.value = '';
        pinField.focus();
        pinField.classList.add('ring-2', 'ring-rose-500');
        setTimeout(() => pinField.classList.remove('ring-2', 'ring-rose-500'), 2500);
      }
      return;
    }

    // If changing PIN, validate that it is 4 digits
    const updates = { name, room_no, role };
    if (newPin) {
      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        this.showToast('New PIN must be exactly 4 numeric digits (e.g. 1234).', 'error');
        document.getElementById('edit-member-new-pin').focus();
        return;
      }
      updates.pin = newPin;
    }

    try {
      await window.messStorage.updateMember(id, updates);
      this.closeEditMemberModal();
      this.showToast(`Updated ${name}'s profile successfully!`, 'success');
    } catch (err) {
      this.showToast(`Failed to update member: ${err.message}`, 'error');
    }
  }

  /* ── Delete Member (Requires Member PIN) ─────────────────────── */
  async promptDeleteMember(memberId, memberName) {
    const member = window.messStorage.state.members.find(m => m.id === memberId);
    if (!member) return;

    const enteredPin = window.prompt(
      `Security Check:\nEnter "${memberName}"'s 4-digit PIN to authorize removing them from the mess:`
    );
    if (enteredPin === null) return; // User cancelled

    const requiredPin = member.pin || '0000';
    if (enteredPin.trim() !== requiredPin) {
      this.showToast(`Incorrect PIN! Cannot remove ${memberName}.`, 'error');
      return;
    }

    try {
      await window.messStorage.deleteMember(memberId);
      this.showToast(`"${memberName}" was removed from the mess.`, 'success');
    } catch (err) {
      this.showToast(`Failed to remove member: ${err.message}`, 'error');
    }
  }

  /* ── Supabase Modal ─────────────────────────────────────────── */
  openSupabaseModal() {
    const modal = document.getElementById('modal-supabase-setup');
    const label = document.getElementById('modal-supabase-status-label');
    const state = window.messStorage.state;

    if (state.dbMode === 'supabase') {
      label.textContent = '🟢 Connected & Syncing with Cloud';
    } else if (state.dbMode === 'needs_tables') {
      label.textContent = '🟡 Connected to Supabase, but tables need to be created';
    } else {
      label.textContent = '⚪ Running in Local Storage Mode';
    }

    modal.classList.remove('hidden');
  }

  closeSupabaseModal() {
    document.getElementById('modal-supabase-setup').classList.add('hidden');
  }

  async copySqlToClipboard() {
    const sqlText = document.getElementById('sql-preview-text').innerText;
    try {
      await navigator.clipboard.writeText(sqlText);
      this.showToast('SQL copied to clipboard!', 'success');
    } catch {
      this.showToast('Could not copy automatically. Please select and copy manually.', 'info');
    }
  }

  async checkSupabaseConnection(isUserTriggered = false) {
    const btn = document.getElementById('btn-test-supabase');
    if (btn) btn.innerHTML = '<span>⏳</span> Testing connection...';

    const health = await window.supabaseApi.testConnection();

    if (health.success && health.status === 'ready') {
      window.messStorage.state.dbMode = 'supabase';
      await window.messStorage.syncFromSupabase();
      this.showToast('🎉 Supabase connected and synced successfully!', 'success');
      this.closeSupabaseModal();
    } else if (health.status === 'no_tables') {
      window.messStorage.state.dbMode = 'needs_tables';
      this.showToast('Tables not found yet. Please paste and run the SQL in Supabase SQL editor.', 'error');
    } else {
      this.showToast(`Supabase Error: ${health.message}`, 'error');
    }

    if (btn) btn.innerHTML = '<span>🔄</span> Test & Sync Supabase Now';
    this.render();
  }

  /* ── Meal Actions ───────────────────────────────────────────── */
  async toggleMealOrder(memberId, date, mealType, isChecked, currentGuestCount) {
    if (!window.messStorage.state.currentUser) {
      this.showToast('Please enter your PIN to manage meals.', 'info');
      this.openUserSwitcherModal();
      return;
    }

    try {
      await window.messStorage.setMeal(memberId, date, mealType, isChecked, isChecked ? currentGuestCount : 0);
      const slotName = window.CONFIG.MEAL_SLOTS.find(s => s.id === mealType)?.shortName || mealType;
      this.showToast(`${slotName} meal set to: ${isChecked ? 'EATING' : 'OFF'}`, 'success');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async changeGuestCount(memberId, date, mealType, delta) {
    if (!window.messStorage.state.currentUser) {
      this.showToast('Please enter your PIN to manage meals.', 'info');
      this.openUserSwitcherModal();
      return;
    }

    const meal = window.messStorage.getMeal(memberId, date, mealType);
    const newGuestCount = Math.max(0, (meal.guest_count || 0) + delta);
    
    try {
      await window.messStorage.setMeal(memberId, date, mealType, true, newGuestCount);
      this.showToast(`Guest meal updated: ${newGuestCount}`, 'info');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  /* ── Chef Modal & Auth ───────────────────────────────────────── */
  openChefAuthModal() {
    const modal = document.getElementById('modal-chef-auth');
    const pinInput = document.getElementById('chef-auth-pin');
    if (pinInput) pinInput.value = '';
    if (modal) modal.classList.remove('hidden');
    setTimeout(() => {
      if (pinInput) pinInput.focus();
    }, 150);
  }

  closeChefAuthModal() {
    const modal = document.getElementById('modal-chef-auth');
    if (modal) modal.classList.add('hidden');
  }

  handleChefAuthSubmit(e) {
    e.preventDefault();
    const inputPin = document.getElementById('chef-auth-pin').value.trim();
    const state = window.messStorage.state;
    const chefMember = state.members.find(m => m.role === 'chef') || { pin: '0000' };
    const correctPin = chefMember.pin || '0000';

    if (inputPin === correctPin) {
      if (chefMember.id) {
        window.messStorage.setCurrentUser(chefMember);
      }
      this.closeChefAuthModal();
      this.showToast('Chef verified! Welcome to the Kitchen.', 'success');
      this.executeSwitchTab('chef-corner');
    } else {
      this.showToast('Incorrect Chef PIN! Try again.', 'error');
      const pinField = document.getElementById('chef-auth-pin');
      if (pinField) {
        pinField.value = '';
        pinField.focus();
        pinField.classList.add('ring-2', 'ring-rose-500');
        setTimeout(() => pinField.classList.remove('ring-2', 'ring-rose-500'), 2500);
      }
    }
  }

  /* ── Chef Actions (Requires Chef Authorization) ─────────────── */
  async toggleChefCookingStatus(date, mealType, targetStatus) {
    const state = window.messStorage.state;
    const chefMember = state.members.find(m => m.role === 'chef') || { pin: '0000' };
    
    // Security check: If not current chef, require Cook PIN
    if (!state.currentUser || state.currentUser.role !== 'chef') {
      const enteredPin = window.prompt(
        `Chef Security Check:\nEnter Chef PIN (0000) to confirm "${targetStatus === 'done' ? 'Cooking Done' : 'Reopen Orders'}":`
      );
      if (enteredPin === null) return;
      if (enteredPin.trim() !== (chefMember.pin || '0000')) {
        this.showToast('Unauthorized: Incorrect Chef PIN.', 'error');
        return;
      }
    }

    try {
      await window.messStorage.setCookingStatus(date, mealType, targetStatus);
      const slotName = window.CONFIG.MEAL_SLOTS.find(s => s.id === mealType)?.shortName || mealType;
      if (targetStatus === 'done') {
        this.showToast(`🍳 Cooking marked DONE for ${slotName}! Locked for members.`, 'success');
      } else {
        this.showToast(`Orders reopened for ${slotName}`, 'info');
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async saveMenuItem(date, mealType) {
    const state = window.messStorage.state;
    const chefMember = state.members.find(m => m.role === 'chef') || { pin: '0000' };

    // Security check: If not current chef, require Cook PIN
    if (!state.currentUser || state.currentUser.role !== 'chef') {
      const enteredPin = window.prompt(`Chef Security Check:\nEnter Chef PIN (0000) to save today's menu:`);
      if (enteredPin === null) return;
      if (enteredPin.trim() !== (chefMember.pin || '0000')) {
        this.showToast('Unauthorized: Incorrect Chef PIN.', 'error');
        return;
      }
    }

    const input = document.getElementById(`menu-input-${mealType}`);
    if (!input) return;

    const menuItem = input.value.trim();
    const cooking = window.messStorage.getCookingStatus(date, mealType);

    await window.messStorage.setCookingStatus(date, mealType, cooking.status, cooking.cooked_meals_count, menuItem);
    this.showToast('Menu saved!', 'success');
  }

  /* ── Password-Protected Fresh Month Reset ───────────────────── */
  openResetMonthModal() {
    const modal = document.getElementById('modal-manager-auth');
    const errBox = document.getElementById('manager-auth-error');
    const emailInput = document.getElementById('manager-auth-email');
    const passInput = document.getElementById('manager-auth-password');
    const submitBtn = document.getElementById('btn-submit-manager-auth');

    if (errBox) {
      errBox.textContent = '';
      errBox.classList.add('hidden');
    }
    if (passInput) passInput.value = '';
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>🛡️</span> Verify & Reset';
    }

    if (modal) modal.classList.remove('hidden');
    if (emailInput) emailInput.focus();
  }

  closeResetMonthModal() {
    const modal = document.getElementById('modal-manager-auth');
    if (modal) modal.classList.add('hidden');
  }

  async handleManagerAuthReset(e) {
    e.preventDefault();
    const emailInput = document.getElementById('manager-auth-email');
    const passInput = document.getElementById('manager-auth-password');
    const errBox = document.getElementById('manager-auth-error');
    const submitBtn = document.getElementById('btn-submit-manager-auth');

    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
      errBox.textContent = 'Please enter both Manager Email and Password.';
      errBox.classList.remove('hidden');
      return;
    }

    // Loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳</span> Verifying credentials...';
    errBox.classList.add('hidden');

    try {
      // Authenticate with your existing Unfilteredpages Supabase account
      const { data, error } = await window.supabaseApi.signInWithPassword({ email, password });

      if (error) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>🛡️</span> Verify & Reset';
        errBox.textContent = `Authentication failed: ${error.message}`;
        errBox.classList.remove('hidden');
        return;
      }

      // Successful authentication: Clear all meal data in local storage and Supabase cloud
      await window.messStorage.clearAllMealData();

      this.closeResetMonthModal();
      this.showToast('🎉 Manager verified! All meal counts have been reset.', 'success');
      this.render();
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>🛡️</span> Verify & Reset';
      errBox.textContent = `Error: ${err.message}`;
      errBox.classList.remove('hidden');
    }
  }

  /* ── CSV Export ─────────────────────────────────────────────── */
  exportMonthlyCSV() {
    const [year, month] = this.selectedMonth.split('-').map(Number);
    const summary = window.messStorage.getMonthSummary(year, month);

    let csv = `Month,${this.selectedMonth}\n`;
    csv += `Member Name,Room,Morning,Lunch,Dinner,Guest Meals,Total Meals\n`;

    summary.membersSummary.forEach(row => {
      csv += `"${row.member.name}","${row.member.room_no || ''}",${row.breakfast},${row.lunch},${row.dinner},${row.guestTotal},${row.total}\n`;
    });

    csv += `TOTALS,,${summary.membersSummary.reduce((a,c)=>a+c.breakfast,0)},${summary.membersSummary.reduce((a,c)=>a+c.lunch,0)},${summary.membersSummary.reduce((a,c)=>a+c.dinner,0)},${summary.membersSummary.reduce((a,c)=>a+c.guestTotal,0)},${summary.grandTotalMeals}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mess-meal-report-${this.selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ── Toast Notifications ────────────────────────────────────── */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600/95 text-white border-emerald-400/40' :
                    type === 'error'   ? 'bg-rose-600/95 text-white border-rose-400/40' :
                                         'bg-slate-900/95 text-white border-slate-700/50';

    toast.className = `p-3 rounded-xl shadow-xl text-xs font-semibold flex items-center justify-between gap-2 backdrop-blur-md border transform transition-all duration-300 translate-y-[-10px] opacity-0 ${bgClass}`;
    toast.innerHTML = `
      <span>${this.escapeHtml(message)}</span>
      <button class="opacity-70 hover:opacity-100 ml-2">✕</button>
    `;

    toast.querySelector('button').onclick = () => {
      toast.remove();
    };

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-[-10px]', 'opacity-0');
    });

    // Auto remove after 3.5s
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-[-10px]');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.app = new MessApp();
window.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
