<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, ExternalLink, Save } from '@lucide/svelte';
	import { INDONESIAN_MONTHS, TAX_LEGAL_FORM, TAX_REGIME_CHOICE } from '$lib/tax/config';
	import { formatRupiah } from '$lib/utils';
	import { toast } from '$lib/components/ui/toast';
	import { MoneyInput } from '$lib/components/ui/money-input';
	import {
		asksExpertServiceQuestion,
		asksFounderGroupQuestion,
		defaultFinalRegimeStartYear,
		isBodyLegalForm
	} from '$lib/tax/eligibility';
	import type { TaxLegalForm } from '$lib/tax/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let saving = $state(false);
	let error = $state<string | null>(null);

	function createForm(source: PageData) {
		return {
			taxYear: source.taxYear,
			legalForm: source.profile?.legalForm ?? '',
			registeredAt: source.profile?.registeredAt ?? '',
			finalRegimeStartYear: source.profile?.finalRegimeStartYear ?? source.taxYear,
			regimeChoice: source.profile?.regimeChoice ?? TAX_REGIME_CHOICE.FINAL_UMKM,
			everUsedGeneralRegime: source.profile?.everUsedGeneralRegime ?? false,
			turnoverLimitExceeded: source.profile?.turnoverLimitExceeded ?? false,
			// Money fields bind number | null: null while a field is cleared.
			priorYearAggregatedRevenue: (source.profile?.priorYearAggregatedRevenue ?? 0) as
				number | null,
			externalMonthlyRevenue: (source.profile?.externalMonthlyRevenue ??
				Array<number>(12).fill(0)) as (number | null)[],
			revenueDataComplete: source.profile?.revenueDataComplete ?? false,
			aggregationConfirmed: source.profile?.aggregationConfirmed ?? false,
			hasProfessionalServiceIncome: source.profile?.hasProfessionalServiceIncome ?? false,
			soleOwnerProvidesProfessionalServices:
				source.profile?.soleOwnerProvidesProfessionalServices ?? false,
			usesOtherTaxFacility: source.profile?.usesOtherTaxFacility ?? false,
			groupTurnoverExceeded: (source.profile?.groupTurnoverExceeded ?? null) as boolean | null
		};
	}

	// Initial editable copy; navigation leaves this route after a successful save.
	// svelte-ignore state_referenced_locally
	let form = $state(createForm(data));

	// The PP 55/2022 term start year follows from the legal form and registration date
	// (Pasal 59 ayat (2) and Pasal 69). A saved profile keeps its stored year, and once the
	// user types a year it is no longer recalculated.
	// svelte-ignore state_referenced_locally
	let startYearEdited = $state(data.profile !== null);
	const suggestedStartYear = $derived(
		form.legalForm === ''
			? null
			: defaultFinalRegimeStartYear(form.legalForm as TaxLegalForm, form.registeredAt)
	);
	$effect(() => {
		if (!startYearEdited && suggestedStartYear !== null) {
			form.finalRegimeStartYear = suggestedStartYear;
		}
	});

	const externalRevenueTotal = $derived(
		form.externalMonthlyRevenue.reduce<number>((sum, value) => sum + (value ?? 0), 0)
	);

	// Which questions apply depends on the legal form; the others are not sent as answers.
	const legalForm = $derived(form.legalForm as TaxLegalForm | '');
	const isIndividual = $derived(legalForm === TAX_LEGAL_FORM.INDIVIDUAL);
	const isBody = $derived(legalForm !== '' && isBodyLegalForm(legalForm));
	const asksExpertService = $derived(legalForm !== '' && asksExpertServiceQuestion(legalForm));
	const asksFounderGroup = $derived(legalForm !== '' && asksFounderGroupQuestion(legalForm));

	async function saveProfile(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		error = null;

		try {
			const response = await fetch('/api/tax/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				// An empty month counts as no revenue outside Buku UMKM.
				body: JSON.stringify({
					...form,
					priorYearAggregatedRevenue: form.priorYearAggregatedRevenue ?? 0,
					externalMonthlyRevenue: form.externalMonthlyRevenue.map((amount) => amount ?? 0),
					hasProfessionalServiceIncome: isIndividual && form.hasProfessionalServiceIncome,
					soleOwnerProvidesProfessionalServices:
						asksExpertService && form.soleOwnerProvidesProfessionalServices,
					usesOtherTaxFacility: isBody && form.usesOtherTaxFacility,
					groupTurnoverExceeded: asksFounderGroup ? form.groupTurnoverExceeded : null,
					turnoverLimitExceeded: legalForm !== '' && form.turnoverLimitExceeded
				})
			});
			const result = (await response.json()) as { error?: string };
			if (!response.ok) throw new Error(result.error || 'Profil pajak gagal disimpan.');
			toast.success('Profil pajak tersimpan', `Estimasi ${data.taxYear} telah diperbarui.`);
			await goto('/pajak', { invalidateAll: true });
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Profil pajak gagal disimpan.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Profil Pajak {data.taxYear} — Buku UMKM</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
	<header class="flex items-start gap-3">
		<a
			href="/pajak"
			class="rounded-lg p-2 transition-colors hover:bg-muted"
			aria-label="Kembali ke halaman Pajak"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<div>
			<h1 class="text-2xl font-bold">Profil pajak {data.taxYear}</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Data ini menentukan apakah Buku UMKM boleh menampilkan estimasi PPh Final 0,5%.
			</p>
		</div>
	</header>

	<div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
		Buku UMKM hanya memberi estimasi, bukan penetapan kewajiban atau nasihat pajak. Periksa kembali
		di
		<a
			href="https://www.pajak.go.id/"
			target="_blank"
			rel="noreferrer"
			class="font-medium underline"
		>
			DJP <ExternalLink class="inline h-3.5 w-3.5" />
		</a>
		atau dengan konsultan pajak bila kondisi Anda kompleks.
	</div>

	<form class="space-y-6" onsubmit={saveProfile}>
		<section class="space-y-4 rounded-lg border bg-card p-5">
			<div>
				<h2 class="font-semibold">Identitas dan periode fasilitas</h2>
				<p class="text-sm text-muted-foreground">
					Bentuk badan dan awal pemakaian fasilitas memengaruhi jangka waktu kelayakan.
				</p>
			</div>

			<div class="grid gap-4 md:grid-cols-2">
				<label class="space-y-1.5 text-sm font-medium">
					<span>Bentuk wajib pajak</span>
					<select
						bind:value={form.legalForm}
						required
						class="h-11 w-full rounded-md border bg-background px-3 font-normal"
					>
						<option value="" disabled>Pilih bentuk wajib pajak</option>
						<option value={TAX_LEGAL_FORM.INDIVIDUAL}>Orang Pribadi</option>
						<option value={TAX_LEGAL_FORM.SINGLE_MEMBER_COMPANY}>Perseroan Perorangan</option>
						<option value={TAX_LEGAL_FORM.COOPERATIVE}>Koperasi</option>
						<option value={TAX_LEGAL_FORM.CV}>CV</option>
						<option value={TAX_LEGAL_FORM.FIRM}>Firma</option>
						<option value={TAX_LEGAL_FORM.LIMITED_COMPANY}>PT biasa</option>
						<option value={TAX_LEGAL_FORM.VILLAGE_ENTERPRISE}>BUM Desa/Bersama</option>
						<option value={TAX_LEGAL_FORM.PERMANENT_ESTABLISHMENT}>Bentuk Usaha Tetap</option>
						<option value={TAX_LEGAL_FORM.OTHER}>Lainnya</option>
					</select>
				</label>

				<label class="space-y-1.5 text-sm font-medium">
					<span>Tanggal terdaftar sebagai wajib pajak</span>
					<input
						type="date"
						bind:value={form.registeredAt}
						required
						class="h-11 w-full rounded-md border bg-background px-3 font-normal"
					/>
					<span class="block text-xs font-normal text-muted-foreground">
						Koperasi memakai tarif final paling lama 4 tahun pajak sejak tahun terdaftar (Pasal 57
						ayat (2) huruf f PP 20/2026).
					</span>
				</label>

				<label class="space-y-1.5 text-sm font-medium">
					<span>Tahun awal jangka waktu tarif final menurut PP 55/2022</span>
					<input
						type="number"
						min="2018"
						max={data.taxYear}
						bind:value={form.finalRegimeStartYear}
						oninput={() => (startYearEdited = true)}
						required
						class="h-11 w-full rounded-md border bg-background px-3 font-normal"
					/>
					<span class="block text-xs font-normal text-muted-foreground">
						Jangka waktunya 7 tahun (orang pribadi), 4 tahun (perseroan perorangan, koperasi, CV,
						firma, BUM Desa), atau 3 tahun (PT). Ketentuan peralihan PP 20/2026 bergantung pada
						tahun berakhirnya.
						{#if suggestedStartYear !== null}
							Berdasarkan bentuk dan tanggal terdaftar: {suggestedStartYear} (Pasal 59 ayat (2) dan Pasal
							69 PP 55/2022).
						{/if}
					</span>
				</label>

				<label class="space-y-1.5 text-sm font-medium">
					<span>Pilihan rezim untuk {data.taxYear}</span>
					<select
						bind:value={form.regimeChoice}
						class="h-11 w-full rounded-md border bg-background px-3 font-normal"
					>
						<option value={TAX_REGIME_CHOICE.FINAL_UMKM}>Tarif final UMKM 0,5%</option>
						<option value={TAX_REGIME_CHOICE.GENERAL}>Tarif umum</option>
					</select>
				</label>
			</div>
		</section>

		<section class="space-y-4 rounded-lg border bg-card p-5">
			<div>
				<h2 class="font-semibold">Omzet agregat</h2>
				<p class="text-sm text-muted-foreground">
					Masukkan omzet kotor sebelum potongan. Sertakan omzet terkait yang tidak tercatat sebagai
					transaksi di Buku UMKM.
				</p>
			</div>

			<label class="block max-w-md space-y-1.5 text-sm font-medium">
				<span>Total omzet agregat tahun {data.taxYear - 1}</span>
				<MoneyInput
					bind:value={form.priorYearAggregatedRevenue}
					required
					placeholder="0"
					class="md:h-11 px-3 font-normal"
				/>
				<span class="block text-xs font-normal text-muted-foreground">
					Seluruh omzet usaha dan jasa pekerjaan bebas, baik yang dikenai PPh final maupun tidak,
					termasuk dari luar negeri; orang pribadi menggabungkan omzet suami-istri (Pasal 58 PP
					20/2026).
				</span>
			</label>

			<div>
				<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
					<h3 class="text-sm font-medium">Omzet bulanan di luar Buku UMKM</h3>
					<span class="text-sm text-muted-foreground"
						>Total: {formatRupiah(externalRevenueTotal)}</span
					>
				</div>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each INDONESIAN_MONTHS as monthName, index (monthName)}
						<label class="space-y-1 text-sm">
							<span>{monthName}</span>
							<MoneyInput
								bind:value={form.externalMonthlyRevenue[index]}
								placeholder="0"
								class="h-10 px-3"
							/>
						</label>
					{/each}
				</div>
			</div>
		</section>

		<section class="space-y-4 rounded-lg border bg-card p-5">
			<div>
				<h2 class="font-semibold">Pengecualian dan konfirmasi</h2>
				<p class="text-sm text-muted-foreground">
					Jawaban ini mencegah estimasi ditampilkan untuk kondisi yang tidak didukung.
				</p>
			</div>

			<div class="space-y-3">
				<label class="flex items-start gap-3 text-sm">
					<input type="checkbox" bind:checked={form.everUsedGeneralRegime} class="mt-1 h-4 w-4" />
					<span>
						Saya pernah memberitahukan kepada DJP bahwa saya memilih tarif umum Pasal 17 (Pasal 57
						ayat (2) huruf a dan ayat (3)).
					</span>
				</label>
				{#if legalForm !== ''}
					<label class="flex items-start gap-3 text-sm">
						<input type="checkbox" bind:checked={form.turnoverLimitExceeded} class="mt-1 h-4 w-4" />
						<span>
							Omzet bruto {isIndividual ? 'usaha saya' : 'usaha ini'} pernah melebihi Rp4,8 miliar dalam
							satu tahun pajak saat memakai tarif final (Pasal 61 PP 55/2022).
						</span>
					</label>
				{/if}
				{#if isIndividual}
					<label class="flex items-start gap-3 text-sm">
						<input
							type="checkbox"
							bind:checked={form.hasProfessionalServiceIncome}
							class="mt-1 h-4 w-4"
						/>
						<span>
							Saya menerima penghasilan dari jasa sehubungan dengan pekerjaan bebas, misalnya
							sebagai pengacara, akuntan, arsitek, dokter, konsultan, notaris, PPAT, penilai,
							aktuaris; pemain musik, pembawa acara, penyanyi, pelawak, bintang film/sinetron/iklan,
							sutradara, kru film, model, penari, pemahat, pelukis, pembuat konten daring
							(influencer, selebgram, bloger, vloger) atau seniman lain; olahragawan; penasihat,
							pengajar, pelatih, penceramah, penyuluh, moderator; pengarang, peneliti, penerjemah;
							agen iklan; pengawas atau pengelola proyek; perantara; penjaja barang dagangan; agen
							asuransi; distributor pemasaran berjenjang atau penjualan langsung (Pasal 56 ayat
							(4)).
						</span>
					</label>
				{/if}
				{#if asksExpertService}
					<label class="flex items-start gap-3 text-sm">
						<input
							type="checkbox"
							bind:checked={form.soleOwnerProvidesProfessionalServices}
							class="mt-1 h-4 w-4"
						/>
						<span>
							{#if legalForm === TAX_LEGAL_FORM.SINGLE_MEMBER_COMPANY}
								Perseroan perorangan ini didirikan oleh orang pribadi berkeahlian khusus dan
								menyerahkan jasa sejenis jasa pekerjaan bebas (Pasal 57 ayat (2) huruf b).
							{:else}
								Badan ini dibentuk oleh orang pribadi berkeahlian khusus dan menyerahkan jasa
								sejenis jasa pekerjaan bebas (Pasal 57 ayat (2) huruf b PP 55/2022).
							{/if}
						</span>
					</label>
				{/if}
				{#if isBody}
					<label class="flex items-start gap-3 text-sm">
						<input type="checkbox" bind:checked={form.usesOtherTaxFacility} class="mt-1 h-4 w-4" />
						<span>
							Badan memperoleh fasilitas PPh Pasal 31A UU PPh, PP 94/2010, atau fasilitas Kawasan
							Ekonomi Khusus (Pasal 57 ayat (2) huruf c).
						</span>
					</label>
				{/if}
			</div>

			{#if asksFounderGroup}
				<fieldset class="space-y-2 border-t pt-4 text-sm">
					<legend class="font-medium">
						Pernahkah omzet gabungan orang pribadi pendiri (beserta pasangan) dan seluruh perseroan
						perorangan yang didirikannya melebihi Rp4,8 miliar dalam satu tahun pajak?
					</legend>
					<p class="text-muted-foreground">
						Bila tidak ada perseroan perorangan, jawab berdasarkan omzet orang pribadi dan pasangan.
						Bila pernah, tarif final tidak dapat dipakai pada tahun-tahun berikutnya (Pasal 57 ayat
						(2) huruf e dan ayat (4), Pasal 58 ayat (3) PP 20/2026).
					</p>
					<div class="flex flex-wrap gap-4">
						<label class="flex min-h-11 items-center gap-2">
							<input
								type="radio"
								name="groupTurnoverExceeded"
								value={false}
								bind:group={form.groupTurnoverExceeded}
								required
								class="h-4 w-4"
							/>
							<span>Tidak pernah</span>
						</label>
						<label class="flex min-h-11 items-center gap-2">
							<input
								type="radio"
								name="groupTurnoverExceeded"
								value={true}
								bind:group={form.groupTurnoverExceeded}
								class="h-4 w-4"
							/>
							<span>Pernah</span>
						</label>
					</div>
				</fieldset>
			{/if}

			<div class="space-y-3 border-t pt-4">
				<label class="flex items-start gap-3 text-sm font-medium">
					<input
						type="checkbox"
						bind:checked={form.aggregationConfirmed}
						required
						class="mt-1 h-4 w-4"
					/>
					<span>
						Saya sudah menggabungkan omzet usaha, pekerjaan bebas, pasangan, dan perseroan
						perseorangan terkait sesuai kondisi saya.
					</span>
				</label>
				<label class="flex items-start gap-3 text-sm font-medium">
					<input
						type="checkbox"
						bind:checked={form.revenueDataComplete}
						required
						class="mt-1 h-4 w-4"
					/>
					<span>Data omzet {data.taxYear} di Buku UMKM dan kolom tambahan sudah lengkap.</span>
				</label>
			</div>
		</section>

		{#if error}
			<p class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
				{error}
			</p>
		{/if}

		<div class="flex flex-wrap justify-end gap-3">
			<a href="/pajak" class="inline-flex h-11 items-center rounded-md border px-4 font-medium">
				Batal
			</a>
			<button
				type="submit"
				disabled={saving}
				class="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-60"
			>
				<Save class="h-4 w-4" />
				{saving ? 'Menyimpan…' : 'Simpan dan hitung ulang'}
			</button>
		</div>
	</form>
</div>
