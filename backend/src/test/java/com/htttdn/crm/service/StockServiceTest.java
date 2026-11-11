package com.htttdn.crm.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.htttdn.crm.entity.*;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.ProductRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class StockServiceTest {
  final ProductRepository products = mock(ProductRepository.class);
  final StockService service =
      new StockService(products, mock(jakarta.persistence.EntityManager.class));

  Product product(long id) {
    Product p = new Product();
    ReflectionTestUtils.setField(p, "id", id);
    p.setStock(8);
    return p;
  }

  void line(Order o, Product p, int quantity) {
    OrderItem i = new OrderItem();
    i.setProduct(p);
    i.setQuantity(quantity);
    o.getItems().add(i);
  }

  @Test
  void groupsVariantsLocksInOrderAndReleasesOnlyOnce() {
    Order o = new Order();
    Product a = product(1), b = product(2);
    line(o, b, 1);
    line(o, a, 1);
    line(o, b, 2);
    when(products.findLockedById(1L)).thenReturn(Optional.of(a));
    when(products.findLockedById(2L)).thenReturn(Optional.of(b));
    service.release(o);
    service.release(o);
    assertEquals(9, a.getStock());
    assertEquals(11, b.getStock());
    assertTrue(o.isStockReleased());
    var sequence = inOrder(products);
    sequence.verify(products).findLockedById(1L);
    sequence.verify(products).save(a);
    sequence.verify(products).findLockedById(2L);
    sequence.verify(products).save(b);
    sequence.verifyNoMoreInteractions();
  }

  @Test
  void missingProductDoesNotMarkOrderReleased() {
    Order o = new Order();
    line(o, product(1), 1);
    assertThrows(ApiException.class, () -> service.release(o));
    assertFalse(o.isStockReleased());
    verify(products, never()).save(any());
  }
}
