type HolosLogoProps = {
  variant?: "lockup" | "mark";
  className?: string;
};

export function HolosLogo({ variant = "lockup", className }: HolosLogoProps) {
  if (variant === "mark") {
    return <img className={className ?? "holos-mark"} src="/brand/holos-mark.png" alt="" />;
  }

  return <img className={className ?? "holos-lockup"} src="/brand/holos-logo.svg" alt="Holos" />;
}
