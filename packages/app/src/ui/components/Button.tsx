import type { ButtonHTMLAttributes } from "react";
import styles from "./components.module.css";

type Variant = "primary" | "secondary" | "ghost";

export function Button({ variant = "secondary", className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={[styles.button, styles[variant], className].filter(Boolean).join(" ")} {...rest} />;
}
