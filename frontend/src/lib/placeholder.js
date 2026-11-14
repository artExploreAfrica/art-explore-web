// Stand-in for a space with no photo: a brand-colour tile showing its initials.
// Shared by the directory cards and the detail page so a space looks the same
// wherever it appears.

export function placeholderColor(name) {
  // Brand colours only, each dark enough for cream initials.
  const palette = [
    "#241b12", // ink
    "#3a2d20", // ink, pressed shade
    "#b0431c", // terracotta
    "#8a3216", // terracotta, pressed shade
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export function getInitials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
