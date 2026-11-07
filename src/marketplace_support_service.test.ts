import test from "node:test";
import assert from "node:assert/strict";
import { decideSupportQueue, openSupportSession } from "./marketplace_support_service.js";

test("paid order hands off to order support and publishes the handoff stage", async () => {
  const calls: Array<{ body: unknown; kind: string }> = [];

  const fakeClient = {
    realtime: {
      channel: {
        create: async (body: unknown) => {
          calls.push({ kind: "channel.create", body });
          return {};
        }
      },
      token: {
        issue: async (body: unknown) => {
          calls.push({ kind: "token.issue", body });
          return { token: "buyer-token-1" };
        }
      },
      publish: async (body: unknown) => {
        calls.push({ kind: "publish", body });
        return {};
      }
    },
    email: {
      send: async () => ({ message_id: "msg_1" })
    }
  };

  assert.equal(decideSupportQueue("paid"), "order-support");

  const result = await openSupportSession(
    {
      orderId: "order_9001",
      productId: "course_reading_lab",
      sellerId: "seller_math_studio",
      buyerId: "buyer_ana",
      buyerEmail: "ana@example.com",
      orderStatus: "paid",
      asset: {
        title: "Week 2 reading worksheet",
        kind: "worksheet",
        url: "https://example.com/assets/week-2-reading-worksheet"
      },
      buyerUpdate: {
        kind: "access",
        message: "I paid, but the worksheet is not visible in my dashboard yet."
      }
    },
    fakeClient as never
  );

  assert.equal(result.nextQueue, "order-support");
  const handoff = calls.find(
    (entry) =>
      entry.kind === "publish" &&
      typeof entry.body === "object" &&
      entry.body !== null &&
      "event" in entry.body &&
      (entry.body as { event?: string }).event === "order.handoff.ready"
  );

  assert.ok(handoff);
  assert.equal((handoff.body as { data: { stage: string } }).data.stage, "order-support");
});
