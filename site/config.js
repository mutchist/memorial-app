/* Where the site reads its data. Both values are public by design: the
   publishable key only allows what the database's row-level security
   allows visitors (published rows). Find them in Supabase under
   Project Settings > API Keys. */
window.SITE_CONFIG = {
  supabaseUrl: 'https://fwcuapconsfvzmtoucnu.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3Y3VhcGNvbnNmdnptdG91Y251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzI4NTcsImV4cCI6MjA4OTUwODg1N30.USnWmNQeyzj6O4ri0BtE8GB0-efAkTrN9CxIr8wd1vw'
};
