import { closeVisitorSession, openSupportSession } from "./marketplace_support_service.js";

const demoRecipient = process.env.DEMO_RECIPIENT ?? "";
if (!demoRecipient) {
  throw new Error("DEMO_RECIPIENT is required");
}

async function main() {
  const opened = await openSupportSession({
    orderId: "order_9001",
    productId: "course_reading_lab",
    sellerId: "seller_math_studio",
    buyerId: "buyer_ana",
    buyerEmail: demoRecipient,
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
  });

  console.log({
    channel: opened.channel,
    nextQueue: opened.nextQueue,
    publishedEvents: opened.publishedEvents
  });

  const emailed = await closeVisitorSession({
    orderId: "order_9001",
    buyerEmail: demoRecipient,
    transcriptLines: [
      "Seller shared Week 2 reading worksheet.",
      "Buyer reported missing access after payment.",
      "Service handed the chat to order support."
    ]
  });

  console.log({
    transcriptEmailMessageId: emailed.messageId
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
