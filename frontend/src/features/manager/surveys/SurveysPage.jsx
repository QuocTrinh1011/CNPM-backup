import { useManagerReadPause } from "../../../shared/hooks/useManagerResource";
import { SurveyAudience } from "../ManagerTools";
import SurveyRecipientGroup, { groupSurveySource } from "../SurveyRecipientGroup";
import { pageData } from "../manager-data";
import { PanelLoading, Table, ListError, PageControls, PanelTitle } from "../ManagerComponents";
import SurveyRewardEditor, { RewardFields, emptyReward } from "../SurveyRewardEditor";
import React, { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { adminApi, adminEndpoints } from "../../../api/manager-api";
import { ManagerDialog } from "../ManagerKit";
import { useManagerList as useAdminList } from "../../../shared/hooks/useManagerResource";

export function Surveys({ notify, location = '', go }) {
  const source=groupSurveySource(location);
  const [autoOpen]=useState(()=>!!source&&window.history.state?.createGroupedSurvey===true);
  useEffect(()=>{if(autoOpen)window.history.replaceState({...window.history.state,createGroupedSurvey:false},'',window.location.href);},[autoOpen]);
  const [reward,setReward]=useState(emptyReward);
  const [page, setPage] = useState(0);
  const endpoint = useCallback(() => adminEndpoints.surveys({ page }), [page]);
  const { data, load, loading, error } = useAdminList(endpoint);

  const [dialogOpen, setDialogOpen] = useState(autoOpen);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience,setAudience]=useState(()=>autoOpen?{audience:'SELECTED',recipientFilter:source.filter}:{audience:'ALL',customerIds:[]});
  const [groupReady,setGroupReady]=useState(false);
  const newQuestion = () => ({
    key: crypto.randomUUID(),
    text: "",
    type: "SINGLE_CHOICE",
    required: true,
    options: ["", ""],
  });
  const [questions, setQuestions] = useState(() => [newQuestion()]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState(null);
  useManagerReadPause(dialogOpen || busy || !!deleting);

  const openCreate = (grouped = false) => {
    setGroupReady(false);
    setAudience(grouped&&source?{audience:'SELECTED',recipientFilter:source.filter}:{audience:'ALL',customerIds:[]});
    setReward(emptyReward());
    setFormError("");
    setTitle("");
    setDescription("");
    setQuestions([newQuestion()]);
    setDialogOpen(true);
  };

  const closeDialog = useCallback(() => {
    if (busy) return;
    setDialogOpen(false);
    setFormError("");
  }, [busy]);

  const change = (key, patch) =>
    setQuestions((current) =>
      current.map((q) => (q.key === key ? { ...q, ...patch } : q))
    );

  const create = async (event) => {
    event.preventDefault();
    if (busy || (audience.recipientFilter && !groupReady)) return;
    setFormError("");
    const prepared = questions.map((q) => ({
      text: q.text.trim(),
      type: q.type,
      required: q.required,
      optionsJson: JSON.stringify(q.options.map((o) => o.trim())),
    }));
    if (
      !title.trim() ||
      !prepared.length ||
      prepared.some(
        (q) =>
          !q.text ||
          JSON.parse(q.optionsJson).length < 2 ||
          JSON.parse(q.optionsJson).some((o) => !o) ||
          new Set(JSON.parse(q.optionsJson)).size !==
            JSON.parse(q.optionsJson).length ||
          q.optionsJson.length > 4000
      )
    ) {
      setFormError(
        "Nhập tiêu đề, ít nhất một câu hỏi và ít nhất hai phương án khác nhau, không trống cho mỗi câu. Danh sách phương án tối đa 4.000 ký tự."
      );
      return;
    }
    setBusy(true);
    try {
      const saved = await adminApi("/api/manager/surveys", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          questions: prepared,
          ...audience,
          reward,
        },
      });
      setTitle("");
      setDescription("");
      setQuestions([newQuestion()]);
      setDialogOpen(false);
      notify(audience.recipientFilter?`Đã lưu khảo sát nháp cho ${saved.recipientCount} khách hàng. Chưa phát hành.`:"Đã lưu khảo sát nháp.");
      if (page) setPage(0);
      else await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async (survey) => {
    if (busy) return;
    setBusy(true);
    setFormError("");
    try {
      await adminApi(
        adminEndpoints.surveyPublish(survey.id) +
          "?value=" +
          (survey.status !== "PUBLISHED"),
        { method: "PATCH" }
      );
      notify("Đã cập nhật phát hành khảo sát.");
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || !deleting) return;
    setBusy(true);
    setFormError("");
    try {
      await adminApi(adminEndpoints.survey(deleting.id), { method: "DELETE" });
      setDeleting(null);
      notify("Đã xóa khảo sát. Kết quả cũ được giữ lại.");
      if (page > 0 && pageData(data).length === 1) setPage(page - 1);
      else await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-panel">
      <PanelTitle
        title="Khảo sát"
        subtitle="Tạo câu hỏi trắc nghiệm và phát hành cho khách hàng."
      />

      <div className="admin-table-toolbar">
        <span className="admin-toolbar-count">
          {data?.totalElements ?? pageData(data).length} khảo sát
        </span>
        <button
          type="button"
          className="admin-primary admin-btn-with-icon"
          onClick={()=>openCreate()}
        >
          <Plus size={16} /> Tạo khảo sát
        </button>
        {source&&<><button type="button" className="admin-action" onClick={()=>openCreate(true)}>Tạo khảo sát cho nhóm này</button><button type="button" className="admin-action" onClick={()=>go(source.back)}>Quay lại nhóm khách hàng</button></>}
      </div>

      {loading ? (
        <PanelLoading />
      ) : error ? (
        <ListError message={error} onRetry={load} />
      ) : (
        <>
          <Table headers={["Tiêu đề", "Trạng thái", "Thao tác"]}>
            {pageData(data).map((survey) => (
              <tr key={survey.id}>
                <td>
                  <b>{survey.title}</b>
                  <SurveyRewardEditor survey={survey} onSaved={load}/>
                  <small className="admin-table-subline">
                    {survey.questions?.length || 0} câu hỏi
                    {survey.description ? ` • ${survey.description}` : ""}
                  </small>
                </td>
                <td>
                  <span
                    className={`admin-badge ${
                      survey.status === "PUBLISHED" ? "is-active" : ""
                    }`}
                  >
                    {survey.status === "PUBLISHED" ? "Đã phát hành" : "Bản nháp"}
                  </span>
                </td>
                <td>
                  <div className="admin-table-row-actions">
                    <button
                      type="button"
                      className="admin-action"
                      disabled={busy}
                      onClick={() => publish(survey)}
                    >
                      {survey.status === "PUBLISHED"
                        ? "Gỡ phát hành"
                        : "Phát hành"}
                    </button>
                    <button
                      type="button"
                      className="admin-action danger-text"
                      disabled={busy}
                      onClick={() => {
                        setFormError("");
                        setDeleting(survey);
                      }}
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <PageControls
            page={page}
            totalPages={data?.totalPages || 0}
            totalElements={data?.totalElements}
            onPage={setPage}
            disabled={busy}
          />
        </>
      )}

      <ManagerDialog
        open={dialogOpen}
        onClose={closeDialog}
        title="Tạo khảo sát mới"
        size="xl"
        closeLabel="Đóng"
      >
        <form onSubmit={create} className="manager-survey-form">
          <RewardFields value={reward} onChange={setReward} disabled={busy}/>
          {audience.recipientFilter?<SurveyRecipientGroup filter={audience.recipientFilter} onReady={setGroupReady} disabled={busy} onOther={()=>setAudience({audience:'ALL',customerIds:[]})}/>:<SurveyAudience value={audience} onChange={setAudience} disabled={busy}/>}
          {formError && (
            <p role="alert" className="manager-form-error">
              {formError}
            </p>
          )}

          <fieldset disabled={busy} className="admin-survey-fieldset">
            <div className="admin-form-group">
              <label htmlFor="survey-title">Tên khảo sát</label>
              <input
                id="survey-title"
                required
                maxLength={255}
                placeholder="Ví dụ: Khảo sát mức độ hài lòng về chất lượng dịch vụ"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="survey-desc">Mô tả</label>
              <textarea
                id="survey-desc"
                maxLength={4000}
                rows={2}
                placeholder="Mô tả mục đích khảo sát hoặc thông điệp gửi tới khách hàng..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="admin-survey-options-header manager-survey-questions-title">
              DANH SÁCH CÂU HỎI ({questions.length})
            </div>

            {questions.map((q, index) => (
              <div className="admin-survey-card" key={q.key}>
                <div className="admin-survey-card-header">
                  <div className="admin-survey-card-title">
                    <span className="admin-survey-card-badge">
                      #{index + 1}
                    </span>
                    <h3>Câu hỏi {index + 1}</h3>
                  </div>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      className="admin-action danger-text"
                      onClick={() =>
                        setQuestions((current) =>
                          current.filter((item) => item.key !== q.key)
                        )
                      }
                    >
                      Xóa câu hỏi
                    </button>
                  )}
                </div>

                <div className="admin-form-group">
                  <label htmlFor={`survey-q-${index}`}>
                    Nội dung câu hỏi {index + 1}
                  </label>
                  <textarea
                    id={`survey-q-${index}`}
                    required
                    maxLength={1000}
                    rows={2}
                    placeholder="Nhập nội dung câu hỏi..."
                    value={q.text}
                    onChange={(e) =>
                      change(q.key, { text: e.target.value })
                    }
                  />
                </div>

                <div className="admin-survey-controls-row">
                  <div className="admin-survey-type-select">
                    <label
                      htmlFor={`survey-q-type-${index}`}
                      className="manager-survey-type-label"
                    >
                      Kiểu câu hỏi {index + 1}
                    </label>
                    <select
                      id={`survey-q-type-${index}`}
                      value={q.type}
                      onChange={(e) =>
                        change(q.key, { type: e.target.value })
                      }
                    >
                      <option value="SINGLE_CHOICE">
                        Chọn một đáp án (Radio)
                      </option>
                      <option value="MULTIPLE_CHOICE">
                        Chọn nhiều đáp án (Checkbox)
                      </option>
                    </select>
                  </div>

                  <label className="admin-survey-required-label">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) =>
                        change(q.key, { required: e.target.checked })
                      }
                    />
                    <span>Bắt buộc trả lời</span>
                  </label>
                </div>

                <div className="admin-survey-options-group">
                  <span className="admin-survey-options-header">
                    Các phương án trả lời:
                  </span>
                  {q.options.map((option, oi) => (
                    <div className="admin-survey-option-row" key={oi}>
                      <div
                        className={`admin-survey-option-bullet ${
                          q.type === "MULTIPLE_CHOICE" ? "square" : ""
                        }`}
                      />
                      <input
                        aria-label={`Câu ${index + 1}, phương án ${oi + 1}`}
                        required
                        maxLength={4000}
                        placeholder={`Phương án ${oi + 1}`}
                        value={option}
                        onChange={(e) =>
                          change(q.key, {
                            options: q.options.map((v, i) =>
                              i === oi ? e.target.value : v
                            ),
                          })
                        }
                      />
                      <button
                        type="button"
                        className="admin-survey-option-delete"
                        disabled={q.options.length <= 2}
                        title={
                          q.options.length <= 2
                            ? "Cần tối thiểu 2 phương án"
                            : "Xóa phương án này"
                        }
                        onClick={() =>
                          change(q.key, {
                            options: q.options.filter((_, i) => i !== oi),
                          })
                        }
                      >
                        Xóa
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="admin-survey-add-option"
                    onClick={() =>
                      change(q.key, { options: [...q.options, ""] })
                    }
                  >
                    <Plus size={14} /> Thêm phương án
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="admin-survey-add-question-btn"
              onClick={() =>
                setQuestions((current) => [...current, newQuestion()])
              }
            >
              <Plus size={16} /> Thêm câu hỏi mới
            </button>
          </fieldset>

          <div className="admin-dialog-actions">
            <button
              type="button"
              className="admin-dialog-cancel"
              disabled={busy}
              onClick={closeDialog}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="admin-primary"
              disabled={busy || !questions.length || (!!audience.recipientFilter && !groupReady)}
            >
              {busy ? "Đang lưu..." : "Lưu bản nháp"}
            </button>
          </div>
        </form>
      </ManagerDialog>

      <ManagerDialog
        open={!!deleting}
        onClose={() => { if (!busy) setDeleting(null); }}
        title="Xóa khảo sát?"
        actions={
          <>
            <button
              type="button"
              className="admin-dialog-cancel"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Quay lại
            </button>
            <button
              type="button"
              className="admin-primary admin-danger-button"
              disabled={busy}
              onClick={remove}
            >
              {busy ? "Đang xóa..." : "Xác nhận xóa"}
            </button>
          </>
        }
      >
        <p>
          Khảo sát “{deleting?.title}” sẽ bị gỡ khỏi danh sách. Câu hỏi và
          kết quả đã thu thập được giữ lại.
        </p>
        {formError && (
          <p role="alert" className="manager-form-error">
            {formError}
          </p>
        )}
      </ManagerDialog>
    </div>
  );
}
