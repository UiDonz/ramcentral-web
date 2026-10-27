# NewRamCentral - User Guide
## For students
**Creating an account:** Click "Create an account" on the login screen, fill in your name, RAM
ID, email, and a password, and choose "Student." You'll land on the Clubs page right away.
**Finding clubs:** The Clubs page lists every active club. Use the search box to filter by name
or category. Clubs you've already joined show separately under "My clubs" at the top.
**Joining a club:** Open a club and click "Join club." If the club requires officer approval
instead, the button will say "Request to join" - an officer needs to approve you before you show
up as a full member.
**Leaving a club:** Open the club and click "Leave club" (or "Cancel request" if you're still
pending).
**Events:** The Events page in the top navigation shows upcoming events only from clubs you've
joined. Click RSVP on any event you plan to attend.
## For club officers
Everything students can do, plus, from inside your club's page:
- **Edit club info** - update the description, meeting times, and contact info.
- **Post an announcement** - shows instantly to everyone viewing the club.
- **Create an event** - give it a title, date/time, location, and description.
- **Approve pending members** - if your club requires approval to join, pending requests appear
  under "Members."
- **Promote a member to officer** - click "Promote to officer" next to their name in the member
  list. They immediately get the same officer tools you have for that club.
  Officer status is per-club: you can be a regular member of one club and an officer of another.
## Starting a new club
Click "Start a club" in the navigation. You become that club's first officer automatically.
## News & Campus Calendar (added in Sprint 3)
The News tab (`/news`) is a live campus information hub, built on top of a scheduled scraper
rather than the club/event data teammates enter by hand.
**Where the data comes from**
- `scripts/scrape-news.js` runs on a schedule via GitHub Actions
(`.github/workflows/scrape-news.yml`),
never in the browser. It holds the only admin-level Firebase credentials and the Anthropic API key
in this project, both injected from GitHub Actions secrets at run time.
- It pulls two things: Farmingdale's News Room headlines, and every event on the school's real public
calendar feed (the same one behind farmingdale.edu/calendar/) - academic deadlines, RamCentral/
CampusLabs club events, general campus events, and athletics.
- Each item is categorized as academic / clubs / campus by keyword match, summarized in a few
original-words sentences by Claude, and written to Firestore (`schoolNews`, `academicCalendar`,
and one `campusDigest` doc per day).
**What the page shows**
- A calendar with a small colored dot per category on any day that has events; clicking a day shows
that day's full detail list.
- Today's Overview: the day's digest broken into individual clickable cards.
- Three auto-scrolling feeds - Academic news, Clubs & fairs (real officer-created events appear here
first, tagged "CLUB EVENT", ahead of scraped items), and Campus news.
- Clicking any card zooms it into a large, centered detail panel (the same ZoomCard component used
everywhere a card expands); click anywhere on the open panel, the backdrop, the close button, or
press Escape to dismiss it.
**Known simplifications worth mentioning in your next report**
- Today's digest is split into sentences and category-tagged with a keyword guess on the client,
since the AI-written digest has no per-sentence category metadata attached - it is usually right,
but not guaranteed.
- The scraper's rolling calendar window (3 days back, 60 days out) means an event added to the
school's calendar further out than 2 months won't appear until a later scheduled run picks it up.