import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// If not logged in, redirect to login
	if (!event.locals.user || !event.locals.session) {
		return redirect(302, '/masuk?redirect=/onboarding');
	}

	return {
		userId: event.locals.user.id
	};
};
