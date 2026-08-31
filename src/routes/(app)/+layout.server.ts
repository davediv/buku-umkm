import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getOnboardingStatus } from '$lib/server/onboarding/service';
import { getLoginHref, getOnboardingHref } from '$lib/navigation/return-to';

export const load: LayoutServerLoad = async ({ locals, untrack, url }) => {
	// The destination is only needed for redirects. Do not make this persistent
	// layout depend on every URL change, otherwise each client navigation repeats
	// the onboarding database lookup before the leaf route can render.
	const returnTo = untrack(() => `${url.pathname}${url.search}`);
	if (!locals.user || !locals.session) {
		throw redirect(302, getLoginHref(returnTo));
	}

	const onboardingStatus = await getOnboardingStatus(getDb(), locals.user.id);
	if (!onboardingStatus) throw redirect(302, getOnboardingHref(returnTo));

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email
		},
		onboardingStatus,
		loadedAt: new Date().toISOString()
	};
};
