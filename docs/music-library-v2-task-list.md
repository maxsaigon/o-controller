# Music Library V2 Task List

Scope: quản lý và trình diễn nhạc từ MusicServer, dùng playback engine DLNA/player hiện có.

## Tasks

- [x] Tạo plan và chốt scope MVP.
- [x] Tạo shared music catalog model và normalization layer.
- [ ] Expose catalog API cho server/folder/album/artist/search.
- [x] Expose initial lazy catalog endpoint `GET /music/catalog?serverId=...&objectId=...`.
- [ ] Chuẩn hóa play context và queue cho track/album/artist/folder.
- [ ] Xây Library UI: home, albums, artists, folders, detail pages.
- [x] Thêm Albums/Artists views vào MusicServer Library panel (prototype V1, không tính là hoàn tất V2).
- [x] Giữ player/queue persistent khi chuyển màn hình Library.
- [ ] Bổ sung test fixture MusicServer thật/mock và test lỗi mạng.
- [ ] Chạy typecheck, unit, integration; sửa lỗi và ghi kết quả.

## Build verification checkpoint

- [x] Service tests: 117 passed.
- [x] Shared/UPnP/service builds.
- [x] Desktop Vite production build.
- [x] Tauri `cargo check`.
- [x] Service sidecar bundle for `aarch64-apple-darwin`.
- [x] Native `.app` and `.dmg` build for `aarch64-apple-darwin`.
- [x] Đóng gói artifact prototype chuyển tiếp riêng, không ghi đè bản cũ.
- [x] Verify DMG checksum và sửa chữ ký ad-hoc để bundle pass strict code-sign verification.

## Definition of Done

- Duyệt được MusicServer theo folder, album và artist.
- Có thể phát track, album, artist hoặc folder bằng player hiện tại.
- Next/previous/autoplay và Now Playing tiếp tục hoạt động.
- Loading, empty, offline và retry state có test.
- Mỗi task có test tương ứng và plan được cập nhật sau khi hoàn tất.
- Cửa sổ desktop dùng layout V2 rộng/resizable với sidebar và content area; không còn shell compact 390×728 làm giao diện chính.

## UI V2 audit 2026-08-12

- [x] Xác nhận artifact 0.2.x trước đây vẫn dùng shell V1 compact.
- [x] Đổi native window sang 1180×760, resizable, minimum 920×640.
- [x] Thay bottom command rail bằng V2 sidebar và workspace content.
- [x] Thêm persistent mini player khi đang duyệt Library.
- [x] Visual QA ở viewport native 1180×760 với MusicServer thật: Now Playing, Folders và Albums.
- [x] Build và đóng gói artifact V2 mới sau visual QA.

## Album & folder presentation 2026-08-12

- [x] Route Albums đến container `391 albums` của MusicServer thay vì group folder hiện tại.
- [x] Route Artists đến container `Artist` và kiểm chứng 563 artists.
- [x] Render album/artist containers thành responsive card grid.
- [x] Album detail có artwork, metadata, Play Album và track list.
- [x] Folder breadcrumb hỗ trợ quay về Root/ancestor.
- [x] Search cục bộ cho albums, artists, folders và tracks trong view hiện tại.
- [x] Chuẩn hóa duration DLNA và grammar `track/tracks`.
- [x] Đồng bộ metadata vào persistent player ngay khi AVTransport chấp nhận Play.
- [ ] Library home/recently-added và artist detail theo album sections.

## Artwork performance 2026-08-12

- [x] Render artwork bằng native lazy loading và async image decoding.
- [x] Thêm service artwork proxy để tránh UI tự tải lặp trực tiếp từ MusicServer.
- [x] Cache LRU trong RAM: tối đa 256 ảnh / 48 MiB / TTL 6 giờ.
- [x] Cache âm 10 phút cho album không có ảnh và dọn entry khi hết hạn.
- [x] Gộp các request đồng thời cho cùng một artwork.
- [x] Tận dụng `albumArtURI` có sẵn trong kết quả browse, tránh SOAP browse từng album.
- [x] Thêm endpoint chẩn đoán `/dlna/artwork-cache/stats`.
- [x] Kiểm thử với MusicServer thật: lượt đầu 33.7 ms, cache hit 1.35 ms (ảnh 136,768 bytes); stats ghi nhận 1 hit / 1 miss.
- [x] Build, ký và verify DMG 0.5.0 riêng; không ghi đè artifact cũ.

## V1-NativeApp visual alignment

- [x] Đối chiếu DESIGN.md và bốn màn tham chiếu ở `docs/V1-NativeApp`.
- [x] Chuyển album list từ card ngang sang gallery artwork vuông, metadata bên dưới.
- [x] Tạo artist grid dạng portrait tròn và artist hero riêng.
- [x] Sửa artist route trung gian để `Artist` có presentation hero trước các collection kỹ thuật của MusicServer.
- [x] Chuyển Now Playing thành card artwork lớn, controls riêng và panel audio signal dùng metadata thật.
- [x] Visual QA Album (392), Artist (563), Adele detail và Player tại 1180×760; console sạch.
- [ ] Thêm artist album sections giàu metadata và nút Play Artist khi MusicServer resolve được queue xuyên collection.
- [ ] Hoàn thiện featured album/recently-added theo dữ liệu thật thay vì dữ liệu demo.
- [x] Build, ký và verify DMG 0.6.0 chứa Album/Player/Artist visual alignment.
- [x] Gộp Remote và Volume thành tab Player; đưa mute/volume slider vào playback controls.
- [x] Sửa Player artwork bị CSP chặn bằng local service proxy thay cho redirect sang MusicServer HTTP.
- [x] Build, ký và verify DMG 0.7.0 chứa Player tích hợp và artwork proxy.
- [x] Thêm Up Next dùng queue DLNA thật, empty state và Clear giữ bài hiện tại.
- [x] Build, ký và verify DMG 0.8.0 chứa Up Next.
- [x] Hiển thị file size từ DLNA `res@size` trong Player Audio Signal / Source Quality.
- [x] Căn lại Player theo `lumina_desktop/DESIGN.md`: named grid areas, card hierarchy, typography và spacing V2.
- [x] Chống vỡ layout Player bằng minmax columns, wrapping controls và breakpoint một cột ở <=980px.
- [x] Visual QA Player tại 920x640, 980x700, 1180x760 và 1440x900; không tràn ngang hoặc chồng khối.
- [x] Tinh gọn Player: bỏ device title/header phụ/source format lặp và device summary lặp; đưa Settings xuống cuối sidebar.
- [x] Tăng artwork lên tối đa 400px và thu hẹp header, content padding, grid/card gaps.
- [x] Thêm cấu hình Digital to Analog lưu bền vững và hiển thị chip DAC trong Audio Signal.
- [x] Tự test TCP/eISCP cho active receiver một lần khi app mở và lưu online/offline + thời điểm test.
- [x] Bỏ Global shortcuts diagnostics khỏi Settings nhưng giữ shortcut runtime hiện có.
