# O-Control Desktop Companion Plan

## 1. Muc tieu

O-Control Desktop Companion la cong cu dieu khien Onkyo CR-N775 tu macOS trong luc lam viec, thay cho viec phai mo dien thoai va dung app Onkyo Controller mobile.

Repository du an:

- GitHub: `https://github.com/maxsaigon/o-controller.git`

Muc tieu chinh:

- Dieu khien nhanh tu macOS: power, volume, mute, input, play/pause.
- Co menu bar app nho gon, mo nhanh, khong chiem khong gian lam viec.
- Co keyboard shortcuts va preset de thao tac khong can roi tay khoi ban phim.
- Co backend on dinh de giao tiep voi Onkyo CR-N775 qua eISCP TCP port `60128`.
- Co web UI phu de dung tren trinh duyet khi can.
- Tan dung cac repo co san lam reference de giam thoi gian mo protocol, command coverage, va edge cases.

Khong phai muc tieu ban dau:

- Khong clone day du Onkyo Controller mobile.
- Khong clone day du `mkulesh/onpc`.
- Khong uu tien duyet thu muc NAS/USB trong MVP.
- Khong expose service truc tiep ra internet.
- Khong phu thuoc vao UDP discovery trong Docker.
- Khong copy code GPL-3.0 vao O-Control neu muon giu license linh hoat.

---

## 2. Nguyen tac san pham

O-Control nen la "desktop productivity remote", khong phai mot media center lon.

Nguyen tac UI/UX:

- Mo nhanh tu menu bar, thao tac trong 1-2 click.
- Mac dinh hien thi cac dieu khien hay dung nhat: power, volume, mute, input, playback.
- Trang thai hien tai phai ro rang: connected/disconnected, power, input, volume, now playing neu co.
- Keyboard-first cho cac thao tac lap lai.
- Khong dung layout marketing, hero, card trang tri, hay man hinh gioi thieu.
- Giao dien yen tinh, compact, phu hop luc lam viec.

Nguyen tac phat trien:

- Reference-driven build: hoc tu repo co san truoc khi tu implement.
- Build nho hon `onpc`: chi lam cac workflow macOS can dung hang ngay.
- Thu app co san truoc: neu `onpc` desktop da du tot thi khong can build nhieu.
- Tach ro phan protocol/service khoi UI de de test va thay doi.
- Tu implement lai cac phan can thiet, khong copy code co license khong phu hop.

---

## 3. Reference repositories

Dung cac repo sau nhu tai lieu ky thuat va benchmark tinh nang:

| Repo | Vai tro | Cach dung |
| --- | --- | --- |
| `mkulesh/onpc` | Full-featured Onkyo/Pioneer controller | Hoc feature scope, UX, state model, CR-N775 support, command coverage. Thu dung desktop app truoc khi build. |
| `miracle2k/onkyo-eiscp` | Python eISCP library/CLI | Hoc packet format, command mapping, discovery, raw command, status update behavior. |
| `jhesch/integra` | Go library + web server | Hoc kien truc service, HTTP API, WebSocket, state broadcast. |
| `tillbaks/node-eiscp` | Node eISCP library cu | Tham khao cach implement Node, command mapping, discovery. Khong dat lam dependency chinh neu khong test ky. |
| `ava-brn/lib-eiscp` | JavaScript eISCP library moi hon | Thu PoC neu can so sanh voi custom adapter. |
| `estbeetoo/node-red-contrib-eiscp` | Node-RED eISCP nodes | Hoc automation pattern va raw command flow. |
| `BMerz/onkyo_webcontrol` | PHP web PoC | Tham khao rieng cho web control va y tuong DLNA/NAS browser. |

License note:

- `mkulesh/onpc` dung GPL-3.0. Chi dung lam reference/benchmark. Khong copy code truc tiep vao O-Control neu O-Control khong muon bi rang buoc GPL.
- Uu tien ghi lai behavior va test case quan sat duoc, sau do implement doc lap bang TypeScript.

Reference outputs can tao:

- `docs/reference-audit.md`: tinh nang nao cua repo nao dang hoc, feature nao can/khong can cho O-Control.
- `docs/protocol-notes.md`: packet format, command mapping, quirks, source reference.
- `docs/cr-n775-test-log.md`: ket qua test tren thiet bi that.

---

## 4. Kien truc de xuat

```text
macOS Menu Bar App / Raycast / Web UI
              |
        HTTP + WebSocket
              |
       O-Control Service
              |
        TCP eISCP :60128
              |
       Onkyo CR-N775
```

### 4.1 O-Control Service

Service chiu trach nhiem ket noi voi receiver, gui lenh eISCP, doc status event, va dong bo state cho UI.

Tech stack:

- TypeScript
- Node.js LTS
- Fastify
- `ws` cho WebSocket
- `pino` cho logging
- `zod` cho validate config/API payload
- Custom eISCP TCP adapter bang `net.Socket`
- Docker Compose neu chay tren Mini PC N100

Ly do khong dat package eISCP cu lam core dependency:

- Mot so package Node eISCP da cu.
- eISCP packet format tuong doi nho, co the tu implement de kiem soat reconnect, parser, queue, va compatibility.
- Van co the dung `onkyo.js` hoac package tuong tu de PoC nhanh, nhung production service nen co adapter rieng.

### 4.2 macOS Companion App

App macOS la trai nghiem chinh.

Tech stack:

- Tauri
- React
- Tailwind CSS
- lucide-react cho icon

UI chinh:

- Menu bar icon hien trang thai ket noi.
- Popover compact khi click menu bar.
- Slider volume co nut `-` va `+`.
- Nut power, mute, play/pause.
- Input selector dang segmented/menu: CD, NET, USB, Bluetooth, Line.
- Now Playing section nho gon neu receiver tra ve metadata.
- Preset row: Work Jazz, Focus Quiet, Stop.

Keyboard shortcuts de xuat:

- `Cmd+Shift+Up`: volume up
- `Cmd+Shift+Down`: volume down
- `Cmd+Shift+Space`: play/pause
- `Cmd+Shift+M`: mute
- `Cmd+Shift+O`: open/close popover

### 4.3 Web UI phu

Web UI dung chung API/WebSocket voi macOS app.

Muc dich:

- Dieu khien tu browser tren LAN.
- Debug state nhanh.
- Dung tren iPad neu can.

Khong can PWA trong MVP, co the them sau.

### 4.4 Raycast Extension

Raycast la optional nhung rat phu hop voi workflow desktop.

Commands de xuat:

- `Onkyo: Power Toggle`
- `Onkyo: Volume Up`
- `Onkyo: Volume Down`
- `Onkyo: Set Volume`
- `Onkyo: Switch Input`
- `Onkyo: Work Jazz`
- `Onkyo: Stop`

---

## 5. Cau hinh va network

Yeu cau:

- CR-N775 dat IP tinh tren router/DHCP reservation.
- Bat `Network Standby` tren receiver neu muon power on tu standby.
- O-Control Service connect truc tiep bang IP, khong phu thuoc discovery.
- Neu chay trong Docker tren N100, cau hinh qua env:

```env
ONKYO_HOST=192.168.1.50
ONKYO_PORT=60128
O_CONTROL_PORT=8787
LOG_LEVEL=info
```

Neu can remote access:

- Dung Tailscale.
- Chi bind service vao LAN/tailnet.
- Them token/password neu mo web UI ngoai may local.

---

## 6. API de xuat

REST API:

```text
GET  /health
GET  /state
POST /commands/power
POST /commands/volume
POST /commands/mute
POST /commands/input
POST /commands/playback
POST /presets/:id/run
```

WebSocket:

```text
GET /events
```

Event shape:

```json
{
  "type": "state.changed",
  "state": {
    "connected": true,
    "power": "on",
    "input": "net",
    "volume": 26,
    "muted": false,
    "playback": "playing",
    "title": "Song title",
    "artist": "Artist name",
    "album": "Album name"
  }
}
```

---

## 7. eISCP command scope

MVP commands:

| Chuc nang | Command |
| --- | --- |
| Power query | `PWRQSTN` |
| Power on | `PWR01` |
| Standby | `PWR00` |
| Volume query | `MVLQSTN` |
| Volume up | `MVLUP` |
| Volume down | `MVLDOWN` |
| Volume set | `MVLxx` |
| Mute query | `AMTQSTN` |
| Mute on | `AMT01` |
| Mute off | `AMT00` |
| Input query | `SLIQSTN` |
| Network input | `SLI2B` |

Phase sau:

| Chuc nang | Command |
| --- | --- |
| Title | `NTI` |
| Artist | `NAT` |
| Album | `NAL` |
| Playback status | `NST` |
| Time | `NTM` |
| Album art | `NJA` |
| NET/USB list | `NLS` / `NLA` |

Can verify tren CR-N775 thuc te vi mot so command phu thuoc firmware va input hien tai.

---

## 8. Milestones va task list

### Phase 0: Reference audit va build/buy decision

- [ ] Cai hoac build thu `mkulesh/onpc` desktop tren macOS.
- [ ] Kiem tra `onpc` co nhan CR-N775/CR-N775D trong LAN khong.
- [ ] Test cac workflow hang ngay: power, volume, mute, input, play/pause, now playing.
- [ ] Kiem tra co menu bar/global shortcut/preset phu hop nhu mong muon khong.
- [ ] Ghi lai tinh nang nao cua `onpc` du dung, tinh nang nao thieu cho workflow macOS.
- [ ] Audit `mkulesh/onpc` de lap danh sach feature can hoc: state model, command groups, metadata, NET/USB handling.
- [ ] Audit `miracle2k/onkyo-eiscp` command mapping va packet behavior.
- [ ] Audit `jhesch/integra` service/WebSocket architecture.
- [ ] Audit Node options: `tillbaks/node-eiscp`, `ava-brn/lib-eiscp`, `onkyo.js`.
- [ ] Tao `docs/reference-audit.md`.
- [ ] Tao `docs/protocol-notes.md` ban dau.

Decision gate:

- Neu `onpc` desktop giai quyet du 80% nhu cau, O-Control chi can lam Raycast/preset wrapper hoac dung app co san.
- Neu `onpc` thieu menu bar, shortcut, preset, hoac workflow qua nang, tiep tuc build O-Control minimal.
- Neu eISCP tren CR-N775 khong on dinh, dung `onpc`/app co san va khong dau tu custom service lon.

Ket qua can co:

- Quyet dinh ro: dung `onpc`, wrapper nho quanh `onpc`, hay build O-Control rieng.
- Feature list cua O-Control duoc cat gon theo nhu cau that.

### Phase 1: Kiem chung CR-N775 thuc te

- [ ] Dat IP tinh cho CR-N775.
- [ ] Bat Network Standby tren CR-N775.
- [ ] Tu Mac/N100 test TCP port `60128` reachable.
- [ ] Gui thu raw command `PWRQSTN`, `MVLQSTN`, `SLIQSTN`.
- [ ] Xac nhan receiver gui event khi van volume tren may vat ly.
- [ ] Ghi lai input code dung cho CD, NET, USB, Bluetooth cua CR-N775.
- [ ] So sanh raw response voi behavior ghi nhan trong `onpc`/`onkyo-eiscp`.
- [ ] Cap nhat `docs/cr-n775-test-log.md`.

Ket qua can co:

- Biet chac CR-N775 co nhan lenh eISCP tu may chay service.
- Biet chac realtime event co hoat dong.

### Phase 2: Core Service MVP

- [ ] Khoi tao repo TypeScript.
- [ ] Tao config loader bang env + validation.
- [ ] Implement eISCP packet builder dua tren protocol notes.
- [ ] Implement eISCP packet parser dua tren protocol notes.
- [ ] Implement TCP connection manager.
- [ ] Them reconnect voi exponential backoff.
- [ ] Them command queue, toi thieu 50ms giua cac message.
- [ ] Implement state store in-memory.
- [ ] Query initial state sau khi connect.
- [ ] Map raw eISCP event sang state update.
- [ ] Implement REST API `/health` va `/state`.
- [ ] Implement command endpoints cho power, volume, mute, input, playback.
- [ ] Implement WebSocket `/events`.
- [ ] Them structured logging.
- [ ] Viet unit test cho packet builder/parser.
- [ ] Viet integration test voi mock TCP receiver.
- [ ] Them test case tu raw response ghi trong `docs/cr-n775-test-log.md`.

Ket qua can co:

- Co service chay local, dieu khien duoc receiver qua HTTP.
- State update realtime qua WebSocket.

### Phase 3: macOS Menu Bar App

- [ ] Khoi tao Tauri + React + Tailwind.
- [ ] Tao menu bar app mode.
- [ ] Hien thi connection status tren menu bar icon/popover.
- [ ] Tao compact control popover.
- [ ] Implement power toggle.
- [ ] Implement volume slider + step buttons.
- [ ] Implement mute toggle.
- [ ] Implement input selector.
- [ ] Implement playback controls.
- [ ] Subscribe WebSocket state.
- [ ] Xu ly disconnected/reconnecting state.
- [ ] Them global shortcuts.
- [ ] Them local settings screen: service URL, shortcuts, presets.
- [ ] Dong goi ban dev cho macOS.

Ket qua can co:

- Dieu khien CR-N775 tren macOS ma khong can mo browser hay dien thoai.

### Phase 4: Presets va workflow

- [ ] Dinh nghia preset schema.
- [ ] Them preset config file.
- [ ] Implement `Work Jazz`: power on, input NET/CD, volume mac dinh.
- [ ] Implement `Focus Quiet`: volume thap, mute off.
- [ ] Implement `Stop`: pause hoac standby.
- [ ] Them preset buttons vao menu bar app.
- [ ] Them REST endpoint `/presets/:id/run`.
- [ ] Them confirmation cho preset co standby/power off neu can.

Ket qua can co:

- Cac workflow nghe nhac hang ngay chay bang 1 click hoac shortcut.

### Phase 5: Web UI phu

- [ ] Tao web dashboard dung chung component voi Tauri neu kha thi.
- [ ] Hien thi state hien tai.
- [ ] Them control surface day du.
- [ ] Them debug panel cho raw events.
- [ ] Them responsive layout cho desktop/tablet.
- [ ] Them optional basic auth hoac tailnet-only note.

Ket qua can co:

- Co UI phu de dieu khien/debug tu browser.

### Phase 6: Now Playing

- [ ] Query metadata khi input la NET/USB/Bluetooth neu ho tro.
- [ ] Parse `NTI`, `NAT`, `NAL`, `NST`, `NTM`.
- [ ] Hien thi now playing trong menu bar popover.
- [ ] Them fallback khi metadata rong/khong support.
- [ ] Log raw metadata event de verify voi CR-N775.
- [ ] So sanh metadata behavior voi `onpc` de xac dinh command/edge case thieu.

Ket qua can co:

- Biet bai dang phat neu receiver/source tra metadata.

### Phase 7: Raycast Extension

- [ ] Tao Raycast extension.
- [ ] Cau hinh service URL.
- [ ] Implement command power toggle.
- [ ] Implement command volume up/down/set.
- [ ] Implement command switch input.
- [ ] Implement command run preset.
- [ ] Hien thi state trong Raycast detail view.

Ket qua can co:

- Dieu khien Onkyo truc tiep tu Raycast.

### Phase 8: Docker va homelab deployment

- [ ] Viet Dockerfile cho service.
- [ ] Viet Docker Compose.
- [ ] Them healthcheck.
- [ ] Them restart policy.
- [ ] Document env vars.
- [ ] Chay tren Ubuntu 24.04 LTS Mini PC N100.
- [ ] Cau hinh Netdata monitor container.
- [ ] Kiem tra reconnect sau khi restart receiver/router/container.

Ket qua can co:

- Service chay on dinh tren homelab.

### Phase 9: Experimental NAS/USB Browser

- [ ] Verify `NLS` / `NLA` tren CR-N775.
- [ ] Log raw list events.
- [ ] Xac dinh navigation model thuc te cua receiver.
- [ ] Audit cach `onpc` xu ly list/browser de hoc behavior, khong copy code.
- [ ] Tao UI list browser toi gian.
- [ ] Them loading/empty/error state.
- [ ] Danh gia UX co dang tiep tuc dau tu khong.

Ket qua can co:

- Quyet dinh co nen bien NAS/USB browser thanh feature chinh hay khong.

---

## 9. Rui ro va cach giam rui ro

| Rui ro | Tac dong | Cach giam rui ro |
| --- | --- | --- |
| Build lai thu `onpc` da giai quyet tot | Ton thoi gian | Phase 0 bat buoc thu/audit `onpc` va co decision gate |
| Copy code GPL-3.0 khong chu y | Rang buoc license ngoai y muon | Chi dung `onpc` lam reference, implement doc lap |
| Node eISCP packages cu | App loi tren Node moi | Tu implement raw adapter, chi dung package cho PoC |
| Docker khong discover duoc receiver | Khong tim thay thiet bi | Dung IP tinh, discovery optional |
| Firmware CR-N775 khong support mot so metadata | Now Playing thieu thong tin | Fallback UI, log raw event, scope metadata la phase sau |
| TCP connection bi dong | Mat realtime update | Reconnect/backoff, query lai state sau reconnect |
| Duyet NAS/USB phuc tap | Ton thoi gian, UX kem | De thanh experimental phase |
| Remote access kem an toan | Lo control service | Tailscale, bind LAN, auth neu can |

---

## 10. Definition of Done cho MVP

MVP duoc xem la hoan thanh khi:

- Da hoan thanh reference audit va quyet dinh build O-Control rieng la can thiet.
- Tu macOS co the power on/off CR-N775.
- Co the set volume va thay volume update khi van tren receiver.
- Co the mute/unmute.
- Co the chuyen input chinh.
- Menu bar app mo nhanh va khong can browser.
- Service tu reconnect khi receiver mat ket noi tam thoi.
- Co README huong dan cau hinh IP, Network Standby, chay service, chay macOS app.

---

## 11. Thu tu uu tien

1. Thu/audit `onpc` desktop va cac reference repo.
2. Build/buy decision: dung app co san, wrapper nho, hay O-Control rieng.
3. Raw eISCP PoC tren CR-N775.
4. Core service.
5. macOS menu bar app.
6. Shortcuts va presets.
7. Web UI phu.
8. Now Playing.
9. Raycast extension.
10. Docker homelab hardening.
11. NAS/USB browser experimental.

---

## 12. Cau truc repo de xuat

```text
o-control/
  apps/
    desktop/          # Tauri + React menu bar app
    web/              # Optional web UI
    raycast/          # Optional Raycast extension
  packages/
    service/          # Fastify service
    eiscp/            # Raw eISCP adapter
    shared/           # Types, schemas, command constants
  infra/
    docker/
      Dockerfile
      docker-compose.yml
  docs/
    reference-audit.md
    protocol-notes.md
    cr-n775-test-log.md
```

---

## 13. Ghi chu trien khai dau tien

Nen bat dau bang reference audit truoc khi tao app rieng.

Repo chinh cua du an la:

```text
https://github.com/maxsaigon/o-controller.git
```

Neu repo moi tao chua co commit dau tien, can init skeleton truoc khi giao task cho nhieu agent:

- Copy `o-control-desktop-companion-plan.md` vao repo root.
- Copy `.agents/` vao repo root.
- Tao `README.md`, `.gitignore`, `package.json`, va workspace structure ban dau.
- Commit skeleton truoc khi tach branch/task cho agent.

Sau khi decision gate xac nhan can build O-Control, tao repo nho voi 2 package:

- `packages/eiscp`: build/parse packet, socket client.
- `packages/service`: HTTP/WebSocket API.

Chi tao Tauri app sau khi service da dieu khien duoc receiver bang curl. Cach nay giup tach ro rui ro protocol khoi rui ro UI.
