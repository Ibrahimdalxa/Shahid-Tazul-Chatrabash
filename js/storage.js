// js/storage.js - State Management & Cloud Sync Layer

class MessStorage {
  constructor() {
    this.STORAGE_KEY_MEMBERS = 'mess_members_v2';
    this.STORAGE_KEY_MEALS = 'mess_meals_v2';
    this.STORAGE_KEY_COOKING = 'mess_cooking_v2';
    this.STORAGE_KEY_USER = 'mess_current_user_v2';
    this.STORAGE_KEY_SESSION = 'mess_session_meta_v2';
    this.SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 Hours (1 Day)
    
    // Purge any legacy dummy data from v1
    try {
      localStorage.removeItem('mess_meals_v1');
      localStorage.removeItem('mess_cooking_v1');
    } catch (e) {}

    this.state = {
      currentUser: null,
      currentDate: this.formatDate(new Date()),
      members: [],
      meals: {},           // key: `${member_id}_${date}_${meal_type}` -> { count, guest_count, updated_at }
      cookingStatus: {},   // key: `${date}_${meal_type}` -> { status, cooked_meals_count, menu_item, completed_at }
      dbMode: 'checking',  // 'supabase' | 'local_fallback' | 'checking'
      lastSync: null
    };

    this.listeners = [];
  }

  formatDate(dateObj) {
    const d = new Date(dateObj);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => {
      try { fn(this.state); } catch (e) { console.error('Listener error:', e); }
    });
  }

  /* ── Initialize ─────────────────────────────────────────────── */
  async init() {
    // 1. Load local cache first for instant rendering
    this.loadFromLocalStorage();

    // 2. Check Supabase connectivity
    const health = await window.supabaseApi.testConnection();
    
    if (health.success && health.status === 'ready') {
      this.state.dbMode = 'supabase';
      await this.syncFromSupabase();
    } else {
      this.state.dbMode = health.status === 'no_tables' ? 'needs_tables' : 'local_fallback';
      console.info(`Supabase status: ${health.message}. Running in local storage mode.`);
    }

    this.notify();
  }

  loadFromLocalStorage() {
    try {
      const storedMembers = localStorage.getItem(this.STORAGE_KEY_MEMBERS);
      if (storedMembers) {
        this.state.members = JSON.parse(storedMembers);
        // Ensure default pins are migrated to 0000
        const oldDefaults = ['1111', '2222', '3333', '4444', '5555', '1234'];
        let updated = false;
        this.state.members.forEach(m => {
          if (!m.pin || oldDefaults.includes(m.pin)) {
            m.pin = '0000';
            updated = true;
          }
        });
        if (updated) this.saveMembersToLocal();
      } else {
        this.state.members = [...window.CONFIG.DEFAULT_MEMBERS];
        this.saveMembersToLocal();
      }

      // Check 24-hour daily session expiration
      if (this.isSessionValid()) {
        const storedUser = localStorage.getItem(this.STORAGE_KEY_USER);
        if (storedUser) {
          this.state.currentUser = JSON.parse(storedUser);
          const match = this.state.members.find(m => m.id === this.state.currentUser.id);
          if (match) this.state.currentUser = match;
        }
      } else {
        // Daily session expired or not started yet
        this.clearSession();
      }

      const storedMeals = localStorage.getItem(this.STORAGE_KEY_MEALS);
      if (storedMeals) {
        this.state.meals = JSON.parse(storedMeals);
      } else {
        this.seedInitialMeals();
      }

      const storedCooking = localStorage.getItem(this.STORAGE_KEY_COOKING);
      if (storedCooking) {
        this.state.cookingStatus = JSON.parse(storedCooking);
      } else {
        this.seedInitialCooking();
      }
    } catch (e) {
      console.error('Error loading local storage:', e);
    }
  }

  isSessionValid() {
    try {
      const sessionStr = localStorage.getItem(this.STORAGE_KEY_SESSION);
      if (!sessionStr) return false;
      const session = JSON.parse(sessionStr);
      if (!session || !session.loginTimestamp) return false;

      const now = Date.now();
      // 24 Hours timer (1 Day)
      if (now - session.loginTimestamp > this.SESSION_DURATION_MS) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  clearSession() {
    this.state.currentUser = null;
    localStorage.removeItem(this.STORAGE_KEY_USER);
    localStorage.removeItem(this.STORAGE_KEY_SESSION);
    this.notify();
  }

  seedInitialMeals() {
    // Fresh start: zero dummy meals
    this.state.meals = {};
    this.saveMealsToLocal();
  }

  seedInitialCooking() {
    // Fresh start: zero dummy cooking status
    this.state.cookingStatus = {};
    this.saveCookingToLocal();
  }

  saveMembersToLocal() {
    localStorage.setItem(this.STORAGE_KEY_MEMBERS, JSON.stringify(this.state.members));
  }

  saveMealsToLocal() {
    localStorage.setItem(this.STORAGE_KEY_MEALS, JSON.stringify(this.state.meals));
  }

  saveCookingToLocal() {
    localStorage.setItem(this.STORAGE_KEY_COOKING, JSON.stringify(this.state.cookingStatus));
  }

  setCurrentUser(user) {
    this.state.currentUser = user;
    if (user) {
      localStorage.setItem(this.STORAGE_KEY_USER, JSON.stringify(user));
      localStorage.setItem(this.STORAGE_KEY_SESSION, JSON.stringify({
        userId: user.id,
        loginTimestamp: Date.now(),
        loginDate: this.formatDate(new Date())
      }));
    } else {
      localStorage.removeItem(this.STORAGE_KEY_USER);
      localStorage.removeItem(this.STORAGE_KEY_SESSION);
    }
    this.notify();
  }

  setCurrentDate(dateStr) {
    this.state.currentDate = dateStr;
    if (this.state.dbMode === 'supabase') {
      this.syncDateFromSupabase(dateStr);
    }
    this.notify();
  }

  /* ── Supabase Synchronization ───────────────────────────────── */
  async syncFromSupabase() {
    try {
      // 1. Fetch members
      const dbMembers = await window.supabaseApi.getMembers();
      if (dbMembers && dbMembers.length > 0) {
        this.state.members = dbMembers;
        this.saveMembersToLocal();
        if (this.state.currentUser) {
          const matched = dbMembers.find(m => m.id === this.state.currentUser.id);
          if (matched) this.state.currentUser = matched;
        }
      }

      // 2. Fetch meals for active month (and recent history for continuous tracking)
      const [year, month] = this.state.currentDate.split('-').map(Number);
      await this.syncMonthFromSupabase(year, month);

      this.state.lastSync = new Date();
      this.notify();
    } catch (e) {
      console.warn('Sync from Supabase failed, using local cache:', e);
    }
  }

  async syncMonthFromSupabase(year, month) {
    if (this.state.dbMode !== 'supabase') return;
    try {
      const daysInMonth = new Date(year, month, 0).getDate();
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      // Also fetch up to 7 days prior so continuous state from previous month boundary is known
      const d = new Date(year, month - 1, 1);
      d.setDate(d.getDate() - 7);
      const priorStartDate = this.formatDate(d);

      const [mealsData, cookingData] = await Promise.all([
        window.supabaseApi.getMealsForMonth(priorStartDate, endDate),
        window.supabaseApi.getCookingStatus(this.state.currentDate)
      ]);

      if (mealsData) {
        mealsData.forEach(row => {
          const key = `${row.member_id}_${row.date}_${row.meal_type}`;
          this.state.meals[key] = {
            count: row.count,
            guest_count: row.guest_count || 0,
            updated_at: row.updated_at
          };
        });
        this.saveMealsToLocal();
      }

      if (cookingData) {
        cookingData.forEach(row => {
          const key = `${row.date}_${row.meal_type}`;
          this.state.cookingStatus[key] = {
            status: row.status,
            cooked_meals_count: row.cooked_meals_count,
            menu_item: row.menu_item || '',
            completed_at: row.completed_at
          };
        });
        this.saveCookingToLocal();
      }
    } catch (e) {
      console.warn('Month sync error:', e);
    }
  }

  async syncDateFromSupabase(dateStr) {
    try {
      const [mealsData, cookingData] = await Promise.all([
        window.supabaseApi.getMealsForDate(dateStr),
        window.supabaseApi.getCookingStatus(dateStr)
      ]);

      if (mealsData) {
        mealsData.forEach(row => {
          const key = `${row.member_id}_${row.date}_${row.meal_type}`;
          this.state.meals[key] = {
            count: row.count,
            guest_count: row.guest_count || 0,
            updated_at: row.updated_at
          };
        });
        this.saveMealsToLocal();
      }

      if (cookingData) {
        cookingData.forEach(row => {
          const key = `${row.date}_${row.meal_type}`;
          this.state.cookingStatus[key] = {
            status: row.status,
            cooked_meals_count: row.cooked_meals_count,
            menu_item: row.menu_item || '',
            completed_at: row.completed_at
          };
        });
        this.saveCookingToLocal();
      }
    } catch (e) {
      console.warn(`Sync error for date ${dateStr}:`, e);
    }
  }

  /* ── Meal Actions (Pencil Paper Continuous Protocol) ────────── */
  getMeal(memberId, date, mealType) {
    // 1. If an explicit record exists for this exact date:
    const exactKey = `${memberId}_${date}_${mealType}`;
    if (this.state.meals[exactKey] !== undefined) {
      const rec = this.state.meals[exactKey];
      return {
        count: rec.count || 0,
        guest_count: rec.guest_count || 0,
        isAutoContinuous: false,
        isExplicit: true
      };
    }

    // 2. Paper Sheet Protocol:
    // If a member gives their meal one day and doesn't erase it, it keeps running continuously.
    // Look back to find the most recent previous date where this member set their meal preference.
    const prefix = `${memberId}_`;
    const suffix = `_${mealType}`;
    let latestPrevDate = null;
    let latestPrevRecord = null;

    for (const key in this.state.meals) {
      if (key.startsWith(prefix) && key.endsWith(suffix)) {
        const recordDate = key.substring(prefix.length, key.length - suffix.length);
        if (recordDate < date) {
          if (!latestPrevDate || recordDate > latestPrevDate) {
            latestPrevDate = recordDate;
            latestPrevRecord = this.state.meals[key];
          }
        }
      }
    }

    // 3. If a past preference exists, its personal meal status carries forward continuously
    if (latestPrevRecord) {
      const personalMealOn = (latestPrevRecord.count - (latestPrevRecord.guest_count || 0)) > 0;
      return {
        count: personalMealOn ? 1 : 0,
        guest_count: 0, // Guest meals are one-off for the visit day only
        isAutoContinuous: true,
        continuousFrom: latestPrevDate
      };
    }

    // 4. If no previous record exists at all before this date, defaults to 0 (Off)
    return { count: 0, guest_count: 0, isAutoContinuous: false };
  }

  async clearAllMealData() {
    this.state.meals = {};
    this.state.cookingStatus = {};
    this.saveMealsToLocal();
    this.saveCookingToLocal();

    if (this.state.dbMode === 'supabase') {
      try {
        await window.supabaseApi.purgeAllMealDataFromCloud();
      } catch (e) {
        console.error('Failed to purge cloud meal data:', e);
      }
    }

    this.notify();
  }

  getCookingStatus(date, mealType) {
    const key = `${date}_${mealType}`;
    return this.state.cookingStatus[key] || {
      status: 'pending',
      cooked_meals_count: 0,
      menu_item: '',
      completed_at: null
    };
  }

  isMealLocked(date, mealType) {
    const cooking = this.getCookingStatus(date, mealType);
    return cooking.status === 'done';
  }

  async setMeal(memberId, date, mealType, isChecked, guestCount = 0) {
    // Check lock
    if (this.isMealLocked(date, mealType)) {
      throw new Error(`This meal has already been cooked by the Chef and is locked.`);
    }

    const count = isChecked ? (1 + guestCount) : 0;
    const finalGuestCount = isChecked ? guestCount : 0;
    const key = `${memberId}_${date}_${mealType}`;

    const record = {
      count,
      guest_count: finalGuestCount,
      updated_at: new Date().toISOString()
    };

    this.state.meals[key] = record;
    this.saveMealsToLocal();
    this.notify();

    // Async push to Supabase
    if (this.state.dbMode === 'supabase') {
      try {
        await window.supabaseApi.upsertMealEntry({
          member_id: memberId,
          date,
          meal_type: mealType,
          count,
          guest_count: finalGuestCount,
          updated_at: record.updated_at
        });
      } catch (err) {
        console.error('Failed to sync meal to Supabase:', err);
      }
    }
  }

  /* ── Chef Cooking Actions ───────────────────────────────────── */
  async setCookingStatus(date, mealType, status, cookedCount = null, menuItem = null) {
    const key = `${date}_${mealType}`;
    const current = this.getCookingStatus(date, mealType);
    
    // If cookedCount not specified, default to current requested count
    let finalCount = cookedCount !== null ? cookedCount : current.cooked_meals_count;
    if (status === 'done' && (cookedCount === null || cookedCount === 0)) {
      const stats = this.getMealStatsForDate(date);
      finalCount = stats[mealType]?.total || 0;
    }

    const updated = {
      status, // 'pending' | 'cooking' | 'done'
      cooked_meals_count: finalCount,
      menu_item: menuItem !== null ? menuItem : (current.menu_item || ''),
      completed_at: status === 'done' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    this.state.cookingStatus[key] = updated;
    this.saveCookingToLocal();
    this.notify();

    if (this.state.dbMode === 'supabase') {
      try {
        await window.supabaseApi.upsertCookingStatus({
          date,
          meal_type: mealType,
          status: updated.status,
          cooked_meals_count: updated.cooked_meals_count,
          menu_item: updated.menu_item,
          completed_at: updated.completed_at
        });
      } catch (err) {
        console.error('Failed to sync cooking status to Supabase:', err);
      }
    }
  }

  /* ── Stats & Calculations ───────────────────────────────────── */
  getMealStatsForDate(date) {
    const members = this.state.members.filter(m => m.role === 'member' && m.is_active !== false);
    const slots = ['breakfast', 'lunch', 'dinner'];
    const result = {};

    slots.forEach(slot => {
      let total = 0;
      let eaters = [];
      let skipped = [];

      members.forEach(m => {
        const meal = this.getMeal(m.id, date, slot);
        if (meal.count > 0) {
          total += meal.count;
          eaters.push({
            member: m,
            count: meal.count,
            guestCount: meal.guest_count || 0
          });
        } else {
          skipped.push(m);
        }
      });

      const cooking = this.getCookingStatus(date, slot);

      result[slot] = {
        total,
        eaters,
        skipped,
        cookingStatus: cooking.status,
        cookedMealsCount: cooking.cooked_meals_count,
        menuItem: cooking.menu_item,
        isCompleted: cooking.status === 'done',
        completedAt: cooking.completed_at
      };
    });

    return result;
  }

  // Monthly summary for a given year & month (1-indexed month, e.g. 10 for October)
  getMonthSummary(year, month) {
    const members = this.state.members.filter(m => m.role === 'member');
    const daysInMonth = new Date(year, month, 0).getDate();
    const memberTotals = {};
    let grandTotalMeals = 0;

    members.forEach(m => {
      memberTotals[m.id] = {
        member: m,
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        guestTotal: 0,
        total: 0,
        dailyBreakdown: {}
      };
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      members.forEach(m => {
        ['breakfast', 'lunch', 'dinner'].forEach(slot => {
          const meal = this.getMeal(m.id, dayStr, slot);
          if (meal.count > 0) {
            memberTotals[m.id][slot] += (meal.count - (meal.guest_count || 0));
            memberTotals[m.id].guestTotal += (meal.guest_count || 0);
            memberTotals[m.id].total += meal.count;
            grandTotalMeals += meal.count;

            if (!memberTotals[m.id].dailyBreakdown[dayStr]) {
              memberTotals[m.id].dailyBreakdown[dayStr] = { breakfast: 0, lunch: 0, dinner: 0, total: 0 };
            }
            memberTotals[m.id].dailyBreakdown[dayStr][slot] = meal.count;
            memberTotals[m.id].dailyBreakdown[dayStr].total += meal.count;
          }
        });
      });
    }

    return {
      year,
      month,
      daysInMonth,
      grandTotalMeals,
      membersSummary: Object.values(memberTotals)
    };
  }

  /* ── Member Management ──────────────────────────────────────── */
  async addMember(name, roomNo = '', pin = '0000', role = 'member') {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newMember = {
      id: 'mem-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      name: name.trim(),
      role,
      pin: pin.trim() || '0000',
      room_no: roomNo.trim(),
      avatar_color: randomColor,
      is_active: true,
      created_at: new Date().toISOString()
    };

    if (this.state.dbMode === 'supabase') {
      try {
        const inserted = await window.supabaseApi.createMember({
          name: newMember.name,
          role: newMember.role,
          pin: newMember.pin,
          room_no: newMember.room_no,
          avatar_color: newMember.avatar_color,
          is_active: true
        });
        if (inserted && inserted[0]) {
          newMember.id = inserted[0].id;
        }
      } catch (err) {
        console.error('Failed to create member in Supabase, saving locally:', err);
      }
    }

    this.state.members.push(newMember);
    this.saveMembersToLocal();
    this.notify();
    return newMember;
  }

  async updateMember(id, updates) {
    const memberIndex = this.state.members.findIndex(m => m.id === id);
    if (memberIndex === -1) throw new Error('Member not found');

    const updatedMember = {
      ...this.state.members[memberIndex],
      ...updates
    };

    this.state.members[memberIndex] = updatedMember;

    if (this.state.currentUser && this.state.currentUser.id === id) {
      this.state.currentUser = updatedMember;
      localStorage.setItem(this.STORAGE_KEY_USER, JSON.stringify(updatedMember));
    }

    this.saveMembersToLocal();

    if (this.state.dbMode === 'supabase') {
      try {
        await window.supabaseApi.updateMember(id, {
          name: updatedMember.name,
          room_no: updatedMember.room_no,
          pin: updatedMember.pin,
          role: updatedMember.role
        });
      } catch (err) {
        console.error('Failed to update member in Supabase:', err);
      }
    }

    this.notify();
    return updatedMember;
  }

  async deleteMember(id) {
    const memberIndex = this.state.members.findIndex(m => m.id === id);
    if (memberIndex === -1) return false;

    // Remove member
    this.state.members.splice(memberIndex, 1);

    // Remove local meal entries for this member
    Object.keys(this.state.meals).forEach(k => {
      if (k.startsWith(`${id}_`)) {
        delete this.state.meals[k];
      }
    });

    // If current user is deleted, fallback to another member or chef
    if (this.state.currentUser && this.state.currentUser.id === id) {
      this.state.currentUser = this.state.members[0] || null;
      if (this.state.currentUser) {
        localStorage.setItem(this.STORAGE_KEY_USER, JSON.stringify(this.state.currentUser));
      } else {
        localStorage.removeItem(this.STORAGE_KEY_USER);
      }
    }

    this.saveMembersToLocal();
    this.saveMealsToLocal();

    if (this.state.dbMode === 'supabase') {
      try {
        await window.supabaseApi.deleteMember(id);
      } catch (err) {
        console.error('Failed to delete member in Supabase:', err);
      }
    }

    this.notify();
    return true;
  }
}

window.messStorage = new MessStorage();
