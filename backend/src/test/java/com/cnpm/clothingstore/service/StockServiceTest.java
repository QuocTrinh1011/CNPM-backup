package com.cnpm.clothingstore.service;

import com.cnpm.clothingstore.entity.*;
import com.cnpm.clothingstore.repository.ProductRepository;
import com.cnpm.clothingstore.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StockServiceTest {
    final ProductRepository products=mock(ProductRepository.class);
    final InventoryMovementService movements=mock(InventoryMovementService.class);
    final StockService service=new StockService(products,mock(jakarta.persistence.EntityManager.class),movements);
    Product product(long id) { Product p=new Product(); ReflectionTestUtils.setField(p,"id",id); p.setStock(8); return p; }
    void line(Order o,Product p,int quantity) { OrderItem i=new OrderItem(); i.setProduct(p); i.setQuantity(quantity); o.getItems().add(i); }
    @Test void groupsVariantsLocksInOrderAndReleasesOnlyOnce() {
        Order o=new Order(); ReflectionTestUtils.setField(o,"id",7L); Product a=product(1),b=product(2);
        line(o,b,1);line(o,a,1);line(o,b,2);
        when(products.findLockedById(1L)).thenReturn(Optional.of(a));when(products.findLockedById(2L)).thenReturn(Optional.of(b));
        service.release(o);service.release(o);
        assertEquals(9,a.getStock());assertEquals(11,b.getStock());assertTrue(o.isStockReleased());
        var sequence=inOrder(products);sequence.verify(products).findLockedById(1L);sequence.verify(products).save(a);sequence.verify(products).findLockedById(2L);sequence.verify(products).save(b);sequence.verifyNoMoreInteractions();
    }
    @Test void missingProductDoesNotMarkOrderReleased() {
        Order o=new Order();line(o,product(1),1);
        assertThrows(ApiException.class,()->service.release(o));assertFalse(o.isStockReleased());verify(products,never()).save(any());
    }
}
