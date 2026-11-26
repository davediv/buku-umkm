<script lang="ts">
	import {
		Box,
		Briefcase,
		Building,
		Building2,
		Calendar,
		Car,
		Coffee,
		Droplets,
		Ellipsis,
		Factory,
		Flame,
		Folder,
		Fuel,
		Gift,
		Megaphone,
		MessageSquare,
		Package,
		Paperclip,
		Percent,
		Phone,
		Settings,
		ShoppingBag,
		ShoppingCart,
		TrendingDown,
		Truck,
		UserCheck,
		Users,
		UtensilsCrossed,
		Wine,
		Wrench,
		Zap
	} from '@lucide/svelte';
	import { isCategoryIcon, type CategoryIcon } from '$lib/shared/validation/category';

	type Props = {
		/** The stored Lucide icon name; anything outside the allowlist shows the fallback. */
		name: string | null | undefined;
		class?: string;
	};

	let { name, class: className = 'h-4 w-4' }: Props = $props();

	// Exactly the allowlisted names, each imported on its own so the bundle carries only
	// these icons. The Record type fails the build if the allowlist gains a name.
	const ICONS: Record<CategoryIcon, typeof Box> = {
		Box,
		Briefcase,
		Building,
		Building2,
		Calendar,
		Car,
		Coffee,
		Droplets,
		Factory,
		Flame,
		Fuel,
		Gift,
		Megaphone,
		MessageSquare,
		// Lucide renamed MoreHorizontal to Ellipsis; seeded rows keep the old name.
		MoreHorizontal: Ellipsis,
		Package,
		Paperclip,
		Percent,
		Phone,
		Settings,
		ShoppingBag,
		ShoppingCart,
		TrendingDown,
		Truck,
		UserCheck,
		Users,
		UtensilsCrossed,
		Wine,
		Wrench,
		Zap
	};

	let Icon = $derived(isCategoryIcon(name) ? ICONS[name] : Folder);
</script>

<Icon class={className} aria-hidden="true" />
