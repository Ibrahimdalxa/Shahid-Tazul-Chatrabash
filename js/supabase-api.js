// js/supabase-api.js - Supabase REST API Service

class SupabaseApi {
  constructor() {
    this.url = window.CONFIG.SUPABASE_URL;
    this.key = window.CONFIG.SUPABASE_ANON_KEY;
    this.isOnline = false;
    this.tablesExist = false;
  }

  _headers() {
    return {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  async testConnection() {
    try {
      const res = await fetch(`${this.url}/rest/v1/mess_members?select=id&limit=1`, {
        method: 'GET',
        headers: this._headers()
      });

      if (res.status === 200) {
        this.isOnline = true;
        this.tablesExist = true;
        return { success: true, status: 'ready', message: 'Connected to Supabase database successfully.' };
      } else if (res.status === 404) {
        this.isOnline = true;
        this.tablesExist = false;
        return { success: false, status: 'no_tables', message: 'Connected to Supabase, but tables are not yet created. Please run the SQL schema.' };
      } else {
        const text = await res.text();
        return { success: false, status: 'error', message: text };
      }
    } catch (err) {
      this.isOnline = false;
      this.tablesExist = false;
      return { success: false, status: 'network_error', message: err.message };
    }
  }

  /* ── Members ─────────────────────────────────────────────────── */
  async getMembers() {
    if (!this.tablesExist) return null;
    const res = await fetch(`${this.url}/rest/v1/mess_members?select=*&order=role.asc,name.asc`, {
      headers: this._headers()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async createMember(member) {
    if (!this.tablesExist) return null;
    const res = await fetch(`${this.url}/rest/v1/mess_members`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(member)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async updateMember(id, updates) {
    if (!this.tablesExist) return null;
    const res = await fetch(`${this.url}/rest/v1/mess_members?id=eq.${id}`, {
      method: 'PATCH',
      headers: this._headers(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async deleteMember(id) {
    if (!this.tablesExist) return null;
    const res = await fetch(`${this.url}/rest/v1/mess_members?id=eq.${id}`, {
      method: 'DELETE',
      headers: this._headers()
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }

  /* ── Meals ───────────────────────────────────────────────────── */
  async getMealsForDate(dateStr) {
    if (!this.tablesExist) return null;
    const res = await fetch(`${this.url}/rest/v1/meal_entries?date=eq.${dateStr}&select=*`, {
      headers: this._headers()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getMealsForMonth(startDate, endDate) {
    if (!this.tablesExist) return null;
    const res = await fetch(`${this.url}/rest/v1/meal_entries?date=gte.${startDate}&date=lte.${endDate}&select=*`, {
      headers: this._headers()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async upsertMealEntry(entry) {
    if (!this.tablesExist) return null;
    // PostgREST upsert with on_conflict
    const headers = {
      ...this._headers(),
      'Prefer': 'resolution=merge-duplicates,return=representation'
    };
    const res = await fetch(`${this.url}/rest/v1/meal_entries?on_conflict=member_id,date,meal_type`, {
      method: 'POST',
      headers,
      body: JSON.stringify(entry)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  /* ── Cooking Status ──────────────────────────────────────────── */
  async getCookingStatus(dateStr) {
    if (!this.tablesExist) return null;
    const res = await fetch(`${this.url}/rest/v1/cooking_status?date=eq.${dateStr}&select=*`, {
      headers: this._headers()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async upsertCookingStatus(statusObj) {
    if (!this.tablesExist) return null;
    const headers = {
      ...this._headers(),
      'Prefer': 'resolution=merge-duplicates,return=representation'
    };
    const res = await fetch(`${this.url}/rest/v1/cooking_status?on_conflict=date,meal_type`, {
      method: 'POST',
      headers,
      body: JSON.stringify(statusObj)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  /* ── Supabase Authentication ────────────────────────────────── */
  async signInWithPassword({ email, password }) {
    try {
      const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': this.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        return { 
          data: null, 
          error: { message: data.error_description || data.msg || data.message || 'Authentication failed' } 
        };
      }

      localStorage.setItem('sb_manager_token', data.access_token);
      return { data, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  }

  async signUp({ email, password }) {
    try {
      const res = await fetch(`${this.url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'apikey': this.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        return { 
          data: null, 
          error: { message: data.error_description || data.msg || data.message || 'Signup failed' } 
        };
      }

      return { data, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  }

  /* ── Cloud Data Reset (Purge) ────────────────────────────────── */
  async purgeAllMealDataFromCloud() {
    const token = localStorage.getItem('sb_manager_token') || this.key;
    const headers = {
      'apikey': this.key,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    try {
      // 1. Delete all cooking_status rows
      await fetch(`${this.url}/rest/v1/cooking_status?id=neq.00000000-0000-0000-0000-000000000000`, {
        method: 'DELETE',
        headers
      });

      // 2. Delete all meal_entries rows
      await fetch(`${this.url}/rest/v1/meal_entries?id=neq.00000000-0000-0000-0000-000000000000`, {
        method: 'DELETE',
        headers
      });

      return { success: true };
    } catch (err) {
      console.error('Cloud purge failed:', err);
      return { success: false, error: err.message };
    }
  }
}

window.supabaseApi = new SupabaseApi();
