import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDIDLLite } from './content-directory.js';

describe('parseDIDLLite', () => {
  it('should parse containers (folders)', () => {
    const didl = `
      <DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"
                 xmlns:dc="http://purl.org/dc/elements/1.1/"
                 xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">
        <container id="64" parentID="0" childCount="12" restricted="1">
          <dc:title>Jazz Collection</dc:title>
          <upnp:class>object.container.storageFolder</upnp:class>
        </container>
      </DIDL-Lite>`;

    const result = parseDIDLLite(didl);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, 'container');
    assert.equal(result[0].id, '64');
    assert.equal(result[0].parentId, '0');
    assert.equal(result[0].title, 'Jazz Collection');
    assert.equal((result[0] as any).childCount, 12);
  });

  it('should parse items (tracks) with full metadata', () => {
    const didl = `
      <DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"
                 xmlns:dc="http://purl.org/dc/elements/1.1/"
                 xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">
        <item id="101" parentID="64" restricted="1">
          <dc:title>Take Five</dc:title>
          <dc:creator>Dave Brubeck</dc:creator>
          <upnp:artist>Dave Brubeck</upnp:artist>
          <upnp:album>Time Out</upnp:album>
          <upnp:genre>Jazz</upnp:genre>
          <upnp:albumArtURI>http://192.168.1.100:9790/albumart/101.jpg</upnp:albumArtURI>
          <upnp:class>object.item.audioItem.musicTrack</upnp:class>
          <res protocolInfo="http-get:*:audio/flac:*" duration="0:05:24" sampleFrequency="96000" bitsPerSample="24" size="52428800">http://192.168.1.100:9790/music/take-five.flac</res>
        </item>
      </DIDL-Lite>`;

    const result = parseDIDLLite(didl);
    assert.equal(result.length, 1);

    const item = result[0];
    assert.equal(item.type, 'item');
    assert.equal(item.id, '101');
    assert.equal(item.parentId, '64');
    assert.equal(item.title, 'Take Five');

    if (item.type === 'item') {
      assert.equal(item.artist, 'Dave Brubeck');
      assert.equal(item.album, 'Time Out');
      assert.equal(item.genre, 'Jazz');
      assert.equal(item.albumArtURI, 'http://192.168.1.100:9790/albumart/101.jpg');
      assert.equal(item.resourceUrl, 'http://192.168.1.100:9790/music/take-five.flac');
      assert.equal(item.mimeType, 'audio/flac');
      assert.equal(item.duration, '0:05:24');
      assert.equal(item.sampleRate, '96000');
      assert.equal(item.bitsPerSample, '24');
      assert.equal(item.size, 52428800);
    }
  });

  it('should parse mixed containers and items', () => {
    const didl = `
      <DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"
                 xmlns:dc="http://purl.org/dc/elements/1.1/"
                 xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">
        <container id="1" parentID="0" childCount="5" restricted="1">
          <dc:title>Albums</dc:title>
          <upnp:class>object.container</upnp:class>
        </container>
        <container id="2" parentID="0" childCount="3" restricted="1">
          <dc:title>Artists</dc:title>
          <upnp:class>object.container</upnp:class>
        </container>
        <item id="99" parentID="0" restricted="1">
          <dc:title>Loose Track</dc:title>
          <upnp:class>object.item.audioItem.musicTrack</upnp:class>
          <res protocolInfo="http-get:*:audio/mpeg:*">http://server/track.mp3</res>
        </item>
      </DIDL-Lite>`;

    const result = parseDIDLLite(didl);
    assert.equal(result.length, 3);
    assert.equal(result[0].type, 'container');
    assert.equal(result[0].title, 'Albums');
    assert.equal(result[1].type, 'container');
    assert.equal(result[1].title, 'Artists');
    assert.equal(result[2].type, 'item');
    assert.equal(result[2].title, 'Loose Track');
  });

  it('should handle double-escaped XML entities from SOAP', () => {
    // SOAP responses often double-escape the DIDL-Lite result
    const escaped = `&lt;DIDL-Lite xmlns=&quot;urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/&quot;&gt;
      &lt;container id=&quot;10&quot; parentID=&quot;0&quot; childCount=&quot;7&quot;&gt;
        &lt;dc:title&gt;My Music&lt;/dc:title&gt;
      &lt;/container&gt;
    &lt;/DIDL-Lite&gt;`;

    const result = parseDIDLLite(escaped);
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'My Music');
    assert.equal(result[0].id, '10');
    assert.equal((result[0] as any).childCount, 7);
  });

  it('should handle empty DIDL-Lite', () => {
    const result = parseDIDLLite('');
    assert.deepEqual(result, []);
  });

  it('should use dc:creator as artist fallback', () => {
    const didl = `
      <DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"
                 xmlns:dc="http://purl.org/dc/elements/1.1/">
        <item id="5" parentID="1" restricted="1">
          <dc:title>Song</dc:title>
          <dc:creator>The Creator</dc:creator>
          <res protocolInfo="http-get:*:audio/mpeg:*">http://server/song.mp3</res>
        </item>
      </DIDL-Lite>`;

    const result = parseDIDLLite(didl);
    assert.equal(result.length, 1);
    if (result[0].type === 'item') {
      assert.equal(result[0].artist, 'The Creator');
    }
  });

  it('should unescape XML entities in fields', () => {
    const didl = `
      <DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"
                 xmlns:dc="http://purl.org/dc/elements/1.1/">
        <item id="5" parentID="1" restricted="1">
          <dc:title>A &amp; B &lt; C &gt; D &quot; E &apos; F</dc:title>
          <res protocolInfo="http-get:*:audio/mpeg:*">http://server/song.mp3?a=1&amp;b=2</res>
        </item>
      </DIDL-Lite>`;

    const result = parseDIDLLite(didl);
    assert.equal(result.length, 1);
    assert.equal(result[0].title, "A & B < C > D \" E ' F");
    if (result[0].type === 'item') {
      assert.equal(result[0].resourceUrl, "http://server/song.mp3?a=1&b=2");
    }
  });
});
