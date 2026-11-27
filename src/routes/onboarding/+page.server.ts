import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import {
	completeOnboarding,
	getOnboardingStatus,
	parseOnboardingForm,
	skipOnboarding
} from '#lib/server/onboarding/service.ts';
import {
	DEFAULT_APP_RETURN_TO,
	getLoginHref,
	getOnboardingHref,
	getSafeAppReturnTo
} from '#lib/navigation/return-to.ts';
import { summarizeError } from '#lib/server/error-summary.ts';

export const load: PageServerLoad = async (event) => {
	const returnTo =
		getSafeAppReturnTo(event.url.searchParams.get('return_to')) ?? DEFAULT_APP_RETURN_TO;
	// If not logged in, redirect to login
	if (!event.locals.user || !event.locals.session) {
		return redirect(302, getLoginHref(getOnboardingHref(returnTo)));
	}

	const status = await getOnboardingStatus(getDb(), event.locals.user.id);
	if (status) return redirect(302, returnTo);

	return { returnTo };
};

export const actions: Actions = {
	complete: async (event) => {
		if (!event.locals.user || !event.locals.session) {
			return fail(401, { message: 'Sesi berakhir. Silakan masuk kembali.' });
		}

		const formData = await event.request.formData();
		const returnTo =
			getSafeAppReturnTo(formData.get('return_to')?.toString()) ?? DEFAULT_APP_RETURN_TO;
		const parsed = parseOnboardingForm(formData);
		if (!parsed.success) return fail(400, { errors: parsed.errors });

		try {
			const result = await completeOnboarding(getDb(), event.locals.user.id, parsed.data);
			if (result.status === 'skipped') {
				return fail(409, { message: 'Onboarding sebelumnya telah dilewati.' });
			}
		} catch (error) {
			console.error('Failed to complete onboarding:', summarizeError(error));
			return fail(500, { message: 'Gagal menyimpan data. Silakan coba lagi.' });
		}

		return redirect(303, returnTo);
	},
	skip: async (event) => {
		if (!event.locals.user || !event.locals.session) {
			return fail(401, { message: 'Sesi berakhir. Silakan masuk kembali.' });
		}

		const formData = await event.request.formData();
		const returnTo =
			getSafeAppReturnTo(formData.get('return_to')?.toString()) ?? DEFAULT_APP_RETURN_TO;

		try {
			await skipOnboarding(getDb(), event.locals.user.id);
		} catch (error) {
			console.error('Failed to skip onboarding:', summarizeError(error));
			return fail(500, { message: 'Gagal menyimpan pilihan. Silakan coba lagi.' });
		}

		return redirect(303, returnTo);
	}
};
