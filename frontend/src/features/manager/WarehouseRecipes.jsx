import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { adminApi, adminEndpoints } from '../../api/manager-api';
import { ListError, PanelLoading, PanelTitle } from './ManagerComponents';
import { InlineNotice } from './ManagerKit';

const blankLine = () => ({ materialId: '', quantityPerProduct: '' });

export default function WarehouseRecipes() {
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [productId, setProductId] = useState('');
  const [recipe, setRecipe] = useState(null);
  const [lines, setLines] = useState([blankLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([
      adminApi(adminEndpoints.products({ page: 0, size: 100, active: true }), { signal: controller.signal }),
      adminApi(adminEndpoints.rawMaterials(), { signal: controller.signal }),
    ]).then(([productPage, rawMaterials]) => {
      if (controller.signal.aborted) return;
      setProducts((productPage?.content || []).filter(product => product.active !== false));
      setMaterials((rawMaterials || []).filter(material => material.active));
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message || 'Không tải được danh mục sản phẩm và nguyên liệu.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (!productId) { setRecipe(null); setLines([blankLine()]); return undefined; }
    const controller = new AbortController();
    setRecipe(null); setError(''); setNotice('');
    adminApi(adminEndpoints.productRecipe(productId), { signal: controller.signal })
      .then(value => {
        if (controller.signal.aborted) return;
        setRecipe(value);
        setLines(value.items?.length ? value.items.map(item => ({ materialId: String(item.materialId), quantityPerProduct: String(item.quantityPerProduct) })) : [blankLine()]);
      })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message || 'Không tải được công thức sản phẩm.'); });
    return () => controller.abort();
  }, [productId, reload]);

  const changeLine = (index, patch) => setLines(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const save = async event => {
    event.preventDefault(); setError(''); setNotice('');
    const ids = lines.map(line => Number(line.materialId));
    if (!productId || !lines.length || lines.some(line => !line.materialId || !Number.isFinite(Number(line.quantityPerProduct)) || Number(line.quantityPerProduct) <= 0)) {
      setError('Chọn ít nhất một nguyên liệu và nhập định mức lớn hơn 0.'); return;
    }
    if (new Set(ids).size !== ids.length) { setError('Mỗi nguyên liệu chỉ xuất hiện một lần trong công thức.'); return; }
    setSaving(true);
    try {
      const updated = await adminApi(adminEndpoints.productRecipe(productId), { method: 'PUT', body: { items: lines.map(line => ({ materialId: Number(line.materialId), quantityPerProduct: Number(line.quantityPerProduct) })) } });
      setRecipe(updated);
      setLines(updated.items.map(item => ({ materialId: String(item.materialId), quantityPerProduct: String(item.quantityPerProduct) })));
      setNotice(`Đã lưu phiên bản công thức ${updated.version}.`);
    } catch (failure) { setError(failure.message || 'Không thể lưu công thức.'); }
    finally { setSaving(false); }
  };

  if (loading) return <PanelLoading />;
  if (error && !productId && !products.length) return <section className="admin-panel warehouse-workspace"><PanelTitle title="Công thức sản phẩm" subtitle="Khai báo định mức nguyên liệu cho từng sản phẩm."/><ListError message={error} onRetry={() => setReload(value => value + 1)} /></section>;
  return <section className="admin-panel warehouse-workspace">
    <PanelTitle title="Công thức sản phẩm" subtitle="Mỗi lần lưu tạo một phiên bản mới; kế hoạch đã lập giữ nguyên công thức đã chốt." />
    <label className="warehouse-select-product">Sản phẩm<select aria-label="Sản phẩm" value={productId} onChange={event => setProductId(event.target.value)}><option value="">Chọn sản phẩm</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
    {error && <ListError message={error} onRetry={() => setReload(value => value + 1)} />}
    {productId && recipe && <form className="warehouse-form-card" onSubmit={save}>
      <div className="warehouse-section-head"><div><h3>{recipe.productName}</h3><p>{recipe.active ? `Phiên bản hiện tại: ${recipe.version}` : 'Chưa có công thức đang hoạt động'}</p></div></div>
      {lines.map((line, index) => <div className="warehouse-recipe-line" key={index}>
        <label>Nguyên liệu<select aria-label={`Nguyên liệu dòng ${index + 1}`} required value={line.materialId} onChange={event => changeLine(index, { materialId: event.target.value })}><option value="">Chọn nguyên liệu</option>{materials.map(material => <option key={material.id} value={material.id}>{material.code} · {material.name} ({material.unit})</option>)}</select></label>
        <label>Định mức / sản phẩm<input aria-label={`Định mức dòng ${index + 1}`} required type="number" min="0.001" step="0.001" value={line.quantityPerProduct} onChange={event => changeLine(index, { quantityPerProduct: event.target.value })}/></label>
        <span>{materials.find(material => String(material.id) === line.materialId)?.unit || ''} / sản phẩm</span>
        <button type="button" className="warehouse-icon-button" aria-label={`Xóa dòng ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines(rows => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={16}/></button>
      </div>)}
      <div className="warehouse-actions"><button type="button" className="admin-action" onClick={() => setLines(rows => [...rows, blankLine()])}><Plus size={15}/> Thêm nguyên liệu</button><button className="admin-primary" disabled={saving || materials.length === 0}>{saving ? 'Đang lưu…' : 'Lưu phiên bản công thức'}</button></div>
    </form>}
    {!productId && <p className="warehouse-empty">Chọn sản phẩm để xem hoặc khai báo công thức nguyên liệu.</p>}
    {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
  </section>;
}
