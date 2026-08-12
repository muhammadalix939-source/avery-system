---
name: Operations hub (seat urgency + client checklist)
description: Group seat-urgency prioritization, Full/Closed group section, Alerts Hub tabs, per-client service checklist rules
type: feature
---
- remaining_seats = group total_pax − confirmed client members (supplier purchase pax never consume seats).
- Groups sort by: nearest departure date first, then fewest remaining seats. 0 seats => FULL, muted and moved to "Full / Closed Groups" section below active list; still searchable.
- Alerts Hub (/alerts): tabs Groups (seat urgency) + Clients (package completion), Payments tab reserved. Has its own search.
- Client Service Checklist: defaults Transport, Ziyarat, Hotel, Visa; fully CRUD per client; statuses Pending / In Progress / Completed. Progress badge "n/m" shown in client table, search results, alerts. All-complete => moves to Completed archive (reversible).
- Every delete across modules goes through ConfirmDelete confirmation.
