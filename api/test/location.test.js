import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
const banned = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
  "Phoenix",
  "San Diego",
  "Los Angeles",
  "Chicago",
  "Houston",
  "Dallas",
  "Austin",
  "Seattle",
  "Boston",
  "Miami",
  "Denver",
  "Philadelphia",
  "Atlanta",
  "Las Vegas",
];
async function files(dir) {
  let out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const url = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
    out.push(...(e.isDirectory() ? await files(url) : [url]));
  }
  return out;
}
test("all turf copy, metadata and scripts stay location-neutral", async () => {
  for (const path of await files(new URL("../../turf/", import.meta.url))) {
    const body = await readFile(path, "utf8");
    for (const name of banned)
      assert.ok(
        !new RegExp("\\b" + name + "\\b", "i").test(body),
        path.pathname + ": " + name,
      );
    assert.ok(!/\b(?:\(\d{3}\)|\d{3}[-.])\s*\d{3}[-.]\d{4}\b/.test(body));
  }
});
