export const getRealBirthday = () => {
  const now = new Date();
  const d = now.getDate();
  const m = now.getMonth() + 1;
  if (m === 1 && d === 5) return "Anjali";
  if (m === 6 && d === 9) return "Dhruvya";
  if (m === 10 && d === 13) return "Pukku";
  if (m === 4 && d === 14) return "Ukku";
  return null;
};
