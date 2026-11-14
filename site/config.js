/* Where the site reads its data. Both values are public by design: the
   publishable key only allows what the database's row-level security
   allows visitors (published rows). Find them in Supabase under
   Project Settings > API Keys. */
window.SITE_CONFIG = {
  supabaseUrl: 'https://fwcuapconsfvzmtoucnu.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3Y3VhcGNvbnNmdnptdG91Y251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzI4NTcsImV4cCI6MjA4OTUwODg1N30.USnWmNQeyzj6O4ri0BtE8GB0-efAkTrN9CxIr8wd1vw',
  // the year strip on the Watch page: the years in view when the page opens (first, last); drag for the others
  storyYears: [1939, 1945],
  // where the Watch map opens, before any place is mentioned: centre [longitude, latitude] and zoom (Europe)
  mapHome: { center: [10, 50], zoom: 3.4 }
};
