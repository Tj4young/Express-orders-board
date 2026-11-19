# Express Open Orders Board

A live board for the Tempe and Mesa offices of Express Employment Professionals. Laptops, phones, and the office TV all see the same orders. When someone hits **+1 Filled** and an order is full, the room gets a celebration and that order moves into Wins.

The board starts empty. It does not invent sample jobs. Recruiters start as Ivonne, Isabella, and Jane at Express Tempe, and Alex and Tim at Express Mesa. Change those offices anytime.

## Put it on the internet (Vercel)

You do not need to write code for this. Plan on about the time it takes to make a pot of coffee. You need a free [Vercel](https://vercel.com) account and this GitHub repo.

### 1. Create the shared memory (Upstash Redis)

Both offices have to read and write the same list. Redis is that shared list. The free tier is enough.

1. Go to [console.upstash.com](https://console.upstash.com) and sign in.
2. Click **Create Database**.
3. Give it a name like `express-orders`. Pick a region close to Arizona (US West is fine). Leave the type as Regional. Click **Create**.
4. Open the database, then the **REST API** section (sometimes called Connect).
5. Copy two values and keep the tab open:
   - **UPSTASH_REDIS_REST_URL**
   - **UPSTASH_REDIS_REST_TOKEN**

You can also add **Upstash Redis** from the Vercel Marketplace while you are in the project (step 3). If Vercel fills in the variables for you, you can skip the copying. This app accepts either of these pairs:

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- `KV_REST_API_URL` and `KV_REST_API_TOKEN`

### 2. Import the repo into Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. Choose **Import Git Repository** and pick this repo.
3. Framework should say **Next.js**. Leave the build command and output directory alone.
4. Do not click Deploy yet if you still need to paste the Redis values. Open **Environment Variables** on that same screen.

### 3. Add the settings

Add these for **Production**:

| Name | Value |
| --- | --- |
| `TEAM_PASSCODE` | A short passcode the desks will share. Not a password you use anywhere else. Example shape: `tempe-mesa-42`. |
| `UPSTASH_REDIS_REST_URL` | From Upstash. Skip if the Vercel Upstash button already added it. |
| `UPSTASH_REDIS_REST_TOKEN` | From Upstash. Skip if the integration already added it. |

`TEAM_PASSCODE` is only for adding and changing orders. The Battle TV does not need it.

### 4. Deploy

Click **Deploy** and wait until it says Ready. Open the site.

If you added the variables *after* the first deploy, they are not live yet. Go to **Deployments**, open the latest one, click **Redeploy**, and wait until it is Ready again.

### 5. Bookmark the right page

Replace `your-site` with the address Vercel gave you.

| Who | Bookmark |
| --- | --- |
| Tempe laptops and phones | `https://your-site.vercel.app/tempe` |
| Mesa laptops and phones | `https://your-site.vercel.app/mesa` |
| The office TV | `https://your-site.vercel.app/battle` |
| Wins / Hall of Fame | `https://your-site.vercel.app/wins` |

On the TV, open the Battle page, tap the browser’s full-screen control, and leave it there. That page is view-only. It never shows **+1 Filled** or **Add order**, even if someone unlocks another computer.

## How the desks use it

1. Open the Tempe or Mesa page.
2. Tap **Unlock** and enter the team passcode. That browser remembers it until someone taps **Lock**.
3. Tap **+ Add order**. Fill in office, client, position, pay, shift, openings, how many are already filled, recruiter, date opened, and notes.
4. On the card, tap **+1 Filled** each time a person is placed. A list of names comes up. Tap who placed that person. The person who opened the order is the big blue button at the top. If you tap once too many, tap **Undo**. Undo removes the latest placement and that person's credit.
5. When filled reaches openings, three things happen:
   - Confetti and a banner, for example `🎉 Express Tempe filled Forklift Operator at ACME!`
   - The filled date is stamped automatically.
   - The order leaves the active board and shows up under Wins.
6. Orders that have been open **14 days or more** get an **Aging** badge.
7. Use the filters for recruiter and shift. Sort by oldest or by most openings.
8. **Recruiters** lets you rename someone or move them to the other office. You cannot remove a recruiter who still has orders or placements. Moving someone does not rewrite heads they already placed.
9. **Sound off** is the default so a TV stays quiet. Tap **Sound on** on a laptop if you want a short chime with the confetti. Each browser remembers that choice. The browser may ignore sound until the page has been clicked.
10. **Add example order** puts one clearly labeled sample on the board (`EXAMPLE — Demo Client`). It is optional, there can be only one, and it is not a real job. Delete it when you are done looking.

Changes show up for everyone within a few seconds. You do not need to refresh.

## How the scoreboard works

The Battle page compares the offices in **Arizona time**. Weeks run Monday through Sunday.

- **Heads** are people placed. Each **+1 Filled** is one head for the person you tap, and for that person's office. The order card shows the split, such as **Ivonne 2 · Jane 2**. Undo removes the latest head.
- **Orders filled** still belong to the office that opened the order.
- **Fill rate** is orders closed during the period, divided by orders that office was working. An order counts as worked if it is still open, or it was filled during the period. Orders finished before the period started do not count.
- The **trophy** goes to the office with more heads this month. If that is a tie, the office that closed more orders wins. If that is also a tie, the higher fill rate wins. If all of that matches, the board says the offices are tied.
- The recruiter leaderboard counts heads for the person who placed them, across both offices.
- The ticker and the celebration name everyone who placed someone on that order.
- **Opened by** is who opened the order. It is not who gets every head.

Placements already on the board stay with the person who opened the order. Deleting an order removes those heads. Changing who opened an order does not move heads that were already placed.

## A note about the link

Anyone with the web address can **see** client names, pay, and notes. Only the passcode can change them. Do not post the link publicly. If the passcode gets out, change `TEAM_PASSCODE` in Vercel and redeploy. Old browsers will be asked to unlock again.

## If something looks wrong

- **“TEAM_PASSCODE is not set”** — add that variable in Vercel for Production, then redeploy.
- **“This deployment has no shared database yet”** — Redis is not connected. Add the Upstash variables (or connect the integration) and redeploy. On Vercel the board will not quietly save to the computer’s disk, because that would not be shared and would disappear.
- **Tempe cannot see Mesa’s order** — you are probably on two different `npm run dev` computers. Deploy with Redis so they share one board.
- **The passcode box shakes you off** — the value has to match exactly, including capitals.
- **The TV says Reconnecting** — check the office Wi‑Fi. The last orders stay on screen until the next successful check.
- **Confetti did not make a sound** — tap **Sound on** first. Browsers block audio until someone clicks the page.

## Run it on one computer (optional)

This is only for trying the board before it is online. Orders stay in a file on that computer (`data/board.json`). Other people will not see them.

1. Install [Node.js](https://nodejs.org) 20 or newer.
2. In this folder, run:

```bash
npm install
cp .env.example .env.local
```

3. Open `.env.local` and set `TEAM_PASSCODE` to anything you want. Leave the Redis lines blank unless you already have a database.
4. Start it:

```bash
npm run dev
```

5. Open [http://localhost:3000/tempe](http://localhost:3000/tempe). Battle TV is [http://localhost:3000/battle](http://localhost:3000/battle).

`npm test` checks the scoring, the fill/undo rules, and that two clicks at once cannot lose a fill. `npm run lint` and `npm run build` are the same checks Vercel runs.
