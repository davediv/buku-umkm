<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, ExternalLink, Save } from '@lucide/svelte';
	import { INDONESIAN_MONTHS, TAX_LEGAL_FORM, TAX_REGIME_CHOICE } from '$lib/tax/config';
	import { formatRupiah } from '$lib/utils';
	import { toast } from '$lib/components/ui/toast';
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
			priorYearAggregatedRevenue: source.profile?.priorYearAggregatedRevenue ?? 0,
			externalMonthlyRevenue: source.profile?.externalMonthlyRevenue ?? Array(12).fill(0),
			revenueDataComplete: source.profile?.revenueDataComplete ?? false,
			aggregationConfirmed: source.profile?.aggregationConfirmed ?? false,
			hasProfessionalServiceIncome: source.profile?.hasProfessionalServiceIncome ?? false,
			soleOwnerProvidesProfessionalServices:
				source.profile?.soleOwnerProvidesProfessionalServices ?? false,
			usesOtherTaxFacility: source.profile?.usesOtherTaxFacility ?? false
		};
	}

	// Initial editable copy; navigation leaves this route after a successful save.
	// svelte-ignore state_referenced_locally
	let form = $state(createForm(data));

	const externalRevenueTotal = $derived(
		form.externalMonthlyRevenue.reduce((sum, value) => sum + (Number(value) || 0), 0)
	);

	async function saveProfile(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		error = null;

		try {
			const response = await fetch('/api/tax/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(form)
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
					<span>Tanggal terdaftar</span>
					<input
						type="date"
						bind:value={form.registeredAt}
						required
						class="h-11 w-full rounded-md border bg-background px-3 font-normal"
					/>
				</label>

				<label class="space-y-1.5 text-sm font-medium">
					<span>Tahun pertama memakai tarif final</span>
					<input
						type="number"
						min="2018"
						max={data.taxYear}
						bind:value={form.finalRegimeStartYear}
						required
						class="h-11 w-full rounded-md border bg-background px-3 font-normal"
					/>
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
				<input
					type="number"
					min="0"
					step="1"
					bind:value={form.priorYearAggregatedRevenue}
					required
					class="h-11 w-full rounded-md border bg-background px-3 font-normal"
				/>
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
							<input
								type="number"
								min="0"
								step="1"
								bind:value={form.externalMonthlyRevenue[index]}
								class="h-10 w-full rounded-md border bg-background px-3"
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
					<span>Saya pernah memilih atau wajib memakai tarif umum.</span>
				</label>
				<label class="flex items-start gap-3 text-sm">
					<input
						type="checkbox"
						bind:checked={form.hasProfessionalServiceIncome}
						class="mt-1 h-4 w-4"
					/>
					<span>Saya memiliki penghasilan pekerjaan bebas/jasa profesi.</span>
				</label>
				<label class="flex items-start gap-3 text-sm">
					<input
						type="checkbox"
						bind:checked={form.soleOwnerProvidesProfessionalServices}
						class="mt-1 h-4 w-4"
					/>
					<span
						>Pemilik perseroan perseorangan memberi jasa keahlian yang sama melalui perseroan.</span
					>
				</label>
				<label class="flex items-start gap-3 text-sm">
					<input type="checkbox" bind:checked={form.usesOtherTaxFacility} class="mt-1 h-4 w-4" />
					<span
						>Saya menggunakan fasilitas PPh lain yang tidak dapat digabung dengan tarif final UMKM.</span
					>
				</label>
			</div>

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
