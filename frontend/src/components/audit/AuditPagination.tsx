import Button from "@/components/common/Button";

type AuditPaginationProps = {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
};

const pageSizes = [20, 50, 100];

function AuditPagination({
  page,
  total,
  limit,
  onPageChange,
  onLimitChange,
}: AuditPaginationProps): JSX.Element {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-3">
      <p className="text-sm text-gray-300">Page {page} of {totalPages}</p>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400" htmlFor="audit-page-size">
          Page size
        </label>
        <select
          id="audit-page-size"
          className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          value={limit}
          onChange={(event) => onLimitChange(Number(event.target.value))}
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Previous
        </Button>
        <Button
          variant="ghost"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default AuditPagination;
