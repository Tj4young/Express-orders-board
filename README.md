# Express Open Orders Board

A live board for the Tempe and Mesa offices of Express Employment Professionals. Laptops, phones, and the office TV all see the same orders. Every **+1 Filled** pops confetti on every screen, including the Battle TV, and names who placed the person. When that fill is the last opening, the room gets the bigger order-filled celebration and the order moves into Wins, where it stays saved so someone can reopen it later.

When a client pulls an order because a competitor filled it, mark **Competitor filled** on the card. That order leaves the board with no confetti and no win. Placements already made keep their credit. The openings that were still empty do not. The order stays in Filled / Saved jobs, marked with the date, and it is listed on the Lost orders page.

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
| Lost orders | `https://your-site.vercel.app/lost` |

On the TV, open the Battle page, tap the browser’s full-screen control, and leave it there. That page is view-only. It never shows **+1 Filled** or **Add order**, even if someone unlocks another computer.

## How the desks use it

1. Open the Tempe or Mesa page.
2. Tap **Unlock** and enter the team passcode. That browser remembers it until someone taps **Lock**.
3. Tap **+ Add order**. Fill in office, client, position, pay, shift, openings, how many are already filled, who opened it, date opened, and notes. **Upload logo** adds the client's logo from a PNG, JPG, WebP, SVG, or a phone photo. The phone photo is shrunk on the device before it is saved. **Replace logo** or **Remove** changes it later. If there is no logo, the card shows the client's initials. No extra storage setup is required. The picture is saved with the order.
4. On the card, tap **+1 Filled** each time a person is placed. A list of names comes up. Tap who placed that person. The person who opened the order is the big blue button at the top. Every screen, including the Battle TV, gets confetti and a line such as `🎉 Ivonne placed a Machine Operator at State Seal! 2 of 5 filled`. If you tap once too many, tap **Undo**. Undo removes the latest placement and that person's credit. Undo does not celebrate.
5. **Competitor filled**, on an open order card, is for when the client pulls the job because someone else filled it. Tap it, then confirm. The passcode is required, the same as a fill. The order leaves this board and the Open orders list. It does not celebrate, it does not land on Wins, and the openings still empty do not add heads or count as an order filled. Anyone already placed on that order keeps that head. The order stays under **Filled / Saved jobs**, marked **Competitor filled** with the date. **Undo** there, or the Undo on the notice that pops up, puts that same order back. **Reopen** makes a fresh copy, the same as a filled job, and the original pull stays on the Lost orders page. Each office's snapshot counts how many of its orders are competitor filled. The full list, with totals by office and by client, a month filter, and a CSV export, is on **Lost**.
6. When filled reaches openings, three things happen:
   - A bigger celebration, for example `🎉 Express Tempe filled Forklift Operator at ACME!`
   - The filled date is stamped automatically.
   - The order leaves the active board and shows up under Wins. It is saved, not deleted. The fill history stays with that order.
7. **Filled / Saved jobs**, on the Tempe page and the Mesa page, lists that office's finished orders and its competitor-filled orders. Search by client or position. **Reopen** puts a fresh copy back on the board: same office, client, position, pay, shift, notes, logo, recruiter, and number of openings, with filled reset to 0 and today's date. The original stays where it was: a win stays on Wins, and a competitor pull stays marked competitor filled. Heads already counted on the Battle page stay counted once. Filling the new copy counts only the new placements. Wins has the same **Reopen** button. It asks for the team passcode, the same way adding and editing do.
8. **Open orders** is the tab on the left edge of the Tempe and Mesa pages, on a laptop or a phone. It lists every open order: logo, client, position, how many are filled, and which office. Tap one to jump to that card. An order from the other office opens that office's board. Competitor-filled orders are not in that list.
9. Editing the filled count up celebrates once for that save, even if the number jumps by more than one. Editing it down does not celebrate.
10. Orders that have been open **14 days or more** get an **Aging** badge.
11. Use the filters for recruiter and shift. Sort by oldest or by most openings.
12. **Recruiters** lets you rename someone or move them to the other office. You cannot remove a recruiter who still has orders or placements. Moving someone does not rewrite heads they already placed.
13. **Sound off** is the default so a TV stays quiet. Tap **Sound on** on a laptop if you want a short chime with the confetti. Each browser remembers that choice. The browser may ignore sound until the page has been clicked.
14. **Add example order** puts one clearly labeled sample on the board (`EXAMPLE — Demo Client`). It is optional, there can be only one, and it is not a real job. Delete it when you are done looking.

Changes show up for everyone within a few seconds. You do not need to refresh.

## How the scoreboard works

The Battle page compares the offices in **Arizona time**. Weeks run Monday through Sunday.

- **Heads** are people placed. Each **+1 Filled** is one head for the person you tap, and for that person's office. The order card shows the split, such as **Ivonne 2 · Jane 2**. Undo removes the latest head.
- **Orders filled** still belong to the office that opened the order.
- **Fill rate** is orders closed during the period, divided by orders that office was working. An order counts as worked if it is still open, it was filled during the period, or a competitor filled it during the period. Orders finished before the period started do not count. A competitor pull is worked, not closed.
- The **trophy** goes to the office with more heads this month. If that is a tie, the office that closed more orders wins. If that is also a tie, the higher fill rate wins. If all of that matches, the board says the offices are tied.
- The recruiter leaderboard counts heads for the person who placed them, across both offices. On the Battle TV, tap a name to open that person's placements for this month: client and logo, position, office, how many they placed on that order, and the date. Newest order first. The rows add up to the number beside the name, including fills on a job that was later reopened or marked competitor filled. Tap the name again to close it. One name stays open at a time, and the board refreshing does not close it. Nothing on that list asks for the passcode.
- The ticker names everyone who placed someone on a filled order. A single fill celebrates the person who placed that one. The order-filled celebration still names everyone who placed someone on that order.
- **Opened by** is who opened the order. It is not who gets every head.
- **Reopen** copies a filled job, or a competitor-filled job, onto the board. It does not add heads, and it does not count as another filled order. The original win keeps its credit. A competitor pull stays on the Lost orders page. Only placements on the new copy are new.
- **Competitor filled** is not an order filled. It adds no heads for openings that were still empty. Heads already placed on that order stay with the people who placed them. For fill rate, the order still counts as worked during the Arizona month it was pulled, so the rate does not jump up, and it does not count as closed. After that month it drops out. Undo removes the pull from the Lost orders page and puts the same order back on the board. The Lost page lists every pull: date marked, office, client, position, how many were filled before the pull, who opened it, and days open. Filter by month and export CSV from that page.

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
