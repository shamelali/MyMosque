export const ROLES = [
  "KETUA",
  "SETIAUSAHA",
  "BENDAHARI",
  "AJK",
  "JAINJ",
  "AUDITOR",
  "TUTOR",
  "JEMAAH",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  KETUA: "Pengerusi / Ketua Masjid",
  SETIAUSAHA: "Setiausaha",
  BENDAHARI: "Bendahari",
  AJK: "Ahli Jawatankuasa",
  JAINJ: "Pegawai JAINJ",
  AUDITOR: "Auditor",
  TUTOR: "Guru Al-Quran (Ustaz/Ustazah)",
  JEMAAH: "Jemaah / Orang Awam",
};

export const ROLE_HOME: Record<Role, string> = {
  KETUA: "/portal",
  SETIAUSAHA: "/portal",
  BENDAHARI: "/portal",
  AJK: "/portal",
  JAINJ: "/jainj",
  AUDITOR: "/jainj",
  TUTOR: "/tutor",
  JEMAAH: "/jemaah",
};

export const PORTAL_ROLES: Role[] = ["KETUA", "SETIAUSAHA", "BENDAHARI", "AJK"];
export const OVERSIGHT_ROLES: Role[] = ["JAINJ", "AUDITOR"];
export const OFFICER_ROLES: Role[] = [...PORTAL_ROLES, ...OVERSIGHT_ROLES];

export function canManageFinance(role: Role) {
  return role === "BENDAHARI" || role === "KETUA";
}

export function canApprove(role: Role) {
  return role === "KETUA" || role === "JAINJ";
}

export function isRole(value: string | null | undefined): value is Role {
  return !!value && (ROLES as readonly string[]).includes(value);
}
