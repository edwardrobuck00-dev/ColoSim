import { Link } from "react-router";
import styles from "./pages.module.css";

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <h1>Page not found</h1>
      <Link to="/">Back to start</Link>
    </div>
  );
}
