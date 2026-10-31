# TicketHub: Event Ticketing Design

TicketHub is a website where people browse concerts and events, pick seats and buy tickets.

## 1. Requirements

**Functional:** browse events, view seats, hold seats for a few minutes, pay, and view my tickets.

**Non-functional:** **speed** (pages under 1 second), **correctness** (a seat is never sold to two people), **fairness** (in a big sale, buyers are served in arrival order), **availability** (99.9%, and the site stays up in a big sale).

## 2. Estimates

Assumptions: 1 day is about 100,000 seconds; peak is about 5x average.

- **Normal day:** 50,000 visitors x 10 pages = 500,000 views, so **5 views/s** (about 25/s at peak). 5,000 tickets/day = **0.05 tickets/s**.
- **Big sale:** 200,000 buyers in 600 s = **333 buyers/s**, about 5 requests each = **about 1,700 requests/s**. At most 33 seats/s can sell, and 10 people compete for each seat, so 90% fail.
- **Comparison:** about 65x the normal rate for views, and thousands of times for purchase attempts. One server copes on a normal day, but not in a sale.

## 3. API

Base URL `/api`, JSON, plural nouns, Bearer token, stateless.

| Method | Endpoint             | Purpose                                                 | Success |
| ------ | -------------------- | ------------------------------------------------------- | ------- |
| GET    | `/events`            | List events (`?page=`, `?city=`)                        | 200     |
| GET    | `/events/{id}`       | One event's details                                     | 200     |
| GET    | `/events/{id}/seats` | Seats: free, held or sold                               | 200     |
| POST   | `/events/{id}/holds` | Hold seats (`{ "seat_ids": [101, 102] }`) for 5 minutes | 201     |
| POST   | `/orders`            | Pay for a hold and create the order                     | 201     |
| GET    | `/users/me/tickets`  | List my tickets                                         | 200     |

**Errors:** 400 invalid input, 401 not logged in, 404 not found, **409 seat already taken**, 410 hold expired, 429 too many requests.

## 4. Data Model (PostgreSQL)

| Table    | Columns                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `users`  | `id` PK, `email` UNIQUE NOT NULL, `password_hash`, `name`                                                                              |
| `events` | `id` PK, `name`, `venue`, `starts_at`, `on_sale_at`                                                                                    |
| `seats`  | `id` PK, `event_id` FK, `section`, `row_label`, `seat_number`, `price_cents`, `status` (free, held, sold), `hold_id` FK, `order_id` FK |
| `holds`  | `id` PK, `user_id` FK, `event_id` FK, `expires_at`                                                                                     |
| `orders` | `id` PK, `user_id` FK, `total_cents`, `status`, `created_at`                                                                           |

**Relationships (one-to-many):** event to seats, user to orders and holds, order to seats, hold to seats. A seat belongs to at most one order, so no join table is needed.
**Constraints (a safety net):** `UNIQUE (event_id, section, row_label, seat_number)`; `CHECK (status IN ('free','held','sold'))`. **Index:** `seats(event_id, status)` for the seat map.

## 5. Preventing Double-Booking

The database, not the app server, decides who wins, using a **transaction** and an **atomic conditional update**:

```sql
BEGIN;
INSERT INTO holds (user_id, event_id, expires_at)
VALUES (?, 7, now() + interval '5 minutes') RETURNING id;
UPDATE seats SET status = 'held', hold_id = ?
WHERE id IN (101, 102) AND event_id = 7 AND status = 'free';
-- if fewer than 2 rows changed, ROLLBACK and return 409
COMMIT;
```

- `AND status = 'free'` makes the check and the change one atomic step. The second of two simultaneous buyers finds the seat already `held`, changes 0 rows and gets **409**. Checking in the app first would be a race.
- All or nothing: if one seat is taken, none are held.
- **Expiry and pay:** a worker frees seats whose hold has run out. `POST /orders` confirms payment, creates the order and sets seats to `sold` with `AND status = 'held' AND hold_id = ?`, in one transaction.

## 6. Trade-offs

- **Cached seat map vs live consistency:** Redis keeps reads fast, but a cached map may show a just-taken seat and give a 409. This is acceptable because the database check is final.
- **Waiting room vs open access:** the queue makes buyers wait, but it protects the database and gives everyone a fair turn.
- **Hold time:** 5 minutes stops double-booking while people pay, but abandoned holds block a seat until they expire.

## 7. Architecture

```
Browser -> CDN -> Load balancer -> Waiting room -> App servers (x3+, stateless)
                                                     |-> Redis (cache)
                                                     |-> Primary DB -> Read replica
                                                     |      ^
                                                     |   Expiry worker
                                                     |-> Payment provider (external)
```

- **CDN:** serves static files and event pages near users.
- **Load balancer:** spreads requests, skips unhealthy servers, returns 429 to abusers.
- **Waiting room:** lets buyers in **in arrival order** at a rate the database can handle (the fairness requirement).
- **App servers:** stateless; 3 normally, 10+ before a sale.
- **Redis:** caches event details and the seat map for 1-2 seconds.
- **Primary database:** the single source of truth; runs the section 5 transactions.
- **Read replica / expiry worker:** the replica serves event lists and "my tickets"; the worker frees expired holds.
- **Payment provider:** external; if it fails, the hold stays valid and the buyer can retry.

**Surviving the big sale:** the CDN and cache answer most of the 1,700 requests/s, the waiting room keeps database load steady, and only about 33 seats/s can sell, which one PostgreSQL primary handles.
