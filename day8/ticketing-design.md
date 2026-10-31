# TicketHub: Event Ticketing Design

TicketHub is a website where people browse concerts and events, pick seats and buy tickets.

## 1. Requirements

**Functional**

- Users can register, log in and browse events.
- Users can view the seats for an event and see which are free.
- Users can hold seats for a few minutes, pay, and view their tickets.

**Non-functional**

- **Speed:** event and seat pages load in under 1 second.
- **Correctness:** a seat is never sold to two people.
- **Fairness:** during a big sale, buyers are served in the order they arrive.
- **Availability:** 99.9% overall, and the site stays up during a big sale.

## 2. Estimates

**Assumptions:** 1 day is about 100,000 seconds. Peak traffic is about 5x average.

**Normal day**

- Page views: 50,000 visitors x 10 pages = 500,000 views per day, so 500,000 / 100,000 = **5 views/s** (about 25/s at peak).
- Purchases: 5,000 tickets per day, so 5,000 / 100,000 = **0.05 tickets/s**. This is tiny.
- Read-heavy: 100 page views for every ticket sold.

**Big sale (first 10 minutes = 600 seconds)**

- 200,000 people try to buy 20,000 seats.
- 200,000 / 600 = about **333 buyers/s**, and each does several requests (open event, view seats, hold, pay). At about 5 requests each, that is roughly **1,700 requests/s**.
- 20,000 seats / 600 s = about 33 seats sold per second at the very most.
- 10 people compete for every seat (200,000 / 20,000), so **90% will fail**.

**Comparison:** the big sale is about 65x the normal rate for page views (333 vs 5 per second) and thousands of times the rate for purchase attempts (333 vs 0.05 per second). One server would cope on a normal day, but not during a sale.

## 3. API

Base URL `/api`, JSON, plural nouns, Bearer token for logged-in routes, stateless.

| Method | Endpoint             | Purpose                                      | Success |
| ------ | -------------------- | -------------------------------------------- | ------- |
| GET    | `/events`            | List events (`?page=`, `?city=`)             | 200     |
| GET    | `/events/{id}`       | One event's details                          | 200     |
| GET    | `/events/{id}/seats` | Seats and whether each is free, held or sold | 200     |
| POST   | `/events/{id}/holds` | Hold chosen seats for 5 minutes              | 201     |
| POST   | `/orders`            | Pay for a hold and create the order          | 201     |
| GET    | `/users/me/tickets`  | List my tickets                              | 200     |

**Hold request:** `POST /events/7/holds` with `{ "seat_ids": [101, 102] }` returns `201` with `{ "hold_id": 55, "expires_at": "2026-11-05T18:05:00Z" }`.

**Errors:** 400 invalid input, 401 not logged in, 404 event not found, **409 seat already taken**, 410 hold expired, 429 too many requests.

## 4. Data Model (PostgreSQL)

| Table    | Columns                                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`  | `id` PK, `email` UNIQUE NOT NULL, `password_hash` NOT NULL, `name`                                                                                             |
| `events` | `id` PK, `name`, `venue`, `starts_at`, `on_sale_at`                                                                                                            |
| `seats`  | `id` PK, `event_id` FK, `section`, `row_label`, `seat_number`, `price_cents`, `status` (free, held or sold), `hold_id` FK (nullable), `order_id` FK (nullable) |
| `holds`  | `id` PK, `user_id` FK, `event_id` FK, `expires_at`                                                                                                             |
| `orders` | `id` PK, `user_id` FK, `total_cents`, `status`, `created_at`                                                                                                   |

**Relationships (all one-to-many)**

- One event has many seats (`seats.event_id`).
- One user has many orders (`orders.user_id`) and many holds (`holds.user_id`).
- One order has many seats (`seats.order_id`). A seat belongs to at most one order, so no join table is needed. A sold seat is the ticket.
- One hold covers many seats (`seats.hold_id`).

**Constraints:** `UNIQUE (event_id, section, row_label, seat_number)` so a seat exists once; `CHECK (status IN ('free','held','sold'))`; `price_cents >= 0`.

**Indexes:** `seats(event_id, status)` for the seat map, the most frequent read; `orders(user_id)` for "my tickets". Indexes slow writes slightly, which is fine here.

PostgreSQL is chosen because correctness matters most, and it gives transactions and constraints.

## 5. Preventing Double-Booking

Two buyers can click the same seat at the same moment. The database, not the app server, decides who wins, using a **transaction** and an **atomic conditional update**.

**Hold step (`POST /events/{id}/holds`), in one transaction:**

```sql
BEGIN;

INSERT INTO holds (user_id, event_id, expires_at)
VALUES (?, 7, now() + interval '5 minutes') RETURNING id;
UPDATE seats
SET status = 'held', hold_id = ?
WHERE id IN (101, 102) AND event_id = 7 AND status = 'free';
-- if fewer than 2 rows changed, ROLLBACK and return 409
COMMIT;
```

- `AND status = 'free'` means only one of two simultaneous requests can change the row. The database locks the row during the update, so the second request finds it already `held`, changes 0 rows and gets **409 Conflict**.
- Checking "is it free?" in the app and then updating would be a race: both requests could read "free" first. Doing the check inside the `UPDATE` makes it a single atomic step.
- The transaction is **all or nothing**: if one of two seats is taken, none are held.

**Expiry:** a hold lasts 5 minutes. A background job sets seats with an expired hold back to `free`.

**Pay step (`POST /orders`):** in one transaction, check the hold is still valid, create the order, set the seats to `sold` with `order_id`, and delete the hold. Payment is confirmed first and the seat update uses `AND status = 'held' AND hold_id = ?`, so a seat cannot be sold twice or sold without a valid hold.

**Safety net:** the `UNIQUE` constraint and the `CHECK` on `status` stop bad rows even if there is an application bug.

## 6. Architecture

```
Browser
   |
  CDN (images, scripts, event pages)
   |
Load balancer (health checks, rate limits)
   |
Waiting room (queue, big sales only)
   |
App servers x 3+ (stateless)
   |            |              |
 Redis      Primary DB --> Read replica      Payment provider
 (cache)        ^                            (external)
                |
          Expiry worker
```

- **CDN:** serves static files and event pages near users, absorbing most of the page views.
- **Load balancer:** spreads requests, skips unhealthy servers, and returns 429 to users who send too many requests.
- **Waiting room:** during a big sale, lets buyers in **in the order they arrive**, at a rate the database can handle. Others see "You are number N in line". This is the fairness requirement.
- **App servers:** stateless, so we add more before a sale (3 normally, 10+ for a sale).
- **Redis:** caches event details and the seat map for 1-2 seconds. A "sold out" flag stops further requests reaching the database.
- **Primary database:** the single source of truth. It runs the hold and pay transactions from section 5.
- **Read replica:** serves event lists and "my tickets", so reads don't slow the primary.
- **Expiry worker:** frees seats whose 5-minute hold has run out.
- **Payment provider:** external. If it fails, the hold stays valid until it expires and the buyer can retry.

**Surviving the big sale:** about 1,700 requests/s arrive, but the CDN and cache answer most of the reads, and the waiting room keeps the buyers reaching the database to a steady rate. Only about 33 seats per second can actually sell, which one PostgreSQL primary handles. Losing buyers get a fast 409 and are not left waiting.

## 7. Trade-offs

- **Fairness vs speed:** the waiting room makes buyers wait, but it protects the database and gives everyone a fair turn. Without it the site would crash and nobody could buy.
- **Hold time (correctness vs availability):** a 5-minute hold stops double-booking while people pay, but an abandoned hold keeps a seat unavailable until it expires. A shorter hold frees seats sooner but rushes buyers.
- **Cache freshness vs load:** the seat map is cached for 1-2 seconds, so a buyer may click a seat that was just taken and get a 409. This is acceptable because the database check is the final authority.
- **Cost vs peak capacity:** extra servers are added only for big sales, which costs less than running them all year.
