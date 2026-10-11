# SnapShare Scaling Plan

SnapShare is a photo-sharing app. Users upload photos and scroll a feed of photos from people they follow.

## Assumptions

- 10,000,000 registered users
- 10% are active each day
- Each active user uploads 1 photo per day
- Each active user views 50 feed pages per day
- An average photo is 2 MB, and each photo also gets a 50 KB thumbnail
- 1 day is about 100,000 seconds (rounded for easy maths)
- Peak traffic is about 5 times the average

## Estimates

**Daily active users (DAU):** 10,000,000 x 10% = 1,000,000 users per day

**Uploads**
- 1,000,000 users x 1 photo = 1,000,000 uploads per day
- 1,000,000 / 100,000 = **10 uploads per second** on average
- Peak: 10 x 5 = **50 uploads per second**

**Feed views**
- 1,000,000 users x 50 views = 50,000,000 feed views per day
- 50,000,000 / 100,000 = **500 feed views per second** on average
- Peak: 500 x 5 = **2,500 feed views per second**

**Storage per year**
- Per photo: 2 MB original + 0.05 MB thumbnail = 2.05 MB
- Per day: 1,000,000 x 2.05 MB = 2,050,000 MB = about 2 TB per day
- Per year: 2.05 TB x 365 = about **750 TB per year**
- (Originals alone: 2 TB x 365 = about 730 TB. Thumbnails add about 18 TB.)

## Read-heavy or write-heavy?

SnapShare is **read-heavy**. There are 500 feed views per second but only 10 uploads per second, so reads are about 50 times more common than writes.

What this means for the design:
- Caching is very valuable, because the same feeds and photos are read again and again.
- A CDN should serve photos and thumbnails, so most traffic never reaches our servers.
- Read replicas take read traffic off the primary database.
- Writes are fewer, so one primary database can handle them for now.

## Why photos should not go in the database

A photo is a large file, 2 MB or more. Storing 750 TB a year inside the database would make it huge, slow to back up and slow to query, and database storage is expensive. Photos also never need SQL queries. Instead, photos go in **object storage** (such as Amazon S3), which is cheap, built for large files and almost unlimited. The database stores only a link (URL) to each photo, plus details such as who uploaded it and when.

## Architecture diagram

```text
                        ┌─────────┐
          ┌────────────>│   DNS   │
          │             └─────────┘
 ┌────────┴──────┐  photos, thumbnails,   ┌──────────────────┐
 │ Browser /     │  app files             │       CDN        │
 │ mobile app    │ <────────────────────> │ (edge servers)   │
 └────────┬──────┘                        └────────┬─────────┘
          │ API calls (HTTPS, JSON)                │ cache miss
          v                                        v
   ┌───────────────┐                      ┌──────────────────┐
   │ Load balancer │                      │  Object storage  │
   └──────┬────────┘                      │ (photos + thumbs)│
     ┌────┴─────┬──────────┐              └────────▲─────────┘
     v          v          v                       │ save files
 ┌───────┐  ┌───────┐  ┌───────┐   ┌──────────┐    │
 │ App 1 │  │ App 2 │  │ App 3 │──>│  Cache   │    │
 └───┬───┘  └───┬───┘  └───┬───┘   │ (Redis)  │    │
     │ writes   │ reads    │ jobs  └──────────┘    │
     v          v          v                       │
 ┌─────────┐ ┌──────────┐ ┌───────┐   ┌────────┐   │
 │ Primary │>│  Read    │ │ Queue │──>│ Worker │───┘
 │   DB    │ │ replica  │ └───────┘   │(thumb- │
 └─────────┘ └──────────┘             │ nails) │
                                      └────────┘
```

## What each component does

- **DNS:** turns the name snapshare.com into the IP address of our servers, so users can find us.
- **CDN:** serves photos, thumbnails and app files from servers near the user, which cuts latency and takes load off our servers.
- **Load balancer:** spreads requests across several app servers and skips any that fail, so no single server is overloaded.
- **App servers:** run the API code (login, upload, feed). They are stateless, so any server can handle any request and we can add more.
- **Cache (Redis):** keeps popular feeds in memory so most feed views avoid the database, which fixes the heavy read load.
- **Primary database:** stores users, follows and photo details, and accepts all writes.
- **Read replica:** holds a copy of the primary and answers feed reads, so the primary is not overloaded.
- **Object storage:** holds the large photo files cheaply and safely, so the database stays small.
- **Queue:** holds jobs such as "make a thumbnail", so the app can answer the user straight away.
- **Worker:** takes jobs from the queue and creates thumbnails in the background, so uploads feel fast.

## Upload flow

1. The user picks a photo and taps Upload. The app sends it to `POST /photos` over HTTPS with the login token.
2. The load balancer sends the request to a healthy app server.
3. The app server checks the token and validates the file (type and size).
4. The app server saves the original photo in object storage and gets back its URL.
5. The app server writes a row in the primary database with the user id, the photo URL and the time.
6. The app server adds a "create thumbnail" job to the queue.
7. The app server deletes the cached feeds of the user's followers, so they see fresh data.
8. The app server replies `201 Created`. The user sees "Uploaded!" without waiting for the thumbnail.
9. A worker takes the job from the queue, reads the original from object storage, makes a 50 KB thumbnail and saves it back to object storage.
10. The worker updates the database row with the thumbnail URL. If the job fails, it is retried.
11. The primary copies the new row to the read replica a few milliseconds later.

## Trade-offs

1. **Speed versus freshness.** The cache, CDN and read replica make feeds fast, but a follower may see a feed that is a few seconds out of date because of cache expiry and replication lag. For a photo feed this is acceptable.
2. **Fast uploads versus instant thumbnails.** The queue lets the upload reply quickly, but the thumbnail appears a moment later. The app can show a placeholder until it is ready.
3. **Cost versus reliability.** Extra app servers, a replica and copies of photos in several regions improve uptime but cost more money. At 750 TB a year, storage cost is also a large part of the bill.
4. **Simplicity versus scalability.** One server is easier to run, but at 2,500 feed views per second at peak, a distributed design is needed.
