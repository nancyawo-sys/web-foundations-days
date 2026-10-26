# TicketHub: Design Document

## 1. Context

TicketHub is a website that sells tickets for concerts and events. Most days traffic is calm, but when a popular concert goes on sale, hundreds of thousands of fans arrive at once and compete for a limited number of seats. The system must stay fast and, above all, must never sell the same seat to two people.

**Goals:** browse events, view seats, hold seats, pay, and view your tickets; stay correct and fair under a big sale.
**Non-goals:** resale/transfer of tickets, dynamic pricing, mobile apps, refunds workflow, and multi-currency support.

## 2. Requirements

**Functional**
- Users can register and log in.
- Users can browse and search events and see event details. Users can hold at most 4 seats per event.
- Users can view the seat map with each seat's availability.
- Users can hold seats temporarily (5 minutes) while they pay.
- Users can pay for held seats and receive tickets. Four-seat limit per user. It stops one person buying out the show, but groups wanting more than four seats must use several accounts.
- Users can view their orders and tickets.

**Non-functional**
- **Correctness (most important):** a seat can be sold to at most one person, even with thousands of simultaneous attempts.
- **Speed:** browsing pages load in under 1 second; seat hold responds in under 500 ms.
- **Fairness:** during a big sale, people are served roughly first-come, first-served and nobody is stuck on an error page.
- **Availability:** 99.9% overall; the site must not crash during a big sale.
- **Durability:** a paid order is never lost.

## 3. Estimates

### Normal day
- 50,000 visitors × 10 pages = 500,000 page views/day
- 500,000 ÷ 100,000 seconds ≈ **5 requests/second** (about 25/second at peak, assuming 5× the average)
- 5,000 tickets/day ≈ **0.05 purchases/second**
- Read-heavy: about 100 page views for every ticket sold.

### Big sale (20,000 seats, 200,000 buyers, first 10 minutes = 600 seconds)
- Arrivals: 200,000 ÷ 600 ≈ **333 users/second**
- Each user makes about 10 requests (event page, seat map refreshes, hold attempts) → about 2,000,000 requests ÷ 600 ≈ **3,300 requests/second**, perhaps 7,000/second at peak.
- Seat hold attempts: about 3 per user → 600,000 ÷ 600 ≈ **1,000 hold attempts/second**
- Tickets sold: 20,000 ÷ 600 ≈ **33 purchases/second**

### Comparison
| | Normal | Big sale | Increase |
|---|---|---|---|
| Requests/second | 5 | 3,300 | ~660× |
| Purchases/second | 0.05 | 33 | ~660× |
| Contention | almost none | 10 attempts per seat | huge |

The big sale is a tiny event in time but dominates the design. We design for the sale, not the normal day, and use cheap scaling steps (cache, queue) so we do not pay for peak capacity all month.

## 4. Proposed Design

### 4.1 API

| Method and path | Purpose | Success |
|---|---|---|
| `POST /users` | register | 201 Created |
| `POST /login` | log in, returns a token | 200 OK |
| `GET /events?query=&page=` | browse/search events | 200 OK |
| `GET /events/{id}` | event details | 200 OK / 404 |
| `GET /events/{id}/seats` | seat map with status | 200 OK |
| `POST /events/{id}/holds` | hold seats, body `{ "seatIds": [12, 13] }` | 201 Created / **409 Conflict** if any seat is taken |
| `POST /orders` | pay for a hold, body `{ "holdId": 7 }` with an `Idempotency-Key` header | 201 Created / 410 Gone if the hold expired |
| `GET /orders` | list my orders | 200 OK |
| `GET /orders/{id}/tickets` | view tickets in an order | 200 OK / 404 |

Example: `POST /events/5/holds` with `{ "seatIds": [12, 13] }` returns `201` with `{ "holdId": 7, "expiresAt": "2026-11-02T18:05:00Z" }`. If seat 13 is already held, it returns `409` with `{ "error": "Seat 13 is not available" }` and holds nothing.

### 4.2 Data model

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  venue      TEXT NOT NULL,
  starts_at  TEXT NOT NULL,
  sale_start TEXT NOT NULL
);

CREATE TABLE orders (
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  total_cents     INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seats (
  id              INTEGER PRIMARY KEY,
  event_id        INTEGER NOT NULL REFERENCES events(id),
  label           TEXT NOT NULL,              -- e.g. 'A-12'
  price_cents     INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'held', 'sold')),
  held_by         INTEGER REFERENCES users(id),
  hold_expires_at TEXT,
  order_id        INTEGER REFERENCES orders(id),  -- set when sold
  UNIQUE (event_id, label)
);
```

**Relationships:** a user has many orders; an event has many seats; an order has many seats (one seat belongs to at most one order). `UNIQUE (event_id, label)` stops duplicate seat rows, and `order_id` is only ever written once per seat.

### 4.3 How double-booking is prevented

The database, not the application code, is the final judge. Holding a seat is one **atomic conditional update inside a transaction**:

```sql
BEGIN;
UPDATE seats
   SET status = 'held', held_by = :user, hold_expires_at = :now_plus_5min
 WHERE id = :seat
   AND event_id = :event
   AND (status = 'available'
        OR (status = 'held' AND hold_expires_at < :now));
-- check the number of rows changed: 1 = success, 0 = someone else got it
COMMIT;
```

1. If two people click the same seat at the same time, the database handles one request first and changes the seat from “available” to “held”. When it reaches the second request, the seat is no longer available, so nothing changes and that person gets a 409 error. If someone picks several seats and one is taken, the whole request is cancelled (rolled back) so nobody ends up with half an order. A seat can only be marked “sold” if the same user still holds it and the hold has not expired. A unique key on each order also stops a double-clicked Pay button from charging twice.
2. When holding several seats, all updates run in one transaction. If any seat returns 0 rows, we **roll back**, so the user never ends up with half an order.
3. Payment happens only on a valid hold. After the payment provider confirms, a second transaction sets `status = 'sold'` and `order_id` **only if** `held_by = :user AND hold_expires_at > :now`. If the hold expired, nothing changes and the user gets `410 Gone` (and is refunded or never charged).
4. The `idempotency_key` is unique, so a double-clicked "Pay" button or a retried request cannot create two orders.
5. The cache never decides availability. It only shows the seat map; the database check above has the last word.

Expired holds are returned to the pool automatically, because the update above treats an expired hold as available. A background job also resets them so the seat map stays tidy.

### 4.4 Architecture

```
 Users
   |
   v
 CDN  (images, JS, CSS, event pages)
   |
   v
 Waiting room / queue  (only during a big sale)
   |
   v
 Load balancer
   |
   +--> App server 1 --+
   +--> App server 2 --+--> Redis cache (event details, seat map snapshot)
   +--> App server N --+
                       |
                       +--> Primary database (all writes: holds, orders)
                       |        |
                       |        +--> Read replicas (browsing, my orders)
                       |
                       +--> Payment provider (external)

 Background worker: expires old holds, sends confirmation emails
```

| Component | Why it exists |
|---|---|
| CDN | Serves images and static files near the user; removes most of the load from our servers. |
| Waiting room | The big sale brings about 660× normal traffic. Admitting users at a steady rate (for example 300 per second) keeps the database below its limit and makes the order fair (first come, first served). |
| Load balancer + stateless app servers | One server cannot handle about 3,300 requests/second and would be a single point of failure. Servers are stateless (login tokens, no local data) so any server can handle any request and more can be added during a sale. |
| Redis cache | Event pages and the seat map are read thousands of times per second but change slowly. Serving them from memory in about 1 ms protects the database. Seat map entries expire after 1-2 seconds. |
| Primary database | The single source of truth for seat status; all holds and orders go through it so the atomic updates above work. |
| Read replicas | Handle browsing and "my tickets" reads and take over if the primary fails. |
| Payment provider | We never store card numbers; the provider handles payment security. |
| Background worker | Releases expired holds and sends emails without slowing down requests. |

**How it survives the big sale:** the CDN and cache absorb the reads, the waiting room smooths the arrival spike, stateless servers scale out, and only about 1,000 hold attempts/second reach the primary database, which a single well-indexed table can handle because each is a small, quick update.

## 5. Trade-offs and Alternatives Considered

1. **Hold duration (5 minutes).** Longer holds give users time to pay but let people block seats they never buy; shorter holds free seats faster but frustrate slow payers. We chose 5 minutes as a balance.
2. **Waiting room vs. letting everyone in.** The waiting room adds complexity and makes some people wait, but without it the database could be overloaded and everyone would get errors. We accept the wait in exchange for stability and fairness.
3. **Slightly stale seat map vs. always accurate.** Caching the seat map for 1-2 seconds means a user may click a seat that was just taken and get a `409`. We accept this because the database still guarantees correctness, and it reduces database reads dramatically.
4. **Alternative: lock rows with `SELECT ... FOR UPDATE` instead of a conditional update.** It works, but holds locks longer and is easier to get wrong. The single conditional `UPDATE` is shorter and simpler.
5. **Alternative: charge first, assign seats afterwards.** Rejected, because users could pay for seats that are no longer available.

## 6. Risks and Open Questions

- **Bots** buying seats at machine speed: need rate limiting per user/IP and CAPTCHA in the waiting room.
- **Payment provider slowness or outage** during a sale: need timeouts and a clear message that the hold is still valid.
- **Primary database failure** mid-sale: replicas can take over, but a few seconds of failed holds are possible. Failover must be tested.
- **Open question:** should one user be limited to a maximum of 4 seats per event for fairness? (Probably yes; to be decided.)