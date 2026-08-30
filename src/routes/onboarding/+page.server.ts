import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
	completeOnboarding,
	getOnboardingStatus,
	parseOnboardingForm,
	skipOnboarding
} from '$lib/server/onboarding/service';

export const load: PageServerLoad = async (event) => {
	// If not logged in, redirect to login
	if (!event.locals.user || !event.locals.session) {
		return redirect(302, '/masuk?redirect=/onboarding');
	}

	const status = await getOnboardingStatus(getDb(), event.locals.user.id);
	if (status) return redirect(302, '/beranda');

	return {};
};

export const actions: Actions = {
	complete: async (event) => {
		if (!event.locals.user || !event.locals.session) {
			return fail(401, { message: 'Sesi berakhir. Silakan masuk kembali.' });
		}

		const parsed = parseOnboardingForm(await event.request.formData());
		if (!parsed.success) return fail(400, { errors: parsed.errors });

		try {
			const result = await completeOnboarding(getDb(), event.locals.user.id, parsed.data);
			if (result.status === 'skipped') {
				return fail(409, { message: 'Onboarding sebelumnya telah dilewati.' });
			}
		} catch (error) {
			console.error('Failed to complete onboarding:', error);
			return fail(500, { message: 'Gagal menyimpan data. Silakan coba lagi.' });
		}

		return redirect(303, '/beranda');
	},
	skip: async (event) => {
		if (!event.locals.user || !event.locals.session) {
			return fail(401, { message: 'Sesi berakhir. Silakan masuk kembali.' });
		}

		try {
			await skipOnboarding(getDb(), event.locals.user.id);
		} catch (error) {
			console.error('Failed to skip onboarding:', error);
			return fail(500, { message: 'Gagal menyimpan pilihan. Silakan coba lagi.' });
		}

		return redirect(303, '/beranda');
	}
};
