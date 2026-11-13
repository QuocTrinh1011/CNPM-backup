import React from 'react';
import './DesktopConnectionScreen.css';

export default function DesktopConnectionScreen({ onRetry, onChangeServer }) {
  return (
    <main className="desktop-connection">
      <section className="desktop-connection__card" aria-labelledby="desktop-connection-title">
        <p className="desktop-connection__eyebrow">ANH LỚN SHOP · DESKTOP</p>
        <h1 id="desktop-connection-title">Không kết nối được máy chủ</h1>
        <p className="desktop-connection__message" role="alert">
          Máy chủ CRM hiện không phản hồi. Kiểm tra backend và kết nối mạng, sau đó thử lại.
        </p>
        <div className="desktop-connection__actions">
          <button className="desktop-connection__primary" onClick={onRetry} type="button">Thử lại</button>
          <button className="desktop-connection__secondary" onClick={onChangeServer} type="button">Đổi địa chỉ máy chủ</button>
        </div>
      </section>
    </main>
  );
}
