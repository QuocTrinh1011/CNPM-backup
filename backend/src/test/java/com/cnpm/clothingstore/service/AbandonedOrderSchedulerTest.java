package com.cnpm.clothingstore.service;
import com.cnpm.clothingstore.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import java.util.*;
class AbandonedOrderSchedulerTest {
    final OrderRepository orders=mock(OrderRepository.class);final AbandonedOrderWorker worker=mock(AbandonedOrderWorker.class);
    @Test void disabledByDefaultDoesNoWork(){new AbandonedOrderScheduler(orders,worker,false,24).run();verifyNoInteractions(orders,worker);}
    @Test void advancesCursorPastFailuresAndReviewCases(){
        when(orders.abandonedIds(eq(0L),any(),any())).thenReturn(List.of(3L,4L));when(orders.abandonedIds(eq(4L),any(),any())).thenReturn(List.of(9L));
        when(worker.cancel(eq(3L),any(),any())).thenThrow(new IllegalStateException("test"));when(worker.cancel(eq(4L),any(),any())).thenReturn("NEEDS_REVIEW");when(worker.cancel(eq(9L),any(),any())).thenReturn("CANCELLED");
        new AbandonedOrderScheduler(orders,worker,true,24).run();verify(worker).cancel(eq(9L),any(),eq(Duration.ofHours(24)));verify(orders).abandonedIds(eq(9L),any(),any());
    }
    @Test void rejectsInvalidGracePeriod(){assertThrows(IllegalArgumentException.class,()->new AbandonedOrderScheduler(orders,worker,true,0));}
}
