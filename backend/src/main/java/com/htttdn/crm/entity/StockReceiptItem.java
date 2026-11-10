package com.htttdn.crm.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "stock_receipt_items")
public class StockReceiptItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "receipt_id", nullable = false)
    private StockReceipt receipt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "product_name", nullable = false, length = 150)
    private String productName;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "unit_cost", nullable = false, precision = 15, scale = 2)
    private BigDecimal unitCost;

    @Column(name = "line_total", nullable = false, precision = 15, scale = 2)
    private BigDecimal lineTotal;

    public StockReceiptItem() {}

    public Long getId() { return id; }
    public StockReceipt getReceipt() { return receipt; }
    public void setReceipt(StockReceipt value) { receipt = value; }
    public Product getProduct() { return product; }
    public void setProduct(Product value) { product = value; }
    public String getProductName() { return productName; }
    public void setProductName(String value) { productName = value; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int value) { quantity = value; }
    public BigDecimal getUnitCost() { return unitCost; }
    public void setUnitCost(BigDecimal value) { unitCost = value; }
    public BigDecimal getLineTotal() { return lineTotal; }
    public void setLineTotal(BigDecimal value) { lineTotal = value; }
}
