import md5 from "md5";

export function getGravatarUrl(email: string | null): string | null {
  if (!email) return null;
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?d=404&s=80`;
}
