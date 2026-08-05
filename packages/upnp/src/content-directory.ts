import type {
  BrowseResponse,
  DLNABrowseResult,
  DLNAContainer,
  DLNAItem,
} from './types.js';

// ── SOAP Envelope ─────────────────────────────────────────────

function buildBrowseSOAP(
  objectId: string,
  startIndex: number,
  requestedCount: number
): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"
            xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <u:Browse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1">
      <ObjectID>${escapeXml(objectId)}</ObjectID>
      <BrowseFlag>BrowseDirectChildren</BrowseFlag>
      <Filter>*</Filter>
      <StartingIndex>${startIndex}</StartingIndex>
      <RequestedCount>${requestedCount}</RequestedCount>
      <SortCriteria></SortCriteria>
    </u:Browse>
  </s:Body>
</s:Envelope>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unescapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// ── DIDL-Lite Parser ──────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'i');
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? '';
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const tagRegex = new RegExp(`<(?:[\\w-]+:)?${tag}([^>]*)>`, 'i');
  const tagMatch = xml.match(tagRegex);
  if (!tagMatch) return '';

  const attrRegex = new RegExp(`${attr}="([^"]*)"`, 'i');
  const attrMatch = tagMatch[1].match(attrRegex);
  return attrMatch?.[1]?.trim() ?? '';
}

function extractResUrl(xml: string): string {
  // <res ...>http://url</res>
  const match = xml.match(/<res[^>]*>([\s\S]*?)<\/res>/i);
  return match?.[1]?.trim() ?? '';
}

function extractResAttr(xml: string, attr: string): string {
  const resMatch = xml.match(/<res([^>]*)>/i);
  if (!resMatch) return '';
  const attrMatch = resMatch[1].match(new RegExp(`${attr}="([^"]*)"`, 'i'));
  return attrMatch?.[1]?.trim() ?? '';
}

/**
 * Parse a DIDL-Lite XML fragment into typed browse results.
 */
export function parseDIDLLite(didlXml: string): DLNABrowseResult {
  const results: DLNABrowseResult = [];

  // Unescape XML entities that are double-escaped in SOAP response
  let xml = didlXml;
  if (xml.includes('&lt;')) {
    xml = xml
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');
  }

  // Split into container and item blocks
  const containerBlocks = xml.match(/<container[^>]*>[\s\S]*?<\/container>/gi) ?? [];
  const itemBlocks = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) ?? [];

  for (const block of containerBlocks) {
    const id = unescapeXml(extractAttr(block, 'container', 'id'));
    const parentId = unescapeXml(extractAttr(block, 'container', 'parentID'));
    const childCountStr = unescapeXml(extractAttr(block, 'container', 'childCount'));
    const title = unescapeXml(extractTag(block, 'title'));
    const albumArtURI = unescapeXml(extractTag(block, 'albumArtURI'));

    const container: DLNAContainer = {
      id,
      parentId,
      title,
      type: 'container',
    };
    if (childCountStr) container.childCount = parseInt(childCountStr, 10);
    if (albumArtURI) container.albumArtURI = albumArtURI;

    results.push(container);
  }

  for (const block of itemBlocks) {
    const id = unescapeXml(extractAttr(block, 'item', 'id'));
    const parentId = unescapeXml(extractAttr(block, 'item', 'parentID'));
    const title = unescapeXml(extractTag(block, 'title'));
    const artist = unescapeXml(extractTag(block, 'artist') || extractTag(block, 'creator'));
    const album = unescapeXml(extractTag(block, 'album'));
    const genre = unescapeXml(extractTag(block, 'genre'));
    const albumArtURI = unescapeXml(extractTag(block, 'albumArtURI'));
    const resourceUrl = unescapeXml(extractResUrl(block));
    const mimeType = unescapeXml(extractResAttr(block, 'protocolInfo').split(':')[2] ?? '');
    const duration = unescapeXml(extractResAttr(block, 'duration'));
    const sampleRate = unescapeXml(extractResAttr(block, 'sampleFrequency'));
    const bitsPerSample = unescapeXml(extractResAttr(block, 'bitsPerSample'));
    const sizeStr = unescapeXml(extractResAttr(block, 'size'));

    const item: DLNAItem = {
      id,
      parentId,
      title,
      type: 'item',
    };
    if (artist) item.artist = artist;
    if (album) item.album = album;
    if (genre) item.genre = genre;
    if (albumArtURI) item.albumArtURI = albumArtURI;
    if (resourceUrl) item.resourceUrl = resourceUrl;
    if (mimeType) item.mimeType = mimeType;
    if (duration) item.duration = duration;
    if (sampleRate) item.sampleRate = sampleRate;
    if (bitsPerSample) item.bitsPerSample = bitsPerSample;
    if (sizeStr) item.size = parseInt(sizeStr, 10);

    results.push(item);
  }

  return results;
}

// ── Browse Action ─────────────────────────────────────────────

/**
 * Browse a container on a DLNA ContentDirectory service.
 *
 * @param controlUrl - The absolute control URL of the ContentDirectory service
 * @param objectId - The container/object ID to browse ("0" for root)
 * @param startIndex - Pagination start offset
 * @param requestedCount - Max items to return (0 = server decides)
 */
export async function browseContentDirectory(
  controlUrl: string,
  objectId = '0',
  startIndex = 0,
  requestedCount = 200,
): Promise<BrowseResponse> {
  const soapBody = buildBrowseSOAP(objectId, startIndex, requestedCount);

  const response = await fetch(controlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      'SOAPAction': '"urn:schemas-upnp-org:service:ContentDirectory:1#Browse"',
    },
    body: soapBody,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`ContentDirectory Browse failed: ${response.status} ${response.statusText}`);
  }

  const responseXml = await response.text();

  // Extract the Result DIDL-Lite from the SOAP response
  const resultMatch = responseXml.match(/<Result[^>]*>([\s\S]*?)<\/Result>/i);
  const didlXml = resultMatch?.[1] ?? '';

  // Extract TotalMatches and NumberReturned
  const totalMatch = responseXml.match(/<TotalMatches[^>]*>(\d+)<\/TotalMatches>/i);
  const returnedMatch = responseXml.match(/<NumberReturned[^>]*>(\d+)<\/NumberReturned>/i);
  const totalMatches = totalMatch ? parseInt(totalMatch[1], 10) : 0;
  const numberReturned = returnedMatch ? parseInt(returnedMatch[1], 10) : 0;

  const items = parseDIDLLite(didlXml);

  return { items, totalMatches, numberReturned };
}

/**
 * Browse all items in a container, automatically handling pagination.
 */
export async function browseAll(
  controlUrl: string,
  objectId = '0',
  pageSize = 200,
): Promise<BrowseResponse> {
  const allItems: DLNABrowseResult = [];
  let startIndex = 0;
  let totalMatches = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await browseContentDirectory(controlUrl, objectId, startIndex, pageSize);
    allItems.push(...page.items);
    totalMatches = page.totalMatches;

    if (allItems.length >= totalMatches || page.numberReturned === 0) {
      break;
    }
    startIndex += page.numberReturned;
  }

  return { items: allItems, totalMatches, numberReturned: allItems.length };
}
