# Music Library V2 Implementation Plan

## Decision

V2 dùng một MusicServer active, browse lazy, không xây database/index toàn thư viện. Catalog layer normalize dữ liệu DLNA; playback tiếp tục delegate cho queue DLNA hiện có.

## Delivery order

1. Shared types + catalog normalization → verify bằng unit tests.
2. Catalog REST API → verify bằng service tests.
3. Play context/queue → verify track/album/artist/folder và autoplay.
4. Library UI → verify component tests và desktop typecheck.
5. Persistent player integration → verify existing playback tests + new queue tests.
6. Full verification → `npm run typecheck`, `npm test`, `npm run test:integration`.

## MVP API

```text
GET  /music/servers
POST /music/scan
GET  /music/roots?serverId=...
GET  /music/folders/:id?serverId=...
GET  /music/albums?serverId=...
GET  /music/albums/:id?serverId=...
GET  /music/artists?serverId=...
GET  /music/artists/:id?serverId=...
GET  /music/recent?serverId=...
GET  /music/search?serverId=...&q=...
POST /music/play
```

## Progress log

### 2026-08-12

- Đã tạo task list và chốt implementation order.
- Existing foundation: DLNA discovery/browse/play, DLNA queue, cover art, Now Playing và receiver controls.
- Đã thêm `MusicTrack`, `MusicAlbum`, `MusicArtist`, `MusicCatalog` vào shared package.
- Đã thêm `normalizeMusicCatalog` và test fallback/grouping/sort tại service package.
- Verification: service tests 116 pass; workspace typecheck pass.
- Đã thêm `GET /music/catalog`, trả normalized albums/artists cho một container browse lazy; endpoint dùng lại discovery và `browseAll` hiện có.
- Đã thêm route contract test cho server không tồn tại.
- Verification sau API slice: service tests 117 pass; shared/upnp/service build pass; desktop Vite build pass; Tauri cargo check pass; sidecar bundle được tạo cho `aarch64-apple-darwin`.

## Current install/test status

Ứng dụng hiện đã build được frontend, native sidecar và native `.app`/`.dmg` cho Apple Silicon. Desktop đang dùng `NetList` làm MusicServer browser có folder/track playback; catalog album/artist UI chuyên biệt và full hardware verification vẫn là phần tiếp theo.

Artifact:

```text
apps/desktop/src-tauri/target/release/bundle/dmg/O-Control-MusicLibrary-V2_0.1.0_aarch64.dmg
```

Bản cũ `O-Control_0.1.0_aarch64.dmg` được giữ nguyên, không ghi đè.

Artifact prototype chuyển tiếp (không phải UI V2 hoàn chỉnh):

```text
apps/desktop/src-tauri/target/release/bundle/dmg/O-Control-MusicLibrary-V2_0.2.2_aarch64.dmg
```

UI checkpoint: Library panel V1 có thêm Folders / Albums / Artists; album/artist card phát queue tương ứng và dùng artwork fallback. Đây vẫn là shell V1 compact 390×728, chưa đạt layout V2 trong `/docs/V1-NativeApp`.

> Correction 2026-08-12: Các báo cáo trước gọi artifact 0.2.x là “UI V2 hoàn thiện” là không chính xác. Không dùng artifact này làm bản nghiệm thu V2.

### Build verification 2026-08-12

- Workspace typecheck pass.
- Full test suite pass: eISCP 39, service 117, UPnP 10, desktop 110, agent runner 9.
- Sidecar, frontend và native Apple Silicon `.app` build thành công.
- Tauri `bundle_dmg.sh` vẫn lỗi ở bước tạo DMG; fallback dùng `hdiutil` thành công.
- Phát hiện chữ ký linker ad-hoc không seal resources; đã ký lại toàn bundle và `codesign --verify --deep --strict` pass.
- DMG 0.2.2 pass `hdiutil verify`; SHA-256: `4da19105861141e098b2280369392765c16135ead3b3fa26b67cecec917297bb`.

### Corrected V2 shell build 2026-08-12

- Thay shell compact 390×728 bằng native window 1180×760, resizable, minimum 920×640.
- Navigation chính chuyển sang sidebar; workspace có Now Playing và Music Library content area.
- Library giữ persistent mini-player ở đáy; Folders/Albums/Artists dùng dữ liệu MusicServer thật.
- Visual QA trực tiếp ở 1180×760; console không có error/warning.
- Sửa bug time malformed hiển thị `NaN:--`; thêm regression test.
- Desktop tests 111 pass; workspace typecheck pass; native app build và strict code-sign verify pass.
- Artifact thực sự dùng shell V2: `apps/desktop/src-tauri/target/release/bundle/dmg/O-Control-MusicLibrary-V2_0.3.0_aarch64.dmg`.
- DMG verify valid; SHA-256: `74843eab8c904b9a6d56e22a9848ab3cfb30aba037ab8fd5ba61ed47ce3156f6`.

### Album/folder build 0.4.0

- Computer Use kiểm chứng native app: service reconnect, Root, Albums (392 entries), album open và Artists (563 entries).
- Browser automation kiểm chứng MusicServer thật: Albums routing, album artwork/detail/track row, Artists routing, search Adele, folder Root → `[folder view]`, breadcrumbs; console sạch.
- Sửa các bug do automation phát hiện: tab chọn trước server, tab Folder không về Root, album detail chỉ là card, raw duration, singular grammar và Now Playing chậm metadata.
- Service tests 118 pass; desktop tests 112 pass; workspace typecheck pass.
- Artifact: `apps/desktop/src-tauri/target/release/bundle/dmg/O-Control-MusicLibrary-V2_0.4.0_aarch64.dmg`.
- DMG verify valid; SHA-256: `c25869f67dc5e39f3a4e55aaf09058cbf3a918429b370e4d3b29cab6a1ffbfda`.

### Artwork cache build 0.5.0

- UI dùng `loading="lazy"` và `decoding="async"`, nên artwork ngoài viewport chưa tải ngay.
- Service proxy artwork có LRU giới hạn 256 ảnh / 48 MiB, TTL 6 giờ, cache âm 10 phút và request de-duplication.
- Index tối đa 2.000 `albumArtURI` được lấy trực tiếp từ browse result; không còn browse lại từng album trước khi tải ảnh.
- Browser được phép tái sử dụng response trong 6 giờ qua `Cache-Control: private, max-age=21600`.
- Test MusicServer thật với artwork album `21`: lượt đầu 33.7 ms, cache hit 1.35 ms; nội dung 136,768 bytes; stats `hits=1`, `misses=1`.
- Workspace typecheck pass; service 121/121 và desktop 112/112 pass.
- Native `.app` build và strict ad-hoc code-sign pass; DMG verify valid.
- Artifact: `apps/desktop/src-tauri/target/release/bundle/dmg/O-Control-MusicLibrary-V2_0.5.0_aarch64.dmg`.
- SHA-256: `4acfedc679a8134456a3b2b4247d150d9fb3fc46d797837e3fa9bb745de6b6e5`.

## Implementation notes

### V1-NativeApp visual alignment — Album, Player, Artist

- Album dùng gallery artwork vuông, typography/spacing theo Lumina Desktop và hover elevation nhẹ.
- Artist dùng portrait tròn; artist landing có hero identity trước các collection `albums/items/date/genre` của MusicServer.
- Player dùng artwork card lớn và audio signal card. Các trường source quality/output device lấy từ state thật; không sao chép thông tin thiết bị giả trong mockup.
- Visual QA với MusicServer thật ở viewport 1180×760: 392 albums, 563 artists, Adele detail; browser console không có warning/error.
- Desktop tests 112/112 và workspace typecheck pass.
- Native Apple Silicon artifact sau vòng visual alignment: `apps/desktop/src-tauri/target/release/bundle/dmg/O-Control-MusicLibrary-V2_0.6.0_aarch64.dmg`.
- App strict code-sign và DMG verification pass; SHA-256: `f7845eb62de5aee3e193d639e4d1c4ee13ca4f66af037622609464f40b35244a`.

### Integrated Player build 0.7.0

- Sidebar chỉ còn một destination `Player` thay cho Remote và Volume riêng biệt.
- Mute và volume slider được đặt inline cùng Previous/Play/Next theo bản thiết kế Player.
- Root cause artwork: `/cover-art` redirect sang HTTP origin của MusicServer, bị desktop WebView CSP chặn. Service giờ proxy image bytes về localhost và cache response 6 giờ.
- Service 121/121, desktop 111/111 và workspace typecheck pass.
- Artifact: `apps/desktop/src-tauri/target/release/bundle/dmg/O-Control-MusicLibrary-V2_0.7.0_aarch64.dmg`.
- DMG verify valid; SHA-256: `24fe86903d2b8f0a8ea7a42a0bb5344a9574945505a6489df358e72fa1bf08df`.

### Up Next build 0.8.0

- `/state` expose queue DLNA hiện tại và `currentIndex`; desktop chỉ trình diễn tối đa 2 bài sau bài đang phát.
- Module Up Next có empty state và nút Clear thật; Clear giữ nguyên current track, xoá phần queue còn lại.
- Service 122/122, desktop 113/113 và workspace typecheck pass.
- Artifact: `apps/desktop/src-tauri/target/release/bundle/dmg/O-Control-MusicLibrary-V2_0.8.0_aarch64.dmg`.
- DMG verify valid; SHA-256: `e3cb7d7f3cc5c27785cab053d94671c08b67305be5782fcfffe74ee1ff82ecba`.

### Player source file size

- Dùng trực tiếp metadata `size` (bytes) trong DLNA `res`, truyền theo queue và current track; không ước lượng từ bitrate/duration.
- Source Quality định dạng kích thước tự động B/KB/MB/GB; ẩn trường này nếu MusicServer không cung cấp.

### Player layout hardening

- Áp dụng hierarchy của Lumina Desktop: artwork/metadata là hero card, Audio Signal và Up Next là supporting cards; dùng radius, border và shadow theo `DESIGN.md`.
- Layout desktop dùng named grid areas để Player, controls, Audio Signal và Up Next không phụ thuộc implicit grid rows.
- Từ 980px trở xuống, các module chuyển sang một cột có giới hạn chiều rộng và dùng content scroll; playback controls được phép wrap thay vì tràn.
- Browser QA tại 920x640, 980x700, 1180x760 và 1440x900 xác nhận document không có horizontal overflow.
- Vòng tinh gọn tiếp theo loại bỏ metadata trùng giữa Player và Audio Signal, bỏ device identity/status lặp, rút header xuống 58px và dành thêm diện tích cho artwork tối đa 400px.
- Settings lưu `digitalToAnalog` trong native `settings.json` (localStorage ở browser preview); Player đọc giá trị này cho hàng Digital-to-Analog.
- Native shell gọi `test_active_receiver_connection` đúng một lần sau khi tải cấu hình lúc startup, kiểm tra TCP/eISCP và ghi `lastTestStatus`/`lastTestAt` mà không cần người dùng mở Settings.

### Catalog normalization

Normalization hiện nhận một browse result trực tiếp. Item không có `resourceUrl` bị bỏ qua; album thiếu metadata dùng `parentId` làm key; track number được derive từ prefix dạng `01.`, `02-` hoặc `03 `. Đây là bước normalize tối thiểu, chưa phải full-library index.
