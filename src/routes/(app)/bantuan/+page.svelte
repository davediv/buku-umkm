<script lang="ts">
	import { ArrowLeft, BookOpen, CircleHelp, Cloud, FileText, ReceiptText } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Bantuan - Buku UMKM</title>
	<meta
		name="description"
		content="Panduan penggunaan, penyimpanan data, laporan, dan pajak di Buku UMKM."
	/>
</svelte:head>

<div class="min-h-screen bg-background">
	<header class="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-3">
		<a
			href="/lainnya"
			class="-ml-2 rounded-full p-2 transition-colors hover:bg-secondary"
			aria-label="Kembali ke Menu"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<div>
			<h1 class="text-lg font-semibold">Bantuan</h1>
			<p class="text-xs text-muted-foreground">Panduan menggunakan Buku UMKM</p>
		</div>
	</header>

	<div class="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
		<section class="rounded-xl border bg-card p-5">
			<div class="flex items-start gap-3">
				<BookOpen class="mt-0.5 h-5 w-5 shrink-0 text-primary" />
				<div class="space-y-2">
					<h2 class="font-semibold">Mulai dari mana?</h2>
					<p class="text-sm leading-6 text-muted-foreground">
						Lengkapi <a
							class="font-medium text-primary underline-offset-4 hover:underline"
							href="/pengaturan?bagian=profil">profil usaha</a
						>, periksa
						<a class="font-medium text-primary underline-offset-4 hover:underline" href="/akun"
							>kas dan rekening</a
						>, lalu gunakan tombol
						<a
							class="font-medium text-primary underline-offset-4 hover:underline"
							href="/transaksi/tambah">Catat</a
						>
						untuk merekam pemasukan atau pengeluaran.
					</p>
				</div>
			</div>
		</section>

		<div class="grid gap-4 md:grid-cols-2">
			<section class="space-y-3 rounded-xl border bg-card p-5">
				<div class="flex items-center gap-2">
					<ReceiptText class="h-5 w-5 text-primary" />
					<h2 class="font-semibold">Pencatatan transaksi</h2>
				</div>
				<p class="text-sm leading-6 text-muted-foreground">
					Pilih jenis transaksi, tanggal, kategori, rekening, dan jumlah. Transaksi yang sudah
					berhasil disimpan akan memengaruhi saldo dan laporan. Draf di perangkat belum menjadi
					catatan keuangan sampai penyimpanan berhasil.
				</p>
			</section>

			<section class="space-y-3 rounded-xl border bg-card p-5">
				<div class="flex items-center gap-2">
					<FileText class="h-5 w-5 text-primary" />
					<h2 class="font-semibold">Laporan dan pajak</h2>
				</div>
				<p class="text-sm leading-6 text-muted-foreground">
					Gunakan <a
						class="font-medium text-primary underline-offset-4 hover:underline"
						href="/laporan">Laporan</a
					>
					untuk ringkasan keuangan. Estimasi pajak hanya tersedia setelah profil pajak lengkap dan tetap
					perlu dibandingkan dengan ketentuan serta sistem resmi DJP.
				</p>
			</section>
		</div>

		<section class="space-y-4 rounded-xl border bg-card p-5">
			<div class="flex items-center gap-2">
				<Cloud class="h-5 w-5 text-primary" />
				<h2 class="font-semibold">Koneksi dan keamanan data</h2>
			</div>
			<p class="text-sm leading-6 text-muted-foreground">
				Buku UMKM bekerja secara online-first. Pastikan indikator koneksi menunjukkan online sebelum
				menyimpan perubahan. Jika koneksi terputus, jangan anggap perubahan sudah tersimpan sampai
				aplikasi menampilkan konfirmasi berhasil.
			</p>
			<p class="text-sm leading-6 text-muted-foreground">
				Unduh cadangan secara berkala dari
				<a
					class="font-medium text-primary underline-offset-4 hover:underline"
					href="/pengaturan?bagian=data">Data & Cadangan</a
				>
				dan simpan file di lokasi pribadi yang aman.
			</p>
		</section>

		<section class="space-y-3 rounded-xl border bg-card p-5">
			<div class="flex items-center gap-2">
				<CircleHelp class="h-5 w-5 text-primary" />
				<h2 class="font-semibold">Saat sesuatu tidak berjalan</h2>
			</div>
			<ol class="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
				<li>Periksa status koneksi di bagian atas aplikasi.</li>
				<li>Muat ulang halaman dan pastikan perubahan terakhir benar-benar tampil.</li>
				<li>Jangan mengulang penyimpanan data keuangan jika hasil sebelumnya belum jelas.</li>
				<li>Buat cadangan sebelum melakukan pemulihan data.</li>
			</ol>
		</section>
	</div>
</div>
