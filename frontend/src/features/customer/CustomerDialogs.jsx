import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Bell, Heart, KeyRound, MapPin, X } from "lucide-react";
import { api, endpoints, signIn, signUp } from "../../api/api";
import { useShopResource } from "../../shared/hooks/storefront-hooks";
import { date, imageSrc, money, protectImage, surveyOptions } from "../../shared/utils/storefront-display";
import { RewardSummary } from "./CustomerVouchers";

export function AuthModal({ page = false, mode, onModeChange, onClose, onAuthenticated, onNotice, onForgot }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    age: "",
  });
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const submit = async (event) => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setAuthError("");
    setBusy(true);
    try {
      if (mode === "register") {
        await signUp({
          ...form,
          age: form.age === "" ? null : Number(form.age),
        });
        onNotice("Tạo tài khoản thành công.");
      }
      const data = await signIn({ email: form.email, password: form.password });
      if (alive.current) onAuthenticated(data.customer);
    } catch (error) {
      if (alive.current) setAuthError(error.message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <div
      className={page ? "customer-page-body" : "modal-backdrop"}
      onMouseDown={(event) => !page && event.target === event.currentTarget && onClose()}
    >
      <div className="auth-modal">
        <button className="close-button" aria-label="Đóng đăng nhập" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="auth-mark">
          AL<span>SHOP</span>
        </div>
        <p className="kicker">ANH LỚN SHOP</p>
        <h2>
          {mode === "login" ? "Chào mừng trở lại." : "Tạo tài khoản mới."}
        </h2>
        <p className="auth-subtitle">
          {mode === "login"
            ? "Đăng nhập để quản lý đơn hàng và lưu những món đồ yêu thích."
            : "Tham gia cộng đồng những người mặc đẹp theo cách riêng."}
        </p>
        <form onSubmit={submit}>
          {authError && <p className="auth-account-error" role="alert">{authError}</p>}
          {mode === "register" && (
            <>
              <label>
                HỌ VÀ TÊN
                <input
                  required
                  value={form.fullName}
                  onChange={(event) =>
                    setForm({ ...form, fullName: event.target.value })
                  }
                  placeholder="Nguyễn Minh Khang"
                />
              </label>
              <label>
                SỐ ĐIỆN THOẠI
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="09xx xxx xxx"
                />
              </label>
              <label>
                TUỔI <span className="optional-label">(không bắt buộc)</span>
                <input
                  type="number"
                  min="13"
                  max="120"
                  value={form.age}
                  onChange={(event) =>
                    setForm({ ...form, age: event.target.value })
                  }
                  placeholder="Ví dụ: 22"
                />
              </label>
            </>
          )}
          <label>
            EMAIL
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              placeholder="ban@email.com"
            />
          </label>
          <label>
            MẬT KHẨU
            <input
              type="password"
              required
              minLength="8"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder="Ít nhất 8 ký tự, gồm chữ và số"
            />
          </label>
          <button className="button button-dark" disabled={busy}>
            {busy
              ? "ĐANG XỬ LÝ..."
              : mode === "login"
                ? "ĐĂNG NHẬP →"
                : "TẠO TÀI KHOẢN →"}
          </button>
        </form>
        <div className="auth-switch">
          {mode === 'login' && <button type="button" onClick={onForgot}>Quên mật khẩu?</button>}
          {mode === "login" ? "Chưa có tài khoản?" : "Bạn đã có tài khoản?"}{" "}
          <button
            onClick={() =>
              onModeChange(mode === "login" ? "register" : "login")
            }
          >
            {mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}
          </button>
        </div>
      </div>
    </div>
  );
}




export function WishlistModal({ page = false, items, onClose, onRemove, onOpen }) {
  return <div className={page ? "customer-page-body" : "modal-backdrop"}><div className="wide-modal wishlist-modal"><button className="close-button" aria-label="Đóng yêu thích" onClick={onClose}><X size={20} /></button><p className="kicker">TÀI KHOẢN / YÊU THÍCH</p><h2>Món đồ bạn thích.</h2>{items.length ? <div className="wishlist-grid">{items.map((item) => <article className="wishlist-card" key={item.productId}><button className="wishlist-image" onClick={() => onOpen({ id: item.productId })}><img src={imageSrc(item.imageUrl)} onError={protectImage} alt={item.name} /></button><div className="wishlist-card-content"><b>{item.name}</b><small>{item.category || "HÀNG NAM"}</small><strong>{money(item.salePrice || item.price)}</strong></div><button className="wishlist-remove" onClick={() => onRemove({ id: item.productId })}>Bỏ thích</button></article>)}</div> : <div className="empty-state compact"><Heart size={34} /><h3>Chưa có món đồ yêu thích</h3><p>Chạm vào biểu tượng trái tim để lưu sản phẩm.</p></div>}</div></div>;
}



export function NotificationsModal({ page = false, onClose, onCount }) {
  const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const { data, error: listError, load } = useShopResource(endpoints.notifications);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { if (data) onCount(data.unreadCount || 0); }, [data, onCount]);
  const read = async item => {
    if (lock.current) return;
    if(item?.readAt)return;
    lock.current = true; setBusy(true); setError('');
    try { await api(item ? endpoints.notificationRead(item.id) : endpoints.notificationsReadAll, { method: 'PATCH' }); await load(); }
    catch (cause) { setError(cause.message); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className={page ? 'customer-page-body' : 'modal-backdrop'}><section className="wide-modal notification-modal">
    {!page && <button className="close-button" aria-label="Đóng thông báo" onClick={onClose}><X size={20}/></button>}
    <div className="notification-head"><div><p className="kicker">TÀI KHOẢN / CẬP NHẬT</p><h2>Thông báo</h2></div><button className="back-link" disabled={busy || !data?.unreadCount} onClick={() => read()}>ĐÁNH DẤU ĐÃ ĐỌC</button></div>
    {error && <p role="alert" className="shop-inline-error">{error}</p>}
    {listError ? <div className="shop-inline-error" role="alert">{listError}<button className="button button-light" onClick={load}>Thử lại</button></div> : !data ? <p role="status">Đang tải thông báo...</p> : data.items.length ? <div className="notification-list">{data.items.map(item => <button disabled={busy} className={item.readAt ? 'notification-item read' : 'notification-item'} key={item.id} onClick={() => read(item)}><Bell size={18}/><span><b>{item.title}</b><small>{item.content}</small><em>{date(item.createdAt)}</em></span></button>)}</div> : <div className="empty-state compact"><Bell size={34}/><h3>Chưa có thông báo</h3><p>Các cập nhật về đơn hàng sẽ xuất hiện ở đây.</p></div>}
  </section></div>;
}


export function ProfileModal({ page = false, user, onClose, onUser, onLogout, onOpenOrders, onOpenWishlist, onOpenNotifications, onOpenSurveys, onOpenAddresses, onOpenPassword, onNotice }) {
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    phone: user?.phone || "",
    age: user?.age ?? "",
    preferences: user?.preferences || "",
  });
  const [busy, setBusy] = useState(false);
  const saveLock = useRef(false);
  const save = async (event) => {
    event.preventDefault();
    if (saveLock.current) return;
    saveLock.current = true;
    setBusy(true);
    try {
      const updated = await api(endpoints.profile, {
        method: "PUT",
        body: { ...form, age: form.age === "" ? null : Number(form.age) },
      });
      onUser(updated);
      onNotice("Đã lưu thông tin cá nhân.");
      onClose();
    } catch (error) {
      onNotice(error.message, "error");
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  };
  return (
    <div className={page ? "customer-page-body" : "modal-backdrop"}>
      <div className="profile-modal">
        <button className="close-button" aria-label="Đóng hồ sơ" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="profile-cover">
          <span>{user?.fullName?.slice(0, 1) || "H"}</span>
        </div>
        <p className="kicker">TÀI KHOẢN CỦA BẠN</p>
        <h2>{user?.fullName}</h2>
        <p className="profile-email">{user?.email}</p>
        <form onSubmit={save}>
          <label>
            HỌ VÀ TÊN
            <input
              required
              value={form.fullName}
              onChange={(event) =>
                setForm({ ...form, fullName: event.target.value })
              }
            />
          </label>
          <label>
            SỐ ĐIỆN THOẠI
            <input
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
            />
          </label>
          <label>
            TUỔI <span className="optional-label">(không bắt buộc)</span>
            <input
              type="number"
              min="13"
              max="120"
              value={form.age}
              onChange={(event) =>
                setForm({ ...form, age: event.target.value })
              }
              placeholder="Ví dụ: 22"
            />
          </label>
          <label>
            PHONG CÁCH ƯA THÍCH
            <textarea
              value={form.preferences}
              onChange={(event) =>
                setForm({ ...form, preferences: event.target.value })
              }
              placeholder="Ví dụ: tối giản, màu trung tính, form relaxed..."
            />
          </label>
          <button className="button button-dark" disabled={busy}>
            {busy ? "ĐANG LƯU..." : "LƯU THAY ĐỔI"}
          </button>
        </form>
        <button className="profile-survey-link account-menu-primary" onClick={onOpenOrders}>
          <span>Đơn hàng của tôi</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
        <button className="profile-survey-link" onClick={onOpenWishlist}>
          <span>Sản phẩm yêu thích</span>
          <Heart size={16} aria-hidden="true" />
        </button>
        <button className="profile-survey-link" onClick={onOpenNotifications}>
          <span>Thông báo</span>
          <Bell size={16} aria-hidden="true" />
        </button>
        <button className="profile-survey-link" onClick={onOpenSurveys}>
          <span>Khảo sát phong cách</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
        <button className="profile-survey-link" onClick={onOpenAddresses}>
          <span>Quản lý địa chỉ giao hàng</span>
          <MapPin size={16} aria-hidden="true" />
        </button>
        <button className="profile-survey-link" onClick={onOpenPassword}>
          <span>Đổi hoặc quên mật khẩu</span>
          <KeyRound size={16} aria-hidden="true" />
        </button>
        <button className="logout-link" onClick={onLogout}>
          Đăng xuất khỏi tài khoản
        </button>
      </div>
    </div>
  );
}

export function SurveyModal({ page = false, surveyId, onNavigate, user, onClose, onLogin, onNotice }) {
  const { data: surveys, error: listError, load } = useShopResource(user ? endpoints.mySurveys : endpoints.surveys);
  const [survey, setSurvey] = useState(null);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const completed = survey?.completed || surveys?.find?.(item => String(item.id) === String(surveyId))?.completed;
  useEffect(() => {
    if (!page) return;
    let alive = true;
    setSurvey(null); setAnswers({}); setDetailError('');
    if (!surveyId) { setDetailLoading(false); return; }
    setDetailLoading(true);
    api(endpoints.survey(surveyId)).then(value => { if (alive) setSurvey(value); }).catch(error => { if (alive) setDetailError(error.message); }).finally(() => { if (alive) setDetailLoading(false); });
    return () => { alive = false; };
  }, [surveyId, retry, page]);
  const submit = async (event) => {
    event.preventDefault();
    if (!user) return onLogin();
    if (busy) return;
    if (survey.questions.some(question => question.required && (!answers[question.id] || Array.isArray(answers[question.id]) && !answers[question.id].length))) return onNotice('Vui lòng trả lời các câu hỏi bắt buộc.', 'error');
    setBusy(true);
    try {
      const result = await api(endpoints.surveyResponses(survey.id), {
        method: "POST",
        body: {
          answers: Object.entries(answers).filter(([questionId]) => survey.questions.some(q => q.id === Number(questionId))).map(([questionId, value]) => ({
            questionId: Number(questionId),
            value: Array.isArray(value) ? JSON.stringify(value) : value,
          })),
        },
      });
      onNotice(result.voucher ? `Bạn đã nhận voucher ${result.voucher.code}!` : "Cảm ơn bạn đã chia sẻ gu thời trang!");
      if(result.voucher) onNavigate('/tai-khoan/voucher'); else onClose();
    } catch (error) {
      onNotice(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={page ? "customer-page-body" : "modal-backdrop"}>
      <div className="survey-modal">
        <button className="close-button" aria-label="Đóng khảo sát" onClick={onClose}>
          <X size={20} />
        </button>
        {detailLoading ? <p role="status">Đang tải khảo sát...</p> : detailError ? <div role="alert">{detailError}<button onClick={() => setRetry(value => value + 1)}>Thử lại</button></div> : !survey ? (
          <>
            <p className="kicker">ANH LỚN SHOP / KHẢO SÁT</p>
            <h2>
              Chọn đúng gu,
              <br />
              <i>mặc đúng mình.</i>
            </h2>
            <p>
              Chia sẻ một chút về phong cách của bạn để những gợi ý lần sau trở
              nên riêng tư hơn.
            </p>
            {listError ? <div className="shop-inline-error" role="alert">{listError}<button className="button button-light" onClick={load}>Thử lại</button></div> : surveys === null ? (
              <div className="modal-loading">Đang tải khảo sát...</div>
            ) : surveys.length ? (
              <div className="survey-list">
                {surveys.map((item) => (
                  <button
                    key={item.id}
                    disabled={item.completed}
                    className={item.completed ? "completed" : ""}
                    onClick={() => { if (page) onNavigate(`/khao-sat/${item.id}`); else { setAnswers({}); setSurvey(item); } }}
                  >
                    <span><ArrowUpRight size={18} aria-hidden="true" /></span>
                    <div>
                      <b>{item.title}</b>
                      <small>{item.description}</small>
                      <RewardSummary reward={item.reward}/>
                    </div>
                    <em>{item.completed ? "ĐÃ HOÀN THÀNH" : "BẮT ĐẦU"}</em>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state compact">
                <h3>Chưa có khảo sát mới</h3>
              </div>
            )}
          </>
        ) : (
          <>
            <button className="back-link" onClick={() => page ? onNavigate('/khao-sat') : setSurvey(null)}>
              <ArrowLeft size={15} /> Các khảo sát
            </button>
            <p className="kicker">KHẢO SÁT / {survey.title}</p>
            <h2>{survey.title}</h2>
            <p>{survey.description}</p>
            <RewardSummary reward={survey.reward}/>
            <form className="survey-form" onSubmit={submit}>
              {completed && (
                <div className="survey-completed-note">
                  Bạn đã hoàn thành khảo sát này. Cảm ơn bạn đã chia sẻ cùng Anh Lớn Shop.
                </div>
              )}
              {survey.questions?.map((question) => (
                <fieldset className="survey-question" key={question.id} disabled={busy || completed}>
                  <legend>{question.text} {question.required ? "*" : "(không bắt buộc)"}</legend>
                  {["SINGLE", "SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(question.type) ? surveyOptions(question.optionsJson).map(option => {
                    const multiple = question.type === "MULTIPLE_CHOICE";
                    const selected = Array.isArray(answers[question.id]) ? answers[question.id] : [];
                    return <label className="survey-choice" key={option}>
                      <input type={multiple ? "checkbox" : "radio"} name={`question-${question.id}`} required={!multiple && question.required} checked={multiple ? selected.includes(option) : answers[question.id] === option} onChange={e => setAnswers(current => ({ ...current, [question.id]: multiple ? (e.target.checked ? [...selected, option] : selected.filter(v => v !== option)) : option }))} />
                      <span>{option}</span>
                    </label>;
                  }) : <textarea aria-label={question.text} required={question.required} maxLength={4000} value={answers[question.id] || ""} onChange={e => setAnswers(current => ({ ...current, [question.id]: e.target.value }))} placeholder="Câu trả lời của bạn..." />}
                </fieldset>
              ))}
              <button className="button button-dark" disabled={busy || completed}>
                {busy ? "ĐANG GỬI..." : <>GỬI CÂU TRẢ LỜI <ArrowUpRight size={16} /></>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
