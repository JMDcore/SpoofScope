import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./main";

const response = (body: unknown, ok = true) =>
  Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);

beforeEach(() => {
  window.history.replaceState({}, "", "/app");
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("SpoofScope public landing", () => {
  it("renders an interactive product preview without contacting the API", () => {
    window.history.replaceState({}, "", "/");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(
      screen.getByRole("heading", { name: /Know what appears around/i }),
    ).toBeTruthy();
    expect(screen.getByText("Interactive product preview")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("SpoofScope application shell", () => {
  it("opens API-key onboarding when authentication is required", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => response({ authentication_required: true })),
    );

    render(<App />);

    expect(
      await screen.findByRole("dialog", { name: "Configure API key" }),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Paste SPOOFSCOPE_API_KEY"),
    ).toBeTruthy();
  });

  it("loads the dashboard and renders monitored scope", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/health") {
        return response({ authentication_required: false });
      }
      if (path === "/api/domains") {
        return response([
          { id: 7, name: "example.com", label: "Example", last_scan_at: null },
        ]);
      }
      if (path === "/api/dashboard") {
        return response({
          counts: { domains: 1, assets: 4, candidates: 2, events: 3 },
          events: [],
          scans: [],
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Exposure command center" }),
    ).toBeTruthy();
    expect((await screen.findAllByText("example.com")).length).toBeGreaterThan(
      1,
    );
    expect(screen.getByText("4")).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it("returns to the public home from the sidebar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === "/api/health") {
          return response({ authentication_required: false });
        }
        if (String(input) === "/api/domains") return response([]);
        return response({ counts: {}, events: [], scans: [] });
      }),
    );

    render(<App />);
    await screen.findByRole("heading", { name: "Exposure command center" });
    fireEvent.click(screen.getByTitle("Home"));

    expect(window.location.pathname).toBe("/");
    expect(
      screen.getByRole("heading", { name: /Know what appears around/i }),
    ).toBeTruthy();
  });

  it("shows a useful error when the API cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );

    render(<App />);

    expect(
      await screen.findByText("Unable to reach the SpoofScope API"),
    ).toBeTruthy();
  });
});
