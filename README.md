# 🍲 Mess Meal-Counting System (Meal Hub)

A responsive, mobile-first Web Application & PWA built for shared hostel/bachelor messes. It tracks daily meals for roommates, automatically aggregates orders for the cook (chef), prevents changes once cooking is done, and computes monthly meal totals for hassle-free billing.

---

## 📱 Features

1. **Member Dashboard (`My Meals`)**:
   - Check or uncheck daily meals for **Morning (Breakfast)**, **Lunch**, and **Dinner**.
   - Optional **Guest Meals counter** (`+1`, `+2`) if visitors or friends join.
   - **Live Cooked Food Notification**: Displays the number of meals cooked and fair portion guidance so members can divide food fairly!
   - **Smart Lock Rule**: Meals can be toggled freely until the Cook presses **"Cooking Done"**. Once finished, the meal slot automatically locks to prevent post-cooking order tampering.

2. **Chef's Command Center (`Chef Corner`)**:
   - Real-time automatic meal counting for each slot (Morning, Lunch, Dinner).
   - Eaters list (members who checked IN + guest portions) and opt-out list (members who checked OFF).
   - Menu planner: Enter dishes (e.g., *Chicken Curry, Dal & Rice*).
   - **"Cooking Done"** action button: Locks the meal slot for that time and publishes the cooked count to all members.

3. **Monthly Calculation & Settlement (`Monthly Sheet`)**:
   - Total meals count per member for the selected month (Morning + Lunch + Dinner + Guests).
   - Total mess meals summary and daily average.
   - Detailed day-by-day meal calendar for any member.
   - **CSV Export** & **Print Sheet** for monthly expense calculation (Meal Rate × Member Meals).

4. **Member Management & Quick PIN Login**:
   - Zero tedious passwords or email confirmations: select profile and enter quick 4-digit PIN (fast on phones).
   - Add new roommates and set custom roles (`member` or `chef`).

5. **Cloud + Offline Local Storage**:
   - Integrated with **Supabase REST API** (`https://ujkrxcqvnxkxfnpwaydy.supabase.co`).
   - Automatically falls back to local storage if offline or before running database migrations.

---

## ⚡ Setup Supabase Database

1. Open your [Supabase SQL Editor](https://supabase.com/dashboard/project/ujkrxcqvnxkxfnpwaydy/sql/new).
2. Click the **"Cloud Synced / Setup SQL"** button in the app header and tap **"📋 Copy SQL"**.
3. Paste into the Supabase SQL editor and click **Run**.
4. That's it! The app will detect the tables and switch to **🟢 Cloud Synced**.

---

## 🚀 How to Run Locally

You can run this app with any local HTTP server:

```powershell
# Option A: Python
python -m http.server 3000

# Option B: Node / npx
npx serve .
```

Open `http://localhost:3000` in your mobile browser or PC browser!
