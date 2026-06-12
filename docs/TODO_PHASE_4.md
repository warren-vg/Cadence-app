# Phase 4 TODOs

## Key Events & Blocks — Calendar Integration

When Google/Apple Calendar integration ships, Key Events & Blocks pulls fixed-time obligations from connected calendars automatically. Manual entry remains as fallback.

The `quarterly_events` table is already structured to receive this data (`title`, `start_date`, `end_date`, `type`). The calendar sync job should upsert into this table per user per quarter, leaving manually entered events untouched.
