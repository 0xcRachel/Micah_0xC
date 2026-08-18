# Micah 0xC — Giới thiệu ứng dụng & Nội dung trang Web

> Tài liệu này là nguồn nội dung (copy pack) cho trang giới thiệu sản phẩm **Micah 0xC**.
> Bạn có thể dùng trực tiếp các section dưới đây để dựng landing page chuyên nghiệp.

---

## 1. Elevator Pitch (câu giới thiệu ngắn — dùng cho hero / tiêu đề chính)

> **Micah 0xC** — Trình quản lý trải nghiệm game của bạn, tất cả trong một.
> Giao diện hiện đại, theo dõi hệ thống, quản lý game yêu thích, tích hợp quản lý Steam — nhanh, gọn, an toàn.

### Slogan ngắn
- **"Your games. Your rules. One hub."**
- **"Quản lý game theo cách của bạn."**
- **"Trải nghiệm. Thống kê. Kiểm soát."**

### Hero Sub-headline (đoạn dưới tiêu đề lớn)
> Micah 0xC là ứng dụng desktop tiện lợi giúp bạn tìm kiếm game, xem thông tin & điểm đánh giá,
> theo dõi tình trạng hệ thống máy tính, và quản lý trải nghiệm Steam của mình — từ một nơi duy nhất.
> Được xây dựng với công nghệ hiện đại (Tauri + React), nhẹ, nhanh và bảo mật.

---

## 2. Tính năng nổi bật (Feature Grid — 6 mục)

### 2.1 🔍 Tìm kiếm game thông minh
Tìm game theo tên, xem thông tin chi tiết, điểm đánh giá, hệ thống yêu cầu (system requirements)
và danh mục (single-player, online PvP, achievements, cloud…) ngay trong ứng dụng.

### 2.2 🖥️ Giám sát hệ thống thời gian thực
Theo dõi thông số máy tính của bạn — CPU, RAM, GPU, hệ điều hành — qua card thông tin hệ thống
(System Info Card) hiển thị ngay trên màn hình chính.

### 2.3 ⭐ Bộ sưu tập game yêu thích
Lưu lại những game bạn thích, xem lại nhanh chóng. Cơ chế "like" tiện lợi giúp bạn không bao giờ
quên tựa game đang mong chờ.

### 2.4 🎮 Trung tâm quản lý Steam (Steam Manager)
Một panel chuyên dụng với 5 tab đầy đủ:
- **Status** — trạng thái tích hợp & tình trạng Steam (Loaded / Not Loaded / Steam Off / Verify Failed).
- **Games** — danh sách game đã quản lý, bật/tắt từng game.
- **Logs** — xem log hoạt động để dễ dàng xử lý sự cố.
- **Settings** — cấu hình theo ý muốn.
- **Updater** — kiểm tra & cài bản cập nhật mới nhất của ứng dụng.

### 2.5 📥 Tải & quản lý script Lua tự động
- Tải script Lua từ Manifest Hub chỉ với một cú nhấp chuột.
- Tự động lưu vào thư mục `lua_scripts` riêng, đặt tên chuẩn theo AppID + tên game.
- Tự động import vào Steam và kích hoạt ngay — **không cần khởi động lại Steam**.
- Thông báo toast trạng thái thành công/thất bại rõ ràng, có animation mượt mà.

### 2.6 🚀 Cập nhật & bảo trì liền mạch
- Kiểm tra phiên bản mới, cập nhật từ nhiều kênh (channel).
- Hỗ trợ đa domain GitHub (giải quyết các vấn đề kết nối) kèm đo lường độ trễ DNS.
- Cài đặt chuyên nghiệp qua bộ cài **MSI** & **NSIS** (Windows).

---

## 3. Đối tượng sử dụng

| Nhóm người dùng | Giá trị nhận được |
| --- | --- |
| **Gamers thường** | Tìm game, xem đánh giá & requirements, lưu game yêu thích, theo dõi hệ thống. |
| **Game enthusiasts / modders** | Tải và quản lý script Lua, quản lý tích hợp game một cách có tổ chức. |
| **Người dùng kỹ thuật** | Panel quản lý chi tiết: log, cấu hình, updater, tùy biến theo nhu cầu. |

---

## 4. Thông tin kỹ thuật (tech highlights — cho mục "Built with")

| Khía cạnh | Chi tiết |
| --- | --- |
| **Nền tảng** | Windows (desktop) |
| **Frontend** | React 19 + Rsbuild (fast build), GSAP (animation mượt) |
| **Backend / Shell** | Tauri 2 (Rust) — nhẹ, nhanh, bảo mật cao, RAM thấp hơn Electron |
| **Theme** | Hỗ trợ Dark mode / Light mode, đồng bộ màu nhất quán (LED green accent) |
| **Đóng gói** | MSI + NSIS installer |
| **Version hiện tại** | 0.6.0 |

### Trải nghiệm UI/UX
- Nhân vật chibi tương tác (Character) — bấm để mở nhanh các tính năng.
- Hiệu ứng transition tròn mượt khi chuyển trang.
- Intro overlay đẹp mắt khi khởi động.
- Toast notification có animation in/out, portal tới body nên không bị che bởi modal.

---

## 5. Security & Privacy (xây dựng niềm tin — rất quan trọng cho landing)

> **An toàn là ưu tiên.**
> - Ứng dụng chạy **local-first**: dữ liệu chủ yếu được xử lý trên máy của bạn.
> - Kiến trúc **Tauri/Rust** giúp giảm thiểu bề mặt tấn công so với các giải pháp web-based đóng gói nặng nề.
> - Không có cơ chế thu thập dữ liệu nhạy cảm; cập nhật qua kênh có kiểm tra phiên bản.
> - Mã nguồn mở (open-source) — bạn có thể tự kiểm tra, đóng góp, tự build.

> **Cam kết trách nhiệm:** Sản phẩm được phát triển với tinh thần hỗ trợ người dùng.
> Vui lòng sử dụng đúng quy định, điều khoản của nền tảng và luật pháp địa phương.

---

## 6. Pricing (Mô hình kinh doanh)

| Gói | Giá | Bao gồm |
| --- | --- | --- |
| **Free** | 0₫ | Toàn bộ tính năng cơ bản: tìm kiếm, hệ thống, Steam Manager, Lua manager. |
| **Supporter (tùy chọn)** | Tùy chọn | Hỗ trợ phát triển, ưu tiên tính năng mới, badge cộng đồng. *(nếu bạn có kế hoạch này)* |

> 💡 *Gợi ý: mô hình "Free forever + Donation/Supporter" phù hợp cho tool cộng đồng open-source.*

---

## 7. FAQ

**Q: Micah 0xC có cần tài khoản hoặc đăng ký không?**
A: Không. Ứng dụng chạy local, không yêu cầu tài khoản.

**Q: Có an toàn không?**
A: Được xây dựng bằng Tauri/Rust, chạy local-first, mã nguồn mở để bạn tự kiểm tra.

**Q: Có phiên bản macOS/Linux không?**
A: Hiện tại ưu tiên Windows. Kiến trúc Tauri giúp việc mở rộng nền tảng trong tương lai trở nên khả thi.

**Q: Làm sao để cập nhật?**
A: Dùng tab Updater trong Steam Manager hoặc tải bản mới từ trang phát hành.

**Q: Tôi có cần Steam đang chạy không?**
A: Hầu hết tính năng dùng được độc lập; riêng các tính năng quản lý tích hợp sẽ yêu cầu Steam được cài đặt đúng đường dẫn.

---

## 8. Call To Action (mẫu nút)

- **Hero CTA:** `Tải ngay cho Windows`  ·  `Xem trên GitHub`
- **Mid-page CTA:** `Khám phá tính năng`  ·  `Hướng dẫn cài đặt`
- **Footer CTA:** `Bắt đầu miễn phí`  ·  `Báo lỗi & Góp ý`

---

## 9. Footer content

- © 2026 Micah 0xC. All rights reserved.
- Built with Tauri · React · Rust.
- Links: GitHub · Discord (nếu có) · Báo cáo lỗi · Chính sách quyền riêng tư · Điều khoản sử dụng.

---

## 10. Gợi ý cấu trúc Landing Page

1. **Navbar** — Logo + link (Tính năng, Tải về, FAQ, GitHub)
2. **Hero** — Slogan lớn + sub-headline + 2 CTA + ảnh screenshot chính
3. **Social proof strip** — "Open source · 0.6.0 · Windows"
4. **Feature Grid** — 6 tính năng (mục 2)
5. **Screenshot gallery** — Home, Steam Manager, Lightbox modal, Dark mode
6. **Tech section** — bảng thông số (mục 4)
7. **Security section** — niềm tin (mục 5)
8. **Pricing / Support** — (mục 6)
9. **FAQ** — (mục 7)
10. **Final CTA + Footer**

---

### Notes về nội dung
- Phần mô tả tính năng viết dựa trên **chức năng thực tế** của ứng dụng (đã đối chiếu code):
  SearchGame, SystemInfoCard, ProfileCard/Lightbox, SteamManager (Status/Games/Logs/Settings/Updater),
  Lua auto download & auto import (`auto_save_and_import_lua`), toast notification, dark/light theme, Tauri+React.
- Các phần **Supporter/Pricing** và **Discord** để trống là tùy chọn — bạn tự quyết định bổ sung.
- Bạn có thể thay tên file / ảnh screenshot placeholder bằng ảnh thật khi dựng web.
