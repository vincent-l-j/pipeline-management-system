import {
  AxiosHeaders,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

type ApiModule = typeof import("../api");

let api: AxiosInstance;
let getLastRequestId: ApiModule["getLastRequestId"];
let reportClientError: ApiModule["reportClientError"];
let requestFulfilled: (
  config: InternalAxiosRequestConfig,
) => InternalAxiosRequestConfig;
let responseFulfilled: (data: unknown) => unknown;
let responseRejected: (error: unknown) => Promise<unknown>;

let originalLocation: Location;

beforeEach(async () => {
  // A fresh module per test: the last request id lives at module scope, so
  // without this the id one test captures decides what the next one sees.
  vi.resetModules();
  const module: ApiModule = await import("../api");
  api = module.default;
  getLastRequestId = module.getLastRequestId;
  reportClientError = module.reportClientError;

  // The interceptors are registered on the shared axios instance at import time.
  // Pull the registered handlers straight off the instance and invoke them
  // directly — no network needed to exercise the token/401 logic.
  // Both interceptors are synchronous, so the casts return values rather than promises.
  requestFulfilled = api.interceptors.request.handlers?.[0]?.fulfilled as (
    config: InternalAxiosRequestConfig,
  ) => InternalAxiosRequestConfig;
  responseFulfilled = api.interceptors.response.handlers?.[0]?.fulfilled as (
    data: unknown,
  ) => unknown;
  responseRejected = api.interceptors.response.handlers?.[0]?.rejected as (
    error: unknown,
  ) => Promise<unknown>;

  localStorage.clear();
  // jsdom's window.location isn't writable by default; swap in a stub so we
  // can observe the redirect without triggering a "navigation not implemented".
  originalLocation = window.location;
  Object.defineProperty(window, "location", {
    value: { href: "" },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});

describe("api request interceptor", () => {
  it("attaches a Bearer token when one is stored", () => {
    localStorage.setItem("token", "abc123");
    const config = requestFulfilled({
      headers: new AxiosHeaders(),
    } as InternalAxiosRequestConfig);

    expect((config.headers as Record<string, string>).Authorization).toBe(
      "Bearer abc123",
    );
  });

  it("leaves Authorization unset when no token is stored", () => {
    const config = requestFulfilled({
      headers: {},
    } as InternalAxiosRequestConfig);
    expect(
      (config.headers as Record<string, unknown>).Authorization,
    ).toBeUndefined();
  });
});

describe("api response interceptor", () => {
  it("passes successful responses through unchanged", () => {
    const response = { status: 200, data: { ok: true } };
    expect(responseFulfilled(response)).toBe(response);
  });

  it("clears auth storage and redirects to /login on 401", async () => {
    localStorage.setItem("token", "abc123");
    localStorage.setItem("user", JSON.stringify({ id: 1 }));
    const error = { response: { status: 401 }, isAxiosError: true } as unknown;

    await expect(responseRejected(error)).rejects.toBeInstanceOf(Error);
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("does not clear storage or redirect on non-401 errors", async () => {
    localStorage.setItem("token", "abc123");
    const error = { response: { status: 500 }, isAxiosError: true } as unknown;

    await expect(responseRejected(error)).rejects.toBeInstanceOf(Error);
    expect(localStorage.getItem("token")).toBe("abc123");
    expect(window.location.href).toBe("");
  });

  it("does not clear storage or redirect when the error report itself is rejected with a 401", async () => {
    localStorage.setItem("token", "abc123");
    const error = {
      response: { status: 401 },
      config: { url: "/client-errors" },
      isAxiosError: true,
    } as unknown;

    await expect(responseRejected(error)).rejects.toBeInstanceOf(Error);
    expect(localStorage.getItem("token")).toBe("abc123");
    expect(window.location.href).toBe("");
  });
});

describe("getLastRequestId", () => {
  it("captures the id from a successful response", () => {
    responseFulfilled({ headers: { "x-request-id": "req-success" } });
    expect(getLastRequestId()).toBe("req-success");
  });

  it("captures the id from a failed response", async () => {
    const error = {
      response: { status: 500, headers: { "x-request-id": "req-failure" } },
      isAxiosError: true,
    } as unknown;

    await expect(responseRejected(error)).rejects.toBeInstanceOf(Error);
    expect(getLastRequestId()).toBe("req-failure");
  });

  it("matches the header name whatever its casing", () => {
    // An AxiosHeaders instance keeps the original casing as its own keys, so a
    // lowercase bracket lookup would miss what a raw XHR response would find.
    responseFulfilled({
      headers: new AxiosHeaders({ "X-Request-ID": "req-mixed-case" }),
    });
    expect(getLastRequestId()).toBe("req-mixed-case");
  });

  it("keeps the previous id when a response carries no such header", () => {
    responseFulfilled({ headers: { "x-request-id": "req-kept" } });
    responseFulfilled({ headers: { "content-type": "application/json" } });
    expect(getLastRequestId()).toBe("req-kept");
  });
});

function acceptedResponse(): AxiosResponse {
  return { status: 202, data: { request_id: "req-server" } } as AxiosResponse;
}

describe("reportClientError", () => {
  beforeEach(() => {
    window.location.href = "http://localhost/pitches?stage=triage";
    window.location.pathname = "/pitches";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts a snake_case body to the client errors path", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue(acceptedResponse());

    await reportClientError(new Error("Boom"), "\n    in PitchesPage");

    expect(post).toHaveBeenCalledWith(
      "/client-errors",
      expect.objectContaining({
        message: "Boom",
        url: "/pitches",
        component_stack: "\n    in PitchesPage",
      }),
    );
  });

  it("reports the path only, never the query string that may carry a token", async () => {
    window.location.href = "http://localhost/auth/callback?token=a.live.jwt";
    window.location.pathname = "/auth/callback";
    const post = vi.spyOn(api, "post").mockResolvedValue(acceptedResponse());

    await reportClientError(new Error("Boom"));

    const body = post.mock.calls[0]?.[1] as { url: string };
    expect(body.url).toBe("/auth/callback");
    expect(body.url).not.toContain("a.live.jwt");
  });

  it("sends the last request id as the correlation value", async () => {
    responseFulfilled({ headers: { "x-request-id": "req-correlated" } });
    const post = vi.spyOn(api, "post").mockResolvedValue(acceptedResponse());

    await reportClientError(new Error("Boom"));

    expect(post).toHaveBeenCalledWith(
      "/client-errors",
      expect.objectContaining({ correlated_request_id: "req-correlated" }),
    );
  });

  it("sends no correlation id when no response has carried one", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue(acceptedResponse());

    await reportClientError(new Error("Boom"));

    expect(post).toHaveBeenCalledWith(
      "/client-errors",
      expect.objectContaining({ correlated_request_id: null }),
    );
  });

  it("resolves to the request id the backend recorded the report under", async () => {
    vi.spyOn(api, "post").mockResolvedValue(acceptedResponse());

    await expect(reportClientError(new Error("Boom"))).resolves.toBe(
      "req-server",
    );
  });

  it("resolves to null when the acknowledgement carries no request id", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ status: 202, data: {} });

    await expect(reportClientError(new Error("Boom"))).resolves.toBeNull();
  });

  it("resolves to null rather than throwing when the report request fails", async () => {
    vi.spyOn(api, "post").mockRejectedValue(new Error("network down"));

    await expect(reportClientError(new Error("Boom"))).resolves.toBeNull();
  });

  it("sends a placeholder message when the error carries none", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue(acceptedResponse());

    await reportClientError(new Error(""));

    const body = post.mock.calls[0]?.[1] as { message: string };
    expect(body.message).toBe("Unknown client error");
  });

  it("reports a thrown value that is not an Error by its string form", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue(acceptedResponse());

    await reportClientError({ toString: () => "thrown object" });

    const body = post.mock.calls[0]?.[1] as { message: string };
    expect(body.message).toBe("thrown object");
  });

  it("ignores a second report while one is in flight", async () => {
    let settle: (() => void) | undefined;
    const post = vi.spyOn(api, "post").mockReturnValue(
      new Promise<AxiosResponse>((resolve) => {
        settle = () => {
          resolve(acceptedResponse());
        };
      }),
    );

    const first = reportClientError(new Error("first"));
    const second = reportClientError(new Error("second"));
    expect(post).toHaveBeenCalledTimes(1);

    settle?.();
    await first;
    await second;
  });

  it("truncates an oversized stack to the length the backend accepts", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue(acceptedResponse());
    const error = new Error("Boom");
    error.stack = "x".repeat(5000);

    await reportClientError(error);

    const body = post.mock.calls[0]?.[1] as { stack: string };
    expect(body.stack).toHaveLength(4000);
  });

  it("truncates an oversized correlation id to the length the backend accepts", async () => {
    // An intermediary that stamps its own long X-Request-ID would otherwise make
    // every report a 422, so the reports vanish exactly when something changed.
    responseFulfilled({ headers: { "x-request-id": "x".repeat(200) } });
    const post = vi.spyOn(api, "post").mockResolvedValue(acceptedResponse());

    await reportClientError(new Error("Boom"));

    const body = post.mock.calls[0]?.[1] as { correlated_request_id: string };
    expect(body.correlated_request_id).toHaveLength(64);
  });
});
