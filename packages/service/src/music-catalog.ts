import type { DLNABrowseResult, DLNAItem } from '@o-control/upnp';
import type { MusicAlbum, MusicArtist, MusicCatalog, MusicTrack } from '@o-control/shared';

function stableId(prefix: string, value: string): string {
  return `${prefix}:${value.trim().toLocaleLowerCase()}`;
}

function parseTrackNumber(title: string): number | undefined {
  const match = title.match(/^\s*(\d{1,3})[.\-\s]+/);
  return match ? Number(match[1]) : undefined;
}

function toTrack(item: DLNAItem): MusicTrack | null {
  if (!item.resourceUrl) return null;
  const artist = item.artist?.trim() || undefined;
  const album = item.album?.trim() || undefined;
  return {
    id: item.id,
    parentId: item.parentId,
    title: item.title,
    artist,
    album,
    albumId: album ? stableId('album', album) : undefined,
    artistId: artist ? stableId('artist', artist) : undefined,
    trackNumber: parseTrackNumber(item.title),
    duration: item.duration,
    resourceUrl: item.resourceUrl,
    mimeType: item.mimeType,
    albumArtUrl: item.albumArtURI,
  };
}

/** Normalize direct children returned by a DLNA browse into music views. */
export function normalizeMusicCatalog(items: DLNABrowseResult): MusicCatalog {
  const albums = new Map<string, MusicAlbum>();
  const artists = new Map<string, MusicArtist>();

  for (const item of items) {
    if (item.type !== 'item') continue;
    const track = toTrack(item);
    if (!track) continue;

    const albumKey = track.albumId ?? stableId('album', track.parentId);
    const album = albums.get(albumKey) ?? {
      id: albumKey,
      title: track.album ?? 'Unknown Album',
      artist: track.artist,
      artistId: track.artistId,
      albumArtUrl: track.albumArtUrl,
      tracks: [],
    };
    album.tracks.push({ ...track, albumId: albumKey });
    albums.set(albumKey, album);

    if (track.artistId) {
      const artist = artists.get(track.artistId) ?? {
        id: track.artistId,
        name: track.artist!,
        albums: [],
      };
      if (!artist.albums.some((entry) => entry.id === album.id)) artist.albums.push(album);
      artists.set(artist.id, artist);
    }
  }

  for (const album of albums.values()) {
    album.tracks.sort((left, right) => (left.trackNumber ?? Number.MAX_SAFE_INTEGER)
      - (right.trackNumber ?? Number.MAX_SAFE_INTEGER));
  }

  return { albums: [...albums.values()], artists: [...artists.values()] };
}
