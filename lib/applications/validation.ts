export type ApplicationInput = { firstName: string; lastName: string; email: string };

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

export function validateApplication(input: ApplicationInput): ApplicationInput {
  const firstName = input.firstName.trim().replace(/\s+/g, " ");
  const lastName = input.lastName.trim().replace(/\s+/g, " ");
  const email = normalizeEmail(input.email);
  if (!firstName || !lastName || firstName.length > 120 || lastName.length > 120) {
    throw new Error("Ad ve soyad gerekli; en fazla 120 karakter olabilir.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Geçerli bir e-posta adresi girin.");
  }
  return { firstName, lastName, email };
}

export function parsePastedApplications(text: string): {
  valid: ApplicationInput[];
  errors: { line: number; reason: string }[];
} {
  const valid: ApplicationInput[] = [];
  const errors: { line: number; reason: string }[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const cells = line.split("\t").map((cell) => cell.trim());
    if (index === 0 && /^(ad|first\s*name)$/i.test(cells[0] ?? "")) return;
    try {
      if (cells.length !== 3) throw new Error("Üç sütun gerekli: ad, soyad, e-posta.");
      const item = validateApplication({ firstName: cells[0], lastName: cells[1], email: cells[2] });
      if (seen.has(item.email)) throw new Error("Tekrar eden e-posta adresi.");
      seen.add(item.email);
      valid.push(item);
    } catch (error) {
      errors.push({ line: index + 1, reason: error instanceof Error ? error.message : "Geçersiz satır." });
    }
  });
  return { valid, errors };
}
