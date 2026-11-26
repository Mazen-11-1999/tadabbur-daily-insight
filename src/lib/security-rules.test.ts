import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
const expect = (value: unknown) => ({
  toBe: (expected: unknown) => assert.equal(value, expected),
  toEqual: (expected: unknown) => assert.deepEqual(value, expected),
  toThrow: () => assert.throws(value as () => unknown),
});
import { AI_DAILY_LIMIT, localNotificationTime, notificationIsDue, timezoneSchema, subscriptionEndpointSchema } from "./security-rules";
import { validCronSecret } from "./cron-auth.server";
import { validateAyahRef } from "./reflections.server";

describe("Requested security rules", () => {
  test("AI daily allowance is 30", () => { expect(AI_DAILY_LIMIT).toBe(30); });
  test("notification callback rejects absent, incorrect, and unconfigured secrets", () => {
    expect(validCronSecret(null, "test-value")).toBe(false);
    expect(validCronSecret("incorrect", "test-value")).toBe(false);
    expect(validCronSecret("test-value", undefined)).toBe(false);
    expect(validCronSecret("test-value", "test-value")).toBe(true);
  });
  test("verse boundaries include 114:6 and reject 114:7, 1:8, 0:1 and 115:1", () => {
    expect(validateAyahRef({ surah_number: 114, ayah_number: 6 })).toEqual({ surah_number: 114, ayah_number: 6 });
    for (const [surah_number, ayah_number] of [[114,7],[1,8],[0,1],[115,1],[2,287],[1,0]]) {
      expect(() => validateAyahRef({ surah_number, ayah_number })).toThrow();
    }
  });
  test("subscriber date follows timezone even across UTC midnight", () => {
    const date = new Date("2026-11-26T22:00:00Z");
    expect(localNotificationTime(date, "Asia/Riyadh")).toEqual({ hour: 1, day: "2026-11-27" });
    expect(localNotificationTime(date, "America/New_York")).toEqual({ hour: 17, day: "2026-11-26" });
  });
  test("local hour is respected and a subscriber gets no duplicate on the same local date", () => {
    const date = new Date("2026-11-26T22:00:00Z");
    expect(notificationIsDue(date, { timezone: "Asia/Riyadh", notification_hour: 1, last_sent_date: null }).due).toBe(true);
    expect(notificationIsDue(date, { timezone: "Asia/Riyadh", notification_hour: 1, last_sent_date: "2026-11-27" }).due).toBe(false);
    expect(notificationIsDue(date, { timezone: "Asia/Riyadh", notification_hour: 22, last_sent_date: null }).due).toBe(false);
  });
  test("timezone tracks summer time automatically", () => {
    expect(localNotificationTime(new Date("2026-07-01T12:00:00Z"), "Europe/London").hour).toBe(13);
    expect(localNotificationTime(new Date("2026-12-01T12:00:00Z"), "Europe/London").hour).toBe(12);
    expect(timezoneSchema.safeParse("bad-zone").success).toBe(false);
  });
  test("subscription deletion requires a concrete endpoint", () => {
    expect(subscriptionEndpointSchema.safeParse(undefined).success).toBe(false);
    expect(subscriptionEndpointSchema.safeParse("").success).toBe(false);
    expect(subscriptionEndpointSchema.safeParse("https://example.com/push/current").success).toBe(true);
  });
});