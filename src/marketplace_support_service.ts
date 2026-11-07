import { z } from "zod";
import { createInfraiClient } from "./infrai_client.js";

const assetSchema = z.object({
  title: z.string().min(1),
  kind: z.enum(["lesson", "worksheet", "download"]),
  url: z.string().url()
});

const buyerUpdateSchema = z.object({
  kind: z.enum(["shipping", "access", "question"]),
  message: z.string().min(1)
});

export const supportSessionSchema = z.object({
  orderId: z.string().min(1),
  productId: z.string().min(1),
  sellerId: z.string().min(1),
  buyerId: z.string().min(1),
  buyerEmail: z.string().email(),
  orderStatus: z.enum(["pending", "paid", "fulfilled", "cancelled"]),
  asset: assetSchema,
  buyerUpdate: buyerUpdateSchema
});

export type SupportSessionInput = z.infer<typeof supportSessionSchema>;

export function decideSupportQueue(orderStatus: SupportSessionInput["orderStatus"]) {
  return orderStatus === "paid" || orderStatus === "fulfilled" ? "order-support" : "pre-sale";
}

export async function openSupportSession(input: SupportSessionInput, customClient?: ReturnType<typeof createInfraiClient>) {
  const parsed = supportSessionSchema.parse(input);
  const infrai = customClient ?? createInfraiClient();
  const channel = `support.${parsed.orderId}`;
  const nextQueue = decideSupportQueue(parsed.orderStatus);
  const publishedEvents: string[] = [];

  await infrai.realtime.channel.create({ channel, type: "private" });

  const tokenResult = await infrai.realtime.token.issue({
    client_id: parsed.buyerId,
    channels: [channel],
    capabilities: ["subscribe", "presence"],
    ttl_seconds: 1800
  });

  await infrai.realtime.publish({
    channel,
    event: "seller.asset.shared",
    data: {
      orderId: parsed.orderId,
      productId: parsed.productId,
      sellerId: parsed.sellerId,
      asset: parsed.asset,
      request_id: `${parsed.orderId}:asset`
    },
    account_id: parsed.sellerId
  });
  publishedEvents.push("seller.asset.shared");

  await infrai.realtime.publish({
    channel,
    event: "buyer.update.received",
    data: {
      orderId: parsed.orderId,
      buyerId: parsed.buyerId,
      update: parsed.buyerUpdate,
      request_id: `${parsed.orderId}:buyer-update`
    },
    account_id: parsed.buyerId
  });
  publishedEvents.push("buyer.update.received");

  await infrai.realtime.publish({
    channel,
    event: "order.handoff.ready",
    data: {
      orderId: parsed.orderId,
      stage: nextQueue,
      orderStatus: parsed.orderStatus,
      request_id: `${parsed.orderId}:handoff`
    },
    account_id: parsed.sellerId
  });
  publishedEvents.push("order.handoff.ready");

  return {
    channel,
    buyerToken: tokenResult.token ?? "issued",
    nextQueue,
    publishedEvents
  };
}

const closeVisitorSchema = z.object({
  orderId: z.string().min(1),
  buyerEmail: z.string().email(),
  transcriptLines: z.array(z.string().min(1)).min(1)
});

export type CloseVisitorInput = z.infer<typeof closeVisitorSchema>;

export async function closeVisitorSession(input: CloseVisitorInput, customClient?: ReturnType<typeof createInfraiClient>) {
  const parsed = closeVisitorSchema.parse(input);
  const infrai = customClient ?? createInfraiClient();

  const body = [
    `Marketplace support transcript for ${parsed.orderId}`,
    "",
    ...parsed.transcriptLines.map((line, index) => `${index + 1}. ${line}`)
  ].join("\n");

  const result = await infrai.email.send({
    to: parsed.buyerEmail,
    subject: `Support transcript for order ${parsed.orderId}`,
    body
  });

  return {
    orderId: parsed.orderId,
    messageId: result.message_id
  };
}
