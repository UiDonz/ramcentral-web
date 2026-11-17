// RamConnect crest: a ram head (Farmingdale Rams) on a shield (the campus),
// under five stars - one for each of the five students who built the app.
export default function Logo({ size = 22 }) {
  return (
    <img
      src="/logo.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="app-logo"
      draggable="false"
    />
  );
}
