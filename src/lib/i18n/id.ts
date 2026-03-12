/**
 * Indonesian (Bahasa Indonesia) locale messages
 * Used for all UI strings in the application
 */
export const id = {
	// Common
	common: {
		save: 'Simpan',
		cancel: 'Batal',
		delete: 'Hapus',
		edit: 'Edit',
		add: 'Tambah',
		search: 'Cari',
		filter: 'Filter',
		export: 'Ekspor',
		import: 'Impor',
		loading: 'Memuat...',
		noData: 'Tidak ada data',
		confirm: 'Konfirmasi',
		yes: 'Ya',
		no: 'Tidak',
		close: 'Tutup',
		back: 'Kembali',
		next: 'Berikutnya',
		submit: 'Kirim',
		reset: 'Reset',
		refresh: 'Segarkan',
		download: 'Unduh',
		upload: 'Unggah',
		view: 'Lihat',
		details: 'Detail',
		actions: 'Aksi',
		status: 'Status',
		date: 'Tanggal',
		amount: 'Jumlah',
		description: 'Deskripsi',
		notes: 'Catatan',
		name: 'Nama',
		email: 'Email',
		password: 'Kata Sandi',
		phone: 'Telepon',
		address: 'Alamat',
		total: 'Total',
		subtotal: 'Subtotal',
		discount: 'Diskon',
		tax: 'Pajak',
		balance: 'Saldo'
	},

	// Auth
	auth: {
		login: 'Masuk',
		logout: 'Keluar',
		register: 'Daftar',
		forgotPassword: 'Lupa Kata Sandi?',
		resetPassword: 'Reset Kata Sandi',
		confirmPassword: 'Konfirmasi Kata Sandi',
		emailPlaceholder: 'contoh@email.com',
		passwordPlaceholder: 'Masukkan kata sandi',
		noAccount: 'Belum punya akun?',
		hasAccount: 'Sudah punya akun?',
		welcomeBack: 'Selamat datang kembali',
		createAccount: 'Buat Akun',
		loginSuccess: 'Berhasil masuk',
		logoutSuccess: 'Berhasil keluar',
		registerSuccess: 'Berhasil membuat akun',
		invalidCredentials: 'Email atau kata sandi salah',
		emailRequired: 'Email wajib diisi',
		passwordRequired: 'Kata sandi wajib diisi',
		passwordMinLength: 'Kata sandi minimal 8 karakter'
	},

	// Navigation
	nav: {
		home: 'Beranda',
		dashboard: 'Dasbor',
		accounts: 'Akun',
		categories: 'Kategori',
		transactions: 'Transaksi',
		debts: 'Hutang/Piutang',
		reports: 'Laporan',
		tax: 'Pajak',
		settings: 'Pengaturan',
		profile: 'Profil'
	},

	// Accounts
	accounts: {
		title: 'Kelola Akun',
		addAccount: 'Tambah Akun',
		editAccount: 'Edit Akun',
		accountName: 'Nama Akun',
		accountType: 'Jenis Akun',
		accountNumber: 'Nomor Akun',
		initialBalance: 'Saldo Awal',
		currentBalance: 'Saldo Saat Ini',
		asset: 'Aktiva',
		liability: 'Kewajiban',
		equity: 'Modal',
		revenue: 'Pendapatan',
		expense: 'Beban',
		cash: 'Kas',
		bank: 'Bank',
		accountDeleted: 'Akun berhasil dihapus',
		accountSaved: 'Akun berhasil disimpan'
	},

	// Categories
	categories: {
		title: 'Kelola Kategori',
		addCategory: 'Tambah Kategori',
		editCategory: 'Edit Kategori',
		categoryName: 'Nama Kategori',
		categoryType: 'Jenis Kategori',
		income: 'Pemasukan',
		expense: 'Pengeluaran',
		categoryDeleted: 'Kategori berhasil dihapus',
		categorySaved: 'Kategori berhasil disimpan'
	},

	// Transactions
	transactions: {
		title: 'Transaksi',
		addTransaction: 'Tambah Transaksi',
		editTransaction: 'Edit Transaksi',
		transactionDate: 'Tanggal Transaksi',
		transactionType: 'Jenis Transaksi',
		transactionDescription: 'Deskripsi Transaksi',
		receipt: 'Bukti Transaksi',
		uploadReceipt: 'Unggah Bukti',
		takePhoto: 'Ambil Foto',
		income: 'Pemasukan',
		expense: 'Pengeluaran',
		transfer: 'Transfer',
		transactionSaved: 'Transaksi berhasil disimpan',
		transactionDeleted: 'Transaksi berhasil dihapus',
		selectAccount: 'Pilih Akun',
		selectCategory: 'Pilih Kategori'
	},

	// Dashboard
	dashboard: {
		title: 'Dasbor',
		cashFlow: 'Arus Kas',
		balance: 'Saldo',
		income: 'Total Pemasukan',
		expense: 'Total Pengeluaran',
		profit: 'Laba/Rugi',
		thisMonth: 'Bulan Ini',
		lastMonth: 'Bulan Lalu',
		thisYear: 'Tahun Ini',
		overview: 'Ringkasan',
		recentTransactions: 'Transaksi Terbaru',
		viewAll: 'Lihat Semua'
	},

	// Debts
	debts: {
		title: 'Hutang/Piutang',
		addDebt: 'Tambah Hutang/Piutang',
		editDebt: 'Edit Hutang/Piutang',
		debtType: 'Jenis',
		creditor: 'Pemberi Pinjaman',
		debtor: 'Peminjam',
		principal: 'Pokok',
		interest: 'Bunga',
		dueDate: 'Jatuh Tempo',
		paidAmount: 'Jumlah Dibayar',
		remainingAmount: 'Sisa Jumlah',
		paidOff: 'Lunas',
		outstanding: 'Belum Lunas',
		debtPaid: 'Pembayaran berhasil dicatat',
		receivable: 'Piutang',
		payable: 'Hutang'
	},

	// Tax
	tax: {
		title: 'Pajak',
		overview: 'Ringkasan Pajak',
		pphFinal: 'PPh Final 0.5%',
		taxableIncome: 'Penghasilan Kena Pajak',
		taxDue: 'Pajak Terutang',
		taxPaid: 'Pajak Dibayar',
		taxPeriod: 'Masa Pajak',
		monthly: 'Bulanan',
		quarterly: 'Tahunan',
		annual: 'Tahunan',
		taxReturn: 'SPT',
		taxBilling: 'Kode Billing',
		taxPaidSuccess: 'Pembayaran pajak berhasil',
		taxDueDate: 'Jatuh Tempo Pembayaran'
	},

	// Reports
	reports: {
		title: 'Laporan',
		incomeStatement: 'Laporan Laba Rugi',
		balanceSheet: 'Laporan Posisi Keuangan',
		cashFlow: 'Laporan Arus Kas',
		notes: 'Catatan atas Laporan Keuangan',
		exportPDF: 'Ekspor PDF',
		exportExcel: 'Ekspor Excel',
		exportCSV: 'Ekspor CSV',
		period: 'Periode',
		from: 'Dari',
		to: 'Sampai',
		generate: 'Buat Laporan'
	},

	// Settings
	settings: {
		title: 'Pengaturan',
		profile: 'Profil Bisnis',
		backup: 'Cadangan Data',
		restore: 'Pulihkan Data',
		backupSuccess: 'Backup berhasil dibuat',
		restoreSuccess: 'Data berhasil dipulihkan',
		language: 'Bahasa',
		theme: 'Tema',
		darkMode: 'Mode Gelap',
		lightMode: 'Mode Terang',
		systemDefault: 'Ikuti Sistem'
	},

	// Onboarding
	onboarding: {
		welcome: 'Selamat Datang',
		welcomeDesc: 'Kelola keuangan UMKM Anda dengan mudah',
		step1Title: 'Buat Profil Bisnis',
		step1Desc: 'Masukkan nama dan informasi bisnis Anda',
		step2Title: 'Atur Akun Dasar',
		step2Desc: 'Buat akun Kas dan Bank untuk memulai',
		step3Title: 'Mulai Mencatat',
		step3Desc: 'Catat transaksi keuangan Anda',
		getStarted: 'Mulai Sekarang',
		skip: 'Lewati',
		previous: 'Sebelumnya',
		next: 'Berikutnya',
		finish: 'Selesai'
	},

	// Errors
	errors: {
		required: 'Field ini wajib diisi',
		invalidEmail: 'Email tidak valid',
		invalidNumber: 'Angka tidak valid',
		minLength: 'Minimal {min} karakter',
		maxLength: 'Maksimal {max} karakter',
		positiveNumber: 'Harus berupa angka positif',
		networkError: 'Terjadi kesalahan jaringan',
		serverError: 'Terjadi kesalahan server',
		unknownError: 'Terjadi kesalahan yang tidak diketahui',
		notFound: 'Data tidak ditemukan',
		unauthorized: 'Anda tidak memiliki akses'
	},

	// Confirmation dialogs
	confirm: {
		deleteTitle: 'Konfirmasi Hapus',
		deleteMessage:
			'Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.',
		logoutTitle: 'Konfirmasi Keluar',
		logoutMessage: 'Apakah Anda yakin ingin keluar?'
	},

	// Sync
	sync: {
		syncing: 'Menyinkronkan...',
		synced: 'Tersinkron',
		syncFailed: 'Sinkronisasi gagal',
		offline: 'Offline',
		online: 'Online',
		lastSync: 'Sinkronisasi terakhir: {time}'
	}
};

export type LocaleMessages = typeof id;
