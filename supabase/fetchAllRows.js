// Supabase returns at most 1000 rows per request. This asks for the rows page by page until
// there are no more, so loaders are not silently cut off at 1000.
//
// buildQuery() must return a NEW query each time, already sorted by a column (or columns) that
// is unique per row. A stable sort is what keeps rows from repeating or going missing between pages.
const PAGE_SIZE = 1000;

export async function fetchAllRows(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows.length ? rows : null, error };
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;   // a short page means that was the last one
  }
  return { data: rows, error: null };
}
