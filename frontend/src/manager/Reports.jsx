import React, { useCallback, useState } from "react";
import { useManagerFilters } from "../useManagerFilters";
import { useManagerList } from "../useManagerResource";
import { Users as UsersIcon, ClipboardList, DollarSign, TrendingUp } from "lucide-react";
import { ListError, PageControls, PanelTitle, PanelLoading } from "./shared";

const RetentionReport = React.lazy(() => import("../RetentionReport"));
const CashflowReport = React.lazy(() => import("../CashflowReport"));

function ReportBars({ items = [] }) {
  return (
    <div className="admin-report-bars">
      {items.map((item, index) => (
        <div key={index}>
          <div className="admin-report-bar-label">
            <span>{item.label}</span>
            <b>
              {item.count} · {item.percent}%
            </b>
          </div>
          <div className="admin-report-track">
            <div style={{ width: Math.min(100, item.percent) + "%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomerReport() {
  const endpoint = useCallback(() => "/api/manager/reports/customers", []);
  const { data, loading, error, load } = useManagerList(endpoint);
  if (loading) return <PanelLoading />;
  if (error) return <ListError message={error} onRetry={load} />;
  if (!data) return null;
  return (
    <>
      <div className="admin-report-summary">
        {[
          ["Khách hàng", data.total],
          ["Hoạt động", data.active],
          ["Bị khóa", data.locked],
          ["Đã khai báo tuổi", data.knownAge],
          ["Đã khai báo sở thích", data.knownPreferences],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {!data.total && <p>Chưa có dữ liệu khách hàng.</p>}
      <div className="admin-report-columns">
        <section>
          <h3>Phân bố độ tuổi</h3>
          <p>Tỷ lệ trên tổng khách hàng chưa xóa.</p>
          <ReportBars items={data.ages} />
        </section>
        <section>
          <h3>Sở thích đã khai báo</h3>
          <p>
            10 nội dung phổ biến nhất; gom nội dung giống nhau, không tự phân
            loại.
          </p>
          <ReportBars items={data.preferences} />
        </section>
      </div>
    </>
  );
}

function TextAnswerReport({ surveyId, questionId }) {
  const [page, setPage] = useState(0);
  const endpoint = useCallback(
    () =>
      `/api/manager/reports/surveys/${surveyId}/questions/${questionId}/answers?page=${page}`,
    [surveyId, questionId, page]
  );
  const { data, loading, error, load } = useManagerList(endpoint);
  if (loading) return <PanelLoading />;
  if (error) return <ListError message={error} onRetry={load} />;
  return (
    <>
      <ul className="admin-text-answers">
        {(data?.content || []).map((answer, i) => (
          <li key={i}>{answer}</li>
        ))}
      </ul>
      {!data?.content?.length && <p>Chưa có câu trả lời.</p>}
      <PageControls
        page={page}
        totalPages={data?.totalPages || 0}
        totalElements={data?.totalElements}
        onPage={setPage}
      />
    </>
  );
}

function SurveyResult({ id }) {
  const endpoint = useCallback(
    () => `/api/manager/reports/surveys/${id}/results`,
    [id]
  );
  const { data, loading, error, load } = useManagerList(endpoint);
  if (loading) return <PanelLoading />;
  if (error) return <ListError message={error} onRetry={load} />;
  if (!data) return null;
  return (
    <div>
      <h3>{data.title}</h3>
      <p>
        {data.responses} lượt trả lời ·{" "}
        {data.status === "PUBLISHED" ? "Đã phát hành" : "Bản nháp"}
      </p>
      {!data.responses && <p>Khảo sát chưa có người trả lời.</p>}
      {(data.questions || []).map((q, i) => (
        <section className="admin-report-question" key={q.id}>
          <h4>
            {i + 1}. {q.text}
          </h4>
          <p>
            {q.type === "MULTIPLE_CHOICE"
              ? "Chọn nhiều đáp án"
              : ["SINGLE", "SINGLE_CHOICE"].includes(q.type)
              ? "Chọn một đáp án"
              : "Văn bản"}{" "}
            · Đã trả lời: {q.answered} · Bỏ qua: {q.skipped}
          </p>
          {(q.invalid > 0 || q.invalidOptions) && (
            <p className="danger-text">
              Có {q.invalid} bài có đáp án không hợp lệ.
              {q.invalidOptions && " Cấu hình phương án cũ không hợp lệ."}
            </p>
          )}
          {["SINGLE", "SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(q.type) ? (
            <>
              <ReportBars items={q.options} />
              <p>
                Tỷ lệ trên {q.answered} người trả lời câu này.
                {q.type === "MULTIPLE_CHOICE" &&
                  " Tổng tỷ lệ có thể vượt 100%."}
              </p>
            </>
          ) : (
            <TextAnswerReport surveyId={id} questionId={q.id} />
          )}
        </section>
      ))}
    </div>
  );
}

function SurveyReports() {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const endpoint = useCallback(
    () => `/api/manager/reports/surveys?page=${page}`,
    [page]
  );
  const { data, loading, error, load } = useManagerList(endpoint);
  return (
    <>
      {loading ? (
        <PanelLoading />
      ) : error ? (
        <ListError message={error} onRetry={load} />
      ) : (
        <>
          <label className="admin-report-select">
            Chọn khảo sát
            <select
              value={selected || ""}
              onChange={(e) => setSelected(e.target.value || null)}
            >
              <option value="">Chọn khảo sát để xem kết quả</option>
              {(data?.content || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ·{" "}
                  {s.status === "PUBLISHED" ? "Đã phát hành" : "Bản nháp"} ·{" "}
                  {s.responses} lượt
                </option>
              ))}
            </select>
          </label>
          {!data?.content?.length && <p>Chưa có khảo sát.</p>}
          <PageControls
            page={page}
            totalPages={data?.totalPages || 0}
            totalElements={data?.totalElements}
            onPage={(p) => {
              setSelected(null);
              setPage(p);
            }}
          />
        </>
      )}
      {selected && <SurveyResult key={selected} id={selected} />}
    </>
  );
}

export function Reports({go}) {
  const [filters, change] = useManagerFilters({tab:'customers'});
  const tab = ['customers','surveys','retention','cashflow'].includes(filters.tab) ? filters.tab : 'customers';
  const setTab = next => change({tab:next,page:''});
  return (
    <div className="admin-panel">
      <PanelTitle
        title="Báo cáo"
        subtitle={tab==='cashflow'?'Khoản thu và hoàn đã xác nhận theo kỳ.':'Dữ liệu tổng hợp toàn bộ thời gian.'}
      />
      <div className="admin-report-tabs">
        <button
          className={tab === "customers" ? "admin-primary" : "admin-action"}
          aria-pressed={tab === "customers"}
          onClick={() => setTab("customers")}
        >
          <UsersIcon size={15} aria-hidden="true" />
          Khách hàng
        </button>
        <button
          className={tab === "surveys" ? "admin-primary" : "admin-action"}
          aria-pressed={tab === "surveys"}
          onClick={() => setTab("surveys")}
        >
          <ClipboardList size={15} aria-hidden="true" />
          Kết quả khảo sát
        </button>
        <button className={tab === 'retention' ? 'admin-primary' : 'admin-action'} aria-pressed={tab === 'retention'} onClick={() => setTab('retention')}>
          <TrendingUp size={15} aria-hidden="true" />Giữ chân khách hàng
        </button>
        <button className={tab==='cashflow'?'admin-primary':'admin-action'} aria-pressed={tab==='cashflow'} onClick={()=>setTab('cashflow')}><DollarSign size={15} aria-hidden="true"/>Thu – hoàn tiền</button>
      </div>
      {tab === 'cashflow' ? <React.Suspense fallback={<PanelLoading/>}><CashflowReport/></React.Suspense> : tab === 'customers' ? <CustomerReport /> : tab === 'surveys' ? <SurveyReports /> : <React.Suspense fallback={<PanelLoading />}><RetentionReport go={go} /></React.Suspense>}
    </div>
  );
}
