import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { EncountersPage } from "../src/routes/EncountersPage";

function Location() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

describe("EncountersPage", () => {
  it("lists every encounter from the content registry, bosses first, and shows the selected one", () => {
    render(<MemoryRouter><EncountersPage /></MemoryRouter>);
    const list = screen.getByRole("navigation", { name: "Bosses" });
    const names = [...list.querySelectorAll("button")].map((b) => b.textContent);
    expect(names[0]).toMatch(/^The Ashen Warden/);
    expect(names.some((n) => n?.startsWith("Training Grounds"))).toBe(true);
    expect(screen.getByRole("heading", { name: "The Ashen Warden" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Training Grounds/ }));
    expect(screen.getByRole("heading", { name: "Training Grounds" })).toBeInTheDocument();
  });

  it("describes the boss from its data: level, attacks, phases, specials, enrage and rules", () => {
    render(<MemoryRouter><EncountersPage /></MemoryRouter>);
    const details = screen.getByTestId("encounter-ashen-warden");
    // Combat level: floor(0.25 * (150 + 450 + 0) + 0.325 * (150 + 150)) = floor(150 + 97.5) = 247
    expect(details.textContent).toContain("247");
    for (const text of ["Cinder bolt", "Ember lob", "Slam", "Smouldering", "Kindled", "Inferno", "from 66%", "from 33%",
      "Ember Rain", "Cinder Volley", "Ash Ring", "Scorched Earth", "Enrages below 12% hitpoints", "heals the Warden"]) {
      expect(details.textContent, text).toContain(text);
    }
  });

  it("starts a fight with the chosen modifiers", () => {
    render(
      <MemoryRouter initialEntries={["/encounters"]}>
        <Routes>
          <Route path="/encounters" element={<EncountersPage />} />
          <Route path="/fight/:encounterId" element={<Location />} />
        </Routes>
      </MemoryRouter>,
    );
    const card = screen.getByTestId("encounter-ashen-warden");
    fireEvent.click(card.querySelector("input[type=checkbox]")!);
    fireEvent.click(card.querySelector("button")!);
    expect(screen.getByTestId("location").textContent).toBe("/fight/ashen-warden?mods=smothering-ash&loadout=melee-70");
  });
});
