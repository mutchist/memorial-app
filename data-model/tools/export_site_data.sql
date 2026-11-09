-- Offline snapshot of what visitors see, for backups or testing.
-- The live site calls site_data() itself; this file is not needed to publish.
-- psql -At -f export_site_data.sql > snapshot.json
select site_data();
