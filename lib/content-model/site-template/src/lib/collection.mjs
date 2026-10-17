// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
// URL input selects a declared choice, never a field name or query operator.
export function collectionFilter(model) {
    return (model.fields.find((field) => field.type === "select" && !field.when) ?? null);
}
export function collectionRequest(model, params) {
    const field = collectionFilter(model), pages = params.getAll("page"), filters = params.getAll("filter");
    const page = pages.length === 0
        ? 1
        : pages.length === 1 && /^[1-9][0-9]{0,4}$/.test(pages[0])
            ? Number(pages[0])
            : null;
    const value = filters[0] ?? "";
    const valid = page !== null &&
        filters.length <= 1 &&
        (value === "" || !!field?.choices?.includes(value));
    return {
        field,
        page,
        value,
        valid,
        where: valid && value && field ? { [field.key]: value } : {},
    };
}
export function collectionAddress(page, value = "") {
    const params = new URLSearchParams();
    if (value)
        params.set("filter", value);
    if (page > 1)
        params.set("page", String(page));
    return "/" + (params.size ? "?" + params.toString() : "") + "#content";
}
