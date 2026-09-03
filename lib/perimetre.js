export function filtreCommune(query, ctx) {
  const id = ctx.lectureCommuneId || ctx.communeId;
  if (id) return query.eq('commune_id', id);
  return query;
}
