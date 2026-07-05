#!/usr/bin/env node
/* Mirror the team page's missing headshots into assets/team/.
   RUN THIS LOCALLY (node scripts/mirror-team-photos.js): the sandbox can't
   reach media.licdn.com or v4.run. NOTE: the LinkedIn URLs are SIGNED and
   EXPIRE (e=... timestamp) -- if a download 403s, re-grab the URL from the
   person's profile. The five photos already in the repo were copied from
   assets/contributors/. */
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");

const PHOTOS = [
  ["ayushi-singhal", "https://media.licdn.com/dms/image/v2/D4D03AQFzCml1mAERIQ/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1681541718242?e=1784764800&v=beta&t=qb8Yz3eGjJMi1NB4B79d5yvP5k1g5Vxbzv-ucWR8n3U"],
  ["varun-hemachandran", "https://v4.run/images/varun.jpg"],
  ["sathyajith-m-s", "https://media.licdn.com/dms/image/v2/D5603AQFgeqVtyMZxEw/profile-displayphoto-scale_400_400/B56ZnaYSdNHAAg-/0/1760305426206?e=1784764800&v=beta&t=Lj0kwkZ4zSuLnl3BRj6CyUHlXqQJx3MCEqZ49fz_6DE"],
  ["abhiram-rajilan", "https://media.licdn.com/dms/image/v2/D4D03AQFxGO8U5IxLhg/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1725624466157?e=1784764800&v=beta&t=cI1BJ4_e9idgoxJhbJCtqkPRK0xf854CyA48yKsv9w4"],
  ["garvita-gupta", "https://media.licdn.com/dms/image/v2/D4D03AQHOwgci3xK7CA/profile-displayphoto-crop_800_800/B4DZm.KVa2JEAM-/0/1759832006938?e=1784764800&v=beta&t=4eYrb8k0ReyvBoTrJ4-I3jCGcxwIKJm7UjaD2JfDHXg"]
];

const OUT = path.join(__dirname, "..", "assets", "team");
fs.mkdirSync(OUT, { recursive: true });

function get(url, redirects) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(get(res.headers.location, redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error("HTTP " + res.statusCode)); }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ buf: Buffer.concat(chunks), type: res.headers["content-type"] || "" }));
      res.on("error", reject);
    }).on("error", reject);
  });
}

(async () => {
  for (const [slug, url] of PHOTOS) {
    try {
      const { buf, type } = await get(url, 3);
      const ext = type.includes("png") ? "png" : "jpg";
      const file = path.join(OUT, slug + "." + ext);
      fs.writeFileSync(file, buf);
      console.log("ok ", slug, Math.round(buf.length / 1024) + "KB");
    } catch (e) {
      console.error("FAIL", slug, e.message);
    }
  }
})();
