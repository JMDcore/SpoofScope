import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./main";

const response = (body: unknown, ok = true) =>
  Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
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
