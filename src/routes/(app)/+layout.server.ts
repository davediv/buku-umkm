import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getOnboardingStatus } from '$lib/server/onboarding/service';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const onboardingStatus = await getOnboardingStatus(getDb(), locals.user.id);
	if (!onboardingStatus) throw redirect(302, '/onboarding');

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email
		},
		onboardingStatus
	};
};
