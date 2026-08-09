import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry, fetchOkWithRetry } from "./fetch-retry";

function okResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithRetry", () => {
  it("returns the first successful response without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithRetry("https://example.com");
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries after a network-level failure and succeeds on the next attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(okResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithRetry("https://example.com", { attempts: 2 });
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws the last network error once every attempt fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchWithRetry("https://example.com", { attempts: 3 }),
    ).rejects.toThrow("timeout");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-ok response: a 404 is not a network failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithRetry("https://example.com", { attempts: 3 });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
    // A single attempt: the whole point is that Yahoo can fall through from
    // NSE to BSE without burning retries on an expected miss.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("waits retryDelayMs between attempts when given", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(okResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithRetry("https://example.com", {
      attempts: 2,
      retryDelayMs: () => 500,
    });
    await vi.advanceTimersByTimeAsync(500);
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("fetchOkWithRetry", () => {
  it("throws when the final response is not ok", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchOkWithRetry("https://example.com", { attempts: 1 }),
    ).rejects.toThrow("500");
  });

  it("returns the response when ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ hi: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchOkWithRetry("https://example.com");
    expect(await res.json()).toEqual({ hi: true });
  });
});
