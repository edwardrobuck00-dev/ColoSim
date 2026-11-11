import { NavLink, Route, Routes } from "react-router";
import { EncountersPage } from "./routes/EncountersPage";
import { FightPage } from "./routes/FightPage";
import { HomePage } from "./routes/HomePage";
import { LoadoutsPage } from "./routes/LoadoutsPage";
import { NotFoundPage } from "./routes/NotFoundPage";
import { SettingsPage } from "./routes/SettingsPage";
import { ReplaysPage } from "./routes/ReplaysPage";
import { ReplayPage } from "./routes/ReplayPage";
import { ErrorBoundary } from "./ui/components/ErrorBoundary";
import styles from "./app.module.css";

export function App() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand}>Combat Simulator</NavLink>
        <nav className={styles.nav}>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/encounters">Encounters</NavLink>
          <NavLink to="/loadouts">Setups</NavLink>
          <NavLink to="/replays">Replays</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <main className={styles.main}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/encounters" element={<EncountersPage />} />
            <Route path="/fight/:encounterId" element={<FightPage />} />
            <Route path="/loadouts" element={<LoadoutsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/replays" element={<ReplaysPage />} />
            <Route path="/replay/:id" element={<ReplayPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}
