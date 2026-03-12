import Table from './table.svelte';
import TableHeader from './table-header.svelte';
import TableBody from './table-body.svelte';
import TableRow from './table-row.svelte';
import TableHead from './table-head.svelte';
import TableCell from './table-cell.svelte';
import TableCaption from './table-caption.svelte';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption };

export type TableProps = {
	class?: string;
};

export type TableHeaderProps = {
	class?: string;
};

export type TableBodyProps = {
	class?: string;
};

export type TableRowProps = {
	class?: string;
};

export type TableHeadProps = {
	class?: string;
};

export type TableCellProps = {
	class?: string;
};

export type TableCaptionProps = {
	class?: string;
};
