-- site-wide announcements behind the /home mail icon

CREATE TABLE IF NOT EXISTS announcements (
    announcement_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title           text        NOT NULL,
    body            text        NOT NULL,
    actor_id        integer,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_at_idx
    ON announcements (created_at DESC, announcement_id DESC);

-- section for the first announcement, so the icon is not empty on the day it ships

INSERT INTO announcements (title, body)
SELECT $ann$140+ HOURS TRACKED$ann$, $ann$Heya everybody! Kuzu here, zoneout's organizer

we just hit 140+ hackatime hours tracked for the leaderboard!!! 🗣️ so peak

There's 70+ people on the leaderboard yet only around 17 have started working on their projects
If you're one of the people who didn't sign themselves in for the leaderboard, **please click on the events button, read the protocols, scroll  down and press "I'm in!" this opts you in the leaderboard.**

Remember, **the raffle of the Bambu A1 Mini 3D Printer will only be spun if we all lock in and give the entity Freedom.**

**Very Important:** The leaderboard's hours will be re-adjusted later on once you start submitting projects. The final approved hour count must be 280 or more hours.

Y'all need to lock in!!!
And I'll lock in on reviews

And together
WE WILL ALL FREE THE ENTITY AND SAVE ZONEOUT!!

*ps: new items being added to the shop soon!*

Happy grinding~
I believe in all of us. We can definitely do this.$ann$
 WHERE NOT EXISTS (SELECT 1 FROM announcements);
