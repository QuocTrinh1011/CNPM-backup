package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "stock_receipts")
public class StockReceipt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "receipt_code", nullable = false, unique = true, length = 40)
    private String receiptCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @Column(name = "supplier_code", nullable = false, length = 40)
    private String supplierCode;

    @Column(name = "supplier_name", nullable = false, length = 150)
    private String supplierName;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Column(nullable = false, length = 10)
    private String status = "POSTED";

    @Column(name = "total_cost", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalCost = BigDecimal.ZERO;

    @Column(length = 2000)
    private String note;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "receipt", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<StockReceiptItem> items = new ArrayList<>();

    public StockReceipt() {}

    public Long getId() { return id; }
    public String getReceiptCode() { return receiptCode; }
    public void setReceiptCode(String value) { receiptCode = value; }
    public Supplier getSupplier() { return supplier; }
    public void setSupplier(Supplier value) { supplier = value; }
    public String getSupplierCode() { return supplierCode; }
    public void setSupplierCode(String value) { supplierCode = value; }
    public String getSupplierName() { return supplierName; }
    public void setSupplierName(String value) { supplierName = value; }
    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant value) { receivedAt = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public BigDecimal getTotalCost() { return totalCost; }
    public void setTotalCost(BigDecimal value) { totalCost = value; }
    public String getNote() { return note; }
    public void setNote(String value) { note = value; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long value) { createdBy = value; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant value) { createdAt = value; }
    public List<StockReceiptItem> getItems() { return items; }
    public void addItem(StockReceiptItem item) { items.add(item); item.setReceipt(this); }
}
