import React from 'react';
import { PanelTitle } from './ManagerComponents';
import './styles/warehouse-workspace.css';

export default function WarehouseReports() {
  return <section className="admin-panel warehouse-workspace"><PanelTitle title="Báo cáo kho" subtitle="Báo cáo biến động và số dư tồn kho theo kỳ."/><p className="warehouse-empty">Màn hình báo cáo kho đang được hoàn thiện.</p></section>;
}
