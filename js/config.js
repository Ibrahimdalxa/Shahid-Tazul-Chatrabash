// js/config.js - Supabase Configuration & Mess Meal Constants

const CONFIG = {
  SUPABASE_URL: 'https://ujkrxcqvnxkxfnpwaydy.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqa3J4Y3F2bnhreGZucHdheWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjY5NTMsImV4cCI6MjA5MzUwMjk1M30.TFBezCSekTtgQ6AoKZ1VWJwf8RwHU2upAlu02N0Zs7o',
  
  MESS_NAME: 'Our Mess Meal Hub',
  
  MEAL_SLOTS: [
    {
      id: 'breakfast',
      name: 'Morning / Breakfast',
      shortName: 'Morning',
      icon: '🌅',
      timeLabel: 'Morning (07:30 AM - 09:30 AM)',
      defaultCutoff: '07:00'
    },
    {
      id: 'lunch',
      name: 'Lunch',
      shortName: 'Lunch',
      icon: '☀️',
      timeLabel: 'Afternoon (01:30 PM - 03:00 PM)',
      defaultCutoff: '11:00'
    },
    {
      id: 'dinner',
      name: 'Dinner',
      shortName: 'Dinner',
      icon: '🌙',
      timeLabel: 'Night (09:00 PM - 10:30 PM)',
      defaultCutoff: '19:00'
    }
  ],

  DEFAULT_MEMBERS: [
    { id: 'chef-1', name: 'Chef (The Cook)', role: 'chef', pin: '0000', room_no: 'Kitchen', avatar_color: '#EF4444' },
    { id: 'mem-1', name: 'Ibrahim', role: 'member', pin: '0000', room_no: 'Room 101', avatar_color: '#3B82F6' },
    { id: 'mem-2', name: 'Rahim', role: 'member', pin: '0000', room_no: 'Room 101', avatar_color: '#10B981' },
    { id: 'mem-3', name: 'Tanvir', role: 'member', pin: '0000', room_no: 'Room 102', avatar_color: '#F59E0B' },
    { id: 'mem-4', name: 'Sabbir', role: 'member', pin: '0000', room_no: 'Room 102', avatar_color: '#8B5CF6' },
    { id: 'mem-5', name: 'Shakil', role: 'member', pin: '0000', room_no: 'Room 103', avatar_color: '#EC4899' }
  ]
};

window.CONFIG = CONFIG;
