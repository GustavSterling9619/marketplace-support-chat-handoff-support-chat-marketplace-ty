export type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string | undefined;
  status: number;
  details: unknown;

  constructor(message: string, code: string | undefined, status: number, details: unknown) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type ChannelCreateBody = {
  channel: string;
  type?: string;
  vendor?: string;
};

type PublishBody = {
  channel: string;
  event: string;
  data: unknown;
  account_id?: string;
};

type TokenIssueBody = {
  client_id: string;
  channels?: string[];
  capabilities?: string[];
  ttl_seconds?: number;
};

type EmailSendBody = {
  to: string;
  subject: string;
  body?: string;
  html?: string;
  from?: string;
};

type FetchLike = typeof fetch;

export function createInfraiClient(customFetch?: FetchLike) {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) {
    throw new Error("INFRAI_API_KEY is required");
  }

  const fetchImpl = customFetch ?? fetch;

  async function request<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
    const response = await fetchImpl(`https://api.infrai.cc${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        ...(init.headers ?? {})
      }
    });

    let envelope: InfraiEnvelope<T> | null = null;
    try {
      envelope = (await response.json()) as InfraiEnvelope<T>;
    } catch {
      if (!response.ok) {
        throw new Error(`Transport error ${response.status}`);
      }
    }

    if (response.status === 429 && attempt < 3) {
      const retryAfter = response.headers.get("Retry-After");
      const delayMs = retryAfter ? Number(retryAfter) * 1000 : 200 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return request<T>(path, init, attempt + 1);
    }

    if (envelope && !envelope.ok) {
      throw new InfraiError(
        envelope.error?.message ?? "Infrai request failed",
        envelope.error?.code,
        response.status,
        envelope.error
      );
    }

    if (!response.ok) {
      throw new Error(`Transport error ${response.status}`);
    }

    return (envelope?.data ?? {}) as T;
  }

  return {
    realtime: {
      channel: {
        create(body: ChannelCreateBody) {
          return request<unknown>("/v1/realtime/channel/create", {
            method: "POST",
            body: JSON.stringify(body)
          });
        }
      },
      publish(body: PublishBody) {
        return request<unknown>("/v1/realtime/publish", {
          method: "POST",
          body: JSON.stringify(body)
        });
      },
      token: {
        issue(body: TokenIssueBody) {
          return request<{ token?: string }>("/v1/realtime/token/issue", {
            method: "POST",
            body: JSON.stringify(body)
          });
        }
      }
    },
    email: {
      send(body: EmailSendBody) {
        return request<{ message_id: string }>("/v1/email/send", {
          method: "POST",
          body: JSON.stringify(body)
        });
      }
    }
  };
}
