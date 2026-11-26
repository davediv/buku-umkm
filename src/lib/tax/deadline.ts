/**
 * Holidays that move a tax payment deadline. PMK 81/2024 Pasal 100: when a due date of
 * Pasal 94 falls on a hari libur, payment may be made at the latest on the next working day,
 * and hari libur means Saturday, Sunday, a national holiday (hari libur nasional), a day
 * declared off for a general election, or a nationally set cuti bersama. Checked against the
 * official texts of all four amendments to PMK 81/2024 (PMK 11/2025, 53/2025, 54/2025 and
 * 1/2026): none changes Pasal 94 or Pasal 100.
 *
 * Each year lists the national holidays and cuti bersama of the SKB 3 Menteri for that year,
 * taken only from the official publication cited next to it. A year without a verified list
 * shifts only for Saturdays and Sundays. No election day off is declared for these years; add
 * one here if the government declares it.
 */
const HOLIDAYS_BY_YEAR: Readonly<Record<number, ReadonlySet<string>>> = {
	// SKB Menteri Agama, Menteri Ketenagakerjaan dan Menteri PANRB Nomor 1497 Tahun 2025,
	// Nomor 2 Tahun 2025, Nomor 5 Tahun 2025, as published by Kemensetneg on 19 September 2025:
	// https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026
	2026: new Set([
		// Hari libur nasional (17 days)
		'2026-01-01', // Tahun Baru 2026 Masehi
		'2026-01-16', // Isra Mikraj Nabi Muhammad saw.
		'2026-02-17', // Tahun Baru Imlek 2577 Kongzili
		'2026-03-19', // Hari Suci Nyepi (Tahun Baru Saka 1948)
		'2026-03-21', // Idulfitri 1447 H
		'2026-03-22', // Idulfitri 1447 H
		'2026-04-03', // Wafat Yesus Kristus
		'2026-04-05', // Kebangkitan Yesus Kristus (Paskah)
		'2026-05-01', // Hari Buruh Internasional
		'2026-05-14', // Kenaikan Yesus Kristus
		'2026-05-27', // Iduladha 1447 H
		'2026-05-31', // Hari Raya Waisak 2570 BE
		'2026-06-01', // Hari Lahir Pancasila
		'2026-06-16', // 1 Muharam Tahun Baru Islam 1448 H
		'2026-08-17', // Proklamasi Kemerdekaan
		'2026-08-25', // Maulid Nabi Muhammad saw.
		'2026-12-25', // Kelahiran Yesus Kristus
		// Cuti bersama (8 days)
		'2026-02-16', // Tahun Baru Imlek 2577 Kongzili
		'2026-03-18', // Hari Suci Nyepi (Tahun Baru Saka 1948)
		'2026-03-20', // Idulfitri 1447 H
		'2026-03-23', // Idulfitri 1447 H
		'2026-03-24', // Idulfitri 1447 H
		'2026-05-15', // Kenaikan Yesus Kristus
		'2026-05-28', // Iduladha 1447 H
		'2026-12-24' // Kelahiran Yesus Kristus
	]),
	// SKB Menteri Agama, Menteri Ketenagakerjaan dan Menteri PANRB Nomor 1205 Tahun 2026,
	// Nomor 3 Tahun 2026, Nomor 2 Tahun 2026, signed 15 September 2026, as published by
	// Kemensetneg on 15 September 2026:
	// https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027
	2027: new Set([
		// Hari libur nasional (18 days)
		'2027-01-01', // Tahun Baru 2027 Masehi
		'2027-01-05', // Isra Mikraj Nabi Muhammad saw.
		'2027-02-06', // Tahun Baru Imlek 2578 Kongzili
		'2027-03-08', // Hari Suci Nyepi (Tahun Baru Saka 1949)
		'2027-03-10', // Idulfitri 1448 H
		'2027-03-11', // Idulfitri 1448 H
		'2027-03-26', // Wafat Yesus Kristus
		'2027-03-28', // Kebangkitan Yesus Kristus (Paskah)
		'2027-05-01', // Hari Buruh Internasional
		'2027-05-06', // Kenaikan Yesus Kristus
		'2027-05-17', // Iduladha 1448 H
		'2027-05-20', // Hari Raya Waisak 2571 BE
		'2027-06-01', // Hari Lahir Pancasila
		'2027-06-06', // 1 Muharam Tahun Baru Islam 1449 H
		'2027-08-15', // Maulid Nabi Muhammad saw.
		'2027-08-17', // Proklamasi Kemerdekaan
		'2027-12-25', // Kelahiran Yesus Kristus
		'2027-12-26', // Isra Mikraj Nabi Muhammad saw. (1449 H)
		// Cuti bersama (8 days)
		'2027-02-05', // Tahun Baru Imlek 2578 Kongzili
		'2027-03-09', // Idulfitri 1448 H
		'2027-03-12', // Idulfitri 1448 H
		'2027-03-15', // Idulfitri 1448 H
		'2027-03-25', // Wafat Yesus Kristus
		'2027-05-18', // Iduladha 1448 H
		'2027-05-19', // Waisak 2571 BE
		'2027-12-24' // Kelahiran Yesus Kristus
	])
};

/** Whether the holiday list for a year comes from a verified SKB 3 Menteri publication. */
export function hasVerifiedHolidayList(year: number): boolean {
	return year in HOLIDAYS_BY_YEAR;
}

function addDays(date: string, days: number): string {
	const next = new Date(`${date}T00:00:00Z`);
	next.setUTCDate(next.getUTCDate() + days);
	return next.toISOString().slice(0, 10);
}

/** Hari libur per PMK 81/2024 Pasal 100 ayat (2), as far as this table knows them. */
export function isTaxHoliday(date: string): boolean {
	const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
	if (weekday === 0 || weekday === 6) return true;
	return HOLIDAYS_BY_YEAR[Number(date.slice(0, 4))]?.has(date) ?? false;
}

/** The date itself when it is a working day, otherwise the next working day. */
export function nextWorkingDay(date: string): string {
	let day = date;
	while (isTaxHoliday(day)) day = addDays(day, 1);
	return day;
}

/**
 * Due date for paying PPh Final UMKM (PPh Pasal 4 ayat (2)) of a tax month: the 15th of the
 * following month (PMK 81/2024 Pasal 94 ayat (2) huruf a), moved to the next working day
 * when the 15th is a hari libur (Pasal 100).
 */
export function paymentDueDate(year: number, month: number): string {
	const dueYear = month === 12 ? year + 1 : year;
	const dueMonth = month === 12 ? 1 : month + 1;
	return nextWorkingDay(`${dueYear}-${String(dueMonth).padStart(2, '0')}-15`);
}

/** Whole days from `from` to `to` (both ISO dates); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
	const start = Date.parse(`${from}T00:00:00Z`);
	const end = Date.parse(`${to}T00:00:00Z`);
	return Math.round((end - start) / 86_400_000);
}
