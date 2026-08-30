<script lang="ts">
	import { ArrowLeft, Database, Download, LockKeyhole, Smartphone } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Privasi - Buku UMKM</title>
	<meta name="description" content="Ringkasan penggunaan dan penyimpanan data di Buku UMKM." />
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
			<h1 class="text-lg font-semibold">Privasi</h1>
			<p class="text-xs text-muted-foreground">Terakhir diperbarui 30 Agustus 2026</p>
		</div>
	</header>

	<div class="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
		<section class="space-y-2 rounded-xl border bg-card p-5">
			<h2 class="font-semibold">Ringkasan</h2>
			<p class="text-sm leading-6 text-muted-foreground">
				Buku UMKM menggunakan data yang Anda masukkan untuk menjalankan akun, pembukuan, laporan,
				cadangan, dan estimasi pajak. Halaman ini menjelaskan perilaku produk saat ini agar Anda
				dapat menentukan data apa yang ingin dicatat.
			</p>
		</section>

		<div class="grid gap-4 md:grid-cols-2">
			<section class="space-y-3 rounded-xl border bg-card p-5">
				<div class="flex items-center gap-2">
					<Database class="h-5 w-5 text-primary" />
					<h2 class="font-semibold">Data yang diproses</h2>
				</div>
				<ul class="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
					<li>Identitas akun, seperti alamat email.</li>
					<li>Profil usaha dan profil pajak yang Anda berikan.</li>
					<li>Rekening, kategori, transaksi, utang, piutang, dan pembayaran.</li>
					<li>Lampiran atau bukti transaksi yang Anda unggah.</li>
				</ul>
			</section>

			<section class="space-y-3 rounded-xl border bg-card p-5">
				<div class="flex items-center gap-2">
					<LockKeyhole class="h-5 w-5 text-primary" />
					<h2 class="font-semibold">Tujuan penggunaan</h2>
				</div>
				<ul class="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
					<li>Mengautentikasi dan melindungi akses ke akun Anda.</li>
					<li>Menyimpan catatan serta menghitung saldo dan laporan.</li>
					<li>Menyediakan estimasi pajak saat profil dinyatakan memenuhi syarat.</li>
					<li>Memulihkan data dari cadangan yang Anda pilih.</li>
				</ul>
			</section>
		</div>

		<section class="space-y-3 rounded-xl border bg-card p-5">
			<div class="flex items-center gap-2">
				<Smartphone class="h-5 w-5 text-primary" />
				<h2 class="font-semibold">Server dan perangkat Anda</h2>
			</div>
			<p class="text-sm leading-6 text-muted-foreground">
				Catatan keuangan yang berhasil disimpan berada pada layanan aplikasi dan dikaitkan dengan
				akun Anda. Perangkat dapat menyimpan informasi operasional terbatas, seperti draf yang belum
				dikirim, status antarmuka, dan waktu cadangan terakhir. Menghapus data browser dapat
				menghapus informasi lokal tersebut, tetapi tidak otomatis menghapus catatan yang sudah
				tersimpan di server.
			</p>
		</section>

		<section class="space-y-3 rounded-xl border bg-card p-5">
			<div class="flex items-center gap-2">
				<Download class="h-5 w-5 text-primary" />
				<h2 class="font-semibold">Cadangan dan kendali Anda</h2>
			</div>
			<p class="text-sm leading-6 text-muted-foreground">
				File cadangan diunduh ke perangkat Anda dan menjadi tanggung jawab Anda untuk menyimpannya
				dengan aman. File tersebut dapat memuat informasi usaha dan keuangan. Periksa file yang
				dipilih sebelum pemulihan karena proses ini dapat mengubah data akun.
			</p>
			<a
				href="/pengaturan?bagian=data"
				class="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
			>
				Kelola cadangan data
			</a>
		</section>

		<p class="text-sm leading-6 text-muted-foreground">
			Jangan masukkan data pribadi yang tidak diperlukan untuk pembukuan. Gunakan kata sandi yang
			unik dan keluar dari aplikasi saat memakai perangkat bersama.
		</p>
	</div>
</div>
