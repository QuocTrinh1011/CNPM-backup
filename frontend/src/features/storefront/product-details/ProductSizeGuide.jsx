import React from 'react';
import { X } from 'lucide-react';

export function ProductSizeGuide({ showSizeGuide, setShowSizeGuide }) {
  return (
    <>
          {showSizeGuide && (
            <div
              className="modal-backdrop"
              onClick={() => setShowSizeGuide(false)}
            >
              <div
                className="size-guide-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="size-guide-header">
                  <h3>Bảng Hướng Dẫn Kích Thước</h3>
                  <button
                    type="button"
                    className="close-button"
                    aria-label="Đóng bảng kích thước"
                    onClick={() => setShowSizeGuide(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="size-guide-table-wrap">
                  <table className="size-guide-table">
                    <thead>
                      <tr>
                        <th>Size</th>
                        <th>Chiều cao</th>
                        <th>Cân nặng</th>
                        <th>Vòng ngực</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><b>S</b></td>
                        <td>1m55 – 1m65</td>
                        <td>48 – 55 kg</td>
                        <td>86 – 90 cm</td>
                      </tr>
                      <tr>
                        <td><b>M</b></td>
                        <td>1m64 – 1m72</td>
                        <td>55 – 65 kg</td>
                        <td>90 – 94 cm</td>
                      </tr>
                      <tr>
                        <td><b>L</b></td>
                        <td>1m70 – 1m78</td>
                        <td>65 – 75 kg</td>
                        <td>94 – 98 cm</td>
                      </tr>
                      <tr>
                        <td><b>XL</b></td>
                        <td>1m75 – 1m85</td>
                        <td>75 – 85 kg</td>
                        <td>98 – 104 cm</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="size-guide-tip">
                  💡 <b>Gợi ý:</b> Nếu bạn ở giữa 2 size, hãy chọn size lớn hơn để có cảm giác mặc rộng rãi và thoải mái nhất.
                </p>
              </div>
            </div>
          )}
    </>
  );
}
