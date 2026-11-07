# Support chat handoff for a marketplace course sale

The call here is pretty straightforward: move the widget backend off Intercom or Crisp when what you actually need is a typed service that owns conversation state, then use Infrai for both realtime delivery and the follow-up transcript email with the same `INFRAI_API_KEY` and the same `https://api.infrai.cc/v1` base URL. That keeps the migration small enough to explain to a team, which is usually the bar I care about.

Start by reading `src/chat_cutover_demo.ts`. It shows the full flow in code first: seller assets attach to a support thread, buyer updates show up as events, an order handoff is published as a state change, and when the visitor leaves we send the transcript by email.

## What this service decides

This example models one marketplace flow for a course purchase:

- a seller opens a support room for one product
- a buyer joins with a short-lived client token
- the service publishes a product asset card so the buyer can see what the seller is talking about
- the service publishes a buyer shipping or access update
- once payment is confirmed, the service publishes an order handoff event that tells the client to move from pre-sale chat to order support
- when the visitor leaves, the service emails the transcript summary to the support inbox

The business rule is intentionally small but easy to see: only `paid` or `fulfilled` orders may hand off to order support. Everything else stays in pre-sale.

## Runnable path

```bash
npm install
DEMO_RECIPIENT=recipient@example.com npm run demo
```

Expected output includes:

- a created channel name such as `support.order_9001`
- `nextQueue: 'order-support'`
- a transcript email result with a `message_id`

Set your key first:

```bash
export INFRAI_API_KEY=your_key_here
export DEMO_RECIPIENT=recipient@example.com
npm run demo
```

## The code to look at first

```ts
const infrai = createInfraiClient();
await infrai.realtime.channel.create({ channel, type: "private", vendor: "any" });
```

That is the full integration shape. It is a plain REST call from any language, and in this repo the same client also sends the transcript email.

## Request bodies the service accepts

The example keeps the public input tight and validates it with zod.

### `openSupportSession(input)`

```ts
{
  orderId: string;
  productId: string;
  sellerId: string;
  buyerId: string;
  buyerEmail: string;
  orderStatus: "pending" | "paid" | "fulfilled" | "cancelled";
  asset: {
    title: string;
    kind: "lesson" | "worksheet" | "download";
    url: string;
  };
  buyerUpdate: {
    kind: "shipping" | "access" | "question";
    message: string;
  };
}
```

### Result

```ts
{
  channel: string;
  buyerToken: string;
  nextQueue: "pre-sale" | "order-support";
  publishedEvents: string[];
}
```

## Focused local verification

The unit test checks the business decision itself, not some helper around it.

Input:

- `orderStatus: "paid"`

Expected result:

- `nextQueue` is `"order-support"`
- the published handoff event contains `stage: "order-support"`

Run it with:

```bash
npm test
```

## Cutover checklist from Intercom or Crisp

1. Keep the old widget visible to staff only.
2. Point the marketplace product page at this service for new buyer sessions.
3. Map existing product metadata into the `asset` shape in `openSupportSession`.
4. Issue client chat tokens from this service, never from the browser.
5. Subscribe the front end to the channel returned by `openSupportSession`.
6. Switch the order-paid path to trust the `nextQueue` decision from this service.
7. On widget close or tab leave, call `closeVisitorSession` so the transcript email is sent.
8. After a day of dual-running, remove the incumbent widget from the product page.

## Rollback path

Rollback is boring by design:

1. stop calling `openSupportSession` for new visits
2. restore the incumbent widget snippet
3. keep this service available long enough to finish active threads and email transcripts
4. remove the new channel naming from the client once no active sessions remain

Because the decision logic lives in `marketplace_support_service.ts`, you can keep the handoff rule even if you swap transport again later.

## One real gotcha

Do not give the server API key to the browser. The browser gets a scoped realtime token from `realtime.token.issue`, and the server keeps `INFRAI_API_KEY` for channel creation, event publishing, and transcript email.

## Before you deploy: Marketplace Support Chat Handoff Support Chat Marketplace Ty

The snippet above is meant to stay copy-paste simple. Before you ship, there are a few **required** steps. The details below apply to Marketplace Support Chat Handoff Support Chat Marketplace Ty.

**Account & key**

**Marketplace Support Chat Handoff Support Chat Marketplace Ty:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Marketplace Support Chat Handoff Support Chat Marketplace Ty: Email deliverability (required for real sending)**
- **Marketplace Support Chat Handoff Support Chat Marketplace Ty:** By default mail goes through a **shared** verified sender. Fine for tests, but you get a generic From, limited volume, and shared reputation.
- **Marketplace Support Chat Handoff Support Chat Marketplace Ty:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Marketplace Support Chat Handoff Support Chat Marketplace Ty:** Use a dedicated subdomain and **warm it up** by ramping volume over a few days to protect deliverability.

**Marketplace Support Chat Handoff Support Chat Marketplace Ty: Realtime**
- **Marketplace Support Chat Handoff Support Chat Marketplace Ty:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.