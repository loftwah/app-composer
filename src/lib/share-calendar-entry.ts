const calendarPath = '/_emdash/admin/plugins/composer-stacks/share-calendar';

export function shareCalendarEntry(
  signedIn: boolean,
  artwork?: { assetId: string; revision: string },
): string {
  const target = artwork
    ? calendarPath + '?' + new URLSearchParams({ artwork: artwork.assetId, revision: artwork.revision })
    : calendarPath;
  return signedIn ? target : '/_emdash/admin/login?' + new URLSearchParams({ redirect: target });
}
